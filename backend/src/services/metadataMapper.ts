import type { VehicleMetadata } from "../models/VehicleMetadata.js";

export function mapRawMetadata(metadata: any): VehicleMetadata {
    return {
        id: metadata.id,
        label: metadata.label,
        licensePlate: metadata.license_plate,
    };
}
