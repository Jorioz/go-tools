import { motion } from "motion/react";
import type { TrainModel } from "./models/train";
import { darken, lighten } from "./utils/color";

interface TrainProps {
    train: TrainModel;
    x: number;
    y: number;
    angleDeg: number;
    color: string;
    isVisible?: boolean;
    overlapAdjustment?: {
        adjustedX: number;
        adjustedY: number;
        scale: number;
    };
}

export default function Train({
    train,
    x,
    y,
    angleDeg,
    color,
    isVisible = true,
    overlapAdjustment,
}: TrainProps) {
    const darkened_color = darken(color);
    const strokeColor = lighten(color);
    const hasResolvedPosition = Number.isFinite(x) && Number.isFinite(y);
    const adjustedX = overlapAdjustment?.adjustedX ?? x;
    const adjustedY = overlapAdjustment?.adjustedY ?? y;
    const adjustedScale = overlapAdjustment?.scale ?? 1;
    const shouldRenderVisible = isVisible && hasResolvedPosition;

    const visibilityAnimation = shouldRenderVisible
        ? {
              x: adjustedX,
              y: adjustedY,
              rotate: angleDeg,
              scale: adjustedScale,
              opacity: 1,
              transitionEnd: { visibility: "visible" as const },
          }
        : {
              x: adjustedX,
              y: adjustedY,
              rotate: angleDeg,
              scale: 0,
              opacity: 0,
              transitionEnd: { visibility: "hidden" as const },
          };

    const buildPolygonPoints = (
        centerX: number,
        centerY: number,
        width: number,
        height: number,
    ) => {
        const polygonTemplate: Array<[number, number]> = [
            [50, 0],
            [100, 40],
            [100, 100],
            [50, 60],
            [0, 100],
            [0, 40],
        ];

        return polygonTemplate
            .map(([px, py]) => {
                const pointX = centerX - width / 2 + (px / 100) * width;
                const pointY = centerY - height / 2 + (py / 100) * height;
                return `${pointX},${pointY}`;
            })
            .join(" ");
    };

    const markerWidth = 100;
    const markerHeight = (markerWidth * 110) / 100;
    const markerPoints = buildPolygonPoints(0, 0, markerWidth, markerHeight);

    return (
        <motion.g
            className={`group cursor-pointer ${shouldRenderVisible ? "pointer-events-auto" : "pointer-events-none"}`}
            initial={{ x, y, rotate: angleDeg, scale: 0, opacity: 0 }}
            animate={visibilityAnimation}
            transition={{
                type: "spring",
                stiffness: 500,
                damping: 40,
                mass: 0.7,
            }}
            style={{
                transformBox: "fill-box",
                transformOrigin: "center center",
                visibility: "visible",
            }}
        >
            <title>
                {`${train.trip_number} | ${train.prev_stop_code} -> ${train.next_stop_code} | ${Math.round(train.progress * 100)}%`}
            </title>
            <polygon
                points={markerPoints}
                className="stroke-black/25"
                strokeLinejoin="round"
                strokeWidth="70"
            />
            <polygon
                points={markerPoints}
                fill={darkened_color}
                stroke={strokeColor}
                strokeWidth="50"
                strokeLinejoin="round"
                paintOrder="stroke fill"
            />
        </motion.g>
    );
}
