import { useCallback, useRef, useState, useEffect } from "react";
import { getAllTrains } from "~/services/train.service";
import type { TrainsByLine } from "~/models/train";

const DEFAULT_INTERVAL = 15;

export function useTrain() {
    const [isLoading, setIsLoading] = useState(false);
    const [trainsByLine, setTrainsByLine] = useState<TrainsByLine>();
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [error, setError] = useState<Error | null>(null);

    const lastUpdatedRef = useRef<Date | null>(null);
    const intervalRef = useRef<number>(DEFAULT_INTERVAL);
    const timerIdRef = useRef<number | null>(null);
    const mountedRef = useRef(false);

    const clearTimer = () => {
        if (timerIdRef.current !== null) {
            window.clearTimeout(timerIdRef.current);
            timerIdRef.current = null;
        }
    };

    const scheduleNext = (
        refreshIntervalSec: number,
        lastUpdatedDate: Date | null,
    ) => {
        clearTimer();
        const now = Date.now();
        const intervalMs = Math.max(1, refreshIntervalSec) * 1000;
        let delay = intervalMs;

        if (lastUpdatedDate) {
            const elapsed = now - lastUpdatedDate.getTime();
            const mod = elapsed % intervalMs;
            delay = mod === 0 ? intervalMs : intervalMs - mod;
            if (delay < 250) delay = intervalMs;
        }

        const maxDelay = 24 * 60 * 60 * 1000;
        if (delay > maxDelay) delay = intervalMs;

        timerIdRef.current = window.setTimeout(() => {
            fetchAll();
        }, delay);
    };

    const fetchAll = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await getAllTrains();
            const returnedInterval = data.refreshInterval ?? DEFAULT_INTERVAL;
            intervalRef.current = returnedInterval;

            const serverLast = data.lastUpdated;
            if (
                !lastUpdatedRef.current ||
                (serverLast &&
                    serverLast.getTime() !== lastUpdatedRef.current.getTime())
            ) {
                setTrainsByLine(data.lines);
                setLastUpdated(serverLast);
                lastUpdatedRef.current = serverLast;
            }

            scheduleNext(returnedInterval, data.lastUpdated);
        } catch (err) {
            setError(err as Error);

            scheduleNext(
                intervalRef.current ?? DEFAULT_INTERVAL,
                lastUpdatedRef.current,
            );
        } finally {
            setIsLoading(false);
        }
    }, []);

    const refresh = useCallback(() => {
        fetchAll();
    }, [fetchAll]);

    useEffect(() => {
        mountedRef.current = true;
        fetchAll();
        return () => {
            mountedRef.current = false;
            clearTimer();
        };
    }, [fetchAll]);

    return {
        trainsByLine,
        lastUpdated,
        isLoading,
        error,
        refresh,
    };
}
