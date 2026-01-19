/*
1. Function should only take shortName in as a param (Route Type)
2. This will lookup orderedStops to get the associated array
3. This array contains stop_id (Stops Type) for each stop in the route.
4. Need to call on Stop mapper to return array of completed Stop Types
5.
*/

import { RoutePackage } from "../models/RoutePackage.js";
import { loadRouteByShortName } from "../services/routeService.js";
import orderedStops from "../../data/orderedStops.json" with { type: "json" };
import { loadStopById } from "../services/stopService.js";
import type { Stop } from "../models/gtfs/Stop.js";
import { loadShapesForRoute } from "../services/shapeService.js";
import { DirectionType } from "../models/Trip.js";

type OrderedStopsData = Record<string, string[]>;

export async function buildRoutePackage(shortName: string) {
    const route = await loadRouteByShortName(shortName);
    if (!route) throw new Error(`Route not found for shortName ${shortName}`);
    console.log(`Got Route: ${route.shortName}`);

    const stopIds = (orderedStops as OrderedStopsData)[route.shortName];
    if (!stopIds)
        throw new Error(`No stops found for route ${route.shortName}`);

    console.log(`Got stop ids: ${stopIds}`);

    const stops: Stop[] = [];
    for (const stopId of stopIds) {
        const stop = await loadStopById(stopId);
        if (stop) {
            console.log(`Success with stop id: ${stop.id}`);
            stops.push(stop);
        } else {
            console.warn(`Stop not found adding to array: ${stop}`);
        }
    }

    const terminusStop = stops[0];
    if (!terminusStop) throw new Error(`Got no terminus stop.`);
    const outboundShapes = await loadShapesForRoute(
        terminusStop.id,
        DirectionType.TO_UNION,
    );
    const inboundShapes = await loadShapesForRoute(
        terminusStop.id,
        DirectionType.TO_ORIGIN,
    );

    return new RoutePackage(route, stops, inboundShapes, outboundShapes);
}
