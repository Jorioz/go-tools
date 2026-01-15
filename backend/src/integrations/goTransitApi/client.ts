const BASE_URL = "https://api.openmetrolinx.com/OpenDataAPI/";
type Params = Map<string, string | number | boolean>;

async function goTransitFetch(path: string, params?: Params) {
    const GO_API_KEY = process.env.GO_API_KEY;
    if (!GO_API_KEY) {
        throw new Error("Missing GO_API_KEY");
    }
    let endpoint = path;
    if (params) {
        const segments = Array.from(params.values());
        endpoint += segments.join("/");
    }

    const url = new URL(`${BASE_URL}${endpoint}`);
    url.searchParams.set("key", GO_API_KEY);

    try {
        const response = await fetch(url.toString());
        if (!response.ok) {
            throw new Error(`Response status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        if (error instanceof Error) {
            console.error(error.message);
        } else {
            console.log("An unknown error occured");
        }
    }
}

export async function getVehiclePositions() {
    return goTransitFetch("api/V1/Gtfs/Feed/VehiclePosition");
}
