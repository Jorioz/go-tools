import type { Train } from "~/models/train";
import { LINES, getStopName, type LineCode } from "./constants";
import {
    resolveTrainMotionMarker,
    type Point,
    type StopAnchor,
} from "./markerGeometry";

type LineConfig = (typeof LINES)[number];

export type TrainSelectionKey = `${LineCode}:${string}`;

export type SelectedRoute = {
    lineCode: LineCode;
    selectionKey: TrainSelectionKey;
    // Points for the remaining route (current position -> final stop)
    highlightedPoints: Point[];
    highlightedPointsString: string;
    // Points for the completed route (first stop -> current position)
    dimmedPoints: Point[];
    dimmedPointsString: string;
    currentPosition: Point;
};

const samePoint = (a: Point, b: Point) =>
    Math.abs(a[0] - b[0]) < 0.01 && Math.abs(a[1] - b[1]) < 0.01;

const appendPoint = (points: Point[], nextPoint: Point) => {
    const lastPoint = points[points.length - 1];
    if (!lastPoint || !samePoint(lastPoint, nextPoint)) {
        points.push(nextPoint);
    }
};

const findLine = (lineCode: string): LineConfig | null => {
    const normalized = lineCode.trim().toUpperCase() as LineCode;
    const line = LINES.find((entry) => entry.id === normalized);
    return line ?? null;
};

const buildStationLookup = (line: LineConfig) => {
    const lookup = new Map<string, StopAnchor>();

    for (const station of line.stations) {
        lookup.set(station.name, {
            coord: line.points[station.pointIndex] as Point,
            pointIndex: station.pointIndex,
        });
    }

    if (line.extension?.station) {
        lookup.set(line.extension.station.name, {
            coord: line.extension.point,
            pointIndex: line.extension.fromPointIndex,
            isExtension: true,
        });
    }

    return lookup;
};

const getAnchor = (
    line: LineConfig,
    lookup: Map<string, StopAnchor>,
    stopCode: string,
): StopAnchor | null => {
    const normalized = stopCode.trim().toUpperCase();

    // Special-case Union: it's represented as the first point on every line
    if (normalized === "UN") {
        return { coord: line.points[0] as Point, pointIndex: 0 };
    }

    const stopName = getStopName(line.id, stopCode);
    return lookup.get(stopName) ?? null;
};

const collectPathIndices = (
    points: Point[],
    startIndex: number,
    endIndex: number,
    output: Point[],
) => {
    const step = startIndex <= endIndex ? 1 : -1;
    for (
        let index = startIndex;
        step > 0 ? index <= endIndex : index >= endIndex;
        index += step
    ) {
        appendPoint(output, points[index] as Point);
    }
};

const getNextPointIndexOnPath = (
    points: Point[],
    startIndex: number,
    endIndex: number,
    progress: number,
): number | null => {
    const step = startIndex <= endIndex ? 1 : -1;
    const indices: number[] = [];

    for (
        let index = startIndex;
        step > 0 ? index <= endIndex : index >= endIndex;
        index += step
    ) {
        indices.push(index);
    }

    if (indices.length === 0) {
        return null;
    }

    if (indices.length === 1) {
        return indices[0];
    }

    const clampProgress = (value: number): number => {
        if (!Number.isFinite(value)) {
            return 0;
        }

        return Math.max(0, Math.min(1, value));
    };

    const segmentLengths: number[] = [];
    let totalLength = 0;

    for (let i = 0; i < indices.length - 1; i += 1) {
        const [x1, y1] = points[indices[i]];
        const [x2, y2] = points[indices[i + 1]];
        const length = Math.hypot(x2 - x1, y2 - y1);
        segmentLengths.push(length);
        totalLength += length;
    }

    if (totalLength === 0) {
        return indices[indices.length - 1];
    }

    let remainingDistance = totalLength * clampProgress(progress);

    for (let i = 0; i < segmentLengths.length; i += 1) {
        const segmentLength = segmentLengths[i];
        if (remainingDistance <= segmentLength) {
            return indices[i + 1];
        }

        remainingDistance -= segmentLength;
    }

    return indices[indices.length - 1];
};

