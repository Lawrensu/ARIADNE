// Carried load and the load factor (docs/contracts.md 4.6, D-027). Owner: Malissa, Stage 2.
// Shared by the science planner (src/science/), the Thread (src/thread/) and Stage 3 (task check-off).
//
//   load_factor = 1 + load_time_factor_per_kg * carried_load_kg
//   walking time with load = walking_time_seconds(...) * load_factor
//   seconds to walk back now = return_field[cell] * load_factor
//
// carried_load_kg = base_carried_load_kg (tool kit) + sample_mass_kg of every task done so far.
// All values are estimates and are shown with "est.".

import type { Knot, ScienceTask, WalkingParameters } from "../data/contracts";



export interface LoadParameters {
    base_carried_load_kg: number;
    load_time_factor_per_kg: number;
}


// Contract values in v1.1.0 (contracts.md 4.6). Used only when meta.json parameters lack the fields
// (v1.0.0 data); the app always prefers meta.json.
export const CONTRACT_LOAD_PARAMETERS: LoadParameters = {
    base_carried_load_kg: 10,
    load_time_factor_per_kg: 0.01,
};



export function loadParametersFromMeta(parameters: WalkingParameters | undefined): LoadParameters {
    if (parameters === undefined) {
        return CONTRACT_LOAD_PARAMETERS;
    }
    let baseCarriedLoadKg = CONTRACT_LOAD_PARAMETERS.base_carried_load_kg;
    if (typeof parameters.base_carried_load_kg === "number") {
        baseCarriedLoadKg = parameters.base_carried_load_kg;
    }
    let loadTimeFactorPerKg = CONTRACT_LOAD_PARAMETERS.load_time_factor_per_kg;
    if (typeof parameters.load_time_factor_per_kg === "number") {
        loadTimeFactorPerKg = parameters.load_time_factor_per_kg;
    }
    return {
        base_carried_load_kg: baseCarriedLoadKg,
        load_time_factor_per_kg: loadTimeFactorPerKg,
    };
}


// contracts.md 4.6: load_factor = 1 + load_time_factor_per_kg * carried_load_kg.
export function loadFactor(carriedLoadKg: number, loadParameters: LoadParameters = CONTRACT_LOAD_PARAMETERS): number {
    return 1 + loadParameters.load_time_factor_per_kg * carriedLoadKg;
}


// Every science task of every Knot, by task_id (task_id is unique across all Knots, contracts.md 3.12).
export function scienceTasksById(knots: Knot[]): Map<string, { knot_id: string; task: ScienceTask }> {
    const tasks = new Map<string, { knot_id: string; task: ScienceTask }>();
    for (const knot of knots) {
        for (const task of knot.science_tasks) {
            tasks.set(task.task_id, { knot_id: knot.knot_id, task });
        }
    }
    return tasks;
}


// Load carried now: the tool kit plus the samples of every completed task. Unknown task ids are ignored.
export function carriedLoadKg(knots: Knot[], completedTaskIds: string[], loadParameters: LoadParameters): number {
    const tasks = scienceTasksById(knots);
    let loadKg = loadParameters.base_carried_load_kg;
    for (const taskId of completedTaskIds) {
        const entry = tasks.get(taskId);
        if (entry !== undefined) {
            loadKg += entry.task.sample_mass_kg;
        }
    }
    return loadKg;
}
