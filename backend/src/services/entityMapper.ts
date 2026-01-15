import { Entity } from "../models/Entity.js";
import { mapRawVehicle } from "./vehicleMapper.js";

export function mapRawEntity(entity: any): Entity {
    return new Entity(
        entity.id,
        entity.is_deleted,
        entity.trip_update,
        mapRawVehicle(entity.vehicle),
        entity.alert
    );
}
