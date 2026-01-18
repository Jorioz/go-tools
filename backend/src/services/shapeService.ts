import type { Shape } from "../models/gtfs/Shape.js";
import { loadTrainShapes } from "../integrations/gtfs/loader.js";
import { mapGtfsShape } from "./mappers/gtfs/shapeMapper.js";
import { DirectionType } from "../models/Trip.js";
import csv from "csv-parser";

// Direction Type:
// 0: TO_UNION
// 1: TO_ORIGIN

//Shapes.csv format:
// eg: shape_id row: WHUN
// Translates to: West Harbour -> Union (Direction 0)
// shortName: WH
// direction: TO_UNION
// Produces -> WHUN lookup

//shortName: WH
//direction: TO_ORIGIN
// Produces -> UNWH lookup

//todo: add verification for shortname
export async function loadShapesForRoute(
    shortName: string,
    direction: DirectionType,
): Promise<Shape[]> {
    return new Promise((resolve, reject) => {
        const lookup =
            direction === DirectionType.TO_UNION
                ? `${shortName}UN`
                : `UN${shortName}`;
        console.log(`Attemping to find ${lookup}`);
        const results: Shape[] = [];
        loadTrainShapes()
            .pipe(csv())
            .on("data", (rawRow) => {
                if (rawRow.shape_id && rawRow.shape_id.includes(lookup)) {
                    const shape = mapGtfsShape(rawRow);
                    results.push(shape);
                }
            })
            .on("end", () => resolve(results))
            .on("error", reject);
    });
}
