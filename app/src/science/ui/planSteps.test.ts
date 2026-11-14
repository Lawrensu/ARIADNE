import { describe, expect, it } from "vitest";

import {
    effectivePlanStep,
    initialPlanStep,
    startWalkState,
    stepAvailability,
} from "./planSteps";
import type { StartWalkInput } from "./planSteps";



const GO_INPUT: StartWalkInput = {
    stopCount: 3,
    status: "plan_ready",
    feasibility: "go",
    unreachableKnotCount: 0,
    isWalkRunning: false,
};



describe("stepAvailability", () => {
    it("always allows PICK", () => {
        expect(stepAvailability("pick", 0).isEnabled).toBe(true);
    });

    it("disables CHECK and GO with a reason when there are no stops", () => {
        for (const step of ["check", "go"] as const) {
            const availability = stepAvailability(step, 0);
            expect(availability.isEnabled).toBe(false);
            expect(availability.disabledReason).toBe("Add a Knot first");
        }
    });

    it("enables CHECK and GO with at least one stop", () => {
        for (const step of ["check", "go"] as const) {
            const availability = stepAvailability(step, 1);
            expect(availability.isEnabled).toBe(true);
            expect(availability.disabledReason).toBeNull();
        }
    });
});


describe("initial and effective step", () => {
    it("starts on PICK without stops and CHECK with a plan", () => {
        expect(initialPlanStep(0, false)).toBe("pick");
        expect(initialPlanStep(2, false)).toBe("pick");
        expect(initialPlanStep(2, true)).toBe("check");
    });

    it("falls back to PICK when the chosen step is unavailable", () => {
        expect(effectivePlanStep("check", 0)).toBe("pick");
        expect(effectivePlanStep("go", 0)).toBe("pick");
        expect(effectivePlanStep("go", 2)).toBe("go");
    });
});


describe("startWalkState", () => {
    it("is disabled with no stops", () => {
        const state = startWalkState({ ...GO_INPUT, stopCount: 0, status: "idle", feasibility: null });
        expect(state.isEnabled).toBe(false);
        expect(state.reason).toBe("Add a Knot first");
        expect(state.label).toBe("START WALK");
    });

    it("is disabled while computing", () => {
        const state = startWalkState({ ...GO_INPUT, status: "computing" });
        expect(state.isEnabled).toBe(false);
        expect(state.reason).toBe("Computing the plan");
    });

    it("is disabled when the plan failed", () => {
        const state = startWalkState({ ...GO_INPUT, status: "plan_failed", feasibility: null });
        expect(state.isEnabled).toBe(false);
        expect(state.reason).toContain("Plan failed");
    });

    it("is disabled for a NO-GO plan and says why", () => {
        const state = startWalkState({ ...GO_INPUT, feasibility: "no_go" });
        expect(state.isEnabled).toBe(false);
        expect(state.reason).toBe("Plan does not fit: drop a task");
    });

    it("is disabled when a Knot is unreachable", () => {
        const state = startWalkState({ ...GO_INPUT, unreachableKnotCount: 1 });
        expect(state.isEnabled).toBe(false);
    });

    it("is enabled for GO and CAUTION plans", () => {
        expect(startWalkState(GO_INPUT).isEnabled).toBe(true);
        expect(startWalkState(GO_INPUT).reason).toBeNull();
        expect(startWalkState({ ...GO_INPUT, feasibility: "caution" }).isEnabled).toBe(true);
    });

    it("reads RESTART WALK with a note when a walk is under way", () => {
        const state = startWalkState({ ...GO_INPUT, isWalkRunning: true });
        expect(state.isEnabled).toBe(true);
        expect(state.label).toBe("RESTART WALK");
        expect(state.note).toBe("The walk follows the plan frozen at start");
    });
});
