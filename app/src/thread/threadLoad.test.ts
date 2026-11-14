import { describe, expect, it } from "vitest";

import { loadProcessedDataFromDisk } from "../data/loadProcessedFromDisk";
import { loadFactor, loadParametersFromMeta } from "../science/loadFactor";
import { computeReachableAreaSquareMetres, effectiveReturnFieldThresholdSeconds } from "./threadContour";
import { computeThreadInfo } from "./threadInfo";



// Time left 30 min: elapsed = planned 6 h - reserve 30 min - 30 min = 5 h.
const ELAPSED_FOR_30_MIN_LEFT_S = 5 * 3600;


describe("Thread and carried load (contracts.md 4.6)", () => {
    it("the reachable area shrinks as the carried load grows (real data, 30 min left)", async () => {
        const data = await loadProcessedDataFromDisk();
        const returnField = data.float32Layers.return_field;
        const grid = data.meta.grid;
        const loadParameters = loadParametersFromMeta(data.meta.parameters);

        const areas: number[] = [];
        for (const loadKg of [0, 10, 14, 25]) {
            const factor = loadFactor(loadKg, loadParameters);
            const effective = effectiveReturnFieldThresholdSeconds(1800, factor);
            const area = computeReachableAreaSquareMetres(returnField, grid, effective);
            areas.push(area);
            console.log(`load ${loadKg} kg: factor ${factor}, effective ${effective.toFixed(1)} s, area ${area} m^2`);
        }
        for (let index = 1; index < areas.length; index += 1) {
            expect(areas[index]).toBeLessThan(areas[index - 1]);
        }
    });

    it("computeThreadInfo reports time left, load and the provenance", async () => {
        const data = await loadProcessedDataFromDisk();
        const info = computeThreadInfo(data, ELAPSED_FOR_30_MIN_LEFT_S, []);
        expect(info.time_left_s).toBe(1800);
        expect(info.carried_load_kg).toBeCloseTo(10, 9);
        expect(info.load_factor).toBeCloseTo(1.1, 9);
        expect(info.effective_return_field_threshold_s).toBeCloseTo(1800 / 1.1, 6);
        expect(info.provenance).toContain("return_field.bin");
        expect(info.provenance).toContain("D-027");
    });

    it("a cell is inside exactly when return_field x load_factor <= time left (boundary case)", () => {
        const timeLeftSeconds = 1100;
        const factor = 1.1;
        // 1000 x 1.1 = 1100 is on the boundary (inside); 1000.5 x 1.1 > 1100 is outside.
        const field = new Float32Array([0, 999, 1000, 1000.5, 2000, Number.POSITIVE_INFINITY]);
        const effective = effectiveReturnFieldThresholdSeconds(timeLeftSeconds, factor);
        const inside = Array.from(field).map((value) => value <= effective + 1e-9);
        const expected = Array.from(field).map((value) => value * factor <= timeLeftSeconds + 1e-9);
        expect(inside).toEqual(expected);
        expect(inside).toEqual([true, true, true, false, false, false]);
    });

    it("no time left gives only the staging cell", () => {
        expect(effectiveReturnFieldThresholdSeconds(0, 1.1)).toBe(0);
    });
});
