import { createContext, useContext, type ReactNode } from "react";
import { useMapSelection } from "~/hooks/useMapSelection";

const MapSelectionContext = createContext<
    ReturnType<typeof useMapSelection> | null
>(null);

export function MapSelectionProvider({ children }: { children: ReactNode }) {
    const data = useMapSelection();
    return (
        <MapSelectionContext.Provider value={data}>
            {children}
        </MapSelectionContext.Provider>
    );
}

export function useMapSelectionContext() {
    const ctx = useContext(MapSelectionContext);
    if (!ctx)
        throw new Error(
            "useMapSelectionContext must be used inside MapSelectionProvider",
        );
    return ctx;
}
