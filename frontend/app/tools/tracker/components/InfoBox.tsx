import React from "react";
import { useMapSelectionContext } from "~/context/mapSelectionContext";
import InfoBoxTrainView from "./InfoBoxTrainView";
import InfoBoxStationView from "./InfoBoxStationView";
import InfoBoxUnionView from "./InfoBoxUnionView";

type InfoBoxProps = {};

export default function InfoBox(_: InfoBoxProps) {
    const { selected, clearSelection } = useMapSelectionContext();
    const isActive = selected !== null;

    return (
        <aside
            className={`fixed z-50 h-auto w-screen rounded-t-md border border-neutral-700 bg-neutral-900/95 p-4 text-neutral-100 shadow-xl transition-transform duration-300 ease-in-out md:left-0 md:top-0 md:h-screen md:w-80 md:rounded-none ${
                isActive
                    ? "translate-y-0 md:translate-x-0 md:translate-y-0"
                    : "translate-y-full md:translate-y-0 md:-translate-x-[120%]"
            } ${isActive ? "pointer-events-auto" : "pointer-events-none"} bottom-0 left-0 right-0`}
            aria-hidden={!isActive}
        >
            <div className="mb-3 flex items-center justify-between">
                <h2 className="text-base font-semibold">Info</h2>
                <button
                    type="button"
                    onClick={clearSelection}
                    className="rounded border border-neutral-600 px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-800"
                >
                    Close
                </button>
            </div>

            <div className="text-sm text-neutral-300">
                {selected == null ? (
                    <div className="text-neutral-400">No selection</div>
                ) : selected.kind === "train" ? (
                    <InfoBoxTrainView train={selected.train} />
                ) : selected.kind === "station" ? (
                    <InfoBoxStationView station={selected.station} />
                ) : selected.kind === "union" ? (
                    <InfoBoxUnionView trains={selected.trainsAtStop} />
                ) : (
                    <div />
                )}
            </div>
        </aside>
    );
}
