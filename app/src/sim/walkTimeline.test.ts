// Simulated walk timeline (D-030): synthetic cases, then the demo scenario on the real data.

import { beforeAll, describe, expect, it } from "vitest";

import type { Knot } from "../data/contracts";
import type { ProcessedData } from "../data/loadProcessed";
import { loadProcessedDataFromDisk } from "../data/loadProcessedFromDisk";
import { computeRoutePlan } from "../routing/routePlans";
import type { RoutingGrid } from "../routing/routingGrid";
import { createRoutingGrid, routingGridInputFromProcessedData } from "../routing/routingGrid";
import { carriedLoadKg, loadFactor, loadParametersFromMeta } from "../science/loadFactor";
import type { LegRouter } from "../science/sciencePlan";
import { computeSciencePlan } from "../science/sciencePlan";
import { nearestNeighbourOrder } from "../science/ui/planDisplay";
import type { SciencePlan } from "../state/scienceSlice";
import type { WalkDetour } from "../state/walkSlice";
import { SOLAR_STORM_SCENARIO } from "./scenarioEngine";
import {
    bearingBetween,
    buildWalkTimeline,
    earlyDepartureShiftSeconds,
    knotStayEndSeconds,
    pointAlongPath,
    tasksFinishedBetween,
    walkStateAt,
} from "./walkTimeline";




const ROVER = { x_m: 0, z_m: 0 };

function makeKnot(knotId: string, x_m: number, z_m: number): Knot {
    return {
        knot_id: knotId,
        name: knotId,
        x_m,
        z_m,
        latitude_deg: 0,
        longitude_deg: 0,
        science_rationale: "",
        measurements: [],
        photos: [],
        science_tasks: [],
    };
}

const KNOT_A = makeKnot("knot_a", 100, 0);

// Rover -> knot_a (100 s along +x), one 50 s task, then back (100 s).
function makePlan(): SciencePlan {
    const provenance = { source_dataset: "test", product_id: "test", resolution_m: 1, is_estimate: true };
    return {
        stops: [{ knot_id: "knot_a", chosen_task_ids: ["task_a"] }],
        legs: [
            {
                leg_kind: "walk_to_knot",
                from_label: "Rover",
                to_label: "knot_a",
                to_knot_id: "knot_a",
                carried_load_kg: 10,
                load_factor: 1.1,
                unloaded_walking_time_s: 90,
                walking_time_s: 100,
                horizontal_distance_m: 100,
                path_positions: [ROVER, { x_m: 50, z_m: 0 }, { x_m: 100, z_m: 0 }],
                is_estimate: true,
            },
            {
                leg_kind: "walk_back_to_rover",
                from_label: "knot_a",
                to_label: "Rover",
                to_knot_id: null,
                carried_load_kg: 11,
                load_factor: 1.11,
                unloaded_walking_time_s: 90,
                walking_time_s: 100,
                horizontal_distance_m: 100,
                path_positions: [],
                is_estimate: true,
            },
        ],
        tasks: [
            {
                knot_id: "knot_a",
                task_id: "task_a",
                label: "Task A",
                duration_s: 50,
                sample_mass_kg: 1,
                carried_load_after_kg: 11,
                provenance,
            },
        ],
        total_walking_time_s: 200,
        total_task_time_s: 50,
        total_plan_time_s: 250,
        plan_time_limit_s: 19800,
        science_budget_left_s: 19550,
        is_feasible: true,
        feasibility: "go",
        drop_task_suggestion: null,
        unreachable_knot_ids: [],
        is_estimate: true,
    } as SciencePlan;
}




describe("bearing and path helpers", () => {
    it("uses compass bearings on the local grid (x east, z south)", () => {
        expect(bearingBetween(ROVER, { x_m: 0, z_m: -10 })).toBeCloseTo(0, 9);
        expect(bearingBetween(ROVER, { x_m: 10, z_m: 0 })).toBeCloseTo(90, 9);
        expect(bearingBetween(ROVER, { x_m: 0, z_m: 10 })).toBeCloseTo(180, 9);
        expect(bearingBetween(ROVER, { x_m: -10, z_m: 0 })).toBeCloseTo(270, 9);
        expect(bearingBetween(ROVER, ROVER)).toBeNull();
    });

    it("interpolates by distance along the path", () => {
        const path = [ROVER, { x_m: 30, z_m: 0 }, { x_m: 30, z_m: 10 }];
        const cumulative = [0, 30, 40];
        const halfway = pointAlongPath(path, cumulative, 0.5);
        expect(halfway.position.x_m).toBeCloseTo(20, 9);
        expect(halfway.heading_deg).toBeCloseTo(90, 9);
        const nearEnd = pointAlongPath(path, cumulative, 0.9);
        expect(nearEnd.position).toEqual({ x_m: 30, z_m: 6 });
        expect(nearEnd.heading_deg).toBeCloseTo(180, 9);
        expect(pointAlongPath(path, cumulative, 2).position).toEqual({ x_m: 30, z_m: 10 });
    });
});




