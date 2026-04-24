import Station from "./Station";
import Train from "./Train";
import type { TrainModel } from "./models/train";
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
        if (!train.in_motion) {
            return train.stopped_at_stop_code !== "";
        }

        return train.progress >= 0.96;
    };

    const getDisplayStopCode = (train: TrainModel): string | null => {
        if (!isStationStopped(train)) {
            return null;
        }

        if (!train.in_motion) {
            const stoppedCode = train.stopped_at_stop_code.trim();
            return stoppedCode || null;
        }

        const nextStopCode = train.next_stop_code.trim();
        if (nextStopCode) {
            return nextStopCode;
        }

        const stoppedCode = train.stopped_at_stop_code.trim();
        if (stoppedCode) {
            return stoppedCode;
        }

        const prevStopCode = train.prev_stop_code.trim();
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

    const stoppedOnTrackColor = "#e0c761";

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox={viewBox}
            className="w-full h-full"
        >
            {showBase && (
                <>
                    <polyline
                        points={pointsString}
                        className={`fill-none ${strokeClass} pointer-events-none`}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    {extensionSegment && (
                        <polyline
                            points={extensionSegment.pointsString}
                            className={`fill-none ${strokeClass} pointer-events-none`}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    )}
                    {extensionSegment && extension?.station && (
                        <Station
                            x={extensionSegment.toX}
                            y={extensionSegment.toY}
                            color={color}
                            label={extension.station.name}
                            labelPosition={extension.station.label}
                            trainsAtStop={
                                trainsByStoppedStationName.get(
                                    extension.station.name,
                                ) ?? []
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
                            trainsAtStop={
                                trainsByStoppedStationName.get(station.name) ??
                                []
                            }
                        />
                    ))}
                </>
            )}
            {showTrains &&
                trainMarkers.map((marker) => {
                    const isStoppedOnTrack =
                        !marker.train.in_motion &&
                        !isStationStopped(marker.train);
                    const markerColor = isStoppedOnTrack
                        ? stoppedOnTrackColor
                        : color;

                    return (
                        <Train
                            key={marker.train.trip_number}
                            train={marker.train}
                            x={marker.x}
                            y={marker.y}
                            angleDeg={marker.angleDeg}
                            color={markerColor}
                            isVisible={marker.isVisible}
                            overlapAdjustment={marker.overlap}
                        />
                    );
                })}
        </svg>
    );
}
