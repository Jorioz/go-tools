import type { Shape } from "../../../models/gtfs/Shape.js";
import type { GtfsShapeRaw } from "../../../integrations/gtfs/rawTypes.js";

export function mapGtfsShape(shapeRaw: GtfsShapeRaw): Shape {
    return {
        id: shapeRaw.shape_id,
        lat: shapeRaw.shape_pt_lat,
        lon: shapeRaw.shape_pt_lon,
        seq: shapeRaw.shape_pt_sequence,
    };
}
