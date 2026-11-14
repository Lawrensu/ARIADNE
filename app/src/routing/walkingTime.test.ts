import { describe, expect, it } from "vitest";

import { DEFAULT_WALKING_PARAMETERS, peakWalkingSpeedMetresPerSecond, walkingTimeSeconds } from "./walkingTime";




// contracts.md 4.5: both implementations must pass these rows, tolerance +-1e-3 s.
const TEST_VECTORS: Array<[number, number, number, number]> = [
    [1, 1.0, 0.0, 1.1912],
    [2, 1.0, 0.1, 1.6905],
    [3, 1.0, -0.1, 1.1912],
    [4, 1.0, 0.5, Number.POSITIVE_INFINITY],
    [5, 1.0, -0.5, Number.POSITIVE_INFINITY],
    [6, 1.4142135623730951, 0.0, 1.6847],
    [7, 10.0, 2.0, 23.9888],
    [8, 10.0, -2.0, 16.9046],
];
const TOLERANCE_SECONDS = 1e-3;




describe("walkingTimeSeconds (contracts.md 4.5 test vectors)", () => {
    for (const [rowNumber, distance, elevationChange, expected] of TEST_VECTORS) {
        it(`row ${rowNumber}: d = ${distance} m, dh = ${elevationChange} m`, () => {
            const actual = walkingTimeSeconds(distance, elevationChange, DEFAULT_WALKING_PARAMETERS);
            if (expected === Number.POSITIVE_INFINITY) {
                expect(actual).toBe(Number.POSITIVE_INFINITY);
            } else {
                expect(Math.abs(actual - expected)).toBeLessThanOrEqual(TOLERANCE_SECONDS);
            }
        });
    }

    it("defaults to the contract parameters", () => {
        expect(walkingTimeSeconds(1.0, 0.0)).toBe(walkingTimeSeconds(1.0, 0.0, DEFAULT_WALKING_PARAMETERS));
    });

    it("uses the parameters it is given", () => {
        const slower = { ...DEFAULT_WALKING_PARAMETERS, suit_speed_factor: 0.3 };
        expect(walkingTimeSeconds(1.0, 0.0, slower)).toBeCloseTo(2 * walkingTimeSeconds(1.0, 0.0), 10);
        const steeperLimit = { ...DEFAULT_WALKING_PARAMETERS, max_walkable_slope_deg: 30 };
        expect(Number.isFinite(walkingTimeSeconds(1.0, 0.5, steeperLimit))).toBe(true);
    });

    it("peak speed is 1.0 m/s with the contract parameters (contracts.md 4.4)", () => {
        expect(peakWalkingSpeedMetresPerSecond()).toBeCloseTo(1.0, 12);
    });
});
