import type { Route } from "../models/gtfs/Route.js";
import { loadRoutes } from "../integrations/gtfs/loader.js";
import { mapGtfsRoute } from "./mappers/gtfs/routeMapper.js";
import csv from "csv-parser";

export async function loadAllRoutes(): Promise<Route[]> {
    return new Promise((resolve, reject) => {
        const results: Route[] = [];

        loadRoutes()
            .pipe(csv())
            .on("data", (rawRow) => {
                const route = mapGtfsRoute(rawRow);
                results.push(route);
            })
            .on("end", () => resolve(results))
            .on("error", reject);
    });
}
