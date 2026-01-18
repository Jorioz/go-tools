export enum RouteType {
    TRAIN = 2,
    BUS = 3,
}

export type Route = {
    id: string;
    agencyId?: string;
    shortName: string;
    longName: string;
    type: RouteType;
    color?: string;
    textColor?: string;
};
