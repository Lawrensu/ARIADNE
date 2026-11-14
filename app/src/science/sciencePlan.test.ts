// Science plan tests on small synthetic inputs (contracts.md 4.6, D-027).
// Routers are synthetic (known seconds per metre) so every expected number is worked out by hand;
// one block uses the real A* on a flat grid through RoutingSession.computeFastLegs.

import { describe, expect, it } from "vitest";

import type { GridDefinition, Knot, LocalPosition, ScienceTask, ScienceTaskType, WalkingParameters } from "../data/contracts";
import { cellCentre, cellFromPosition, cellIndex } from "../data/grid";
import { RoutingSession } from "../routing/routingSession";
import { walkingTimeSeconds } from "../routing/walkingTime";
import type { SciencePlanStop } from "../state/scienceSlice";
import type { DropCandidate, LegRouter, SciencePlanInput } from "./sciencePlan";
import {
    CAUTION_MARGIN_SECONDS,
    checkNextTaskDuringWalk,
    computeSciencePlan,
    planTimeLimitSeconds,
    suggestTaskToDrop,
} from "./sciencePlan";




const GRID: GridDefinition = { width: 10, height: 10, cell_size_m: 1 };
// Synthetic router: 100 s per metre of Manhattan distance, unloaded.
const SECONDS_PER_METRE = 100;
const TOLERANCE_DIGITS = 6;


function centreOf(row: number, col: number): LocalPosition {
    return cellCentre(GRID, { row, col });
}


const STAGING = centreOf(7, 2);
const POSITION_A = centreOf(2, 2);
const POSITION_B = centreOf(2, 7);
const POSITION_C = centreOf(7, 7);
const POSITION_D = centreOf(5, 5);


function task(taskId: string, taskType: ScienceTaskType, durationMinutes: number, sampleMassKg: number): ScienceTask {
    return {
        task_id: taskId,
        label: `Label ${taskId}`,
        task_type: taskType,
        duration_minutes: durationMinutes,
        sample_mass_kg: sampleMassKg,
        equipment: [],
        provenance: { source_dataset: "synthetic", product_id: "synthetic", is_estimate: true },
    };
}


function knot(knotId: string, position: LocalPosition, tasks: ScienceTask[]): Knot {
    return {
        knot_id: knotId,
        name: `Name ${knotId}`,
        x_m: position.x_m,
        z_m: position.z_m,
        latitude_deg: 0,
        longitude_deg: 0,
        science_rationale: "",
        measurements: [],
        photos: [],
        science_tasks: tasks,
    };
}


const KNOTS: Knot[] = [
    knot("knot_a", POSITION_A, [task("task_a_image", "imaging", 10, 0), task("task_a_sample", "surface_sample", 20, 2)]),
    knot("knot_b", POSITION_B, [task("task_b_core", "core_sample", 30, 5)]),
    knot("knot_c", POSITION_C, [task("task_c_scan", "in_situ_measurement", 5, 0)]),
    // return_field is +Infinity here: unreachable.
    knot("knot_d", POSITION_D, [task("task_d_image", "imaging", 10, 0)]),
];


function returnFieldWith(values: Array<[LocalPosition, number]>): Float32Array {
    const field = new Float32Array(GRID.width * GRID.height).fill(Number.POSITIVE_INFINITY);
    field[cellIndex(GRID, cellFromPosition(GRID, STAGING))] = 0;
    for (const [position, seconds] of values) {
        field[cellIndex(GRID, cellFromPosition(GRID, position))] = seconds;
    }
    return field;
}


const RETURN_FIELD = returnFieldWith([
    [POSITION_A, 300],
    [POSITION_B, 500],
    [POSITION_C, 400],
]);


