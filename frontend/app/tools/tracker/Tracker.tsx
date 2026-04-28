import React, { useEffect, useState } from "react";
import MapSimple from "./MapSimple";
import Banner from "../../../components/Banner";
import { useTrain } from "~/hooks/useTrain";

export default function Tracker() {
    const { trainsByLine, isLoading, error, refresh, lastUpdated } = useTrain();
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
        <div>
            {bannerMessage && (
                <Banner message={bannerMessage} type={bannerType} />
            )}
            <MapSimple trainsByLine={trainsByLine ?? {}} />
        </div>
    );
}
