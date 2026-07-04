import { z } from "zod";
import {
    LINE_CODES,
    STOPS_BY_LINE,
    type LineCode,
} from "~/tools/tracker/utils/constants";

export type { LineCode };
export const LineCodes = z.enum(LINE_CODES);

export const TrainSchema = z
    .object({
        tripNumber: z.string(),
        lineCode: LineCodes,
        direction: z.number(),
        firstStopCode: z.string(),
        lastStopCode: z.string(),
        startTime: z.date(),
        endTime: z.date(),
        prevStopCode: z.string(),
        nextStopCode: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        progress: z.number(),
        inMotion: z.boolean(),
        modifiedDate: z.date(),
        stoppedAtStopCode: z.string(),
        stopCodes: z.array(z.string()),
    })
    .superRefine((data, ctx) => {
        const stops = STOPS_BY_LINE[data.lineCode];
        // stopCodes is intentionally excluded here: an unrecognised code in the
        // trip's route path should not reject the whole train (it stays
        // renderable and the info box tolerates unknown codes), unlike the
        // position fields below which must resolve to known stations.
        const stopFields = [
            "firstStopCode",
            "lastStopCode",
            "prevStopCode",
            "nextStopCode",
            "stoppedAtStopCode",
        ];
        for (const field of stopFields) {
            const code = data[field as keyof typeof data];
            if (typeof code === "string" && stops && !(code in stops)) {
                ctx.addIssue({
                    code: "custom",
                    message: `Got invalid STOP CODE '${code}' for LINE CODE '${data.lineCode}'`,
                });
            }
        }
    });

export type Train = z.infer<typeof TrainSchema>;
export type TrainsByLine = Partial<Record<LineCode, Train[]>>;
