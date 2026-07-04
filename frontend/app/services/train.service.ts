import { z } from "zod";
import type { LineCode, Train } from "~/models/train";
import { LineCodes } from "~/models/train";
const API_BASE_URL = "";
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
    // Ordered trip stop list (travel order). Tolerate an absent field from an
    // older backend by defaulting to an empty list -- the UI then falls back to
    // its live next-stop display.
    stop_codes: z.array(z.string()).optional().default([]),
});

const RawByLineResponse = z.object({
    trains: z.array(RawTrainSchema),
});

const RawAllTrainsResponse = z.object({
    lines: z.record(LineCodes, z.array(RawTrainSchema)),
});

type ByLineResponse = {
    lastUpdated: Date | null;
    refreshInterval: number | null;
    trains: Train[];
};

type AllTrainsResponse = {
    lastUpdated: Date | null;
    refreshInterval: number | null;
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
    stopCodes: raw.stop_codes,
});

async function apiFetch(
    endpoint: string,
): Promise<{ data: unknown; headers: Headers }> {
    const url = API_BASE_URL ? `${API_BASE_URL}${endpoint}` : endpoint;
    const res = await fetch(url);
    if (!res.ok) throw new Error("API Error fetching trains.");
    const data = await res.json();
    return { data, headers: res.headers };
}

function parseLastUpdated(headers: Headers): Date | null {
    const hdr =
        headers.get("x-last-updated") ||
        headers.get("last-modified") ||
        headers.get("last-updated");
    if (!hdr) return null;
    const d = new Date(hdr);
    return isNaN(d.getTime()) ? null : d;
}

function parseRefreshInterval(headers: Headers): number | null {
    const v = headers.get("x-refresh-interval");
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

export async function getAllTrains(): Promise<AllTrainsResponse> {
    const { data, headers } = await apiFetch("/api/trains");
    const parsed = RawAllTrainsResponse.parse(data);
    const lines: AllTrainsResponse["lines"] = {};
    for (const [lineCode, trains] of Object.entries(parsed.lines)) {
        lines[lineCode as LineCode] = (trains as any[]).map(toTrain);
    }
    return {
        lastUpdated: parseLastUpdated(headers),
        refreshInterval: parseRefreshInterval(headers),
        lines,
    };
}

export async function getTrainsByLine(
    lineCode: LineCode,
): Promise<ByLineResponse> {
    const { data, headers } = await apiFetch(`/api/trains/${lineCode}`);
    const parsed = RawByLineResponse.parse(data);
    return {
        lastUpdated: parseLastUpdated(headers),
        refreshInterval: parseRefreshInterval(headers),
        trains: parsed.trains.map(toTrain),
    };
}
