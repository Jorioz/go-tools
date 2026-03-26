import { motion } from "motion/react";
import { useRef, useState, useEffect, useMemo } from "react";
import { HiWrench, HiMapPin } from "react-icons/hi2";
import { TbTrainFilled } from "react-icons/tb";
import { BsFillClockFill } from "react-icons/bs";

function buildOrbitKeyframes(
    rx: number,
    ry: number,
    phaseRad: number,
    sizeReductionPercent: number,
    steps = 120,
) {
    const x: number[] = [];
    const y: number[] = [];
    const opacity: number[] = [];
    const scale: number[] = [];

    for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * Math.PI * 2 + phaseRad;
        const xPos = Math.cos(t) * rx;
        const yPos = Math.sin(t) * ry;

        x.push(xPos);
        y.push(yPos);

        const normalizedX =
            rx === 0 ? 1 : Math.max(0, Math.min(1, 1 - Math.abs(xPos) / rx));

        const normalizedY =
            ry === 0 ? 1 : Math.max(0, Math.min(1, (ry - yPos) / (2 * ry)));

        const combined = normalizedX * normalizedY;
        opacity.push(combined);

        const minScale = 1 - sizeReductionPercent / 100;
        const s = minScale + combined * (1 - minScale);
        scale.push(s);
    }

    return { x, y, opacity, scale };
}

export default function ToolAnimation() {
    const containerRef = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const update = () => {
            const rect = el.getBoundingClientRect();
            setSize({ width: rect.width, height: rect.height });
        };

        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const iconSize = 28;
    const inset = 2;
    const sizeReductionPercent = 30;

    const rx = Math.max(0, size.width / 2 - iconSize / 2 - inset) * 1.4;
    const ry = Math.max(0, size.height / 2 - iconSize / 2 - inset) * 1.5;

    const icons = [
        <HiWrench color="white" size={iconSize} />,
        <TbTrainFilled className="text-lime-300" size={iconSize} />,
        <HiMapPin className="text-teal-300" size={iconSize} />,
        <BsFillClockFill className="text-amber-300" size={iconSize} />,
        <HiWrench color="white" size={iconSize} />,
        <TbTrainFilled className="text-lime-300" size={iconSize} />,
        <HiMapPin className="text-teal-300" size={iconSize} />,
        <BsFillClockFill className="text-amber-300" size={iconSize} />,
    ];

    const keyframes = useMemo(() => {
        return icons.map((_, i) => {
            const phase = (i / icons.length) * Math.PI * 2;
            return buildOrbitKeyframes(rx, ry, phase, sizeReductionPercent);
        });
    }, [rx, ry, sizeReductionPercent]);

    return (
        <div
            ref={containerRef}
            className="absolute inset-0 pointer-events-none -translate-y-4 "
        >
            <div className="absolute inset-0">
                {icons.map((icon, index) => (
                    <motion.div
                        key={index}
                        className="absolute left-1/2 top-1/2"
                        style={{
                            marginLeft: -iconSize / 2,
                            marginTop: -iconSize / 2,
                        }}
                        animate={{
                            x: keyframes[index].x,
                            y: keyframes[index].y,
                            opacity: keyframes[index].opacity,
                            scale: keyframes[index].scale,
                        }}
                        transition={{
                            duration: 20,
                            repeat: Infinity,
                            ease: "linear",
                        }}
                    >
                        {icon}
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
