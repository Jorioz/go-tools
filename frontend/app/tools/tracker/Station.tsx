import { AnimatePresence } from "motion/react";
import React, { useMemo } from "react";
import type { Train } from "~/models/train";
import { darken, lighten } from "./utils/color";
import MiniTrainDot from "./MiniTrainDot";

interface StationProps {
    x: number;
    y: number;
    color: string;
    label?: string;
    labelPosition?: "top" | "bottom" | "left" | "right";
    isActive?: boolean;
    onClick?: () => void;
    trainsAtStop?: Train[];
}

export default function Station({
    x,
    y,
    color,
    label,
    labelPosition = "top",
    trainsAtStop = [],
}: StationProps) {
    const activeTrains = trainsAtStop;
    const isOccupied = activeTrains.length > 0;
    const activeTrips = useMemo(
        () => activeTrains.map((train) => train.tripNumber).join(", "),
        [activeTrains],
    );

    const getLabelCoordinates = (): {
        x: number;
        y: number;
        anchor: "middle" | "end" | "start";
    } => {
        const offset = 150;
        switch (labelPosition) {
            case "top":
                return { x, y: y - offset, anchor: "middle" as const };
            case "bottom":
                return { x, y: y + offset, anchor: "middle" as const };
            case "left":
                return { x: x - offset, y: y + 40, anchor: "end" as const }; // +40 for vertical centering
            case "right":
                return { x: x + offset, y: y + 40, anchor: "start" as const };
        }
    };

    const labelCoords = getLabelCoordinates();
    const miniDotRadius = 25;
    const miniDotGap = 25;
    const miniDotRowY = labelCoords.y + 52;
    const miniDotRowWidth =
        activeTrains.length > 0
            ? activeTrains.length * (miniDotRadius * 2) +
              (activeTrains.length - 1) * miniDotGap
            : 0;

    const estimatedLabelWidth = (label?.length ?? 0) * 58;
    const labelCenterX = (() => {
        if (labelCoords.anchor === "middle") {
            return labelCoords.x;
        }
        if (labelCoords.anchor === "start") {
            return labelCoords.x + estimatedLabelWidth / 2;
        }
        return labelCoords.x - estimatedLabelWidth / 2;
    })();

    const miniDotRowStartX = labelCenterX - miniDotRowWidth / 2;

    const miniDotFill = darken(color, 0.35);
    const miniDotStroke = lighten(color, 0.15);

    return (
        <g className="group pointer-events-auto">
            <g
                className="cursor-pointer transition-transform duration-200 ease-out pointer-events-auto group-hover:scale-250"
                style={{ transformOrigin: `${x}px ${y}px` }}
            >
                {isOccupied && (
                    <title>{`Stopped trains: ${activeTrips}`}</title>
                )}
                <circle cx={x} cy={y} r="80" className="fill-transparent" />
                <circle
                    cx={x}
                    cy={y}
                    r="30"
                    className="pointer-events-none fill-white stroke-0 group-hover:stroke-20 transition-[stroke-width] duration-200 ease-out"
                    stroke={color}
                />
            </g>
            {label && (
                <>
                    <text
                        x={labelCoords.x}
                        y={labelCoords.y}
                        textAnchor={labelCoords.anchor}
                        className="pointer-events-auto cursor-pointer fill-neutral-800 text-[110px] select-none font-semibold"
                    >
                        {label}
                    </text>

                    <AnimatePresence initial={false}>
                        {activeTrains.map((train, index) => {
                            const cx =
                                miniDotRowStartX +
                                index * (miniDotRadius * 2 + miniDotGap) +
                                miniDotRadius;

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
                </>
            )}
        </g>
    );
}
