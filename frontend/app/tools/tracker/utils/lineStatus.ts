import { z } from "zod";
import type { LineCode } from "./constants";

// Per-line scheduled-service status from the trains API (issue #26). The backend
// reports "in_service" / "out_of_service" per line; the field is OPTIONAL so an
// older backend response without it still parses -- every line then defaults to
// in service and renders normally.
export const LineStatusValue = z.enum(["in_service", "out_of_service"]);

// Keys are line codes; validated loosely as strings so an unmodeled line code
// never rejects the whole response (fail open) and the parser stays decoupled
// from the LINE_CODES value at runtime.
export const LineStatusesSchema = z
    .record(z.string(), LineStatusValue)
    .optional();

export type LineStatuses = Partial<Record<LineCode, boolean>>;

/**
 * Normalize the optional `line_statuses` field into a `{ line: isInService }`
 * map. A missing field, or a line absent from it, defaults to in service (true)
 * so a line is never dimmed on missing data (fail open, matching the backend).
 */
export function parseLineStatuses(
    raw: z.infer<typeof LineStatusesSchema>,
): LineStatuses {
    const statuses: LineStatuses = {};
    if (!raw) {
        return statuses;
    }
    for (const [lineCode, value] of Object.entries(raw)) {
        statuses[lineCode as LineCode] = value === "in_service";
    }
    return statuses;
}

/** Whether a line is explicitly out of service; unknown lines default to false. */
export function isLineOutOfService(
    statuses: LineStatuses | undefined,
    lineCode: LineCode,
): boolean {
    return statuses?.[lineCode] === false;
}