function parameters(plannedMarswalkHours: number, reserveMinutes: number, loadTimeFactorPerKg = 0.01, baseLoadKg = 10): WalkingParameters {
    return {
        suit_speed_factor: 0.6,
        gravity_adjustment: 1,
        max_walkable_slope_deg: 25,
        suit_capability_hours: 8,
        planned_marswalk_hours: plannedMarswalkHours,
        reserve_minutes: reserveMinutes,
        base_carried_load_kg: baseLoadKg,
        load_time_factor_per_kg: loadTimeFactorPerKg,
    };
}


function manhattanRouter(unreachable: LocalPosition[] = []): LegRouter {
    return async (from, to) => {
        for (const position of unreachable) {
            if (position.x_m === to.x_m && position.z_m === to.z_m) {
                return null;
            }
        }
        const distanceMetres = Math.abs(to.x_m - from.x_m) + Math.abs(to.z_m - from.z_m);
        return {
            unloaded_walking_time_s: distanceMetres * SECONDS_PER_METRE,
            horizontal_distance_m: distanceMetres,
            path_positions: [from, to],
        };
    };
}


function planInput(stops: SciencePlanStop[], walkingParameters: WalkingParameters, overrides: Partial<SciencePlanInput> = {}): SciencePlanInput {
    return {
        knots: KNOTS,
        stops,
        parameters: walkingParameters,
        grid: GRID,
        returnField: RETURN_FIELD,
        stagingPoint: STAGING,
        routeLeg: manhattanRouter(),
        ...overrides,
    };
}


// Rover -> A (image, sample 2 kg) -> B (core 5 kg) -> C (scan) -> rover.
// Legs unloaded: 500, 500, 500 s; walk back return_field[C] = 400 s.
// Loads: 10, 12, 17, 17 kg -> factors 1.10, 1.12, 1.17, 1.17.
// Walking: 550 + 560 + 585 + 468 = 2163 s. Tasks: 600 + 1200 + 1800 + 300 = 3900 s. Total 6063 s.
const FULL_STOPS: SciencePlanStop[] = [
    { knot_id: "knot_a", chosen_task_ids: ["task_a_image", "task_a_sample"] },
    { knot_id: "knot_b", chosen_task_ids: ["task_b_core"] },
    { knot_id: "knot_c", chosen_task_ids: ["task_c_scan"] },
];
const FULL_TOTAL_S = 6063;




describe("computeSciencePlan: legs, load and totals (contracts.md 4.6 rule 2)", () => {
    it("scales each leg with the load carried on it and adds tasks and the walk back", async () => {
        const plan = await computeSciencePlan(planInput(FULL_STOPS, parameters(6, 30)));

        expect(plan.legs.map((leg) => leg.leg_kind)).toEqual(["walk_to_knot", "walk_to_knot", "walk_to_knot", "walk_back_to_rover"]);
        expect(plan.legs.map((leg) => leg.carried_load_kg)).toEqual([10, 12, 17, 17]);
        const expectedFactors = [1.1, 1.12, 1.17, 1.17];
        const expectedWalking = [550, 560, 585, 468];
        for (let index = 0; index < plan.legs.length; index++) {
            const leg = plan.legs[index];
            expect(leg.load_factor).toBeCloseTo(expectedFactors[index], 12);
            expect(leg.walking_time_s).toBeCloseTo(expectedWalking[index], TOLERANCE_DIGITS);
            expect(leg.walking_time_s).toBeCloseTo(leg.unloaded_walking_time_s * leg.load_factor, 9);
            expect(leg.is_estimate).toBe(true);
        }
        expect(plan.legs[0].from_label).toBe("Rover");
        expect(plan.legs[0].to_knot_id).toBe("knot_a");

        // Walk back: return_field[C] x load_factor, unloaded time = return_field.
        const walkBack = plan.legs[3];
        expect(walkBack.unloaded_walking_time_s).toBe(400);
        expect(walkBack.to_knot_id).toBeNull();
        expect(walkBack.to_label).toBe("Rover");
        expect(walkBack.path_positions.length).toBeGreaterThan(0);

        // The sample is carried from right after its task.
        expect(plan.tasks.map((entry) => entry.carried_load_after_kg)).toEqual([10, 12, 17, 17]);
        expect(plan.tasks.map((entry) => entry.duration_s)).toEqual([600, 1200, 1800, 300]);

        expect(plan.total_walking_time_s).toBeCloseTo(2163, TOLERANCE_DIGITS);
        expect(plan.total_task_time_s).toBe(3900);
        expect(plan.total_plan_time_s).toBeCloseTo(FULL_TOTAL_S, TOLERANCE_DIGITS);
        expect(plan.plan_time_limit_s).toBe(6 * 3600 - 30 * 60);
        expect(plan.science_budget_left_s).toBeCloseTo(19800 - FULL_TOTAL_S, TOLERANCE_DIGITS);
        expect(plan.is_feasible).toBe(true);
        expect(plan.feasibility).toBe("go");
        expect(plan.drop_task_suggestion).toBeNull();
        expect(plan.unreachable_knot_ids).toEqual([]);
        expect(plan.is_estimate).toBe(true);
    });


    it("ignores unknown task ids, tasks of other Knots and repeated task ids", async () => {
        const stops: SciencePlanStop[] = [
            { knot_id: "knot_a", chosen_task_ids: ["task_unknown", "task_a_image", "task_b_core", "task_a_image"] },
        ];
        const plan = await computeSciencePlan(planInput(stops, parameters(6, 30)));
        expect(plan.stops).toEqual([{ knot_id: "knot_a", chosen_task_ids: ["task_a_image"] }]);
        expect(plan.tasks.map((entry) => entry.task_id)).toEqual(["task_a_image"]);
    });


    it("uses the D-020 limit when meta.json has no parameters", () => {
        expect(planTimeLimitSeconds(undefined)).toBe(19800);
    });
});




