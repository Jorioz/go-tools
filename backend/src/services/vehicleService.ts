import { getVehiclePositions } from "../integrations/goTransitApi/client.js";

function isEntityTrain(entity: { id: string }): boolean {
    return /-\b[A-Z]{2,3}\b-/.test(entity.id);
}

export async function fetchAllEntities() {
    try {
        const data = await getVehiclePositions();
        return data;
    } catch (error) {
        throw error;
    }
}

export async function fetchAllTrainEntities() {
    const allEntities = (await fetchAllEntities()) as Array<{
        id: string;
    }>;
    return allEntities.filter(isEntityTrain);
}
