// Science plan (D-027, docs/contracts.md 4.6). Owner: Malissa, Stage 2. Pure, testable in Node.
//
// A plan starts at the rover (staging point), visits the chosen Knots in order, does the chosen
// tasks at each, and walks back to the rover from the last Knot.
//
//   carried_load_kg = base_carried_load_kg + sample_mass_kg of every task done so far
//   walking leg time = contract walking time of the "fast" A* path (contracts.md 4.2) x load_factor
//   walk back time  = return_field[last Knot cell] x load_factor (exact, the same as the Thread)
//   plan time       = walking legs + task durations + walk back (contracts.md 4.6 rule 2)
//   feasible        = plan time <= planned_marswalk_hours * 3600 - reserve_minutes * 60 (rule 3)
//
// A task's sample mass is carried from right after that task. Seconds everywhere. Every number
// here is a model estimate and is shown with "est.".
//
// checkNextTaskDuringWalk() is the live check of contracts.md 4.6 rule 4 for Stage 3 (Suit HUD).

import type { GridDefinition, Knot, LocalPosition, ScienceTask, WalkingParameters } from "../data/contracts";
import { cellFromPosition, cellIndex } from "../data/grid";
import type {
    DropTaskSuggestion,
    SciencePlan,
    SciencePlanFeasibility,
    SciencePlanLeg,
    SciencePlanStop,
    SciencePlanTaskEntry,
} from "../state/scienceSlice";
import { loadFactor, loadParametersFromMeta, scienceTasksById } from "./loadFactor";




// Below this science budget left a feasible plan is "caution" instead of "go". 15 minutes, est.:
// about the time of one short task, so a small delay (a detour, a slow sample) still fits.
export const CAUTION_MARGIN_SECONDS = 15 * 60;


// D-020 values, used only when meta.json has no parameters (v1.0.0 data); meta.json always wins.
export const CONTRACT_PLAN_TIME_PARAMETERS = {
    planned_marswalk_hours: 6,
    reserve_minutes: 30,
};


// Label of the plan's start and end in legs (the pressurised rover at the staging point).
export const ROVER_LABEL = "Rover";




// One walking leg as routed by A* "fast", without load (contracts.md 4.2).
export interface RoutedLeg {
    unloaded_walking_time_s: number;
    horizontal_distance_m: number;
    path_positions: LocalPosition[];
}


// Routes one leg; null when "to" cannot be reached from "from". Tests pass synthetic routers or
// direct A*; the app passes the routing worker's computeFastLegs results.
export type LegRouter = (from: LocalPosition, to: LocalPosition) => Promise<RoutedLeg | null>;


export interface SciencePlanInput {
    knots: Knot[];
    // In the order they are visited.
    stops: SciencePlanStop[];
    // meta.json parameters (planned_marswalk_hours, reserve_minutes, load fields).
    parameters: WalkingParameters | undefined;
    grid: GridDefinition;
    // return_field.bin (contracts.md 3.6): seconds from a cell to the staging point, unloaded.
    returnField: Float32Array;
    stagingPoint: LocalPosition;
    routeLeg: LegRouter;
}


// A task that could be dropped, with the unloaded walking time of every leg after it (its sample
// mass is carried on those legs, including the walk back).
export interface DropCandidate {
    knot_id: string;
    task_id: string;
    label: string;
    duration_s: number;
    sample_mass_kg: number;
    unloaded_walking_time_after_s: number;
}




// contracts.md 4.6 rule 3: planned_marswalk_hours * 3600 - reserve_minutes * 60, seconds.
export function planTimeLimitSeconds(parameters: WalkingParameters | undefined): number {
    let plannedMarswalkHours = CONTRACT_PLAN_TIME_PARAMETERS.planned_marswalk_hours;
    let reserveMinutes = CONTRACT_PLAN_TIME_PARAMETERS.reserve_minutes;
    if (parameters !== undefined) {
        plannedMarswalkHours = parameters.planned_marswalk_hours;
        reserveMinutes = parameters.reserve_minutes;
    }
    return plannedMarswalkHours * 3600 - reserveMinutes * 60;
}


// return_field (contracts.md 3.6) at the cell containing the position: unloaded seconds to walk
// back to the staging point. +Infinity = unreachable.
export function returnFieldSecondsAt(grid: GridDefinition, returnField: Float32Array, position: LocalPosition): number {
    const index = cellIndex(grid, cellFromPosition(grid, position));
    const value = returnField[index];
    if (value === undefined || Number.isNaN(value)) {
        return Number.POSITIVE_INFINITY;
    }
    return value;
}