describe("computeSciencePlan: feasibility (contracts.md 4.6 rule 3)", () => {
    // No load effect, so the totals are exact integers: rover -> A 500 s, image 600 s, walk back rf[A].
    const noLoad = (hours: number, reserveMinutes: number) => parameters(hours, reserveMinutes, 0, 0);
    const stops: SciencePlanStop[] = [{ knot_id: "knot_a", chosen_task_ids: ["task_a_image"] }];


    it("exactly at the limit is feasible (caution: no budget left)", async () => {
        const returnField = returnFieldWith([[POSITION_A, 700]]);
        const plan = await computeSciencePlan(planInput(stops, noLoad(1, 30), { returnField }));
        expect(plan.total_plan_time_s).toBe(1800);
        expect(plan.plan_time_limit_s).toBe(1800);
        expect(plan.is_feasible).toBe(true);
        expect(plan.science_budget_left_s).toBe(0);
        expect(plan.feasibility).toBe("caution");
    });


    it("one second over the limit is no_go", async () => {
        const returnField = returnFieldWith([[POSITION_A, 701]]);
        const plan = await computeSciencePlan(planInput(stops, noLoad(1, 30), { returnField }));
        expect(plan.total_plan_time_s).toBe(1801);
        expect(plan.is_feasible).toBe(false);
        expect(plan.feasibility).toBe("no_go");
        expect(plan.science_budget_left_s).toBe(-1);
    });


    it("go at exactly CAUTION_MARGIN_SECONDS left, caution one second below", async () => {
        // Limit 1.25 h - 30 min = 2700 s.
        const atMargin = await computeSciencePlan(planInput(stops, noLoad(1.25, 30), { returnField: returnFieldWith([[POSITION_A, 700]]) }));
        expect(atMargin.science_budget_left_s).toBe(CAUTION_MARGIN_SECONDS);
        expect(atMargin.feasibility).toBe("go");
        const belowMargin = await computeSciencePlan(planInput(stops, noLoad(1.25, 30), { returnField: returnFieldWith([[POSITION_A, 701]]) }));
        expect(belowMargin.science_budget_left_s).toBe(CAUTION_MARGIN_SECONDS - 1);
        expect(belowMargin.feasibility).toBe("caution");
    });
});




