import type { Route, RouteType } from "../../../models/gtfs/Route.js";
import type { GtfsRouteRaw } from "../../../integrations/gtfs/rawTypes.js";
import orderedStopsJson from "../../../../data/orderedStops.json" with { type: "json" };

const orderedStops: { [key: string]: string[] } = orderedStopsJson;

export function mapGtfsRoute(routeRaw: GtfsRouteRaw): Route {
    return {
        id: routeRaw.route_id,
        shortName: routeRaw.route_short_name,
        longName: routeRaw.route_long_name,
        type: Number(routeRaw.route_type) as RouteType,
        color: routeRaw.route_color ?? "",
    };
}
