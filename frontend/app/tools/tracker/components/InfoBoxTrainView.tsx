import React from "react";
import type { Train } from "~/models/train";
import { getStopName, LINES, DIRECTION_LABELS } from "../utils/constants";

function findLineInfo(lineCode: string) {
    const found = LINES.find((l) => l.id === lineCode);
    return found ?? { id: lineCode as any, name: lineCode, color: "#6b7280" };
}

// Slice the trip's ordered stop list down to the stops still ahead of the train.
// The cut point is the train's current position: the station it is stopped at (so
// its current stop leads the list) or, when moving, its next stop. Returns null
// when the list is empty or the position can't be located in it -- the caller then
// falls back to the live next-stop display rather than showing a misleading list.
function remainingStopCodes(train: Train): string[] | null {
    const codes = train.stopCodes ?? [];
    if (codes.length === 0) return null;

    const anchor =
        train.stoppedAtStopCode?.trim() ||
        train.nextStopCode?.trim() ||
        "";
    if (!anchor) return null;

    const index = codes.indexOf(anchor);
    if (index === -1) return null;

    return codes.slice(index);
}

export default function InfoBoxTrainView({ train }: { train: Train }) {
    const line = findLineInfo(train.lineCode);
    const nextStop = train.nextStopCode?.trim() || train.stoppedAtStopCode?.trim() || train.prevStopCode?.trim() || "";
    const nextStopName = nextStop ? getStopName(train.lineCode, nextStop) : "Unknown";
    const directionLabel = DIRECTION_LABELS[train.direction] ?? "Unknown";

    const remaining = remainingStopCodes(train);

    return (
        <div>
            <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div
                        className="h-8 w-8 flex items-center justify-center text-xs text-neutral-100 font-bold"
                        style={{ backgroundColor: line.color }}
                    >
                        {line.id}
                    </div>
                    <div>
                        <div className="text-sm font-semibold text-neutral-100">{line.name}</div>
                        <div className="text-xs text-neutral-400">Trip {train.tripNumber}</div>
                    </div>
                </div>
            </div>

            <div className="space-y-2 text-sm text-neutral-300">
                <div>
                    <strong className="text-neutral-200">Next stop: </strong>
                    {nextStopName}
                </div>
                <div>
                    <strong className="text-neutral-200">Direction: </strong>
                    {directionLabel}
                </div>
                <div>
                    <strong className="text-neutral-200">Status: </strong>
                    {train.inMotion ? "Moving" : "Stopped"}
                </div>
            </div>

            {remaining && remaining.length > 0 && (
                <div className="mt-3 border-t border-neutral-700 pt-3">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                        Remaining stops
                    </div>
                    <ol className="space-y-1 text-sm text-neutral-300">
                        {remaining.map((code, i) => (
                            <li key={`${code}-${i}`} className="flex items-center gap-2">
                                <span
                                    className="h-2 w-2 shrink-0 rounded-full"
                                    style={{ backgroundColor: line.color }}
                                />
                                {getStopName(train.lineCode, code)}
                            </li>
                        ))}
                    </ol>
                </div>
            )}
        </div>
    );
}
