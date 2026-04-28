import { createContext, useContext, type ReactNode } from "react";
import { useTrain } from "~/hooks/useTrain";

const TrainContext = createContext<ReturnType<typeof useTrain> | null>(null);

export function TrainProvider({ children }: { children: ReactNode }) {
    const data = useTrain();
    return (
        <TrainContext.Provider value={data}>{children}</TrainContext.Provider>
    );
}

export function useTrainContext() {
    const ctx = useContext(TrainContext);
    if (!ctx)
        throw new Error("useTrainContext must be used inside TrainProvider");
    return ctx;
}
