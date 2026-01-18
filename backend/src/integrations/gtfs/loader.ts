import path from "path";
import fs from "fs";
import stripBomStream from "strip-bom-stream";

const GTFS_PATH = path.resolve(process.cwd(), "data/gtfs");

export function loadRoutes() {
    return fs.createReadStream(path.join(GTFS_PATH, "routes.csv"));
}

// ts should not be here, most of shapes is useless, i only use train data. keeping it tho in case i need it one day
export function loadShapes() {
    return fs.createReadStream(path.join(GTFS_PATH, "shapes.csv"));
}

export function loadStops() {
    return fs.createReadStream(path.join(GTFS_PATH, "stops.csv"));
}

export function loadTrainShapes() {
    return fs
        .createReadStream(path.join(GTFS_PATH, "train_shapes.csv"))
        .pipe(stripBomStream());
}
