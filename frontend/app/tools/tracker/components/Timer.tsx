import React, { useState, useEffect } from "react";
import { useTrainContext } from "~/context/trainContext";

export default function Timer() {
    const { lastUpdated, refreshInterval, OFFSET } = useTrainContext();
    const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
    useEffect(() => {
        let rafId = 0;
        if (!lastUpdated) {
            setSecondsLeft(null);
            return;
        }

        const intervalMs = Math.max(1, refreshInterval) * 1000;
        const tick = () => {
            const now = Date.now();
            const last = lastUpdated.getTime();
            const raw = now - last;
            const mod = ((raw % intervalMs) + intervalMs) % intervalMs;
            const remainingMs = Math.max(0, intervalMs - mod);
            const nextSecondsLeft = Math.max(0, Math.ceil(remainingMs / 1000));

            setSecondsLeft(nextSecondsLeft);
            rafId = window.requestAnimationFrame(tick);
        };

        rafId = window.requestAnimationFrame(tick);
        return () => {
            window.cancelAnimationFrame(rafId);
        };
    }, [lastUpdated, refreshInterval, OFFSET]);
    const displayValue = secondsLeft ?? "--";

    return (
        <div className="rounded-full h-12 w-12 bg-neutral-800 flex items-center justify-center shadow-md">
            <span className="font-bold text-2xl text-white">
                {displayValue}
            </span>
        </div>
    );
}
