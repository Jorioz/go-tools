import { useCallback, useEffect, useRef, useState } from "react";
import { getAllTrains } from "~/services/train.service";
import type { Train, TrainsByLine, LineCode } from "~/models/train";
import { LineCodes } from "~/models/train";

const SERVER_REFRESH_INTERVAL = 15000;

export function useTrains() {
    const [isLoading, setIsLoading] = useState(false);
    const [trainsByLine, setTrainsByLine] = useState<TrainsByLine>();
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [error, setError] = useState<Error | null>(null);

    const lastUpdatedRef = useRef<Date | null>(null);

    const fetchAll = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await getAllTrains();
            if (
                !lastUpdatedRef.current ||
                data.lastUpdated.getTime() !== lastUpdatedRef.current.getTime()
            ) {
                setTrainsByLine(data.lines);
                setLastUpdated(data.lastUpdated);
                lastUpdatedRef.current = data.lastUpdated;
            }
        } catch (err) {
            setError(err as Error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        let timeout: number | undefined;
        const scheduleNextFetch = () => {
            let delay = 0;
            if (lastUpdated) {
                const elapsed = Date.now() - lastUpdated.getTime();
                delay = Math.max(SERVER_REFRESH_INTERVAL - elapsed, 0);
            }
            timeout = window.setTimeout(fetchAll, delay);
        };
        fetchAll();
        scheduleNextFetch();
        return () => {
            if (timeout) clearTimeout(timeout);
        };
    }, [fetchAll]);

    const refresh = useCallback(() => {
        fetchAll();
    }, [fetchAll]);

    return {
        trainsByLine,
        lastUpdated,
        isLoading,
        error,
        refresh,
    };
}
