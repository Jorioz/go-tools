import React, { useEffect, useState } from "react";
import MapSimple from "./MapSimple";
import type { LineCode } from "./utils/constants";
import {
    toTrainsByLine,
    type RawTrainModel,
    type TrainModel,
} from "./models/train";

interface TrainsResponse {
    last_updated: string | null;
    lines: Partial<Record<LineCode, RawTrainModel[]>>;
}

export default function Tracker() {
    const [trainsByLine, setTrainsByLine] = useState<
        Partial<Record<LineCode, TrainModel[]>>
    >({});
    const backendBaseUrl =
        (import.meta.env.VITE_BACKEND_URL as string | undefined) ??
        (typeof window !== "undefined"
            ? `http://${window.location.hostname}:8000`
            : "http://localhost:8000");

    useEffect(() => {
        let isMounted = true;

        const fetchTrains = async () => {
            try {
                const response = await fetch(`${backendBaseUrl}/api/trains`);
                if (!response.ok) {
                    return;
                }

                const payload = (await response.json()) as TrainsResponse;
                if (isMounted && payload.lines) {
                    setTrainsByLine(toTrainsByLine(payload.lines));
                }
            } catch {}
        };

        fetchTrains();
        const interval = window.setInterval(fetchTrains, 5000);

        return () => {
            isMounted = false;
            window.clearInterval(interval);
        };
    }, [backendBaseUrl]);

    return (
        <div>
            <MapSimple trainsByLine={trainsByLine} />
        </div>
    );
}
