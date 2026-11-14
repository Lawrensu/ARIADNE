// Science plan on the real data/processed/ grid (contracts.md 4.6, D-027), routed with direct A*
// (no Web Worker). Logs a readable table of each plan for the hand-off notes.

import { beforeAll, describe, expect, it } from "vitest";

import type { ProcessedData } from "../data/loadProcessed";
import { loadProcessedDataFromDisk } from "../data/loadProcessedFromDisk";
import { computeRoutePlan } from "../routing/routePlans";
import type { RoutingGrid } from "../routing/routingGrid";
import { createRoutingGrid, routingGridInputFromProcessedData } from "../routing/routingGrid";
import type { SciencePlan, SciencePlanStop } from "../state/scienceSlice";
import type { LegRouter } from "./sciencePlan";
import { computeSciencePlan, returnFieldSecondsAt } from "./sciencePlan";




let data: ProcessedData;
let routingGrid: RoutingGrid;


beforeAll(async () => {
    data = await loadProcessedDataFromDisk();
    routingGrid = createRoutingGrid(routingGridInputFromProcessedData(data));
});


const directAStarRouter: LegRouter = async (from, to) => {
    const plan = computeRoutePlan(routingGrid, "fast", from, to);
    if (plan === null) {
        return null;
    }
    return {
        unloaded_walking_time_s: plan.walking_time_s,
        horizontal_distance_m: plan.horizontal_distance_m,
        path_positions: plan.path_positions,
    };
};


function minutes(seconds: number): string {
    return `${(seconds / 60).toFixed(1)} min`;
}


function logPlanTable(title: string, plan: SciencePlan): void {
    const lines: string[] = [];
    lines.push(`=== ${title} (all values est.) ===`);
    lines.push("leg | from -> to | load kg | load factor | distance m | unloaded | with load");
    plan.legs.forEach((leg, index) => {
        lines.push(
            `${index + 1} ${leg.leg_kind} | ${leg.from_label} -> ${leg.to_label} | ${leg.carried_load_kg.toFixed(1)} | ${leg.load_factor.toFixed(3)} | ${leg.horizontal_distance_m.toFixed(0)} | ${minutes(leg.unloaded_walking_time_s)} | ${minutes(leg.walking_time_s)}`,
        );
    });
    lines.push("task | knot | duration | sample kg | load after kg");
    for (const task of plan.tasks) {
        lines.push(`${task.task_id} | ${task.knot_id} | ${minutes(task.duration_s)} | ${task.sample_mass_kg} | ${task.carried_load_after_kg.toFixed(1)}`);
    }
    lines.push(`walking ${minutes(plan.total_walking_time_s)} + tasks ${minutes(plan.total_task_time_s)} = plan ${minutes(plan.total_plan_time_s)}`);
    lines.push(`limit ${minutes(plan.plan_time_limit_s)}, science budget left ${minutes(plan.science_budget_left_s)}, feasibility ${plan.feasibility}`);
    if (plan.drop_task_suggestion === null) {
        lines.push("drop suggestion: none");
    } else {
        lines.push(`drop suggestion: ${plan.drop_task_suggestion.task_id} at ${plan.drop_task_suggestion.knot_id}, saves ${minutes(plan.drop_task_suggestion.saves_s)}`);
    }
    lines.push(`unreachable: ${plan.unreachable_knot_ids.length === 0 ? "none" : plan.unreachable_knot_ids.join(", ")}`);
    console.log(lines.join("\n"));
}


function allTasksStops(knotIds: string[]): SciencePlanStop[] {
    return knotIds.map((knotId) => {
        const knot = data.knots.find((candidate) => candidate.knot_id === knotId);
        expect(knot).toBeDefined();
        return { knot_id: knotId, chosen_task_ids: knot!.science_tasks.map((task) => task.task_id) };
    });
}


