import { describe, expect, it } from "vitest";

import type { EnvironmentSample, Knot } from "../data/contracts";
import { walkingTimeSeconds } from "../routing/walkingTime";
import type { SciencePlan, SciencePlanLeg, SciencePlanStop } from "../state/scienceSlice";
import {
    bearingDegrees,
    bearingWord,
    computeHudNumbers,
    emptyHudNumbers,
    formatDistanceMetres,
    formatDurationHm,
    formatMeasurement,
    formatMinutesEstimate,
    formatScienceBudgetChip,
    formatSignedMinutes,
    nearestEnvironmentSample,
    normalizeBearing,
    o2State,
    selectNextKnot,
    threadMarginState,
} from "./hudMath";



function makeKnot(knotId: string, name: string, xM: number, zM: number): Knot {
    return {
        knot_id: knotId,
        name,
        x_m: xM,
        z_m: zM,
        latitude_deg: 0,
        longitude_deg: 0,
        science_rationale: "",
        measurements: [],
        photos: [],
        science_tasks: [],
    };
}


function makeLeg(toKnotId: string | null, distanceM: number, walkingTimeS: number): SciencePlanLeg {
    return {
        leg_kind: toKnotId === null ? "walk_back_to_rover" : "walk_to_knot",
        from_label: "Rover",
        to_label: "Knot",
        to_knot_id: toKnotId,
        carried_load_kg: 10,
        load_factor: 1.1,
        unloaded_walking_time_s: walkingTimeS / 1.1,
        walking_time_s: walkingTimeS,
        horizontal_distance_m: distanceM,
        path_positions: [],
        is_estimate: true,
    };
}


function makePlan(stops: SciencePlanStop[], legs: SciencePlanLeg[]): SciencePlan {
    return {
        stops,
        legs,
        tasks: [],
        total_walking_time_s: 0,
        total_task_time_s: 0,
        total_plan_time_s: 0,
        plan_time_limit_s: 19800,
        science_budget_left_s: 0,
        is_feasible: true,
        feasibility: "go",
        drop_task_suggestion: null,
        unreachable_knot_ids: [],
        is_estimate: true,
    };
}


function makeSample(seconds: number): EnvironmentSample {
    return {
        seconds_since_replay_start: seconds,
        local_mean_solar_time: "12:00:00",
        air_temperature_c: -20,
        ground_temperature_c: -10,
        pressure_pa: 740,
        uv_index_level: "moderate",
        dust_opacity_tau: 0.5,
        radiation_dose_rate_usv_per_hour: 27,
        provenance: {
            source_dataset: "Curiosity REMS and RAD",
            product_id: "test",
            is_estimate: false,
        },
    };
}



describe("bearingDegrees", () => {
    it("uses the local grid: x east, z south, 0 = north, clockwise", () => {
        expect(bearingDegrees(0, 0, 0, -10)).toBe(0);
        expect(bearingDegrees(0, 0, 10, 0)).toBe(90);
        expect(bearingDegrees(0, 0, 0, 10)).toBe(180);
        expect(bearingDegrees(0, 0, -10, 0)).toBe(270);
    });

    it("wraps around north at 359 and 0", () => {
        expect(normalizeBearing(360)).toBe(0);
        expect(normalizeBearing(-1)).toBe(359);
        expect(bearingDegrees(0, 0, -0.01, -10)).toBeCloseTo(359.94, 1);
        expect(bearingDegrees(0, 0, 0.01, -10)).toBeCloseTo(0.06, 1);
    });

    it("returns 0 for the same point and unknown for non-finite input", () => {
        expect(bearingDegrees(4, 5, 4, 5)).toBe(0);
        expect(Number.isNaN(bearingDegrees(0, 0, Number.NaN, 10))).toBe(true);
    });
});


describe("bearingWord", () => {
    it("names the eight compass points", () => {
        expect(bearingWord(0)).toBe("N");
        expect(bearingWord(45)).toBe("NE");
        expect(bearingWord(90)).toBe("E");
        expect(bearingWord(135)).toBe("SE");
        expect(bearingWord(180)).toBe("S");
        expect(bearingWord(225)).toBe("SW");
        expect(bearingWord(270)).toBe("W");
        expect(bearingWord(315)).toBe("NW");
        expect(bearingWord(350)).toBe("N");
        expect(bearingWord(Number.NaN)).toBe("unknown");
    });
});