describe("computeSciencePlan: drop task suggestion", () => {
    // Savings in FULL_STOPS (task time + sample mass x 0.01 x unloaded walking after it):
    //   task_a_image 600; task_a_sample 1200 + 2 x 0.01 x 1400 = 1228;
    //   task_b_core 1800 + 5 x 0.01 x 900 = 1845; task_c_scan 300.


    it("picks the smallest task whose removal alone makes the plan fit", async () => {
        // Limit 2 h - 30 min = 5400 s; 663 s over. task_a_sample and task_b_core are enough alone.
        const plan = await computeSciencePlan(planInput(FULL_STOPS, parameters(2, 30)));
        expect(plan.feasibility).toBe("no_go");
        expect(plan.drop_task_suggestion).not.toBeNull();
        expect(plan.drop_task_suggestion!.task_id).toBe("task_a_sample");
        expect(plan.drop_task_suggestion!.knot_id).toBe("knot_a");
        expect(plan.drop_task_suggestion!.saves_s).toBeCloseTo(1228, TOLERANCE_DIGITS);

        // saves_s is exactly what removing the task saves.
        const withoutSample = FULL_STOPS.map((stop) => ({
            knot_id: stop.knot_id,
            chosen_task_ids: stop.chosen_task_ids.filter((id) => id !== "task_a_sample"),
        }));
        const smallerPlan = await computeSciencePlan(planInput(withoutSample, parameters(2, 30)));
        expect(plan.total_plan_time_s - smallerPlan.total_plan_time_s).toBeCloseTo(1228, TOLERANCE_DIGITS);
        expect(smallerPlan.is_feasible).toBe(true);
    });


    it("picks the biggest saver when no single task is enough", async () => {
        // Limit 1.5 h - 30 min = 3600 s; 2463 s over.
        const plan = await computeSciencePlan(planInput(FULL_STOPS, parameters(1.5, 30)));
        expect(plan.feasibility).toBe("no_go");
        expect(plan.drop_task_suggestion!.task_id).toBe("task_b_core");
        expect(plan.drop_task_suggestion!.saves_s).toBeCloseTo(1845, TOLERANCE_DIGITS);
    });


    it("on caution, suggests the smallest task that brings the plan back to go", async () => {
        // Limit 2.25 h - 30 min = 6300 s; 237 s left. Going back to 900 s left needs 663 s saved.
        const plan = await computeSciencePlan(planInput(FULL_STOPS, parameters(2.25, 30)));
        expect(plan.feasibility).toBe("caution");
        expect(plan.drop_task_suggestion!.task_id).toBe("task_a_sample");
    });


    it("is null when the plan is go or has no tasks", async () => {
        const goPlan = await computeSciencePlan(planInput(FULL_STOPS, parameters(6, 30)));
        expect(goPlan.drop_task_suggestion).toBeNull();
        const noTasks = await computeSciencePlan(
            planInput([{ knot_id: "knot_a", chosen_task_ids: [] }], parameters(0.5, 0), { returnField: returnFieldWith([[POSITION_A, 5000]]) }),
        );
        expect(noTasks.feasibility).toBe("no_go");
        expect(noTasks.drop_task_suggestion).toBeNull();
    });


    it("suggestTaskToDrop breaks duration ties by the larger saving, and returns null without candidates", () => {
        const candidates: DropCandidate[] = [
            { knot_id: "k1", task_id: "light", label: "light", duration_s: 600, sample_mass_kg: 0, unloaded_walking_time_after_s: 1000 },
            { knot_id: "k2", task_id: "heavy", label: "heavy", duration_s: 600, sample_mass_kg: 4, unloaded_walking_time_after_s: 1000 },
        ];
        const suggestion = suggestTaskToDrop(candidates, 2000, 1500, 0.01);
        expect(suggestion!.task_id).toBe("heavy");
        expect(suggestion!.saves_s).toBeCloseTo(640, 9);
        expect(suggestTaskToDrop([], 2000, 1500, 0.01)).toBeNull();
    });
});




