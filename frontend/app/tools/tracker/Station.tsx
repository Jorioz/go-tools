import { AnimatePresence } from "motion/react";
import React, { useMemo } from "react";
import type { Train } from "~/models/train";
import { darken, lighten } from "./utils/color";
import MiniTrainDot from "./MiniTrainDot";

// When a train is selected, its remaining route is annotated: "served" stops are
// emphasized, "skipped" stops are faded, and "off-route" stations (behind the
// train or beyond its destination) are dimmed to match the dimmed base line.
// undefined means no train is selected on this line -> normal rendering.
export type StationRouteStatus = "served" | "skipped" | "off-route";

interface StationProps {
    x: number;
    y: number;
    color: string;
    label?: string;
    labelPosition?: "top" | "bottom" | "left" | "right";
    isActive?: boolean;
    onClick?: () => void;
    trainsAtStop?: Train[];
    routeStatus?: StationRouteStatus;
}

export default function Station({
    x,
    y,
    color,
    label,
    labelPosition = "top",
    onClick,
    trainsAtStop = [],
    routeStatus,
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

    const labelOpacity =
        routeStatus === "skipped" || routeStatus === "off-route" ? 0.4 : 1;

    return (
        <g className="group pointer-events-auto" onClick={onClick}>
            <g
                className="cursor-pointer transition-transform duration-200 ease-out pointer-events-auto group-hover:scale-250"
                style={{ transformOrigin: `${x}px ${y}px` }}
            >
                {isOccupied && (
                    <title>{`Stopped trains: ${activeTrips}`}</title>
                )}
                <circle cx={x} cy={y} r="80" className="fill-transparent" />
                {routeStatus === undefined ? (
                    <circle
                        cx={x}
                        cy={y}
                        r="30"
                        className="pointer-events-none fill-white stroke-0 group-hover:stroke-20 transition-[stroke-width] duration-200 ease-out"
                        stroke={color}
                    />
                ) : routeStatus === "served" ? (
                    // Served: enlarged white dot with a solid line-coloured ring.
                    <circle
                        cx={x}
                        cy={y}
                        r="46"
                        className="pointer-events-none fill-white"
                        stroke={color}
                        strokeWidth="18"
                    />
                ) : routeStatus === "skipped" ? (
                    // Skipped: small faded white dot, no ring. Must NOT use the
                    // line colour -- it sits on top of the highlighted polyline
                    // (same colour at near-full opacity), where a line-coloured
                    // marker vanishes. White contrasts with all line colours;
                    // the smaller size, lower opacity, and missing ring keep it
                    // de-emphasized vs the served dot, and the bright line
                    // beneath it distinguishes it from off-route dots sitting
                    // on the dimmed line.
                    <circle
                        cx={x}
                        cy={y}
                        r="24"
                        className="pointer-events-none fill-white"
                        opacity="0.55"
                    />
                ) : (
                    // Off-route: dimmed to match the dimmed base polyline.
                    <circle
                        cx={x}
                        cy={y}
                        r="30"
                        className="pointer-events-none fill-white"
                        opacity="0.25"
                    />
                )}
            </g>
            {label && (
                <>
                    <text
                        x={labelCoords.x}
                        y={labelCoords.y}
                        textAnchor={labelCoords.anchor}
                        opacity={labelOpacity}
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