describe("formatting", () => {
    it("formats distance in metres under 1000 and kilometres above", () => {
        expect(formatDistanceMetres(210)).toBe("210 m");
        expect(formatDistanceMetres(999)).toBe("999 m");
        expect(formatDistanceMetres(1000)).toBe("1.0 km");
        expect(formatDistanceMetres(1234)).toBe("1.2 km");
        expect(formatDistanceMetres(Number.NaN)).toBe("unknown");
        expect(formatDistanceMetres(Number.POSITIVE_INFINITY)).toBe("unknown");
        expect(formatDistanceMetres(-5)).toBe("unknown");
    });

    it("formats duration as h:mm, minutes rounded down", () => {
        expect(formatDurationHm(15000)).toBe("4:10");
        expect(formatDurationHm(3599)).toBe("0:59");
        expect(formatDurationHm(3600)).toBe("1:00");
        expect(formatDurationHm(0)).toBe("0:00");
        expect(formatDurationHm(Number.NaN)).toBe("unknown");
        expect(formatDurationHm(-1)).toBe("unknown");
    });

    it("formats minutes rounded down", () => {
        expect(formatMinutesEstimate(359)).toBe("5 min");
        expect(formatMinutesEstimate(360)).toBe("6 min");
        expect(formatMinutesEstimate(0)).toBe("0 min");
        expect(formatMinutesEstimate(-1)).toBe("unknown");
        expect(formatMinutesEstimate(Number.POSITIVE_INFINITY)).toBe("unknown");
    });

    it("formats a signed Thread margin in minutes", () => {
        expect(formatSignedMinutes(870)).toBe("+14 min");
        expect(formatSignedMinutes(-180)).toBe("-3 min");
        expect(formatSignedMinutes(30)).toBe("0 min");
        expect(formatSignedMinutes(Number.POSITIVE_INFINITY)).toBe("unknown");
    });

    it("formats the science budget chip", () => {
        expect(formatScienceBudgetChip(null)).toBe("No plan yet");
        expect(formatScienceBudgetChip(1620)).toBe("+27 min left");
        expect(formatScienceBudgetChip(-600)).toBe("over by 10 min");
        expect(formatScienceBudgetChip(Number.NaN)).toBe("unknown");
    });

    it("formats measurements without NaN", () => {
        expect(formatMeasurement(1.234, 1, "°C")).toBe("1.2 °C");
        expect(formatMeasurement(Number.NaN, 1, "°C")).toBe("unknown");
    });
});


describe("state thresholds", () => {
    it("Thread margin: below 0 min is no-go, below 15 min is caution, else go", () => {
        expect(threadMarginState(-1)).toBe("no_go");
        expect(threadMarginState(-0.01)).toBe("no_go");
        expect(threadMarginState(0)).toBe("caution");
        expect(threadMarginState(899)).toBe("caution");
        expect(threadMarginState(900)).toBe("go");
        expect(threadMarginState(3600)).toBe("go");
        expect(threadMarginState(Number.NaN)).toBe("no_go");
    });

    it("O2: empty is no-go, under one hour is caution, else go", () => {
        expect(o2State(0)).toBe("no_go");
        expect(o2State(-1)).toBe("no_go");
        expect(o2State(3599)).toBe("caution");
        expect(o2State(3600)).toBe("go");
        expect(o2State(Number.NaN)).toBe("no_go");
    });
});


describe("nearestEnvironmentSample", () => {
    it("returns the nearest replay sample", () => {
        const samples = [makeSample(0), makeSample(60), makeSample(120)];
        expect(nearestEnvironmentSample(samples, 70)?.seconds_since_replay_start).toBe(60);
        expect(nearestEnvironmentSample(samples, 100)?.seconds_since_replay_start).toBe(120);
        expect(nearestEnvironmentSample([], 10)).toBeNull();
        expect(nearestEnvironmentSample(samples, Number.NaN)?.seconds_since_replay_start).toBe(0);
    });
});


