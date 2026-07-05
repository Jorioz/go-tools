import Station, { type StationRouteStatus } from "./Station";
import Train from "./Train";
import type { Train as TrainModel } from "~/models/train";
import type { StationSelection } from "~/hooks/useMapSelection";
import {
    buildSelectedRoute,
    getTrainSelectionKey,
    type SelectedRoute,
} from "./utils/selectionRoute";
import {
    buildTrainMarkers,
    type Point,
    type StopAnchor,
    type TrainMarker,
} from "./utils/markerGeometry";
import {
    getStopName,
    type LineCode,
    LINE_SPACING,
    UNION_BASE_Y,
} from "./utils/constants";

interface StationData {
    name: string;
    pointIndex: number;
    label: string;
}

interface LineProps {
    lineCode: LineCode;
    stations: StationData[];
    points: number[][];
    color: string;
    strokeClass: string;
    order: number;
    trains?: TrainModel[];
    viewBox?: string;
    extension?: {
        fromPointIndex: number;
        point: [number, number];
        station?: { name: string; label: "top" | "bottom" | "left" | "right" };
    };
    showBase?: boolean; // Polyline + Extension + Station Dots + Labels
    showTrains?: boolean;
    selectedTrain?: TrainModel | null;
    showSelectionOverlay?: boolean;
    onSelectTrain?: (train: TrainModel) => void;
    onSelectStation?: (station: StationSelection) => void;
}