function knotPosition(knot: Knot): LocalPosition {
    return { x_m: knot.x_m, z_m: knot.z_m };
}


// "no_go" if not feasible; "caution" if feasible but less than CAUTION_MARGIN_SECONDS is left;
// otherwise "go".
export function feasibilityOf(isFeasible: boolean, scienceBudgetLeftSeconds: number): SciencePlanFeasibility {
    if (!isFeasible) {
        return "no_go";
    }
    if (scienceBudgetLeftSeconds < CAUTION_MARGIN_SECONDS) {
        return "caution";
    }
    return "go";
}




// Plan time saved by dropping one task: its duration plus the slower walking its sample mass
// causes on every later leg. Exact, because load_factor is linear in the load (contracts.md 4.6):
// each later leg loses unloaded_time * load_time_factor_per_kg * sample_mass_kg.
export function dropSavingsSeconds(candidate: DropCandidate, loadTimeFactorPerKg: number): number {
    const slowerWalkingSeconds = candidate.unloaded_walking_time_after_s * loadTimeFactorPerKg * candidate.sample_mass_kg;
    return candidate.duration_s + slowerWalkingSeconds;
}


// The task to suggest dropping so the plan time comes down to targetPlanTimeSeconds:
// 1. among tasks whose removal alone is enough, the one with the smallest duration (least science
//    lost; ties: the larger saving, then the earlier task);
// 2. if no single task is enough, the one that saves the most plan time (ties: the earlier task).
// null when there are no candidates.
export function suggestTaskToDrop(
    candidates: DropCandidate[],
    totalPlanTimeSeconds: number,
    targetPlanTimeSeconds: number,
    loadTimeFactorPerKg: number,
): DropTaskSuggestion | null {
    let bestSufficient: { candidate: DropCandidate; savesSeconds: number } | null = null;
    let bestSaver: { candidate: DropCandidate; savesSeconds: number } | null = null;

    for (const candidate of candidates) {
        const savesSeconds = dropSavingsSeconds(candidate, loadTimeFactorPerKg);

        if (bestSaver === null) {
            bestSaver = { candidate, savesSeconds };
        } else {
            if (savesSeconds > bestSaver.savesSeconds) {
                bestSaver = { candidate, savesSeconds };
            }
        }

        const isEnoughAlone = totalPlanTimeSeconds - savesSeconds <= targetPlanTimeSeconds;
        if (!isEnoughAlone) {
            continue;
        }
        if (bestSufficient === null) {
            bestSufficient = { candidate, savesSeconds };
        } else {
            if (candidate.duration_s < bestSufficient.candidate.duration_s) {
                bestSufficient = { candidate, savesSeconds };
            } else {
                if (candidate.duration_s === bestSufficient.candidate.duration_s) {
                    if (savesSeconds > bestSufficient.savesSeconds) {
                        bestSufficient = { candidate, savesSeconds };
                    }
                }
            }
        }
    }

    let chosen = bestSufficient;
    if (chosen === null) {
        chosen = bestSaver;
    }
    if (chosen === null) {
        return null;
    }
    return {
        knot_id: chosen.candidate.knot_id,
        task_id: chosen.candidate.task_id,
        label: chosen.candidate.label,
        saves_s: chosen.savesSeconds,
    };
}


// When to suggest a drop and what it must achieve:
// - plan time over the limit: bring it within the limit (feasible again);
// - within the limit but "caution": bring the science budget left up to CAUTION_MARGIN_SECONDS ("go");
// - otherwise: no suggestion.
// Unreachable Knots make a plan "no_go" too, but dropping a task cannot fix that, so they do not
// trigger a suggestion on their own.
export function dropTaskSuggestionForPlan(
    candidates: DropCandidate[],
    totalPlanTimeSeconds: number,
    planTimeLimitS: number,
    loadTimeFactorPerKg: number,
): DropTaskSuggestion | null {
    if (candidates.length === 0) {
        return null;
    }
    const scienceBudgetLeftSeconds = planTimeLimitS - totalPlanTimeSeconds;
    if (totalPlanTimeSeconds > planTimeLimitS) {
        return suggestTaskToDrop(candidates, totalPlanTimeSeconds, planTimeLimitS, loadTimeFactorPerKg);
    }
    if (scienceBudgetLeftSeconds < CAUTION_MARGIN_SECONDS) {
        return suggestTaskToDrop(candidates, totalPlanTimeSeconds, planTimeLimitS - CAUTION_MARGIN_SECONDS, loadTimeFactorPerKg);
    }
    return null;
}




