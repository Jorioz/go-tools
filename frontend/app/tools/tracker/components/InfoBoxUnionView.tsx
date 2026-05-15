import React from "react";
import type { Train } from "~/models/train";
import { LINES } from "../utils/constants";
import { useMapSelectionContext } from "~/context/mapSelectionContext";

function findLineInfo(lineCode: string) {
    const found = LINES.find((l) => l.id === lineCode);
    return found ?? { id: lineCode as any, name: lineCode, color: "#6b7280" };
}

export default function InfoBoxUnionView({ trains }: { trains: Train[] }) {
    const { selectTrain } = useMapSelectionContext();

    return (
        <div>
            <div className="mb-3 flex items-center gap-3">
                <div>
                    <div className="text-lg font-semibold text-neutral-100">Union</div>
                    <div className="text-sm text-neutral-400">Stopped trains at Union</div>
                </div>
            </div>

            <div className="mt-2 text-sm text-neutral-300">
                {trains.length === 0 ? (
                    <div className="text-sm text-neutral-400">No stopped trains</div>
                ) : (
                    <ul className="space-y-2">
                        {trains.map((t) => (
                            <li key={t.tripNumber}>
                                <button
                                    type="button"
                                    onClick={() => selectTrain(t)}
                                    className="w-full text-left rounded bg-neutral-800 px-3 py-2 hover:bg-neutral-700"
                                >
                                    <div className="text-sm text-neutral-100">Trip {t.tripNumber} — {t.lineCode}</div>
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
