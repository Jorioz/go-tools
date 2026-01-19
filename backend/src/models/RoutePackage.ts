import type { Route } from "./gtfs/Route.js";
import type { Shape } from "./gtfs/Shape.js";
import type { Stop } from "./gtfs/Stop.js";

/**
 * @param {Shape[]} outboundShapes - UNION -> TERMINUS
 * @param {Shape[]} inboundShapes - TERMINUS -> UNION
 */
export class RoutePackage {
    constructor(
        public route: Route,
        public stops: Stop[],
        public outboundShapes: Shape[],
        public inboundShapes: Shape[],
    ) {}
}
