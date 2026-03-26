import React from "react";

interface StationProps {
    x: number;
    y: number;
    color: string;
    label?: string;
    labelPosition?: "top" | "bottom" | "left" | "right";
    isActive?: boolean;
    onClick?: () => void;
}

export default function Station({
    x,
    y,
    color,
    label,
    labelPosition = "top",
}: StationProps) {
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

    return (
        <g className="group">
            <g
                className="cursor-pointer hover:scale-250 transition-transform duration-200 ease-out pointer-events-auto"
                style={{ transformOrigin: `${x}px ${y}px` }}
            >
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
                <text
                    x={labelCoords.x}
                    y={labelCoords.y}
                    textAnchor={labelCoords.anchor}
                    className="pointer-events-none fill-neutral-300 text-[110px] select-none font-semibold"
                >
                    {label}
                </text>
            )}
        </g>
    );
}
