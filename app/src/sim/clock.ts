// Simulation clock: pure time and consumables maths plus one React hook that ticks the store
// (owner: Malissa, Stage 2; Letta extends sim/ in Stage 3 with the scenario engine and environment replay).
//
// The clock is a replay clock, not live data (D-014): simElapsedSeconds is "simulated seconds since the
// Marswalk started". The suit is fully charged at 0. State lives in the store (state/simSlice.ts);
// this file only holds the logic, so it can be tested without React.
//
// EXTENSION POINTS for Letta:
//   - Scenario events (alerts, solar particle event) can read computeConsumablesState() and the store's
//     simElapsedSeconds; they do not need to touch the driver.
//   - To end the replay somewhere other than suit capability, change the limit used in useSimClockDriver().

import { useEffect } from "react";

import type { WalkingParameters } from "../data/contracts";
import { useAriadneStore } from "../state/store";



// Simulated seconds per real second offered in the controls. 1 = real time.
export const SIM_SPEED_PRESETS: number[] = [1, 10, 60, 300, 1200];

// A real frame delta larger than this (background tab, debugger pause) is clamped so the clock never jumps.
export const MAX_REAL_DELTA_SECONDS = 0.25;

const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_MINUTE = 60;


// Fallback consumables (D-020), used only when meta.parameters is missing:
// suit capability 8 h, planned Marswalk 6 h, reserve 30 min.
export const DEFAULT_CONSUMABLE_PARAMETERS = {
    suit_capability_hours: 8,
    planned_marswalk_hours: 6,
    reserve_minutes: 30,
};


export type ConsumableParameters = Pick<
    WalkingParameters,
    "suit_capability_hours" | "planned_marswalk_hours" | "reserve_minutes"
>;


export interface ConsumablesState {
    suit_capability_s: number;
    planned_marswalk_s: number;
    reserve_s: number;
    elapsed_s: number;
    suit_remaining_s: number;
    planned_remaining_s: number;
    // Time left for the Thread, contracts.md 4.6 rule 4 (D-027): planned Marswalk time minus elapsed time
    // minus the reserve, never below 0. CHANGED from v1.0.0 (suit remaining minus reserve). The Thread
    // compares return_field x load_factor against this value. Field name kept (deprecate-only habit).
    thread_threshold_s: number;
    // Same value as thread_threshold_s under a clearer name: planned walk time left.
    planned_time_left_s: number;
    // Model-derived (D-020), so always shown as "est.".
    is_estimate: true;
}



// New elapsed time after one frame, clamped to [0, limitSeconds].
export function advanceSimElapsedSeconds(
    elapsedSeconds: number,
    realDeltaSeconds: number,
    speedMultiplier: number,
    limitSeconds: number,
): number {
    const advanced = elapsedSeconds + realDeltaSeconds * speedMultiplier;
    if (advanced < 0) {
        return 0;
    }
    if (advanced > limitSeconds) {
        return limitSeconds;
    }
    return advanced;
}


// Consumables at a given simulated time. If parameters is undefined (meta.parameters missing) the
// D-020 fallback values are used.
export function computeConsumablesState(
    elapsedSeconds: number,
    parameters: ConsumableParameters | undefined,
): ConsumablesState {
    const used = parameters === undefined ? DEFAULT_CONSUMABLE_PARAMETERS : parameters;
    const suitCapabilitySeconds = used.suit_capability_hours * SECONDS_PER_HOUR;
    const plannedSeconds = used.planned_marswalk_hours * SECONDS_PER_HOUR;
    const reserveSeconds = used.reserve_minutes * SECONDS_PER_MINUTE;
    const suitRemainingSeconds = Math.max(0, suitCapabilitySeconds - elapsedSeconds);
    const plannedRemainingSeconds = Math.max(0, plannedSeconds - elapsedSeconds);
    // contracts.md 4.6 rule 4: time left = planned time - elapsed - reserve (floored at 0).
    // suit_remaining_s (8 h suit) stays for the O2 readout; the clock may still run to suit capability.
    const plannedTimeLeftSeconds = Math.max(0, plannedSeconds - elapsedSeconds - reserveSeconds);
    return {
        suit_capability_s: suitCapabilitySeconds,
        planned_marswalk_s: plannedSeconds,
        reserve_s: reserveSeconds,
        elapsed_s: elapsedSeconds,
        suit_remaining_s: suitRemainingSeconds,
        planned_remaining_s: plannedRemainingSeconds,
        thread_threshold_s: plannedTimeLeftSeconds,
        planned_time_left_s: plannedTimeLeftSeconds,
        is_estimate: true,
    };
}


// "H:MM:SS", for example 27015 -> "7:30:15". Negative or non-finite input shows as 0:00:00.
export function formatDurationHms(totalSeconds: number): string {
    let wholeSeconds = 0;
    if (Number.isFinite(totalSeconds) && totalSeconds > 0) {
        wholeSeconds = Math.floor(totalSeconds);
    }
    const hours = Math.floor(wholeSeconds / SECONDS_PER_HOUR);
    const minutes = Math.floor((wholeSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
    const seconds = wholeSeconds % SECONDS_PER_MINUTE;
    const minutesText = minutes < 10 ? `0${minutes}` : `${minutes}`;
    const secondsText = seconds < 10 ? `0${seconds}` : `${seconds}`;
    return `${hours}:${minutesText}:${secondsText}`;
}



// Mount once in the app. While isSimPlaying, advances simElapsedSeconds every animation frame by
// real delta x simSpeedMultiplier, and pauses at the suit capability. Cleans up on unmount.
export function useSimClockDriver(): void {
    useEffect(() => {
        let animationFrameId = 0;
        let lastTimestampMs: number | null = null;

        function onFrame(timestampMs: number) {
            const state = useAriadneStore.getState();
            if (state.isSimPlaying === false || lastTimestampMs === null) {
                // Not playing (or first frame after starting): only remember the time.
                lastTimestampMs = state.isSimPlaying ? timestampMs : null;
            } else {
                const realDeltaSeconds = Math.min((timestampMs - lastTimestampMs) / 1000, MAX_REAL_DELTA_SECONDS);
                lastTimestampMs = timestampMs;
                const parameters = state.processedData === null ? undefined : state.processedData.meta.parameters;
                const limitSeconds = computeConsumablesState(0, parameters).suit_capability_s;
                const nextElapsed = advanceSimElapsedSeconds(
                    state.simElapsedSeconds,
                    realDeltaSeconds,
                    state.simSpeedMultiplier,
                    limitSeconds,
                );
                state.setSimElapsedSeconds(nextElapsed);
                if (nextElapsed >= limitSeconds) {
                    state.setSimPlaying(false);
                }
            }
            animationFrameId = requestAnimationFrame(onFrame);
        }

        animationFrameId = requestAnimationFrame(onFrame);
        return () => cancelAnimationFrame(animationFrameId);
    }, []);
}
