import { describe, expect, it } from "vitest";

import { formatDistance, formatWalkingTimeEstimate } from "./formatting";



describe("formatWalkingTimeEstimate", () => {
    it("labels every time as an estimate and rounds to minutes", () => {
        expect(formatWalkingTimeEstimate(20)).toBe("est. < 1 min");
        expect(formatWalkingTimeEstimate(1488)).toBe("est. 25 min");
        expect(formatWalkingTimeEstimate(3 * 3600 + 5 * 60)).toBe("est. 3 h 05 min");
    });

    it("says unreachable for +Infinity", () => {
        expect(formatWalkingTimeEstimate(Number.POSITIVE_INFINITY)).toBe("unreachable");
    });
});



describe("formatDistance", () => {
    it("rounds to 10 m below 1 km and to 0.1 km above", () => {
        expect(formatDistance(214)).toBe("210 m");
        expect(formatDistance(1118)).toBe("1.1 km");
    });
});
