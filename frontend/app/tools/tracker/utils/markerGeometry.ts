import type { Train } from "~/models/train";

export type Point = [number, number];

export type StopAnchor = {
    coord: Point;
    pointIndex?: number;
    isExtension?: boolean;
};

export type LineExtension = {
    fromPointIndex: number;
};

export type ExtensionSegment = {
    toX: number;
    toY: number;
};

export type MarkerMotion = {
    x: number;
    y: number;
    angleDeg: number;
};

export type TrainMarkerOverlapAdjustment = {
    adjustedX: number;
    adjustedY: number;
    scale: number;
};

export type TrainMarker = {
    train: Train;
    x: number;
    y: number;
    angleDeg: number;
    isVisible: boolean;
    overlap?: TrainMarkerOverlapAdjustment;
};

const OVERLAP_DISTANCE_THRESHOLD = 100;
const OVERLAP_SCALE = 0.5;
const OVERLAP_OFFSET_MAGNITUDE = 40;

const clampProgress = (progress: number): number => {
    if (!Number.isFinite(progress)) {
        return 0;
    }

    return Math.max(0, Math.min(1, progress));
};

export const computeMarkerAngle = (dx: number, dy: number): number => {
    if (
        !Number.isFinite(dx) ||
        !Number.isFinite(dy) ||
        (dx === 0 && dy === 0)
    ) {
        return 0;
    }

    return (Math.atan2(dy, dx) * 180) / Math.PI + 90;
};

export const interpolateOnPointPath = (
    points: Point[],
    startIndex: number,
    endIndex: number,
    progress: number,
): { x: number; y: number; dx: number; dy: number } => {
    const step = startIndex <= endIndex ? 1 : -1;
    const indices: number[] = [];

    for (
        let i = startIndex;
        step > 0 ? i <= endIndex : i >= endIndex;
        i += step
    ) {
        indices.push(i);
    }

    if (indices.length <= 1) {
        const [x, y] = points[startIndex];
        return { x, y, dx: 0, dy: 0 };
    }

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
        const [x, y] = points[startIndex];
        return { x, y, dx: 0, dy: 0 };
    }

    let remainingDistance = totalLength * clampProgress(progress);

    for (let i = 0; i < segmentLengths.length; i += 1) {
        const segmentLength = segmentLengths[i];
        const [x1, y1] = points[indices[i]];
        const [x2, y2] = points[indices[i + 1]];

        if (remainingDistance <= segmentLength) {
            const t =
                segmentLength === 0 ? 0 : remainingDistance / segmentLength;
            return {
                x: x1 + (x2 - x1) * t,
                y: y1 + (y2 - y1) * t,
                dx: x2 - x1,
                dy: y2 - y1,
            };
        }

        remainingDistance -= segmentLength;
    }

    const [x, y] = points[endIndex];
    const [prevX, prevY] = points[indices[indices.length - 2]];
    return { x, y, dx: x - prevX, dy: y - prevY };
};

export const resolveTrainMotionMarker = ({
    points,
    prevAnchor,
    nextAnchor,
    progress,
    extension,
    extensionSegment,
}: {
    points: Point[];
    prevAnchor: StopAnchor;
    nextAnchor: StopAnchor;
    progress: number;
    extension?: LineExtension;
    extensionSegment?: ExtensionSegment | null;
}): MarkerMotion => {
    const boundedProgress = clampProgress(progress);

    if (
        prevAnchor.pointIndex !== undefined &&
        nextAnchor.pointIndex !== undefined
    ) {
        const segment = interpolateOnPointPath(
            points,
            prevAnchor.pointIndex,
            nextAnchor.pointIndex,
            boundedProgress,
        );

        return {
            x: segment.x,
            y: segment.y,
            angleDeg: computeMarkerAngle(segment.dx, segment.dy),
        };
    }

    if (
        extension &&
        extensionSegment &&
        prevAnchor.pointIndex !== undefined &&
        nextAnchor.isExtension &&
        prevAnchor.pointIndex === extension.fromPointIndex
    ) {
        const [x1, y1] = points[extension.fromPointIndex];
        const x = x1 + (extensionSegment.toX - x1) * boundedProgress;
        const y = y1 + (extensionSegment.toY - y1) * boundedProgress;

        return {
            x,
            y,
            angleDeg: computeMarkerAngle(
                extensionSegment.toX - x1,
                extensionSegment.toY - y1,
            ),
        };
    }

    if (
        extension &&
        extensionSegment &&
        prevAnchor.isExtension &&
        nextAnchor.pointIndex !== undefined &&
        nextAnchor.pointIndex === extension.fromPointIndex
    ) {
        const [x2, y2] = points[extension.fromPointIndex];
        const x =
            extensionSegment.toX +
            (x2 - extensionSegment.toX) * boundedProgress;
        const y =
            extensionSegment.toY +
            (y2 - extensionSegment.toY) * boundedProgress;

        return {
            x,
            y,
            angleDeg: computeMarkerAngle(
                x2 - extensionSegment.toX,
                y2 - extensionSegment.toY,
            ),
        };
    }

    const x =
        prevAnchor.coord[0] +
        (nextAnchor.coord[0] - prevAnchor.coord[0]) * boundedProgress;
    const y =
        prevAnchor.coord[1] +
        (nextAnchor.coord[1] - prevAnchor.coord[1]) * boundedProgress;

    return {
        x,
        y,
        angleDeg: computeMarkerAngle(
            nextAnchor.coord[0] - prevAnchor.coord[0],
            nextAnchor.coord[1] - prevAnchor.coord[1],
        ),
    };
};