export default function Line({
    lineCode,
    stations,
    points,
    color,
    strokeClass,
    order,
    trains = [],
    viewBox = "0 0 13205 9500",
    extension,
    showBase = true,
    showTrains = true,
    selectedTrain = null,
    showSelectionOverlay = false,
    onSelectTrain,
    onSelectStation,
}: LineProps) {
    const multipliedPoints: Point[] = points.map(([x, y]) => [x, y]);

    const currentUnionY = multipliedPoints[0][1];
    const targetUnionY = UNION_BASE_Y + order * LINE_SPACING;
    const yOffset = targetUnionY - currentUnionY;

    const offsetPoints: Point[] = multipliedPoints.map(([x, y]) => [
        x,
        y + yOffset,
    ]);

    const extensionSegment = extension
        ? (() => {
              const [fromX, fromY] = offsetPoints[extension.fromPointIndex];
              const toX = extension.point[0];
              const toY = extension.point[1] + yOffset;
              return {
                  fromX,
                  fromY,
                  toX,
                  toY,
                  pointsString: `${fromX} ${fromY} ${toX} ${toY}`,
              };
          })()
        : null;

    const extensionStation = extension?.station ?? null;

    const pointsString = offsetPoints.map(([x, y]) => `${x} ${y}`).join(" ");

    const offsetStations = stations.map((station) => {
        const [x, y] = offsetPoints[station.pointIndex];
        return {
            ...station,
            x,
            y,
        };
    });

    const stationCoordByName = new Map<string, [number, number]>();
    const stationIndexByName = new Map<string, number>();
    for (const station of offsetStations) {
        stationCoordByName.set(station.name, [station.x, station.y]);
        stationIndexByName.set(station.name, station.pointIndex);
    }

    const getAnchor = (stopCode: string): StopAnchor => {
        if (stopCode === "UN") {
            const [unionX, unionY] = offsetPoints[0];
            return { coord: [unionX, unionY], pointIndex: 0 };
        }

        if (stopCode === "HA" && extensionSegment) {
            return {
                coord: [extensionSegment.toX, extensionSegment.toY],
                isExtension: true,
            };
        }

        const stopName = getStopName(lineCode, stopCode);
        const stationCoord = stationCoordByName.get(stopName)!;
        const pointIndex = stationIndexByName.get(stopName)!;

        return {
            coord: stationCoord,
            pointIndex,
        };
    };

    const isStationStopped = (train: TrainModel) => {
        if (!train.inMotion) {
            return train.stoppedAtStopCode !== "";
        }
        return train.progress >= 0.96;
    };

    const getDisplayStopCode = (train: TrainModel): string | null => {
        if (!isStationStopped(train)) {
            return null;
        }
        if (!train.inMotion) {
            const stoppedCode = train.stoppedAtStopCode.trim();
            return stoppedCode || null;
        }
        const nextStopCode = train.nextStopCode.trim();
        if (nextStopCode) {
            return nextStopCode;
        }
        const stoppedCode = train.stoppedAtStopCode.trim();
        if (stoppedCode) {
            return stoppedCode;
        }
        const prevStopCode = train.prevStopCode.trim();
        return prevStopCode || null;
    };

    const stoppedStationTrains = trains.filter(isStationStopped);

    const trainsByStoppedStationName = new Map<string, TrainModel[]>();
    for (const train of stoppedStationTrains) {
        const displayStopCode = getDisplayStopCode(train);
        if (!displayStopCode) {
            continue;
        }
        const stopName = getStopName(lineCode, displayStopCode);
        const existing = trainsByStoppedStationName.get(stopName) ?? [];
        existing.push(train);
        trainsByStoppedStationName.set(stopName, existing);
    }

    const trainMarkers: TrainMarker[] = buildTrainMarkers({
        trains,
        points: offsetPoints,
        getAnchor,
        isStationStopped,
        extension,
        extensionSegment,
    });

    const selectedRoute: SelectedRoute | null =
        showSelectionOverlay && selectedTrain?.lineCode === lineCode
            ? buildSelectedRoute(selectedTrain)
            : null;
    const highlightedPointsString = selectedRoute
        ? selectedRoute.highlightedPoints
              .map(([x, y]) => `${x} ${y + yOffset}`)
              .join(" ")
        : null;
    const dimmedPointsString = selectedRoute
        ? selectedRoute.dimmedPoints
              .map(([x, y]) => `${x} ${y + yOffset}`)
              .join(" ")
        : null;

    // When the selected train's trip resolves to a served/skipped stop list,
    // map each on-route station name to its status; stations absent from the
    // list are off-route (behind the train or beyond its destination). When the
    // trip is unresolved (remainingStops === null) the map stays empty and
    // stations render normally, matching the pre-selection look.
    const routeStatusByName = new Map<string, StationRouteStatus>();
    if (selectedRoute?.remainingStops) {
        for (const stop of selectedRoute.remainingStops) {
            routeStatusByName.set(stop.name, stop.status);
        }
    }
    const hasStationStatus = Boolean(selectedRoute?.remainingStops);
    const getStationRouteStatus = (
        name: string,
    ): StationRouteStatus | undefined => {
        if (!hasStationStatus) {
            return undefined;
        }
        return routeStatusByName.get(name) ?? "off-route";
    };

    const stoppedOnTrackColor = "#e0c761";

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox={viewBox}
            className="w-full h-full"
            overflow="visible"
        >
            {showBase && (
                <>
                    <polyline
                        points={pointsString}
                        className={`fill-none ${strokeClass} pointer-events-none ${selectedRoute ? "opacity-20" : ""}`}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    {selectedRoute &&
                        dimmedPointsString &&
                        dimmedPointsString.length > 0 && (
                            <polyline
                                points={dimmedPointsString}
                                className="fill-none pointer-events-none"
                                stroke={color}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="140"
                                opacity="0.35"
                            />
                        )}
                    {selectedRoute && highlightedPointsString && (
                        <polyline
                            points={highlightedPointsString ?? ""}
                            className="fill-none pointer-events-none"
                            stroke={color}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="140"
                            opacity="0.95"
                        />
                    )}
                    {extensionSegment && (
                        <polyline
                            points={extensionSegment.pointsString}
                            className={`fill-none ${strokeClass} pointer-events-none ${selectedRoute ? "opacity-20" : ""}`}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    )}
                    {extensionSegment && extensionStation && (
                        <Station
                            x={extensionSegment.toX}
                            y={extensionSegment.toY}
                            color={color}
                            label={extensionStation.name}
                            labelPosition={extensionStation.label}
                            routeStatus={getStationRouteStatus(
                                extensionStation.name,
                            )}
                            trainsAtStop={
                                trainsByStoppedStationName.get(
                                    extensionStation.name,
                                ) ?? []
                            }
                            onClick={
                                onSelectStation
                                    ? () =>
                                          onSelectStation({
                                              name: extensionStation.name,
                                              lineCode,
                                              x: extensionSegment.toX,
                                              y: extensionSegment.toY,
                                              trainsAtStop:
                                                  trainsByStoppedStationName.get(
                                                      extensionStation.name,
                                                  ) ?? [],
                                          })
                                    : undefined
                            }
                        />
                    )}
                    {offsetStations.map((station, index) => (
                        <Station
                            key={index}
                            x={station.x}
                            y={station.y}
                            color={color}
                            label={station.name}
                            labelPosition={
                                station.label as
                                    | "top"
                                    | "bottom"
                                    | "left"
                                    | "right"
                            }
                            routeStatus={getStationRouteStatus(station.name)}
                            trainsAtStop={
                                trainsByStoppedStationName.get(station.name) ??
                                []
                            }
                            onClick={
                                onSelectStation
                                    ? () =>
                                          onSelectStation({
                                              name: station.name,
                                              lineCode,
                                              x: station.x,
                                              y: station.y,
                                              trainsAtStop:
                                                  trainsByStoppedStationName.get(
                                                      station.name,
                                                  ) ?? [],
                                          })
                                    : undefined
                            }
                        />
                    ))}
                </>
            )}
            {showTrains &&
                trainMarkers.map((marker) => {
                    const isStoppedOnTrack =
                        !marker.train.inMotion &&
                        !isStationStopped(marker.train);
                    const markerColor = isStoppedOnTrack
                        ? stoppedOnTrackColor
                        : color;
                    const isSelectedTrain =
                        selectedTrain !== null &&
                        getTrainSelectionKey(marker.train) ===
                            getTrainSelectionKey(selectedTrain);
                    const isDimmedTrain =
                        selectedTrain !== null && !isSelectedTrain;

                    return (
                        <Train
                            key={marker.train.tripNumber}
                            train={marker.train}
                            x={marker.x}
                            y={marker.y}
                            angleDeg={marker.angleDeg}
                            color={markerColor}
                            isSelected={isSelectedTrain}
                            isDimmed={isDimmedTrain}
                            isVisible={marker.isVisible}
                            overlapAdjustment={marker.overlap}
                            onClick={
                                onSelectTrain
                                    ? () => onSelectTrain(marker.train)
                                    : undefined
                            }
                        />
                    );
                })}
        </svg>
    );
}
