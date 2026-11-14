// Small selector the UI (Suit HUD, Planning Table) can use for the Thread readouts (owner: Malissa, Stage 2).

import type { ProcessedData } from "../data/loadProcessed";
import { computeConsumablesState } from "../sim/clock";
import { computeReachableAreaSquareMetres } from "./threadContour";



export const THREAD_PROVENANCE_LINE =
    "Derived from return_field.bin (ARIADNE walking model, contracts.md 4) and suit consumables D-020, est.";


export interface ThreadInfo {
    threshold_seconds: number;
    reachable_area_square_metres: number;
    provenance: string;
    is_estimate: true;
}


// Threshold and reachable area at a simulated time (full resolution, exact; not quantised).
export function computeThreadInfo(processedData: ProcessedData, simElapsedSeconds: number): ThreadInfo {
    const consumables = computeConsumablesState(simElapsedSeconds, processedData.meta.parameters);
    return {
        threshold_seconds: consumables.thread_threshold_s,
        reachable_area_square_metres: computeReachableAreaSquareMetres(
            processedData.float32Layers.return_field,
            processedData.meta.grid,
            consumables.thread_threshold_s,
        ),
        provenance: THREAD_PROVENANCE_LINE,
        is_estimate: true,
    };
}
