import { useCallback, useState } from "react";
import type { Train } from "~/models/train";

export type StationSelection = {
    name: string;
    lineCode: string;
    x: number;
    y: number;
    trainsAtStop: Train[];
};

export type SelectedEntity =
    | { kind: "train"; train: Train }
    | { kind: "station"; station: StationSelection }
    | { kind: "union"; trainsAtStop: Train[] };

export function useMapSelection() {
    const [selected, setSelected] = useState<SelectedEntity | null>(null);

    const selectTrain = useCallback((train: Train) => {
        setSelected({ kind: "train", train });
    }, []);

    const selectStation = useCallback((station: StationSelection) => {
        setSelected({ kind: "station", station });
    }, []);

    const selectUnion = useCallback((trainsAtStop: Train[]) => {
        setSelected({ kind: "union", trainsAtStop });
    }, []);

    const setSelectedEntity = useCallback((next: SelectedEntity | null) => {
        setSelected(next);
    }, []);

    const clearSelection = useCallback(() => setSelected(null), []);

    const selectedKind = selected?.kind ?? null;

    return {
        selected,
        selectedKind,
        selectTrain,
        selectStation,
        selectUnion,
        setSelectedEntity,
        clearSelection,
    };
}
