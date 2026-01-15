import { fetchAllVehiclePositions } from "../services/vehicleService.js";
import { fileLogger } from "../utils/fileLogger.js";

export async function testVehicleFetch() {
    const data = await fetchAllVehiclePositions();
    fileLogger(JSON.stringify(data), "./src/logs/vehicleLog.json");
}