export const resolveStoppedTrainAngle = ({
    points,
    prevAnchor,
    nextAnchor,
    stoppedAnchor,
    progress,
    direction,
    extension,
    extensionSegment,
}: {
    points: Point[];
    prevAnchor: StopAnchor;
    nextAnchor: StopAnchor;
    stoppedAnchor: StopAnchor;
    progress: number;
    direction: number;
    extension?: LineExtension;
    extensionSegment?: ExtensionSegment | null;
}): number => {
    if (
        prevAnchor.pointIndex !== undefined &&
        nextAnchor.pointIndex !== undefined &&
        prevAnchor.pointIndex !== nextAnchor.pointIndex
    ) {
        const segment = interpolateOnPointPath(
            points,
            prevAnchor.pointIndex,
            nextAnchor.pointIndex,
            progress,
        );
        return computeMarkerAngle(segment.dx, segment.dy);
    }

    if (
        extension &&
        extensionSegment &&
        prevAnchor.pointIndex !== undefined &&
        nextAnchor.isExtension &&
        prevAnchor.pointIndex === extension.fromPointIndex
    ) {
        const [x1, y1] = points[extension.fromPointIndex];
        return computeMarkerAngle(
            extensionSegment.toX - x1,
            extensionSegment.toY - y1,
        );
    }

    if (
        extension &&
        extensionSegment &&
        prevAnchor.isExtension &&
        nextAnchor.pointIndex !== undefined &&
        nextAnchor.pointIndex === extension.fromPointIndex
    ) {
        const [x2, y2] = points[extension.fromPointIndex];
        return computeMarkerAngle(
            x2 - extensionSegment.toX,
            y2 - extensionSegment.toY,
        );
    }

    const directDx = nextAnchor.coord[0] - prevAnchor.coord[0];
    const directDy = nextAnchor.coord[1] - prevAnchor.coord[1];
    const directAngle = computeMarkerAngle(directDx, directDy);
    if (directAngle !== 0) {
        return directAngle;
    }

    if (stoppedAnchor.pointIndex !== undefined) {
        const index = stoppedAnchor.pointIndex;
        const backwardIndex = Math.max(0, index - 1);
        const forwardIndex = Math.min(points.length - 1, index + 1);

        if (forwardIndex !== backwardIndex) {
            const [backX, backY] = points[backwardIndex];
            const [forwardX, forwardY] = points[forwardIndex];
            const movingForward = direction === 0;

            return movingForward
                ? computeMarkerAngle(forwardX - backX, forwardY - backY)
                : computeMarkerAngle(backX - forwardX, backY - forwardY);
        }
    }

    return 0;
};

const getOverlapDistance = (a: TrainMarker, b: TrainMarker): number =>
    Math.hypot(a.x - b.x, a.y - b.y);

