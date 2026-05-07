import React, { useEffect, useState } from "react";
import MapSimple from "./MapSimple";
import Banner from "../../../components/Banner";
import { useTrainContext } from "~/context/trainContext";
import Timer from "~/tools/tracker/components/Timer";
import Legend from "./components/Legend";

export default function Tracker() {
    const { trainsByLine, isLoading, error, refresh, lastUpdated } =
        useTrainContext();
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
            <MapSimple trainsByLine={trainsByLine ?? {}} />
            <div className="fixed bottom-3 w-full flex justify-between items-end z-40 px-2">
                <Legend />
                <div className="flex items-center justify-center h-full w-fit">
                    <Timer />
                </div>
            </div>
        </div>
    );
}
