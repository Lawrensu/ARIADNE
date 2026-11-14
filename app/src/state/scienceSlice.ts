// Science slice: the science plan (D-027, contracts.md 4.6). Owner: Malissa, Stage 2.
// The planner in src/science/ fills sciencePlan; the Planning Table edits the stops and tasks;
// Stage 3 (Letta) checks off tasks at Knots by writing completedTaskIds, which sets the carried load.

import type { StateCreator } from "zustand";

import type { LocalPosition, Provenance } from "../data/contracts";
import type { AriadneState } from "./store";



// One planned stop: a Knot and the tasks chosen there, in the order they are done.
export interface SciencePlanStop {
    knot_id: string;
    chosen_task_ids: string[];
}


// "walk_to_knot": rover or previous Knot to the next Knot. "walk_back_to_rover": last stop to the rover.
export type SciencePlanLegKind = "walk_to_knot" | "walk_back_to_rover";


export interface SciencePlanLeg {
    leg_kind: SciencePlanLegKind;
    from_label: string;
    to_label: string;
    // The Knot this leg ends at; null for the walk back to the rover.
    to_knot_id: string | null;
    // Load carried on this leg (tool kit plus samples taken before it), kg, est.
    carried_load_kg: number;
    load_factor: number;
    // Contract walking time without load (contracts.md 4.2), seconds, est.
    unloaded_walking_time_s: number;
    // unloaded_walking_time_s * load_factor (contracts.md 4.6), seconds, est.
    walking_time_s: number;
    horizontal_distance_m: number;
    // Cell centres along the leg in local grid metres (empty when the leg is timed from return_field).
    path_positions: LocalPosition[];
    is_estimate: true;
}


export interface SciencePlanTaskEntry {
    knot_id: string;
    task_id: string;
    label: string;
    duration_s: number;
    sample_mass_kg: number;
    // Carried load right after this task, kg, est.
    carried_load_after_kg: number;
    provenance: Provenance;
}


// "go": fits with margin; "caution": fits but the margin is small; "no_go": does not fit.
export type SciencePlanFeasibility = "go" | "caution" | "no_go";


export interface DropTaskSuggestion {
    knot_id: string;
    task_id: string;
    label: string;
    // Plan time saved by dropping it (task time plus slower walking from its sample mass), seconds, est.
    saves_s: number;
}


export interface SciencePlan {
    stops: SciencePlanStop[];
    legs: SciencePlanLeg[];
    tasks: SciencePlanTaskEntry[];
    total_walking_time_s: number;
    total_task_time_s: number;
    // Walking legs + tasks + walk back (contracts.md 4.6 rule 2).
    total_plan_time_s: number;
    // planned_marswalk_hours * 3600 - reserve_minutes * 60 (contracts.md 4.6 rule 3).
    plan_time_limit_s: number;
    // plan_time_limit_s - total_plan_time_s; negative when the plan does not fit.
    science_budget_left_s: number;
    is_feasible: boolean;
    feasibility: SciencePlanFeasibility;
    // Set when the plan does not fit (or is tight): the task whose removal helps most.
    drop_task_suggestion: DropTaskSuggestion | null;
    // Knots in the plan that cannot be reached on the walkable grid.
    unreachable_knot_ids: string[];
    is_estimate: true;
}


// "idle": no plan requested. "computing": legs are being routed. "plan_ready": sciencePlan is set.
// "plan_failed": an error occurred (see sciencePlanError).
export type SciencePlanStatus = "idle" | "computing" | "plan_ready" | "plan_failed";


export interface ScienceSlice {
    sciencePlanStops: SciencePlanStop[];
    sciencePlan: SciencePlan | null;
    sciencePlanStatus: SciencePlanStatus;
    sciencePlanError: string | null;
    // Tasks already done on this walk; their sample mass is carried from then on (contracts.md 4.6).
    completedTaskIds: string[];
    addSciencePlanStop: (knotId: string, chosenTaskIds: string[]) => void;
    removeSciencePlanStop: (knotId: string) => void;
    moveSciencePlanStop: (knotId: string, direction: "earlier" | "later") => void;
    toggleSciencePlanTask: (knotId: string, taskId: string) => void;
    setSciencePlanStops: (stops: SciencePlanStop[]) => void;
    setSciencePlan: (plan: SciencePlan | null, status: SciencePlanStatus) => void;
    setSciencePlanStatus: (status: SciencePlanStatus, error?: string | null) => void;
    setTaskCompleted: (taskId: string, isCompleted: boolean) => void;
    clearSciencePlan: () => void;
}



export const createScienceSlice: StateCreator<AriadneState, [], [], ScienceSlice> = (set) => ({
    sciencePlanStops: [],
    sciencePlan: null,
    sciencePlanStatus: "idle",
    sciencePlanError: null,
    completedTaskIds: [],

    addSciencePlanStop: (knotId, chosenTaskIds) =>
        set((state) => {
            const alreadyPlanned = state.sciencePlanStops.some((stop) => stop.knot_id === knotId);
            if (alreadyPlanned) {
                return {};
            }
            return { sciencePlanStops: [...state.sciencePlanStops, { knot_id: knotId, chosen_task_ids: [...chosenTaskIds] }] };
        }),

    removeSciencePlanStop: (knotId) =>
        set((state) => ({ sciencePlanStops: state.sciencePlanStops.filter((stop) => stop.knot_id !== knotId) })),

    moveSciencePlanStop: (knotId, direction) =>
        set((state) => {
            const stops = [...state.sciencePlanStops];
            const index = stops.findIndex((stop) => stop.knot_id === knotId);
            if (index < 0) {
                return {};
            }
            let targetIndex: number;
            if (direction === "earlier") {
                targetIndex = index - 1;
            } else {
                targetIndex = index + 1;
            }
            if (targetIndex < 0 || targetIndex >= stops.length) {
                return {};
            }
            const moved = stops[index];
            stops[index] = stops[targetIndex];
            stops[targetIndex] = moved;
            return { sciencePlanStops: stops };
        }),

    toggleSciencePlanTask: (knotId, taskId) =>
        set((state) => ({
            sciencePlanStops: state.sciencePlanStops.map((stop) => {
                if (stop.knot_id !== knotId) {
                    return stop;
                }
                if (stop.chosen_task_ids.includes(taskId)) {
                    return { ...stop, chosen_task_ids: stop.chosen_task_ids.filter((id) => id !== taskId) };
                }
                return { ...stop, chosen_task_ids: [...stop.chosen_task_ids, taskId] };
            }),
        })),

    setSciencePlanStops: (stops) => set({ sciencePlanStops: stops }),

    setSciencePlan: (plan, status) => set({ sciencePlan: plan, sciencePlanStatus: status, sciencePlanError: null }),

    setSciencePlanStatus: (status, error = null) => set({ sciencePlanStatus: status, sciencePlanError: error }),

    setTaskCompleted: (taskId, isCompleted) =>
        set((state) => {
            const isAlreadyCompleted = state.completedTaskIds.includes(taskId);
            if (isCompleted) {
                if (isAlreadyCompleted) {
                    return {};
                }
                return { completedTaskIds: [...state.completedTaskIds, taskId] };
            }
            return { completedTaskIds: state.completedTaskIds.filter((id) => id !== taskId) };
        }),

    clearSciencePlan: () => set({ sciencePlanStops: [], sciencePlan: null, sciencePlanStatus: "idle", sciencePlanError: null }),
});
