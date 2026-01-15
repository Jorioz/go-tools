import type { Position } from "../models/Position.js";

export function mapRawPosition(position: any): Position {
    return {
        latitude: position.latitude,
        longitude: position.longitude,
        bearing: position.bearing,
        odometer: position.odometer,
        speed: position.speed,
    };
}
