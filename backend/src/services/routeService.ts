import type { Route } from "../models/gtfs/Route.js";
import { loadRoutes } from "../integrations/gtfs/loader.js";
import { mapGtfsRoute } from "./mappers/gtfs/routeMapper.js";
import csv from "csv-parser";
import type { GtfsRouteRaw } from "../integrations/gtfs/rawTypes.js";

export async function loadAllRoutes(): Promise<Route[]> {
    return new Promise((resolve, reject) => {
        const results: Route[] = [];

        loadRoutes()
            .pipe(csv())
            .on("data", (rawRow: GtfsRouteRaw) => {
                const route = mapGtfsRoute(rawRow);
                results.push(route);
            })
            .on("end", () => resolve(results))
            .on("error", reject);
    });
}

export async function loadRouteByShortName(
    shortName: string,
): Promise<Route | null> {
    return new Promise((resolve, reject) => {
        const stream = loadRoutes().pipe(csv());

        stream
            .on("data", (rawRow: GtfsRouteRaw) => {
                const route = mapGtfsRoute(rawRow);
                if (route.shortName === shortName) {
                    stream.destroy();
                    resolve(route);
                }
            })
            .on("end", () => resolve(null))
            .on("error", reject);
    });
}
