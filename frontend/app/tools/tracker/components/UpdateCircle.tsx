import React, { useEffect, useState } from "react";
import { useTrainContext } from "~/context/trainContext";

const SIZE = 64;
const R = 26;
const STROKE = 4;
const CIRC = 2 * Math.PI * R;

export default function UpdateCircle() {
    const { lastUpdated, refreshInterval, OFFSET } = useTrainContext();
    const [progress, setProgress] = useState(0);
    const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

    useEffect(() => {
        let mounted = true;
        if (!lastUpdated) {
            setProgress(0);
            setSecondsLeft(null);
            return;
        }

        const offsetMs = OFFSET ?? 0;
        const intervalMs = Math.max(1, refreshInterval) * 1000;
        const tick = () => {
            const now = Date.now();
            const last = lastUpdated.getTime();
            const raw = now - last;
            const mod = ((raw % intervalMs) + intervalMs) % intervalMs;
            const p = Math.min(1, Math.max(0, mod / intervalMs));
            const secs = Math.max(0, Math.ceil((intervalMs - mod + offsetMs) / 1000));
            if (!mounted) return;
            setProgress(p);
            setSecondsLeft(secs);
        };

        tick();
        const id = window.setInterval(tick, 100);
        return () => {
            mounted = false;
            window.clearInterval(id);
        };
    }, [lastUpdated, refreshInterval]);

    const dashOffset = CIRC * (1 - progress);

    return (
        <div style={{ width: SIZE, height: SIZE, display: "inline-block" }}>
            <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
                <g transform={`translate(${SIZE / 2}, ${SIZE / 2})`}>
                    <circle
                        r={R}
                        fill="transparent"
                        stroke="#eee"
                        strokeWidth={STROKE}
                    />
                    <circle
                        r={R}
                        fill="transparent"
                        stroke="#0b74de"
                        strokeWidth={STROKE}
                        strokeLinecap="round"
                        strokeDasharray={CIRC}
                        strokeDashoffset={dashOffset}
                        transform="rotate(-90)"
                    />
                    <text
                        x={0}
                        y={0}
                        textAnchor="middle"
                        dominantBaseline="central"
                        style={{ fontSize: 16, fontWeight: 700, fill: "#111" }}
                    >
                        {secondsLeft ?? ""}
                    </text>
                </g>
            </svg>
        </div>
    );
}
