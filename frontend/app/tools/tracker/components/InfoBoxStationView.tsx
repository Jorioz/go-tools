import React from "react";
import type { StationSelection } from "~/hooks/useMapSelection";
import { LINES } from "../utils/constants";
import type { Train } from "~/models/train";
import { useMapSelectionContext } from "~/context/mapSelectionContext";

function findLineInfo(lineCode: string) {
    const found = LINES.find((l) => l.id === lineCode);
    return found ?? { id: lineCode as any, name: lineCode, color: "#6b7280" };
}

export default function InfoBoxStationView({ station }: { station: StationSelection }) {
    const { selectTrain } = useMapSelectionContext();
    const line = findLineInfo(station.lineCode);

    const trains = station.trainsAtStop ?? [];

    return (
        <div>
            <div className="mb-3 flex items-center gap-3">
                <div
                    className="h-8 w-8 flex items-center justify-center text-xs text-neutral-100 font-bold"
                    style={{ backgroundColor: line.color }}
                >
                    {line.id}
                </div>
                <div>
                    <div className="text-sm font-semibold text-neutral-100">{station.name}</div>
                    <div className="text-xs text-neutral-400">{line.name}</div>
                </div>
            </div>

            <div className="mt-2 text-sm text-neutral-300">
                <div className="mb-2 text-neutral-200 font-semibold">Stopped trains</div>
                {trains.length === 0 ? (
                    <div className="text-sm text-neutral-400">No stopped trains</div>
                ) : (
                    <ul className="space-y-2">
                        {trains.map((t: Train) => (
                            <li key={t.tripNumber}>
                                <button
                                    type="button"
                                    onClick={() => selectTrain(t)}
                                    className="w-full text-left rounded bg-neutral-800 px-3 py-2 hover:bg-neutral-700"
                                >
                                    <div className="text-sm text-neutral-100">Trip {t.tripNumber}</div>
                                    <div className="text-xs text-neutral-400">{t.inMotion ? "Moving" : "Stopped"}</div>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