describe("selectNextKnot", () => {
    it("prefers the first incomplete science plan stop and uses its plan leg", () => {
        const knotA = makeKnot("knot_a", "A", 100, 0);
        const knotB = makeKnot("knot_b", "B", 0, -50);
        const plan = makePlan(
            [
                { knot_id: "knot_a", chosen_task_ids: ["task_1"] },
                { knot_id: "knot_b", chosen_task_ids: ["task_2"] },
            ],
            [makeLeg("knot_a", 120, 150)],
        );

        const selection = selectNextKnot({
            knots: [knotA, knotB],
            position: { x_m: 0, z_m: 0 },
            sciencePlan: plan,
            completedTaskIds: [],
            parameters: undefined,
            loadFactor: 1.1,
        });

        expect(selection.knot?.knot_id).toBe("knot_a");
        expect(selection.source).toBe("science_plan");
        expect(selection.distanceM).toBe(120);
        expect(selection.walkTimeSeconds).toBe(150);
        expect(selection.bearingDeg).toBe(90);
        expect(selection.bearingWord).toBe("E");
        expect(selection.isDistanceFromPlan).toBe(true);
        expect(selection.isWalkTimeFromPlan).toBe(true);
    });

    it("skips a stop whose chosen tasks are all done and a stop with no tasks", () => {
        const knotA = makeKnot("knot_a", "A", 100, 0);
        const knotB = makeKnot("knot_b", "B", 0, -50);
        const plan = makePlan(
            [
                { knot_id: "knot_a", chosen_task_ids: [] },
                { knot_id: "knot_b", chosen_task_ids: ["task_2"] },
            ],
            [],
        );

        const selection = selectNextKnot({
            knots: [knotA, knotB],
            position: { x_m: 0, z_m: 0 },
            sciencePlan: plan,
            completedTaskIds: [],
            parameters: undefined,
            loadFactor: 1.1,
        });

        expect(selection.knot?.knot_id).toBe("knot_b");
        expect(selection.source).toBe("science_plan");
    });

    it("falls back to the nearest Knot when the plan is complete", () => {
        const knotA = makeKnot("knot_a", "A", 100, 0);
        const knotB = makeKnot("knot_b", "B", 0, -50);
        const plan = makePlan([{ knot_id: "knot_a", chosen_task_ids: ["task_1"] }], [makeLeg("knot_a", 120, 150)]);

        const selection = selectNextKnot({
            knots: [knotA, knotB],
            position: { x_m: 0, z_m: 0 },
            sciencePlan: plan,
            completedTaskIds: ["task_1"],
            parameters: undefined,
            loadFactor: 1.1,
        });

        expect(selection.knot?.knot_id).toBe("knot_b");
        expect(selection.source).toBe("nearest_knot");
        expect(selection.isDistanceFromPlan).toBe(false);
        expect(selection.isWalkTimeFromPlan).toBe(false);
    });

    it("uses the straight-line distance and walking model without a plan", () => {
        const knotA = makeKnot("knot_a", "A", 100, 0);

        const selection = selectNextKnot({
            knots: [knotA],
            position: { x_m: 0, z_m: 0 },
            sciencePlan: null,
            completedTaskIds: [],
            parameters: undefined,
            loadFactor: 1.1,
        });

        expect(selection.source).toBe("nearest_knot");
        expect(selection.distanceM).toBe(100);
        expect(selection.straightLineDistanceM).toBe(100);
        expect(selection.bearingDeg).toBe(90);
        expect(selection.walkTimeSeconds).toBeCloseTo(walkingTimeSeconds(100, 0) * 1.1, 9);
        expect(selection.isWalkTimeFromPlan).toBe(false);
    });

    it("returns unknown readings when there are no Knots", () => {
        const selection = selectNextKnot({
            knots: [],
            position: { x_m: 0, z_m: 0 },
            sciencePlan: null,
            completedTaskIds: [],
            parameters: undefined,
            loadFactor: 1.1,
        });

        expect(selection.knot).toBeNull();
        expect(selection.source).toBe("none");
        expect(Number.isNaN(selection.distanceM)).toBe(true);
        expect(selection.bearingWord).toBe("unknown");
    });
});


describe("computeHudNumbers", () => {
    const grid = { width: 2, height: 2, cell_size_m: 2 };

    it("computes distance, Thread margin and O2 with states", () => {
        const numbers = computeHudNumbers({
            grid,
            returnField: new Float32Array([300, 1, 1, 1]),
            position: { x_m: 1, z_m: 1 },
            timeLeftSeconds: 600,
            loadFactor: 1.1,
            o2RemainingSeconds: 15000,
            nextKnotDistanceM: 250,
            nextKnotWalkTimeSeconds: 360,
        });

        expect(numbers.walkBackNowSeconds).toBeCloseTo(330, 6);
        expect(numbers.threadMarginSeconds).toBeCloseTo(270, 6);
        expect(numbers.threadMarginText).toBe("+4 min");
        expect(numbers.threadState).toBe("caution");
        expect(numbers.distanceText).toBe("250 m");
        expect(numbers.distanceState).toBe("go");
        expect(numbers.o2Text).toBe("4:10");
        expect(numbers.o2State).toBe("go");
        expect(numbers.nextKnotWalkTimeText).toBe("6 min");
    });

    it("shows unknown and no-go for an unreachable position and empty O2", () => {
        const numbers = computeHudNumbers({
            grid,
            returnField: new Float32Array([Number.POSITIVE_INFINITY, 1, 1, 1]),
            position: { x_m: 1, z_m: 1 },
            timeLeftSeconds: 600,
            loadFactor: 1.1,
            o2RemainingSeconds: 0,
            nextKnotDistanceM: Number.NaN,
            nextKnotWalkTimeSeconds: Number.NaN,
        });

        expect(numbers.threadMarginText).toBe("unknown");
        expect(numbers.threadState).toBe("no_go");
        expect(numbers.distanceText).toBe("unknown");
        expect(numbers.distanceState).toBe("no_go");
        expect(numbers.o2Text).toBe("0:00");
        expect(numbers.o2State).toBe("no_go");
        expect(numbers.nextKnotWalkTimeText).toBe("unknown");
    });

    it("returns all unknown readings before data loads", () => {
        const numbers = emptyHudNumbers();
        expect(numbers.distanceText).toBe("unknown");
        expect(numbers.threadMarginText).toBe("unknown");
        expect(numbers.o2Text).toBe("unknown");
        expect(numbers.threadState).toBe("no_go");
    });
});
