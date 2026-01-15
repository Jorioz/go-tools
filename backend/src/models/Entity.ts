import { Vehicle } from "./Vehicle.js";

export class Entity {
    readonly id: string;
    readonly isDeleted: boolean;
    readonly tripUdate: unknown;
    readonly vehicle: Vehicle;
    readonly alert: unknown;

    constructor(
        id: string,
        isDeleted: boolean,
        tripUpdate: unknown,
        vehicle: Vehicle,
        alert: unknown
    ) {
        this.id = id;
        this.isDeleted = isDeleted;
        this.tripUdate = tripUpdate;
        this.vehicle = vehicle;
        this.alert = alert;
    }
}