describe("walk timeline (synthetic plan)", () => {
    const timeline = buildWalkTimeline(makePlan(), [KNOT_A], ROVER, 1000);

    it("walks, works at the Knot, then walks back", () => {
        expect(timeline.segments.map((segment) => segment.segment_kind)).toEqual(["walk_leg", "science_task", "walk_leg"]);
        expect(timeline.end_s).toBe(1250);
    });

    it("waits at the rover before the start and after the end", () => {
        expect(walkStateAt(timeline, null, ROVER, 999).phase).toBe("at_rover");
        const done = walkStateAt(timeline, null, ROVER, 2000);
        expect(done.phase).toBe("at_rover");
        expect(done.position).toEqual(ROVER);
    });

    it("moves at constant speed along the leg and works at the Knot", () => {
        const walking = walkStateAt(timeline, null, ROVER, 1025);
        expect(walking.phase).toBe("walking");
        expect(walking.position.x_m).toBeCloseTo(25, 9);
        expect(walking.knot_id).toBe("knot_a");
        expect(walking.heading_deg).toBeCloseTo(90, 9);

        const working = walkStateAt(timeline, null, ROVER, 1120);
        expect(working.phase).toBe("at_knot");
        expect(working.task_id).toBe("task_a");
        expect(working.position).toEqual({ x_m: 100, z_m: 0 });
    });

    it("walks a leg with no stored path in a straight line", () => {
        const back = walkStateAt(timeline, null, ROVER, 1200);
        expect(back.position.x_m).toBeCloseTo(50, 9);
        expect(back.heading_deg).toBeCloseTo(270, 9);
    });

    it("finishes a task once, when its planned end is passed", () => {
        expect(tasksFinishedBetween(timeline, null, 1100, 1149)).toEqual([]);
        expect(tasksFinishedBetween(timeline, null, 1100, 1150)).toEqual(["task_a"]);
        expect(tasksFinishedBetween(timeline, null, 1150, 1300)).toEqual([]);
    });

    it("follows a detour from its start and never finishes a task it cut short", () => {
        const detour: WalkDetour = {
            started_at_sim_seconds: 1120,
            path_positions: [{ x_m: 100, z_m: 0 }, { x_m: 100, z_m: 40 }],
            walking_time_s: 40,
            target_kind: "shelter",
            target_id: "shelter_rover",
            target_label: "Rover shelter",
            phase_on_arrival: "sheltering",
            is_estimate: true,
        };
        expect(walkStateAt(timeline, detour, ROVER, 1110).phase).toBe("at_knot");
        const onDetour = walkStateAt(timeline, detour, ROVER, 1140);
        expect(onDetour.is_on_detour).toBe(true);
        expect(onDetour.position.z_m).toBeCloseTo(20, 9);
        expect(onDetour.heading_deg).toBeCloseTo(180, 9);
        const arrived = walkStateAt(timeline, detour, ROVER, 1200);
        expect(arrived.phase).toBe("sheltering");
        expect(arrived.position).toEqual({ x_m: 100, z_m: 40 });
        expect(tasksFinishedBetween(timeline, detour, 1000, 1300)).toEqual([]);
    });

    it("knows when the stay at a Knot ends", () => {
        expect(knotStayEndSeconds(timeline, "knot_a", 1110)).toBe(1150);
        expect(knotStayEndSeconds(timeline, "knot_a", 1050)).toBeNull();
        expect(knotStayEndSeconds(timeline, "knot_b", 1110)).toBeNull();
    });

    it("leaves a Knot early once every task there is ticked off, never otherwise", () => {
        const plan = makePlan();
        // At 1110 s the astronaut is at knot_a with 40 s of task left.
        expect(earlyDepartureShiftSeconds(timeline, null, plan, [], ROVER, 1110)).toBe(0);
        expect(earlyDepartureShiftSeconds(timeline, null, plan, ["task_a"], ROVER, 1110)).toBe(40);
        // Shifting the walk start 40 s earlier puts the astronaut on the walk back at 1110 s.
        const shifted = buildWalkTimeline(plan, [KNOT_A], ROVER, 1000 - 40);
        const afterShift = walkStateAt(shifted, null, ROVER, 1110);
        expect(afterShift.phase).toBe("walking");
        expect(afterShift.knot_id).toBeNull();
        expect(afterShift.position).toEqual({ x_m: 100, z_m: 0 });
        // Ticking off while still walking to the Knot does not skip the walk.
        expect(earlyDepartureShiftSeconds(timeline, null, plan, ["task_a"], ROVER, 1050)).toBe(0);
    });
});




