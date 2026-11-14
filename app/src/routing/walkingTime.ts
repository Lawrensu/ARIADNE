// The shared walking-time function (docs/contracts.md section 4).
// The pipeline has the same function in Python (pipeline/ariadne_pipeline/walking.py) and uses it
// for return_field.bin. Both must give the same result, so this follows contracts.md 4.4 exactly.
// Walking times are model estimates (Tobler's hiking function adapted for a suit), shown as "est.".

import type { WalkingParameters } from "../data/contracts";




// The subset of meta.json parameters (contracts.md 3.1) the walking function needs.
export type WalkingTimeParameters = Pick<
    WalkingParameters,
    "suit_speed_factor" | "gravity_adjustment" | "max_walkable_slope_deg"
>;


// Contract values in v1.0.0 (contracts.md 4.4, D-019). The app passes meta.parameters when present.
export const DEFAULT_WALKING_PARAMETERS: WalkingTimeParameters = {
    suit_speed_factor: 0.6,
    gravity_adjustment: 1.0,
    max_walkable_slope_deg: 25,
};


// Tobler's peak speed on Earth, km/h (contracts.md 4.3). Reached on a gentle downhill (S = -0.05).
const TOBLER_PEAK_SPEED_KMH = 6;




// Seconds to walk one step on ground with penalty 1 (contracts.md 4.1 and 4.4).
// horizontal_distance_m > 0. elevation_change_m is signed: positive uphill, negative downhill.
// Returns +Infinity when the step is steeper than max_walkable_slope_deg.
export function walkingTimeSeconds(
    horizontal_distance_m: number,
    elevation_change_m: number,
    parameters: WalkingTimeParameters = DEFAULT_WALKING_PARAMETERS,
): number {
    const slopeRatio = elevation_change_m / horizontal_distance_m;
    const slopeDegrees = (Math.atan(Math.abs(slopeRatio)) * 180) / Math.PI;
    if (slopeDegrees > parameters.max_walkable_slope_deg) {
        return Number.POSITIVE_INFINITY;
    }

    const speedKmh =
        TOBLER_PEAK_SPEED_KMH *
        Math.exp(-3.5 * Math.abs(slopeRatio + 0.05)) *
        parameters.suit_speed_factor *
        parameters.gravity_adjustment;
    return horizontal_distance_m / (speedKmh / 3.6);
}


// The fastest any step can be walked, m/s: Tobler's peak speed with the suit and gravity factors.
// Used by the A* and D* Lite heuristics: every edge costs at least distance / peak speed, because
// exp(...) <= 1 and traversal_penalty >= 1 (contracts.md 3.5), so the heuristic never overestimates.
export function peakWalkingSpeedMetresPerSecond(
    parameters: WalkingTimeParameters = DEFAULT_WALKING_PARAMETERS,
): number {
    const peakSpeedKmh = TOBLER_PEAK_SPEED_KMH * parameters.suit_speed_factor * parameters.gravity_adjustment;
    return peakSpeedKmh / 3.6;
}
