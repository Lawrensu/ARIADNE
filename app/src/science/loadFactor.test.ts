import { describe, expect, it } from "vitest";

import { loadProcessedDataFromDisk } from "../data/loadProcessedFromDisk";
import { carriedLoadKg, CONTRACT_LOAD_PARAMETERS, loadFactor, loadParametersFromMeta } from "./loadFactor";



// contracts.md 4.6 load factor test vectors, tolerance 1e-9.
const LOAD_FACTOR_VECTORS = [
    { row: 1, carried_load_kg: 0.0, expected_load_factor: 1.0 },
    { row: 2, carried_load_kg: 10.0, expected_load_factor: 1.1 },
    { row: 3, carried_load_kg: 17.5, expected_load_factor: 1.175 },
];



describe("loadFactor (contracts.md 4.6 test vectors)", () => {
    for (const vector of LOAD_FACTOR_VECTORS) {
        it(`row ${vector.row}: ${vector.carried_load_kg} kg -> ${vector.expected_load_factor}`, () => {
            const factor = loadFactor(vector.carried_load_kg, CONTRACT_LOAD_PARAMETERS);
            expect(Math.abs(factor - vector.expected_load_factor)).toBeLessThanOrEqual(1e-9);
        });
    }
});



describe("load parameters and carried load on the real data", () => {
    it("reads the v1.1.0 load parameters from meta.json", async () => {
        const data = await loadProcessedDataFromDisk();
        // Load parameters exist from contract v1.1.0 onwards (any later 1.x, e.g. the 1.1.1 wording fix, D-028).
        const [major, minor] = data.meta.contract_version.split(".").map(Number);
        expect(major).toBe(1);
        expect(minor).toBeGreaterThanOrEqual(1);
        expect(loadParametersFromMeta(data.meta.parameters)).toEqual({ base_carried_load_kg: 10, load_time_factor_per_kg: 0.01 });
    });

    it("starts with the tool kit and adds each completed task's sample mass", async () => {
        const data = await loadProcessedDataFromDisk();
        const parameters = loadParametersFromMeta(data.meta.parameters);
        expect(carriedLoadKg(data.knots, [], parameters)).toBe(10);
        const allTaskIds = data.knots.flatMap((knot) => knot.science_tasks.map((task) => task.task_id));
        const totalSampleKg = data.knots.flatMap((knot) => knot.science_tasks).reduce((sum, task) => sum + task.sample_mass_kg, 0);
        expect(carriedLoadKg(data.knots, allTaskIds, parameters)).toBeCloseTo(10 + totalSampleKg, 9);
        expect(carriedLoadKg(data.knots, ["task_that_does_not_exist"], parameters)).toBe(10);
    });

    it("has unique task ids across all Knots (contracts.md 3.12)", async () => {
        const data = await loadProcessedDataFromDisk();
        const taskIds = data.knots.flatMap((knot) => knot.science_tasks.map((task) => task.task_id));
        expect(new Set(taskIds).size).toBe(taskIds.length);
        expect(taskIds.length).toBeGreaterThan(0);
    });
});
