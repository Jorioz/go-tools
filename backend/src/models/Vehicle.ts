import type { Trip } from "./Trip.js";
import type { VehicleMetadata } from "./VehicleMetadata.js";
import type { Position } from "./Position.js";

export class Vehicle {
    readonly trip: Trip;
    readonly metadata: VehicleMetadata;
    readonly position: Position;
    readonly stopId: string;
    readonly currentStatus: string;
    readonly timestamp: number;
    readonly congestionLevel: string;
    readonly occupancyStatus: string;

    constructor(
        trip: Trip,
        metadata: VehicleMetadata,
        position: Position,
        stopId: string,
        currentStatus: string,
        timestamp: number,
        congestionLevel: string,
        occupancyStatus: string
    ) {
        this.trip = trip;
        this.metadata = metadata;
        this.position = position;
        this.stopId = stopId;
        this.currentStatus = currentStatus;
        this.timestamp = timestamp;
        this.congestionLevel = congestionLevel;
        this.occupancyStatus = occupancyStatus;
    }
}