describe("demo scenario on the real data (D-030)", () => {
    let data: ProcessedData;
    let routingGrid: RoutingGrid;
    let plan: SciencePlan;

    const router: LegRouter = async (from, to) => {
        const route = computeRoutePlan(routingGrid, "fast", from, to);
        if (route === null) {
            return null;
        }
        return {
            unloaded_walking_time_s: route.walking_time_s,
            horizontal_distance_m: route.horizontal_distance_m,
            path_positions: route.path_positions,
        };
    };

    beforeAll(async () => {
        data = await loadProcessedDataFromDisk();
        routingGrid = createRoutingGrid(routingGridInputFromProcessedData(data));
        // The same plan as runDemoScenario: every Knot, nearest first, every task.
        const order = nearestNeighbourOrder(data.meta.staging_point, data.knots);
        const stops = order.map((knotId) => {
            const knot = data.knots.find((candidate) => candidate.knot_id === knotId);
            return { knot_id: knotId, chosen_task_ids: knot === undefined ? [] : knot.science_tasks.map((task) => task.task_id) };
        });
        const result = await computeSciencePlan({
            knots: data.knots,
            stops,
            parameters: data.meta.parameters,
            grid: data.meta.grid,
            returnField: data.float32Layers.return_field,
            stagingPoint: data.meta.staging_point,
            routeLeg: router,
        });
        expect(result).not.toBeNull();
        plan = result as SciencePlan;
    });

    function eventTime(eventType: string): number {
        const event = SOLAR_STORM_SCENARIO.events.find((candidate) => candidate.event_type === eventType);
        expect(event).toBeDefined();
        return (event as { at_sim_seconds: number }).at_sim_seconds;
    }

    it("fires the storm after the first samples, on the way to the third Knot, then reroutes to the rover", () => {
        const walkStart = eventTime("walk_started");
        const timeline = buildWalkTimeline(plan, data.knots, data.meta.staging_point, walkStart);
        const stormAt = eventTime("solar_particle_event_alert");
        const rerouteAt = eventTime("reroute_to_shelter");

        // Every task at the first two Knots is done before the storm, and at least one took a sample,
        // so the demo shows the carried load (and the Thread) change before the alert.
        const done = tasksFinishedBetween(timeline, null, walkStart, stormAt);
        const firstTwoKnotIds = [plan.legs[0].to_knot_id, plan.legs[1].to_knot_id];
        const expectedDone = plan.tasks.filter((task) => firstTwoKnotIds.includes(task.knot_id)).map((task) => task.task_id);
        expect(done).toEqual(expectedDone);
        const sampleKg = plan.tasks.filter((task) => done.includes(task.task_id)).reduce((sum, task) => sum + task.sample_mass_kg, 0);
        expect(sampleKg).toBeGreaterThan(0);

        for (const at of [stormAt, rerouteAt]) {
            const state = walkStateAt(timeline, null, data.meta.staging_point, at);
            expect(state.phase).toBe("walking");
            expect(state.knot_id).toBe(plan.legs[2].to_knot_id);
        }

        // The detour back to the rover from the reroute point, timed like rerouteWalkTo.
        const from = walkStateAt(timeline, null, data.meta.staging_point, rerouteAt).position;
        const rover = data.meta.staging_point;
        const route = computeRoutePlan(routingGrid, "fast", from, rover);
        expect(route).not.toBeNull();
        const parameters = loadParametersFromMeta(data.meta.parameters);
        const factor = loadFactor(carriedLoadKg(data.knots, done, parameters), parameters);
        const homeAt = rerouteAt + (route as { walking_time_s: number }).walking_time_s * factor;

        console.log(
            `demo: walk ${walkStart} s, tasks done before the storm ${done.join(", ")}, storm ${stormAt} s, reroute ${rerouteAt} s, ` +
                `in the rover at est. ${(homeAt / 60).toFixed(1)} min (walk back est. ${((homeAt - rerouteAt) / 60).toFixed(1)} min, load factor ${factor.toFixed(3)})`,
        );
        // Home within the planned 5 h 30 min (contracts.md 4.6 rule 3), well before the suit limit.
        expect(homeAt).toBeLessThan(plan.plan_time_limit_s);
    });

    // The driver steps on animation frames, whose size depends on the machine and the sim speed.
    // Replaying the scenario with two different frame patterns must give the same events, tasks,
    // detour and positions: the run depends only on simulation time (Stage 3 gate, "identically twice").
    it("runs identically whatever the frame step sizes", () => {
        const walkStart = eventTime("walk_started");
        const parameters = loadParametersFromMeta(data.meta.parameters);

        function replay(stepSizes: number[]): string[] {
            const log: string[] = [];
            let timeline: ReturnType<typeof buildWalkTimeline> | null = null;
            let detour: WalkDetour | null = null;
            let eventIndex = 0;
            const done: string[] = [];
            let previous = 0;
            let now = 0;
            let stepIndex = 0;
            while (now < 3 * 3600) {
                now += stepSizes[stepIndex % stepSizes.length];
                stepIndex += 1;
                while (eventIndex < SOLAR_STORM_SCENARIO.events.length && SOLAR_STORM_SCENARIO.events[eventIndex].at_sim_seconds <= now) {
                    const event = SOLAR_STORM_SCENARIO.events[eventIndex];
                    // Like the driver: walk up to the event's own time first.
                    if (timeline !== null && event.at_sim_seconds > previous) {
                        for (const taskId of tasksFinishedBetween(timeline, detour, previous, event.at_sim_seconds)) {
                            done.push(taskId);
                            log.push(`task ${taskId}`);
                        }
                        previous = event.at_sim_seconds;
                    }
                    log.push(`event ${event.event_type} at ${event.at_sim_seconds}`);
                    if (event.event_type === "walk_started") {
                        timeline = buildWalkTimeline(plan, data.knots, data.meta.staging_point, event.at_sim_seconds);
                    }
                    if (event.event_type === "reroute_to_shelter" && timeline !== null) {
                        const from = walkStateAt(timeline, null, data.meta.staging_point, event.at_sim_seconds).position;
                        const route = computeRoutePlan(routingGrid, "fast", from, data.meta.staging_point);
                        if (route !== null) {
                            const factor = loadFactor(carriedLoadKg(data.knots, done, parameters), parameters);
                            detour = {
                                started_at_sim_seconds: event.at_sim_seconds,
                                path_positions: [from, ...route.path_positions],
                                walking_time_s: route.walking_time_s * factor,
                                target_kind: "shelter",
                                target_id: "shelter_rover",
                                target_label: "Rover shelter",
                                phase_on_arrival: "sheltering",
                                is_estimate: true,
                            };
                            log.push(`detour ${detour.walking_time_s.toFixed(6)} s from ${from.x_m.toFixed(6)},${from.z_m.toFixed(6)}`);
                        }
                    }
                    eventIndex += 1;
                }
                if (timeline !== null) {
                    for (const taskId of tasksFinishedBetween(timeline, detour, previous, now)) {
                        done.push(taskId);
                        log.push(`task ${taskId}`);
                    }
                }
                previous = now;
            }
            // Positions at fixed check times, independent of the frame pattern.
            for (const checkAt of [walkStart, 1800, 4000, 6700, 7000, 8000, 3 * 3600]) {
                const state = walkStateAt(timeline, detour, data.meta.staging_point, checkAt);
                log.push(`at ${checkAt}: ${state.phase} ${state.position.x_m.toFixed(6)},${state.position.z_m.toFixed(6)}`);
            }
            return log;
        }

        expect(walkStart).toBeGreaterThan(0);
        const smoothFrames = replay([1]);
        const jitteryFrames = replay([17, 3.5, 40, 0.25, 120]);
        expect(jitteryFrames).toEqual(smoothFrames);
        expect(smoothFrames.some((line) => line.startsWith("detour"))).toBe(true);
        expect(smoothFrames[smoothFrames.length - 1]).toContain("sheltering");
    });
});