export const getTrainSelectionKey = (train: Train): TrainSelectionKey =>
    `${train.lineCode}:${train.tripNumber}`;

export const buildSelectedRoute = (
    train: Train | null | undefined,
): SelectedRoute | null => {
    if (!train) {
        return null;
    }

    const line = findLine(train.lineCode);
    if (!line) {
        return null;
    }

    const lookup = buildStationLookup(line);
    const destinationCode = train.lastStopCode.trim();
    const destinationAnchor = getAnchor(line, lookup, destinationCode);
    if (!destinationAnchor) {
        return null;
    }

    const prevAnchor = getAnchor(line, lookup, train.prevStopCode.trim());
    const nextAnchor = getAnchor(line, lookup, train.nextStopCode.trim());

    let currentPosition: Point | null = null;
    let routeStartIndex: number | null = null;

    if (train.inMotion) {
        if (!prevAnchor || !nextAnchor) {
            return null;
        }

        const motionMarker = resolveTrainMotionMarker({
            points: line.points as Point[],
            prevAnchor,
            nextAnchor,
            progress: train.progress,
            extension: line.extension,
            extensionSegment: line.extension
                ? {
                      toX: line.extension.point[0],
                      toY: line.extension.point[1],
                  }
                : null,
        });

        currentPosition = [motionMarker.x, motionMarker.y];

        if (
            prevAnchor.pointIndex === undefined ||
            nextAnchor.pointIndex === undefined
        ) {
            return null;
        }

        routeStartIndex = getNextPointIndexOnPath(
            line.points as Point[],
            prevAnchor.pointIndex,
            nextAnchor.pointIndex,
            train.progress,
        );
    } else {
        const stoppedCode = train.stoppedAtStopCode.trim();
        const stoppedAnchor = getAnchor(line, lookup, stoppedCode);
        if (!stoppedAnchor) {
            return null;
        }

        currentPosition = stoppedAnchor.coord;
        routeStartIndex = stoppedAnchor.pointIndex ?? null;
    }

    if (!currentPosition || routeStartIndex === null) {
        return null;
    }

    const highlightedPoints: Point[] = [currentPosition];

    const destinationIsExtension =
        line.extension?.station?.name === getStopName(line.id, destinationCode);

    if (destinationIsExtension) {
        if (routeStartIndex === line.extension?.fromPointIndex) {
            appendPoint(highlightedPoints, line.extension!.point);
        } else {
            collectPathIndices(
                line.points as Point[],
                routeStartIndex,
                line.extension!.fromPointIndex,
                highlightedPoints,
            );

            appendPoint(highlightedPoints, line.extension!.point);
        }
    } else {
        const destinationIndex = destinationAnchor.pointIndex;

        if (destinationIndex === undefined) {
            return null;
        }

        collectPathIndices(
            line.points as Point[],
            routeStartIndex,
            destinationIndex,
            highlightedPoints,
        );
    }

    // Build dimmed (completed) segment from first stop to current position
    const dimmedPoints: Point[] = [];
    const firstAnchor = getAnchor(line, lookup, train.firstStopCode.trim());
    if (firstAnchor) {
        // Start with the anchor coordinate (handles extension anchors)
        appendPoint(dimmedPoints, firstAnchor.coord);

        if (
            typeof firstAnchor.pointIndex === "number" &&
            typeof routeStartIndex === "number"
        ) {
            collectPathIndices(
                line.points as Point[],
                firstAnchor.pointIndex,
                routeStartIndex,
                dimmedPoints,
            );
        }

        // Ensure we end at the exact current position
        appendPoint(dimmedPoints, currentPosition);
    }

    return {
        lineCode: line.id,
        selectionKey: getTrainSelectionKey(train),
        highlightedPoints,
        highlightedPointsString: highlightedPoints
            .map(([x, y]) => `${x} ${y}`)
            .join(" "),
        dimmedPoints,
        dimmedPointsString: dimmedPoints.map(([x, y]) => `${x} ${y}`).join(" "),
        currentPosition,
    };
};
