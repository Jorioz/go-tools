import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
    LineStatusesSchema,
    hasOutOfServiceLine,
    isLineOutOfService,
    parseLineStatuses,
} from "./lineStatus.ts";

describe("parseLineStatuses (issue #26 optional field, fail-open)", () => {
    it("parses an absent field and defaults every line to in service", () => {
        // A response payload WITHOUT the status field must still parse.
        const parsed = LineStatusesSchema.parse(undefined);
        const statuses = parseLineStatuses(parsed);

        assert.deepEqual(statuses, {});
        // No line is dimmed on missing data.
        assert.equal(isLineOutOfService(statuses, "MI"), false);
        assert.equal(isLineOutOfService(statuses, "LW"), false);
    });

    it("marks only out_of_service lines as out, others in", () => {
        const parsed = LineStatusesSchema.parse({
            MI: "out_of_service",
            RH: "out_of_service",
            LW: "in_service",
        });
        const statuses = parseLineStatuses(parsed);

        assert.equal(statuses.MI, false);
        assert.equal(statuses.RH, false);
        assert.equal(statuses.LW, true);
        assert.equal(isLineOutOfService(statuses, "MI"), true);
        assert.equal(isLineOutOfService(statuses, "RH"), true);
        assert.equal(isLineOutOfService(statuses, "LW"), false);
    });

    it("treats a line absent from a present map as in service", () => {
        const parsed = LineStatusesSchema.parse({ MI: "out_of_service" });
        const statuses = parseLineStatuses(parsed);

        // LE was not reported -> default in service, never dimmed.
        assert.equal(isLineOutOfService(statuses, "LE"), false);
    });
});

describe("hasOutOfServiceLine (issue #28 dimmed-legend gating)", () => {
    it("is false for missing/empty data (fail open, nothing dimmed)", () => {
        assert.equal(hasOutOfServiceLine(undefined), false);
        assert.equal(hasOutOfServiceLine({}), false);
    });

    it("is false when every reported line is in service", () => {
        const statuses = parseLineStatuses(
            LineStatusesSchema.parse({ MI: "in_service", LW: "in_service" }),
        );
        assert.equal(hasOutOfServiceLine(statuses), false);
    });

    it("is true when at least one line is out of service", () => {
        const statuses = parseLineStatuses(
            LineStatusesSchema.parse({ MI: "out_of_service", LW: "in_service" }),
        );
        assert.equal(hasOutOfServiceLine(statuses), true);
    });
});
