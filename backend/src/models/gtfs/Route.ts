import type { Stop } from "./Stop.js";

export enum RouteType {
    TRAIN = 2,
    BUS = 3,
}

// Short name eg: MI,
// Id for when looking up current route on api
export type Route = {
    id: string;
    agencyId?: string;
    shortName: string;
    longName: string;
    type: RouteType;
    color?: string;
    textColor?: string;
};
