import { getVehiclePositions } from "../integrations/goTransitApi/client.js";

export async function fetchAllVehiclePositions() {
    try {
        const data = await getVehiclePositions();
        return data;
    } catch (error) {
        throw error;
    }
}
