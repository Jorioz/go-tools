import path from "path";
import fs from "fs";
import stripBomStream from "strip-bom-stream";

const GTFS_PATH = path.resolve(process.cwd(), "data/gtfs");

export function loadRoutes() {
    return fs.createReadStream(path.join(GTFS_PATH, "routes.csv"));
}

export function loadStops() {
    return fs
        .createReadStream(path.join(GTFS_PATH, "stops.csv"))
        .pipe(stripBomStream());
}

export function loadTrainShapes() {
    return fs
        .createReadStream(path.join(GTFS_PATH, "train_shapes.csv"))
        .pipe(stripBomStream());
}
