import { AnimatePresence } from "motion/react";
import React, { useEffect, useMemo, useState } from "react";
import type { Train } from "~/models/train";
import { LINES, LINE_SPACING, UNION_BASE_Y } from "./utils/constants";
import { darken, lighten } from "./utils/color";
import MiniTrainDot from "./MiniTrainDot";

interface UnionStationProps {
    trainsAtStop?: Train[];
    onSelectUnion?: () => void;
}

export default function UnionStation({
    trainsAtStop = [],
    onSelectUnion,
}: UnionStationProps) {
    const [activeTrains, setActiveTrains] =
        useState<Train[]>(trainsAtStop);

    useEffect(() => {
        setActiveTrains(trainsAtStop);
    }, [trainsAtStop]);

    const lineColorByCode = useMemo(
        () => new Map(LINES.map((line) => [line.id, line.color])),
        [],
    );

    const orders = LINES.map((line) => line.order);
    const minOrder = Math.min(...orders);
    const maxOrder = Math.max(...orders);

    const topY = UNION_BASE_Y + minOrder * LINE_SPACING - 50;
    const bottomY = UNION_BASE_Y + maxOrder * LINE_SPACING;
    const height = bottomY - topY + 50;

    const x = 7311;
    const width = 100;

    const rectX = x - width / 2;
    const miniDotRadius = 25;
    const miniDotGap = 25;
    const labelY = topY - 150;
    const miniDotRowY = labelY + 70;
    const miniDotRowWidth =
        activeTrains.length > 0
            ? activeTrains.length * (miniDotRadius * 2) +
              (activeTrains.length - 1) * miniDotGap
            : 0;
    const miniDotRowStartX = x - miniDotRowWidth / 2;
    const activeTrips = activeTrains
        .map((train) => train.tripNumber)
        .join(", ");

    return (
        <g className="group pointer-events-auto" onClick={onSelectUnion}>
            <g
                className="cursor-pointer transition-transform duration-200 ease-out pointer-events-auto group-hover:scale-110"
                style={{ transformOrigin: `${x}px ${topY + height / 2}px` }}
            >
                {activeTrains.length > 0 && (
                    <title>{`Stopped trains: ${activeTrips}`}</title>
                )}
                <rect
                    x={rectX - 50}
                    y={topY - 50}
                    width={width + 100}
                    height={height + 100}
                    className="fill-transparent"
                />
                <rect
                    x={rectX}
                    y={topY}
                    width={width}
                    height={height}
                    rx={width / 2}
                    ry={width / 2}
                    className="pointer-events-none fill-white stroke-0 group-hover:stroke-20 transition-[stroke-width] duration-200 ease-out"
                    stroke="#fff"
                />
            </g>
            <text
                x={x}
                y={labelY}
                textAnchor="middle"
                className="pointer-events-auto cursor-pointer fill-neutral-800 text-[110px] select-none font-semibold"
            >
                Union
            </text>
            <AnimatePresence initial={false}>
                {activeTrains.map((train, index) => {
                    const cx =
                        miniDotRowStartX +
                        index * (miniDotRadius * 2 + miniDotGap) +
                        miniDotRadius;
                    const lineColor =
                        lineColorByCode.get(train.lineCode) ?? "#9ca3af";
                    const miniDotFill = darken(lineColor, 0.35);
                    const miniDotStroke = lighten(lineColor, 0.15);

                    return (
                        <MiniTrainDot
                            key={train.tripNumber}
                            trainTripNumber={train.tripNumber}
                            cx={cx}
                            cy={miniDotRowY}
                            radius={miniDotRadius}
                            fill={miniDotFill}
                            stroke={miniDotStroke}
                        />
                    );
                })}
            </AnimatePresence>
        </g>
    );
}
