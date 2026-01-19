import type { Stop } from "../models/gtfs/Stop.js";
import type { GtfsStopRaw } from "../integrations/gtfs/rawTypes.js";
import { mapGtfsStop } from "./mappers/gtfs/stopMapper.js";
import csv from "csv-parser";
import { loadStops } from "../integrations/gtfs/loader.js";

export async function loadStopById(stopId: string): Promise<Stop | null> {
    return new Promise((resolve, reject) => {
        const stream = loadStops().pipe(csv());

        stream
            .on("data", (rawRow: GtfsStopRaw) => {
                const stop = mapGtfsStop(rawRow);
                if (stop.id === stopId) {
                    stream.destroy();
                    resolve(stop);
                }
            })
            .on("end", () => resolve(null))
            .on("error", reject);
    });
}