// The chosen tasks of a stop that exist and belong to that Knot, each once in the whole plan.
// Unknown task ids (and ids of tasks at another Knot) are ignored.
function chosenTasksOfStop(
    stop: SciencePlanStop,
    tasksById: Map<string, { knot_id: string; task: ScienceTask }>,
    usedTaskIds: Set<string>,
): ScienceTask[] {
    const chosen: ScienceTask[] = [];
    for (const taskId of stop.chosen_task_ids) {
        const entry = tasksById.get(taskId);
        if (entry === undefined) {
            continue;
        }
        if (entry.knot_id !== stop.knot_id) {
            continue;
        }
        if (usedTaskIds.has(taskId)) {
            continue;
        }
        usedTaskIds.add(taskId);
        chosen.push(entry.task);
    }
    return chosen;
}


// Builds the science plan (contracts.md 4.6). Stops whose Knot is unknown, has no finite
// return_field, or cannot be reached from the previous stop go in unreachable_knot_ids and are
// skipped (the next leg starts from the last reached stop); the plan is then "no_go".
//
// Walk back leg: walking_time_s = return_field[last Knot cell] x load_factor and
// unloaded_walking_time_s = return_field[last Knot cell] (exact, as the Thread). It is also routed
// with A* only so the UI can draw it (path_positions, horizontal_distance_m); if that route fails
// path_positions is empty and horizontal_distance_m is NaN (unknown, never faked).
export async function computeSciencePlan(input: SciencePlanInput): Promise<SciencePlan> {
    const loadParameters = loadParametersFromMeta(input.parameters);
    const tasksById = scienceTasksById(input.knots);
    const knotsById = new Map<string, Knot>();
    for (const knot of input.knots) {
        knotsById.set(knot.knot_id, knot);
    }
    const planTimeLimitS = planTimeLimitSeconds(input.parameters);

    const cleanedStops: SciencePlanStop[] = [];
    const legs: SciencePlanLeg[] = [];
    const tasks: SciencePlanTaskEntry[] = [];
    const unreachableKnotIds: string[] = [];
    const usedTaskIds = new Set<string>();
    // Each done task and the index of the first leg walked after it.
    const doneTasks: Array<{ task: ScienceTask; knotId: string; firstLaterLegIndex: number }> = [];

    let carriedLoadKg = loadParameters.base_carried_load_kg;
    let currentPosition: LocalPosition = { x_m: input.stagingPoint.x_m, z_m: input.stagingPoint.z_m };
    let currentLabel = ROVER_LABEL;
    let lastReachedKnot: Knot | null = null;

    for (const stop of input.stops) {
        const chosenTasks = chosenTasksOfStop(stop, tasksById, usedTaskIds);
        cleanedStops.push({ knot_id: stop.knot_id, chosen_task_ids: chosenTasks.map((task) => task.task_id) });

        const knot = knotsById.get(stop.knot_id);
        if (knot === undefined) {
            unreachableKnotIds.push(stop.knot_id);
            continue;
        }
        const returnFieldSeconds = returnFieldSecondsAt(input.grid, input.returnField, knotPosition(knot));
        if (!Number.isFinite(returnFieldSeconds)) {
            unreachableKnotIds.push(stop.knot_id);
            continue;
        }
        const routed = await input.routeLeg(currentPosition, knotPosition(knot));
        if (routed === null) {
            unreachableKnotIds.push(stop.knot_id);
            continue;
        }
        if (!Number.isFinite(routed.unloaded_walking_time_s)) {
            unreachableKnotIds.push(stop.knot_id);
            continue;
        }

        // The load on this leg: tool kit plus the samples of every task before it.
        const legLoadFactor = loadFactor(carriedLoadKg, loadParameters);
        legs.push({
            leg_kind: "walk_to_knot",
            from_label: currentLabel,
            to_label: knot.name,
            to_knot_id: knot.knot_id,
            carried_load_kg: carriedLoadKg,
            load_factor: legLoadFactor,
            unloaded_walking_time_s: routed.unloaded_walking_time_s,
            walking_time_s: routed.unloaded_walking_time_s * legLoadFactor,
            horizontal_distance_m: routed.horizontal_distance_m,
            path_positions: routed.path_positions,
            is_estimate: true,
        });

        for (const task of chosenTasks) {
            // The sample is carried from right after the task (contracts.md 4.6).
            carriedLoadKg += task.sample_mass_kg;
            tasks.push({
                knot_id: knot.knot_id,
                task_id: task.task_id,
                label: task.label,
                duration_s: task.duration_minutes * 60,
                sample_mass_kg: task.sample_mass_kg,
                carried_load_after_kg: carriedLoadKg,
                provenance: task.provenance,
            });
            doneTasks.push({ task, knotId: knot.knot_id, firstLaterLegIndex: legs.length });
        }

        currentPosition = knotPosition(knot);
        currentLabel = knot.name;
        lastReachedKnot = knot;
    }

    if (lastReachedKnot !== null) {
        const lastKnotPosition = knotPosition(lastReachedKnot);
        const returnFieldSeconds = returnFieldSecondsAt(input.grid, input.returnField, lastKnotPosition);
        const walkBackLoadFactor = loadFactor(carriedLoadKg, loadParameters);
        // Routed only for drawing; the time comes from return_field.
        const routed = await input.routeLeg(lastKnotPosition, input.stagingPoint);
        let horizontalDistanceMetres = Number.NaN;
        let pathPositions: LocalPosition[] = [];
        if (routed !== null) {
            horizontalDistanceMetres = routed.horizontal_distance_m;
            pathPositions = routed.path_positions;
        }
        legs.push({
            leg_kind: "walk_back_to_rover",
            from_label: lastReachedKnot.name,
            to_label: ROVER_LABEL,
            to_knot_id: null,
            carried_load_kg: carriedLoadKg,
            load_factor: walkBackLoadFactor,
            unloaded_walking_time_s: returnFieldSeconds,
            walking_time_s: returnFieldSeconds * walkBackLoadFactor,
            horizontal_distance_m: horizontalDistanceMetres,
            path_positions: pathPositions,
            is_estimate: true,
        });
    }

    let totalWalkingTimeSeconds = 0;
    for (const leg of legs) {
        totalWalkingTimeSeconds += leg.walking_time_s;
    }
    let totalTaskTimeSeconds = 0;
    for (const task of tasks) {
        totalTaskTimeSeconds += task.duration_s;
    }
    // total_walking_time_s includes the walk back (contracts.md 4.6 rule 2).
    const totalPlanTimeSeconds = totalWalkingTimeSeconds + totalTaskTimeSeconds;
    const scienceBudgetLeftSeconds = planTimeLimitS - totalPlanTimeSeconds;

    let isFeasible = true;
    if (unreachableKnotIds.length > 0) {
        isFeasible = false;
    } else {
        if (totalPlanTimeSeconds > planTimeLimitS) {
            isFeasible = false;
        }
    }

    // Unloaded walking time from each leg to the end, for the drop savings.
    const unloadedWalkingFromLegSeconds: number[] = new Array(legs.length + 1).fill(0);
    for (let legIndex = legs.length - 1; legIndex >= 0; legIndex--) {
        unloadedWalkingFromLegSeconds[legIndex] = unloadedWalkingFromLegSeconds[legIndex + 1] + legs[legIndex].unloaded_walking_time_s;
    }
    const candidates: DropCandidate[] = doneTasks.map((doneTask) => ({
        knot_id: doneTask.knotId,
        task_id: doneTask.task.task_id,
        label: doneTask.task.label,
        duration_s: doneTask.task.duration_minutes * 60,
        sample_mass_kg: doneTask.task.sample_mass_kg,
        unloaded_walking_time_after_s: unloadedWalkingFromLegSeconds[doneTask.firstLaterLegIndex],
    }));
    const dropTaskSuggestion = dropTaskSuggestionForPlan(
        candidates,
        totalPlanTimeSeconds,
        planTimeLimitS,
        loadParameters.load_time_factor_per_kg,
    );

    return {
        stops: cleanedStops,
        legs,
        tasks,
        total_walking_time_s: totalWalkingTimeSeconds,
        total_task_time_s: totalTaskTimeSeconds,
        total_plan_time_s: totalPlanTimeSeconds,
        plan_time_limit_s: planTimeLimitS,
        science_budget_left_s: scienceBudgetLeftSeconds,
        is_feasible: isFeasible,
        feasibility: feasibilityOf(isFeasible, scienceBudgetLeftSeconds),
        drop_task_suggestion: dropTaskSuggestion,
        unreachable_knot_ids: unreachableKnotIds,
        is_estimate: true,
    };
}