function checkPlanConsistency(plan: SciencePlan, stopCount: number): void {
    expect(plan.unreachable_knot_ids).toEqual([]);
    expect(plan.legs.length).toBe(stopCount + 1);

    // Each leg: walking_time_s = unloaded x load_factor, factor from the load (contracts.md 4.6).
    const loadTimeFactorPerKg = data.meta.parameters!.load_time_factor_per_kg!;
    for (const leg of plan.legs) {
        expect(leg.load_factor).toBeCloseTo(1 + loadTimeFactorPerKg * leg.carried_load_kg, 12);
        expect(leg.walking_time_s).toBeCloseTo(leg.unloaded_walking_time_s * leg.load_factor, 9);
        expect(Number.isFinite(leg.walking_time_s)).toBe(true);
        expect(leg.path_positions.length).toBeGreaterThan(1);
    }

    // Walk back = return_field[last Knot cell] x load_factor, the same as the Thread.
    const walkBack = plan.legs[plan.legs.length - 1];
    expect(walkBack.leg_kind).toBe("walk_back_to_rover");
    const lastStop = plan.stops[plan.stops.length - 1];
    const lastKnot = data.knots.find((knot) => knot.knot_id === lastStop.knot_id)!;
    const returnFieldSeconds = returnFieldSecondsAt(data.meta.grid, data.float32Layers.return_field, lastKnot);
    expect(walkBack.unloaded_walking_time_s).toBe(returnFieldSeconds);
    expect(walkBack.walking_time_s).toBeCloseTo(returnFieldSeconds * walkBack.load_factor, 9);
    // Its drawn A* route takes the same time within 1 % (realData.test.ts cross-check).
    const drawnRoute = computeRoutePlan(routingGrid, "fast", lastKnot, data.meta.staging_point)!;
    expect(Math.abs(drawnRoute.walking_time_s - returnFieldSeconds) / returnFieldSeconds).toBeLessThan(0.01);

    // Totals add up (contracts.md 4.6 rule 2 and 3).
    let walkingSum = 0;
    for (const leg of plan.legs) {
        walkingSum += leg.walking_time_s;
    }
    let taskSum = 0;
    for (const task of plan.tasks) {
        taskSum += task.duration_s;
    }
    expect(plan.total_walking_time_s).toBeCloseTo(walkingSum, 6);
    expect(plan.total_task_time_s).toBeCloseTo(taskSum, 6);
    expect(plan.total_plan_time_s).toBeCloseTo(walkingSum + taskSum, 6);
    const parameters = data.meta.parameters!;
    expect(plan.plan_time_limit_s).toBe(parameters.planned_marswalk_hours * 3600 - parameters.reserve_minutes * 60);
    expect(plan.science_budget_left_s).toBeCloseTo(plan.plan_time_limit_s - plan.total_plan_time_s, 6);
    expect(plan.is_feasible).toBe(plan.total_plan_time_s <= plan.plan_time_limit_s);
}




describe("science plan on the real data", () => {
    it("rover -> all 5 Knots with every task -> rover", async () => {
        const knotIds = [
            "knot_channel_west_edge",
            "knot_sulfur_stones",
            "knot_boxwork_first_view",
            "knot_boxwork_ridge",
            "knot_boxwork_hollow",
        ];
        const startedAt = performance.now();
        const plan = await computeSciencePlan({
            knots: data.knots,
            stops: allTasksStops(knotIds),
            parameters: data.meta.parameters,
            grid: data.meta.grid,
            returnField: data.float32Layers.return_field,
            stagingPoint: data.meta.staging_point,
            routeLeg: directAStarRouter,
        });
        console.log(`all 5 Knots planned in ${(performance.now() - startedAt).toFixed(0)} ms (direct A*, Node)`);
        logPlanTable("Rover -> all 5 Knots, all tasks", plan);
        checkPlanConsistency(plan, knotIds.length);
        expect(plan.tasks.length).toBe(10);
        if (plan.feasibility !== "go") {
            expect(plan.drop_task_suggestion).not.toBeNull();
        }
    });


    it("a smaller plan: channel west edge and boxwork first view", async () => {
        const knotIds = ["knot_channel_west_edge", "knot_boxwork_first_view"];
        const plan = await computeSciencePlan({
            knots: data.knots,
            stops: allTasksStops(knotIds),
            parameters: data.meta.parameters,
            grid: data.meta.grid,
            returnField: data.float32Layers.return_field,
            stagingPoint: data.meta.staging_point,
            routeLeg: directAStarRouter,
        });
        logPlanTable("Rover -> channel west edge -> boxwork first view, all tasks", plan);
        checkPlanConsistency(plan, knotIds.length);
        expect(plan.tasks.length).toBe(4);
    });
});
