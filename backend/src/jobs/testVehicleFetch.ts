import { fetchAllVehiclePositions } from "../services/vehicleService.js";
import { fileLogger } from "../utils/fileLogger.js";

export async function testVehicleFetch() {
    const data = await fetchAllVehiclePositions();
    const logData = JSON.stringify(data) ?? "";
    fileLogger(logData, "./src/logs/vehicleLog.json");
}
