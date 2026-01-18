export enum DirectionType {
    TO_UNION = 0,
    TO_ORIGIN = 1,
}

export type Trip = {
    tripId: string;
    routeId: string;
    directionId: DirectionType;
    startTime: string;
    startDate: string;
    scheduleRelationship: string;
};
