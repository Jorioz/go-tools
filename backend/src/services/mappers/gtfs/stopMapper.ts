import type { Stop } from "../../../models/gtfs/Stop.js";
import type { GtfsStopRaw } from "../../../integrations/gtfs/rawTypes.js";

export function stopMapper(stopRaw: GtfsStopRaw): Stop {
    return {
        id: stopRaw.stop_id,
        name: stopRaw.stop_name,
        lat: stopRaw.stop_lat,
        lon: stopRaw.stop_lon,
        code: stopRaw.stop_code,
    };
}
