import path from "path";
import fs from "fs";

const GTFS_PATH = path.resolve(process.cwd(), "data/gtfs");

export function loadRoutes() {
    return fs.createReadStream(path.join(GTFS_PATH, "routes.csv"));
}

export function loadShapes() {
    return fs.createReadStream(path.join(GTFS_PATH, "shapes.csv"));
}

export function loadStops() {
    return fs.createReadStream(path.join(GTFS_PATH, "stops.csv"));
}
