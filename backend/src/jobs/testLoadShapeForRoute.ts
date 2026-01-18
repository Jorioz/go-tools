import type { DirectionType } from "../models/Trip.js";
import { loadShapesForRoute } from "../services/shapeService.js";

export async function testLoadShapesForRoute(
    shortName: string,
    direction: DirectionType,
) {
    const shapes = await loadShapesForRoute(shortName, direction);
    console.log(shapes);
}
