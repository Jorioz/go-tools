import type { Route, RouteType } from "../../models/Route.js";
import type { GtfsRouteRaw } from "../../integrations/gtfs/rawTypes.js";

export function mapGtfsRoute(routeRaw: GtfsRouteRaw): Route {
    return {
        id: routeRaw.route_id,
        shortName: routeRaw.route_short_name,
        longName: routeRaw.route_long_name,
        type: Number(routeRaw.route_type) as RouteType,
        color: routeRaw.route_color ?? "",
    };
}
