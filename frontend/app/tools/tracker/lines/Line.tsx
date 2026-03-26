import React from "react";
import Station from "../Station";
import {
    LINE_SPACING,
    UNION_BASE_Y,
    X_MULTIPLIER,
    Y_MULTIPLIER,
} from "../constants";

interface StationData {
    name: string;
    pointIndex: number;
    label: string;
}

interface LineProps {
    stations: StationData[];
    points: number[][];
    color: string;
    strokeClass: string;
    order: number;
    viewBox?: string;
}

export default function Line({
    stations,
    points,
    color,
    strokeClass,
    order,
    viewBox = "0 0 13205 9500",
}: LineProps) {
    const multipliedPoints = points.map(([x, y]) => [
        x * X_MULTIPLIER,
        y * Y_MULTIPLIER,
    ]);

    const currentUnionY = multipliedPoints[0][1];
    const targetUnionY = UNION_BASE_Y + order * LINE_SPACING;
    const yOffset = targetUnionY - currentUnionY;

    const offsetPoints = multipliedPoints.map(([x, y]) => [x, y + yOffset]);
    const pointsString = offsetPoints.map(([x, y]) => `${x} ${y}`).join(" ");

    const offsetStations = stations.map((station) => {
        const [x, y] = offsetPoints[station.pointIndex];
        return {
            ...station,
            x,
            y,
        };
    });

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox={viewBox}
            className="w-full h-full"
        >
            <polyline
                points={pointsString}
                className={`fill-none ${strokeClass} pointer-events-none`}
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {offsetStations.map((station, index) => (
                <Station
                    key={index}
                    x={station.x}
                    y={station.y}
                    color={color}
                    label={station.name}
                    labelPosition={
                        station.label as "top" | "bottom" | "left" | "right"
                    }
                />
            ))}
        </svg>
    );
}
