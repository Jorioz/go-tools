import React from "react";
import { LINES, LINE_SPACING, UNION_BASE_Y, X_MULTIPLIER } from "./constants";

export default function UnionStation() {
    const orders = LINES.map((line) => line.order);
    const minOrder = Math.min(...orders);
    const maxOrder = Math.max(...orders);

    const topY = UNION_BASE_Y + minOrder * LINE_SPACING - 50;
    const bottomY = UNION_BASE_Y + maxOrder * LINE_SPACING;
    const height = bottomY - topY + 50;

    const x = 7311 * X_MULTIPLIER;
    const width = 100;

    const rectX = x - width / 2;

    return (
        <g className="group">
            <g
                className="cursor-pointer hover:scale-110 transition-transform duration-200 ease-out pointer-events-auto"
                style={{ transformOrigin: `${x}px ${topY + height / 2}px` }}
            >
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
                    className="pointer-events-none fill-white stroke-0 group-hover:stroke-[20] transition-[stroke-width] duration-200 ease-out"
                    stroke="#fff"
                />
            </g>
            <text
                x={x}
                y={topY - 150}
                textAnchor="middle"
                className="pointer-events-none fill-neutral-300 text-[110px] select-none font-semibold"
            >
                Union
            </text>
        </g>
    );
}
