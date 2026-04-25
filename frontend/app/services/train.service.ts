import { z } from "zod";
import type { LineCode, Train } from "~/models/train";
import { LineCodes } from "~/models/train";
const API_BASE_URL = "http://localhost:8000"; //import.meta.env.BASE_URL;

const RawTrainSchema = z.object({
    trip_number: z.string(),
    line_code: LineCodes,
    direction: z.number(),
    first_stop_code: z.string(),
    last_stop_code: z.string(),
    start_time: z.coerce.date(),
    end_time: z.coerce.date(),
    prev_stop_code: z.string(),
    next_stop_code: z.string(),
    latitude: z.number(),
    longitude: z.number(),
    progress: z.number(),
    in_motion: z.boolean(),
    modified_date: z.coerce.date(),
    stopped_at_stop_code: z.string(),
});

const RawByLineResponse = z.object({
    last_updated: z.coerce.date(),
    trains: z.array(RawTrainSchema),
});

const RawAllTrainsResponse = z.object({
    last_updated: z.coerce.date(),
    lines: z.record(LineCodes, z.array(RawTrainSchema)),
});

type ByLineResponse = {
    lastUpdated: Date;
    trains: Train[];
};

type AllTrainsResponse = {
    lastUpdated: Date;
    lines: Partial<Record<LineCode, Train[]>>;
};

const toTrain = (raw: z.infer<typeof RawTrainSchema>): Train => ({
    tripNumber: raw.trip_number,
    lineCode: raw.line_code,
    direction: raw.direction,
    firstStopCode: raw.first_stop_code,
    lastStopCode: raw.last_stop_code,
    startTime: raw.start_time,
    endTime: raw.end_time,
    prevStopCode: raw.prev_stop_code,
    nextStopCode: raw.next_stop_code,
    latitude: raw.latitude,
    longitude: raw.longitude,
    progress: raw.progress,
    inMotion: raw.in_motion,
    modifiedDate: raw.modified_date,
    stoppedAtStopCode: raw.stopped_at_stop_code,
});

async function apiFetch(endpoint: string): Promise<unknown> {
    const url = `${API_BASE_URL}${endpoint}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("API Error fetching trains.");
    return res.json();
}

export async function getAllTrains(): Promise<AllTrainsResponse> {
    const data = await apiFetch("/api/trains");
    const parsed = RawAllTrainsResponse.parse(data);
    const lines: AllTrainsResponse["lines"] = {};
    for (const [lineCode, trains] of Object.entries(parsed.lines)) {
        lines[lineCode as LineCode] = trains.map(toTrain);
    }
    return {
        lastUpdated: parsed.last_updated,
        lines,
    };
}

export async function getTrainsByLine(
    lineCode: LineCode,
): Promise<ByLineResponse> {
    const data = await apiFetch(`/api/trains/${lineCode}`);
    const parsed = RawByLineResponse.parse(data);
    return {
        lastUpdated: parsed.last_updated,
        trains: parsed.trains.map(toTrain),
    };
}
