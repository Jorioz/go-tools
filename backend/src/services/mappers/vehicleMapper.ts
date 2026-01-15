import { mapRawTrip } from "./tripMapper.js";
import { mapRawPosition } from "./positionMapper.js";
import { mapRawMetadata } from "./metadataMapper.js";
import { Vehicle } from "../../models/Vehicle.js";

export function mapRawVehicle(vehicle: any): Vehicle {
    return new Vehicle(
        mapRawTrip(vehicle.trip),
        mapRawMetadata(vehicle.vehicle),
        mapRawPosition(vehicle.position),
        vehicle.stop_id,
        vehicle.current_status,
        vehicle.timestamp,
        vehicle.congestion_level,
        vehicle.occupancy_status
    );
}
