import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
    computeMarkerAngle,
    resolveStoppedTrainAngle,
    type Point,
    type StopAnchor,
} from "./markerGeometry.ts";

// A stopped train whose prev/next anchors sit on the same point makes the
// direct prev->next angle degenerate (dx === dy === 0), forcing the polyline
// fallback that derives heading from the neighbouring polyline points.
describe("resolveStoppedTrainAngle polyline fallback", () => {
    // Horizontal polyline: forward is +x, backward is -x.
    const points: Point[] = [
        [0, 0],
        [10, 0],
        [20, 0],
    ];
    const anchorAtMiddle: StopAnchor = { coord: [10, 0], pointIndex: 1 };

    const resolveFallback = (direction: number): number =>
        resolveStoppedTrainAngle({
            points,
            // Same anchor for prev and next => direct angle degenerates to 0.
            prevAnchor: anchorAtMiddle,
            nextAnchor: anchorAtMiddle,
            stoppedAnchor: anchorAtMiddle,
            progress: 0,
            direction,
        });

    it("points forward along the polyline for inbound trains (direction 0)", () => {
        // back point [0,0] -> forward point [20,0] => heading east.
        const expected = computeMarkerAngle(20, 0);
        assert.equal(resolveFallback(0), expected);
    });

    it("points backward along the polyline for outbound trains (direction 1)", () => {
        // forward point [20,0] -> back point [0,0] => heading west.
        const expected = computeMarkerAngle(-20, 0);
        assert.equal(resolveFallback(1), expected);
    });

    it("gives opposite headings for the two directions", () => {
        assert.notEqual(resolveFallback(0), resolveFallback(1));
    });
});
