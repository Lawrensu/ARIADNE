// Pure rules for the three-step PLAN flow: PICK, CHECK, GO (D-031 follow-up). Owner: Malissa, Stage 2.
// No DOM, no React: tested with Vitest in Node.

import type { SciencePlanFeasibility, SciencePlanStatus } from "../../state/scienceSlice";



export type PlanStep = "pick" | "check" | "go";


export const PLAN_STEPS: PlanStep[] = ["pick", "check", "go"];


export const PLAN_STEP_LABELS: Record<PlanStep, string> = {
    pick: "1 PICK",
    check: "2 CHECK",
    go: "3 GO",
};


export interface StepAvailability {
    isEnabled: boolean;
    // Short reason shown when the step is disabled; null when enabled.
    disabledReason: string | null;
}


export interface StartWalkInput {
    stopCount: number;
    status: SciencePlanStatus;
    // Null while there is no plan yet.
    feasibility: SciencePlanFeasibility | null;
    unreachableKnotCount: number;
    isWalkRunning: boolean;
}


export interface StartWalkState {
    isEnabled: boolean;
    label: string;
    // Why the button is disabled; null when enabled.
    reason: string | null;
    // One-line note shown under the button when a walk is already under way; null otherwise.
    note: string | null;
}



export function stepAvailability(step: PlanStep, stopCount: number): StepAvailability {
    if (step === "pick") {
        return { isEnabled: true, disabledReason: null };
    }
    if (stopCount === 0) {
        return { isEnabled: false, disabledReason: "Add a Knot first" };
    }
    return { isEnabled: true, disabledReason: null };
}


// The step the panel starts on: CHECK when a plan exists, otherwise PICK.
export function initialPlanStep(stopCount: number, hasPlan: boolean): PlanStep {
    if (stopCount > 0 && hasPlan) {
        return "check";
    }
    return "pick";
}


// The step actually shown: a chosen step that is not available (for example every stop removed) falls back to PICK.
export function effectivePlanStep(chosenStep: PlanStep, stopCount: number): PlanStep {
    if (stepAvailability(chosenStep, stopCount).isEnabled) {
        return chosenStep;
    }
    return "pick";
}


export function startWalkState(input: StartWalkInput): StartWalkState {
    let label = "START WALK";
    let note: string | null = null;
    if (input.isWalkRunning) {
        label = "RESTART WALK";
        note = "The walk follows the plan frozen at start";
    }

    if (input.stopCount === 0) {
        return { isEnabled: false, label, reason: "Add a Knot first", note };
    }
    if (input.status === "computing") {
        return { isEnabled: false, label, reason: "Computing the plan", note };
    }
    if (input.status === "plan_failed") {
        return { isEnabled: false, label, reason: "Plan failed: change a stop to try again", note };
    }
    if (input.status !== "plan_ready" || input.feasibility === null) {
        return { isEnabled: false, label, reason: "Plan not ready yet", note };
    }
    if (input.unreachableKnotCount > 0) {
        return { isEnabled: false, label, reason: "A Knot cannot be reached: remove it", note };
    }
    if (input.feasibility === "no_go") {
        return { isEnabled: false, label, reason: "Plan does not fit: drop a task", note };
    }
    return { isEnabled: true, label, reason: null, note };
}
