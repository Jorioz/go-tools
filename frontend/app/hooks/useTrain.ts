import { useCallback, useRef, useState } from "react";
import { getAllTrains } from "~/services/train.service";
import type { TrainsByLine } from "~/models/train";

export function useTrain() {
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

    // No automatic scheduling: consumers call `refresh()` when they want new data.
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