// Live check during the walk (contracts.md 4.6 rule 4), for Stage 3 (Suit HUD, Knot cards).
export interface NextTaskCheckInput {
    // meta.json parameters (planned_marswalk_hours, reserve_minutes, load fields).
    parameters: WalkingParameters | undefined;
    // Marswalk time elapsed so far, seconds.
    elapsed_s: number;
    // return_field at the astronaut's current cell, unloaded seconds.
    current_return_field_s: number;
    // Load carried now (tool kit plus samples of completed tasks), kg.
    carried_load_kg: number;
    // Unloaded walking time from here to the next task's Knot (A* "fast"); 0 when already there.
    walk_to_next_knot_unloaded_s: number;
    // return_field at the next task's Knot cell, unloaded seconds.
    next_knot_return_field_s: number;
    next_task_duration_s: number;
    next_task_sample_mass_kg: number;
}


export interface NextTaskCheck {
    // planned_marswalk_hours * 3600 - elapsed - reserve_minutes * 60.
    time_left_s: number;
    // return_field[current cell] * load_factor(carried load now).
    walk_back_now_s: number;
    // time_left_s - walk_back_now_s: the Thread margin.
    thread_margin_s: number;
    // Extra time the next task needs compared with walking back now: walk to its Knot with the
    // current load, the task, and the walk back from that Knot with its sample, minus walk_back_now_s.
    next_task_cost_s: number;
    // thread_margin_s - next_task_cost_s: what is left if the next task is done.
    margin_after_next_task_s: number;
    // true when the margin is below the next task's cost: suggest dropping it.
    should_drop_next_task: boolean;
    is_estimate: true;
}


