import React from "react";
import type { Train } from "~/models/train";
import { getStopName, LINES, DIRECTION_LABELS } from "../utils/constants";

function findLineInfo(lineCode: string) {
    const found = LINES.find((l) => l.id === lineCode);
    return found ?? { id: lineCode as any, name: lineCode, color: "#6b7280" };
}

export default function InfoBoxTrainView({ train }: { train: Train }) {
    const line = findLineInfo(train.lineCode);
    const nextStop = train.nextStopCode?.trim() || train.stoppedAtStopCode?.trim() || train.prevStopCode?.trim() || "";
    const nextStopName = nextStop ? getStopName(train.lineCode, nextStop) : "Unknown";
    const directionLabel = DIRECTION_LABELS[train.direction] ?? "Unknown";

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
        </div>
    );
}
