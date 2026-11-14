// Small selector the UI (Suit HUD, Planning Table) can use for the Thread readouts (owner: Malissa, Stage 2).
// contracts.md 4.6 (D-027): the Thread uses return_field x load_factor against the time left.

import type { ProcessedData } from "../data/loadProcessed";
import { carriedLoadKg, loadFactor, loadParametersFromMeta } from "../science/loadFactor";
import { computeConsumablesState } from "../sim/clock";
import { computeReachableAreaSquareMetres, effectiveReturnFieldThresholdSeconds } from "./threadContour";



export const THREAD_PROVENANCE_LINE =
    "Derived from return_field.bin (ARIADNE walking model, contracts.md 4) x load factor " +
    "(1 + 0.01 x carried kg, 10 kg tool kit plus samples, est., D-027) against the time left " +
    "(planned Marswalk time minus elapsed minus reserve, D-020, contracts.md 4.6), est.";


export interface ThreadInfo {
    // Time left in seconds (planned minus elapsed minus reserve, floored at 0). Same value as threshold_seconds.
    time_left_s: number;
    // Kept for existing readers: same value as time_left_s.
    threshold_seconds: number;
    carried_load_kg: number;
    load_factor: number;
    // time_left_s / load_factor: the return_field value the ring is drawn at.
    effective_return_field_threshold_s: number;
    reachable_area_square_metres: number;
    provenance: string;
    is_estimate: true;
}


// Thread readouts at a simulated time and carried load (full resolution, exact; not quantised).
export function computeThreadInfo(
    processedData: ProcessedData,
    simElapsedSeconds: number,
    completedTaskIds: string[],
): ThreadInfo {
    const consumables = computeConsumablesState(simElapsedSeconds, processedData.meta.parameters);
    const loadParameters = loadParametersFromMeta(processedData.meta.parameters);
    const carriedKg = carriedLoadKg(processedData.knots, completedTaskIds, loadParameters);
    const currentLoadFactor = loadFactor(carriedKg, loadParameters);
    const effectiveThresholdSeconds = effectiveReturnFieldThresholdSeconds(
        consumables.planned_time_left_s,
        currentLoadFactor,
    );
    return {
        time_left_s: consumables.planned_time_left_s,
        threshold_seconds: consumables.planned_time_left_s,
        carried_load_kg: carriedKg,
        load_factor: currentLoadFactor,
        effective_return_field_threshold_s: effectiveThresholdSeconds,
        reachable_area_square_metres: computeReachableAreaSquareMetres(
            processedData.float32Layers.return_field,
            processedData.meta.grid,
            effectiveThresholdSeconds,
        ),
        provenance: THREAD_PROVENANCE_LINE,
        is_estimate: true,
    };
}