// contracts.md 4.6 rule 4: the Thread compares return_field x load_factor with the time left; if
// the margin drops below the time of the next task plus its walk back, suggest dropping that task.
// "Plus its walk back" is read as the walk to that Knot, the task, and the walk back from it with
// the sample's extra load, counted against the walk back from here (so it is not counted twice).
// When the astronaut is at the Knot this is: drop if time_left < duration + return_field x load_factor(after).
export function checkNextTaskDuringWalk(input: NextTaskCheckInput): NextTaskCheck {
    const loadParameters = loadParametersFromMeta(input.parameters);
    const timeLeftSeconds = planTimeLimitSeconds(input.parameters) - input.elapsed_s;
    const loadFactorNow = loadFactor(input.carried_load_kg, loadParameters);
    const loadFactorAfterTask = loadFactor(input.carried_load_kg + input.next_task_sample_mass_kg, loadParameters);

    const walkBackNowSeconds = input.current_return_field_s * loadFactorNow;
    const threadMarginSeconds = timeLeftSeconds - walkBackNowSeconds;

    const walkToNextKnotSeconds = input.walk_to_next_knot_unloaded_s * loadFactorNow;
    const walkBackFromNextKnotSeconds = input.next_knot_return_field_s * loadFactorAfterTask;
    const nextTaskCostSeconds = walkToNextKnotSeconds + input.next_task_duration_s + walkBackFromNextKnotSeconds - walkBackNowSeconds;
    const marginAfterNextTaskSeconds = threadMarginSeconds - nextTaskCostSeconds;

    let shouldDropNextTask = false;
    if (!Number.isFinite(marginAfterNextTaskSeconds)) {
        // An unreachable Knot or position: the task cannot be done safely.
        shouldDropNextTask = true;
    } else {
        if (marginAfterNextTaskSeconds < 0) {
            shouldDropNextTask = true;
        }
    }

    return {
        time_left_s: timeLeftSeconds,
        walk_back_now_s: walkBackNowSeconds,
        thread_margin_s: threadMarginSeconds,
        next_task_cost_s: nextTaskCostSeconds,
        margin_after_next_task_s: marginAfterNextTaskSeconds,
        should_drop_next_task: shouldDropNextTask,
        is_estimate: true,
    };
}