describe("computeSciencePlan: unreachable Knots", () => {
    it("lists a Knot with infinite return_field, skips it and is no_go", async () => {
        const stops: SciencePlanStop[] = [
            { knot_id: "knot_a", chosen_task_ids: ["task_a_image"] },
            { knot_id: "knot_d", chosen_task_ids: ["task_d_image"] },
            { knot_id: "knot_c", chosen_task_ids: [] },
        ];
        const plan = await computeSciencePlan(planInput(stops, parameters(6, 30)));
        expect(plan.unreachable_knot_ids).toEqual(["knot_d"]);
        expect(plan.is_feasible).toBe(false);
        expect(plan.feasibility).toBe("no_go");
        // The next leg starts from the last reached Knot (A -> C).
        expect(plan.legs.map((leg) => leg.to_knot_id)).toEqual(["knot_a", "knot_c", null]);
        expect(plan.legs[1].from_label).toBe("Name knot_a");
        expect(plan.tasks.map((entry) => entry.task_id)).toEqual(["task_a_image"]);
        // Time fits, so no drop suggestion: dropping a task cannot make a Knot reachable.
        expect(plan.drop_task_suggestion).toBeNull();
    });


    it("lists a Knot the router cannot reach and an unknown Knot id", async () => {
        const stops: SciencePlanStop[] = [
            { knot_id: "knot_b", chosen_task_ids: ["task_b_core"] },
            { knot_id: "knot_unknown", chosen_task_ids: [] },
            { knot_id: "knot_a", chosen_task_ids: [] },
        ];
        const plan = await computeSciencePlan(planInput(stops, parameters(6, 30), { routeLeg: manhattanRouter([POSITION_B]) }));
        expect(plan.unreachable_knot_ids).toEqual(["knot_b", "knot_unknown"]);
        expect(plan.feasibility).toBe("no_go");
        expect(plan.legs.map((leg) => leg.to_knot_id)).toEqual(["knot_a", null]);
        expect(plan.tasks).toEqual([]);
    });


    it("has no legs when no Knot is reachable", async () => {
        const plan = await computeSciencePlan(planInput([{ knot_id: "knot_d", chosen_task_ids: [] }], parameters(6, 30)));
        expect(plan.legs).toEqual([]);
        expect(plan.total_plan_time_s).toBe(0);
        expect(plan.feasibility).toBe("no_go");
    });


    it("keeps the walk back time from return_field when its drawing route fails", async () => {
        const router = manhattanRouter([STAGING]);
        const plan = await computeSciencePlan(planInput([{ knot_id: "knot_a", chosen_task_ids: [] }], parameters(6, 30), { routeLeg: router }));
        const walkBack = plan.legs[1];
        expect(walkBack.leg_kind).toBe("walk_back_to_rover");
        expect(walkBack.walking_time_s).toBeCloseTo(300 * 1.1, 9);
        expect(walkBack.path_positions).toEqual([]);
        expect(Number.isNaN(walkBack.horizontal_distance_m)).toBe(true);
    });
});




