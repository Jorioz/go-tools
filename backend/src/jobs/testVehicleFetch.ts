import { fetchAllEntities } from "../services/vehicleService.js";
import { fileLogger } from "../utils/fileLogger.js";

export async function testVehicleFetch() {
    const data = await fetchAllEntities();
    const logData = JSON.stringify(data) ?? "";
    fileLogger(logData, "./src/logs/vehicleLog.json");
}
