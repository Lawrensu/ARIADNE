// Text and state for the solar storm countdown (D-033), shared by the tablet (status bar chip,
// objective card, system menu) and the visor. Pure functions, no React. The countdown itself comes
// from sim/scenarioEngine.ts stormCountdownAt; this file only words it.
//
// Rules: whole minutes (rounded down), always "est." (the storm time is a forecast), a state word
// next to the colour and shape (caution while the watch is on, no-go once the storm is active).

import type { StormCountdown } from "../sim/scenarioEngine";
import type { HazardState } from "../theme/StateBadge";



const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;



// Whole minutes until the storm, rounded down; null when there is no usable countdown.
export function stormCountdownWholeMinutes(countdown: StormCountdown): number | null {
    if (countdown.phase !== "watch") {
        return null;
    }
    if (countdown.seconds_to_storm === null || !Number.isFinite(countdown.seconds_to_storm)) {
        return null;
    }
    return Math.max(Math.floor(countdown.seconds_to_storm / SECONDS_PER_MINUTE), 0);
}


// The state to draw: caution during the watch, no-go while the storm is active, null for "none".
export function stormCountdownState(countdown: StormCountdown): HazardState | null {
    if (countdown.phase === "watch") {
        return "caution";
    }
    if (countdown.phase === "active") {
        return "no_go";
    }
    return null;
}


// "STORM IN 14 MIN est.", "STORM IN <1 MIN est.", "STORM ACTIVE", or null for "none".
export function formatStormCountdownText(countdown: StormCountdown): string | null {
    if (countdown.phase === "active") {
        return "STORM ACTIVE";
    }
    const minutes = stormCountdownWholeMinutes(countdown);
    if (minutes === null) {
        // A watch without a usable time: say so without a number.
        if (countdown.phase === "watch") {
            return "STORM WATCH";
        }
        return null;
    }
    if (minutes < 1) {
        return "STORM IN <1 MIN est.";
    }
    return `STORM IN ${minutes} MIN est.`;
}


// Phone version: "STORM 14m", "STORM <1m", "STORM ACTIVE". Short enough for the 375 px status bar.
export function formatStormCountdownShort(countdown: StormCountdown): string | null {
    if (countdown.phase === "active") {
        return "STORM ACTIVE";
    }
    const minutes = stormCountdownWholeMinutes(countdown);
    if (minutes === null) {
        if (countdown.phase === "watch") {
            return "STORM WATCH";
        }
        return null;
    }
    if (minutes < 1) {
        return "STORM <1m";
    }
    return `STORM ${minutes}m`;
}


// Line for the objective card during the watch; null in every other phase.
export function formatStormWatchLine(countdown: StormCountdown): string | null {
    if (countdown.phase !== "watch") {
        return null;
    }
    const minutes = stormCountdownWholeMinutes(countdown);
    if (minutes === null) {
        return "Space weather watch: storm expected.";
    }
    if (minutes < 1) {
        return "Space weather watch: storm in <1 min est.";
    }
    return `Space weather watch: storm in ~${minutes} min est.`;
}


// Simulation time as "T+1:21:40" (hours, minutes, seconds), for the presenter line in the system menu.
export function formatSimTimeHms(simSeconds: number): string {
    if (!Number.isFinite(simSeconds) || simSeconds < 0) {
        return "T+?";
    }
    const wholeSeconds = Math.floor(simSeconds);
    const hours = Math.floor(wholeSeconds / SECONDS_PER_HOUR);
    const minutes = Math.floor((wholeSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
    const seconds = wholeSeconds % SECONDS_PER_MINUTE;
    const minutesText = minutes < 10 ? `0${minutes}` : `${minutes}`;
    const secondsText = seconds < 10 ? `0${seconds}` : `${seconds}`;
    return `T+${hours}:${minutesText}:${secondsText}`;
}


const SCENARIO_EVENT_WORDS: Record<string, string> = {
    walk_started: "walk start",
    space_weather_watch: "storm watch",
    solar_particle_event_alert: "storm alert",
    reroute_to_shelter: "reroute to shelter",
};


// "Next: storm watch at T+1:21:40". Unknown event types show their id with spaces.
export function formatNextScenarioEvent(eventType: string, atSimSeconds: number): string {
    let words = SCENARIO_EVENT_WORDS[eventType];
    if (words === undefined) {
        words = eventType.replace(/_/g, " ");
    }
    return `Next: ${words} at ${formatSimTimeHms(atSimSeconds)}`;
}