describe("checkNextTaskDuringWalk (contracts.md 4.6 rule 4)", () => {
    // Limit 19800 s; elapsed 15000 s -> 4800 s left. At the Knot: return_field 3000 s, load 10 kg.
    // Walk back now 3300 s, margin 1500 s. A 5 kg task adds 3000 x 0.05 = 150 s to the walk back.
    const base = {
        parameters: parameters(6, 30),
        elapsed_s: 15000,
        current_return_field_s: 3000,
        carried_load_kg: 10,
        walk_to_next_knot_unloaded_s: 0,
        next_knot_return_field_s: 3000,
        next_task_sample_mass_kg: 5,
    };


    it("keeps a task that fits with its extra walk back", () => {
        const check = checkNextTaskDuringWalk({ ...base, next_task_duration_s: 1200 });
        expect(check.time_left_s).toBe(4800);
        expect(check.walk_back_now_s).toBeCloseTo(3300, 9);
        expect(check.thread_margin_s).toBeCloseTo(1500, 9);
        expect(check.next_task_cost_s).toBeCloseTo(1350, 9);
        expect(check.margin_after_next_task_s).toBeCloseTo(150, 9);
        expect(check.should_drop_next_task).toBe(false);
    });


    it("suggests dropping a task that does not fit", () => {
        const check = checkNextTaskDuringWalk({ ...base, next_task_duration_s: 1400 });
        expect(check.margin_after_next_task_s).toBeCloseTo(-50, 9);
        expect(check.should_drop_next_task).toBe(true);
    });


    it("counts the walk to the next Knot with the current load", () => {
        // 200 s unloaded to the next Knot -> 220 s; next Knot is 100 s further from the rover.
        const check = checkNextTaskDuringWalk({
            ...base,
            walk_to_next_knot_unloaded_s: 200,
            next_knot_return_field_s: 3100,
            next_task_sample_mass_kg: 0,
            next_task_duration_s: 1000,
        });
        // 220 + 1000 + 3100 x 1.1 - 3300 = 1330.
        expect(check.next_task_cost_s).toBeCloseTo(1330, 9);
        expect(check.should_drop_next_task).toBe(false);
    });


    it("drops a task at an unreachable Knot", () => {
        const check = checkNextTaskDuringWalk({ ...base, next_knot_return_field_s: Number.POSITIVE_INFINITY, next_task_duration_s: 60 });
        expect(check.should_drop_next_task).toBe(true);
    });
});




describe("RoutingSession.computeFastLegs on a flat grid", () => {
    // 20 x 20 cells of 2 m, flat, penalty 1, with a closed ring of impassable cells around (15, 15).
    const width = 20;
    const height = 20;
    const cellSizeMetres = 2;
    const penalty = new Float32Array(width * height).fill(1);
    for (let row = 13; row <= 17; row++) {
        for (let col = 13; col <= 17; col++) {
            const isRing = row === 13 || row === 17 || col === 13 || col === 17;
            if (isRing) {
                penalty[row * width + col] = Number.POSITIVE_INFINITY;
            }
        }
    }
    const session = new RoutingSession({
        grid: { width, height, cell_size_m: cellSizeMetres },
        heightmap: new Float32Array(width * height),
        traversal_penalty: penalty,
        slope_degrees: new Float32Array(width * height),
        viewshed_rover: new Uint8Array(width * height).fill(1),
    });
    const grid: GridDefinition = { width, height, cell_size_m: cellSizeMetres };
    const orthogonalSeconds = walkingTimeSeconds(cellSizeMetres, 0);
    const diagonalSeconds = walkingTimeSeconds(cellSizeMetres * Math.SQRT2, 0);


    it("returns one fast leg per consecutive pair with octile walking times, null where unreachable", () => {
        const waypoints = [cellCentre(grid, { row: 1, col: 1 }), cellCentre(grid, { row: 1, col: 9 }), cellCentre(grid, { row: 5, col: 5 }), cellCentre(grid, { row: 15, col: 15 })];
        const legs = session.computeFastLegs(waypoints);
        expect(legs.length).toBe(3);
        // 8 orthogonal steps.
        expect(legs[0]!.walking_time_s).toBeCloseTo(8 * orthogonalSeconds, 9);
        expect(legs[0]!.route_option).toBe("fast");
        // 4 diagonal steps.
        expect(legs[1]!.walking_time_s).toBeCloseTo(4 * diagonalSeconds, 9);
        expect(legs[1]!.horizontal_distance_m).toBeCloseTo(4 * cellSizeMetres * Math.SQRT2, 9);
        // Inside the closed ring.
        expect(legs[2]).toBeNull();
    });


    it("does not set a route goal (rerouteFrom still has nothing to replan)", () => {
        expect(() => session.rerouteFrom(cellCentre(grid, { row: 0, col: 0 }), [])).toThrow();
    });
});
