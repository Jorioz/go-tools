import fs from "fs";
import path from "path";

const GTFS_PATH = path.resolve(process.cwd(), "data/gtfs");
const SHAPES_CSV = path.join(GTFS_PATH, "shapes.csv");
const OUTPUT_CSV = path.join(GTFS_PATH, "train_shapes.csv");

export function splitRawShapes() {
    const lines = fs
        .readFileSync(SHAPES_CSV, "utf-8")
        .split("\n")
        .filter(Boolean);

    const header = lines[0];
    const trainRows: string[] = [];

    for (let i = lines.length - 1; i > 0; i--) {
        const line = lines[i];
        if (typeof line !== "string") {
            continue;
        }
        const shape_id = line.split(",")[0];

        if (isNaN(Number(shape_id))) {
            trainRows.unshift(line);
        }
    }

    trainRows.unshift(header ?? "");

    fs.writeFileSync(OUTPUT_CSV, trainRows.join("\n"), "utf-8");
}
