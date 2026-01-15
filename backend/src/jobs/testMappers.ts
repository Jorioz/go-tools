import * as fs from "fs";
import * as path from "path";
import { mapRawEntity } from "../services/mappers/entityMapper.js";

export function testMappers() {
    try {
        const logPath = path.join(process.cwd(), "src/logs/vehicleLog.json");
        const rawData = fs.readFileSync(logPath, "utf-8");
        const jsonData = JSON.parse(rawData);

        if (jsonData.entity && jsonData.entity.length > 0) {
            const firstEntity = mapRawEntity(jsonData.entity[0]);

            console.log("✅ Mapping successful!");
            console.log("Entity ID:", firstEntity.id);
            console.log("Vehicle ID:", firstEntity.vehicle.metadata.id);
            console.log("Route ID:", firstEntity.vehicle.trip.routeId);
            console.log("Position:", firstEntity.vehicle.position);
            console.log(
                "\nFull mapped object:",
                JSON.stringify(firstEntity, null, 2)
            );
        } else {
            console.log("❌ No entities found in JSON");
        }
    } catch (error) {
        console.error("❌ Mapping failed:", error);
        throw error;
    }
}
