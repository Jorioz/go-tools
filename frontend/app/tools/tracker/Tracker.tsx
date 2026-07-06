import React from "react";
import MapSimple from "./MapSimple";
import Banner from "../../../components/Banner";
import { useTrainContext } from "~/context/trainContext";
import Timer from "~/tools/tracker/components/Timer";
import Legend from "./components/Legend";
import InfoBox from "./components/InfoBox";
import type { Train } from "~/models/train";
import { useMapSelectionContext } from "~/context/mapSelectionContext";
import { hasOutOfServiceLine } from "./utils/lineStatus";

export default function Tracker() {
    const { trainsByLine, lineStatuses, isLoading, error, refresh, lastUpdated } =
        useTrainContext();
    const { selected, clearSelection } = useMapSelectionContext();
    const isInfoBoxActive = selected !== null;

    // todo: move banner state outside?
    let bannerMessage: string | null = null;
    let bannerType: "error" | "warning" | "info" | "success" | "generic" =
        "generic";
    if (error) {
        if (error.message === "Failed to fetch") {
            bannerMessage = "Live trains are currently unavailable.";
            bannerType = "error";
        } else {
            bannerMessage = error.message;
            bannerType = "warning";
        }
    }

    return (
        <div className="flex justify-center w-screen h-screen overflow-hidden">
            {bannerMessage && (
                <Banner message={bannerMessage} type={bannerType} />
            )}
            <MapSimple
                trainsByLine={trainsByLine ?? {}}
                lineStatuses={lineStatuses}
            />
            <InfoBox />
            <div className="fixed bottom-3 w-full flex justify-between md:justify-start md:gap-3 items-end z-40 px-2">
                <Legend
                    showOutOfService={hasOutOfServiceLine(lineStatuses)}
                />
                <div className="flex items-center justify-center h-full w-fit">
                    <Timer />
                </div>
            </div>
        </div>
    );
}
