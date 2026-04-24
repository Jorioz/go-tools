import { z } from "zod";
import { LINE_CODES } from "~/tools/tracker/utils/constants";

const LineCodes = z.enum(LINE_CODES);
type LineCodes = z.infer<typeof LineCodes>;

const TrainSchema = z.object({
    tripNumber: z.string(),
    lineCode: LineCodes,
});