const buildOverlapGroups = (markers: TrainMarker[]): TrainMarker[][] => {
    const adjacency = new Map<TrainMarker, Set<TrainMarker>>();
    const visibleMarkers = markers.filter((marker) => marker.isVisible);

    for (let i = 0; i < visibleMarkers.length; i += 1) {
        const markerA = visibleMarkers[i];
        for (let j = i + 1; j < visibleMarkers.length; j += 1) {
            const markerB = visibleMarkers[j];
            if (
                getOverlapDistance(markerA, markerB) <
                OVERLAP_DISTANCE_THRESHOLD
            ) {
                if (!adjacency.has(markerA)) {
                    adjacency.set(markerA, new Set());
                }
                if (!adjacency.has(markerB)) {
                    adjacency.set(markerB, new Set());
                }
                adjacency.get(markerA)!.add(markerB);
                adjacency.get(markerB)!.add(markerA);
            }
        }
    }

    const visited = new Set<TrainMarker>();
    const groups: TrainMarker[][] = [];

    for (const marker of markers) {
        if (visited.has(marker)) {
            continue;
        }

        const component: TrainMarker[] = [];
        const queue: TrainMarker[] = [marker];

        while (queue.length > 0) {
            const current = queue.shift()!;
            if (visited.has(current)) {
                continue;
            }
            visited.add(current);
            component.push(current);

            const neighbors = adjacency.get(current);
            if (!neighbors) {
                continue;
            }

            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    queue.push(neighbor);
                }
            }
        }

        if (component.length > 1) {
            groups.push(component);
        }
    }

    return groups;
};

const getDirectionSign = (direction: number): number =>
    direction === 0 ? 1 : -1;

const getPerpendicularOffset = (
    angleDeg: number,
    direction: number,
    index: number,
): { x: number; y: number } => {
    const normalizedAngle = ((angleDeg % 360) + 360) % 360;
    let baseX = Math.cos((normalizedAngle * Math.PI) / 180);
    let baseY = Math.sin((normalizedAngle * Math.PI) / 180);

    if (baseX < 0 || (baseX === 0 && baseY < 0)) {
        baseX = -baseX;
        baseY = -baseY;
    }

    const distance = OVERLAP_OFFSET_MAGNITUDE * index;
    const sign = getDirectionSign(direction);

    return {
        x: baseX * distance * sign,
        y: baseY * distance * sign,
    };
};

const applyOverlapAdjustments = (markers: TrainMarker[]): TrainMarker[] => {
    const groups = buildOverlapGroups(markers);
    const adjusted = new Map<TrainMarker, TrainMarkerOverlapAdjustment>();

    for (const group of groups) {
        const directionBuckets: {
            [key: number]: TrainMarker[];
        } = {};

        for (const marker of group) {
            const direction = marker.train.direction;
            if (!directionBuckets[direction]) {
                directionBuckets[direction] = [];
            }
            directionBuckets[direction].push(marker);
        }

        for (const directionKey of Object.keys(directionBuckets)) {
            const bucket = directionBuckets[Number(directionKey)];
            bucket.forEach((marker, index) => {
                const { x, y } = getPerpendicularOffset(
                    marker.angleDeg,
                    marker.train.direction,
                    index + 1,
                );
                adjusted.set(marker, {
                    adjustedX: marker.x + x,
                    adjustedY: marker.y + y,
                    scale: OVERLAP_SCALE,
                });
            });
        }
    }

    return markers.map((marker) => ({
        ...marker,
        overlap: adjusted.get(marker),
    }));
};

export const buildTrainMarkers = ({
    trains,
    points,
    getAnchor,
    isStationStopped,
    extension,
    extensionSegment,
}: {
    trains: Train[];
    points: Point[];
    getAnchor: (stopCode: string) => StopAnchor;
    isStationStopped: (train: Train) => boolean;
    extension?: LineExtension;
    extensionSegment?: ExtensionSegment | null;
}): TrainMarker[] => {
    const markers = trains
        .map<TrainMarker | null>((train) => {
            const prevAnchor = getAnchor(train.prevStopCode);
            const nextAnchor = getAnchor(train.nextStopCode);
            const boundedProgress = clampProgress(train.progress);
            const isVisible = !isStationStopped(train);

            if (!train.inMotion) {
                const stoppedCode = train.stoppedAtStopCode.trim();
                if (!stoppedCode) {
                    return null;
                }
                const stoppedAnchor = getAnchor(stoppedCode);
                return {
                    train,
                    x: stoppedAnchor.coord[0],
                    y: stoppedAnchor.coord[1],
                    angleDeg: resolveStoppedTrainAngle({
                        points,
                        prevAnchor,
                        nextAnchor,
                        stoppedAnchor,
                        progress: boundedProgress,
                        direction: train.direction,
                        extension,
                        extensionSegment,
                    }),
                    isVisible,
                };
            }

            const markerMotion = resolveTrainMotionMarker({
                points,
                prevAnchor,
                nextAnchor,
                progress: boundedProgress,
                extension,
                extensionSegment,
            });

            return {
                train,
                x: markerMotion.x,
                y: markerMotion.y,
                angleDeg: markerMotion.angleDeg,
                isVisible,
            };
        })
        .filter((marker): marker is TrainMarker => marker !== null);

    return applyOverlapAdjustments(markers);
};
