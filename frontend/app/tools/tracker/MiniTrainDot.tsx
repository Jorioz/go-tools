import { motion } from "motion/react";

interface MiniTrainDotProps {
    trainTripNumber: string;
    cx: number;
    cy: number;
    radius?: number;
    fill: string;
    stroke: string;
}

export default function MiniTrainDot({
    trainTripNumber,
    cx,
    cy,
    radius = 25,
    fill,
    stroke,
}: MiniTrainDotProps) {
    return (
        <motion.g
            layout
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{
                type: "spring",
                stiffness: 700,
                damping: 35,
                mass: 0.45,
            }}
            style={{
                transformBox: "fill-box",
                transformOrigin: "center center",
            }}
        >
            <title>{`Stopped train ${trainTripNumber}`}</title>
            <circle cx={cx} cy={cy} r={radius + 5} className="fill-black/20" />
            <circle
                cx={cx}
                cy={cy}
                r={radius}
                fill={fill}
                stroke={stroke}
                strokeWidth="15"
            />
        </motion.g>
    );
}
