// Scripted scenario engine (owner: Letta, Stage 3, built by the simulation sub-agent).
// Pure: no React and no store access, so it runs in Node tests. The format is docs/contracts.md
// section 3.15. The scenario content lives in app/src/sim/scenario.json and is replayed on the
// simulation clock (D-014); the runner applies its events to the store in ScenarioRunner.tsx.

import type { LocalPosition, Shelter } from "../data/contracts";
import scenarioDefinition from "./scenario.json";



// 3.15: one scripted event.
export interface ScenarioEvent {
    at_sim_seconds: number;
    // Descriptive string constant, for example "solar_particle_event_alert" (D-012).
    event_type: string;
    payload: Record<string, unknown>;
    display_message: string;
    recommended_action: string;
}


export interface ScenarioDefinition {
    scenario_id: string;
    description: string;
    // Ordered by at_sim_seconds, ascending.
    events: ScenarioEvent[];
}


// The shipped scenario (contracts.md 3.15, app/src/sim/scenario.json).
export const SOLAR_STORM_SCENARIO: ScenarioDefinition = scenarioDefinition as ScenarioDefinition;


export interface ScenarioDueEvents {
    // Events that are due now, in order. Already past but not fired events are included, never skipped.
    events: ScenarioEvent[];
    // Index of the first event that is not fired yet; pass it back on the next call.
    nextIndex: number;
}


export interface ScenarioProgress {
    fired_count: number;
    total_count: number;
    // Simulation time of the next event, or null when every event has fired.
    next_event_at_sim_seconds: number | null;
    is_complete: boolean;
}


export interface NearestShelter {
    shelter: Shelter;
    distance_m: number;
}


const SECONDS_PER_MINUTE = 60;


// Everything at or before simElapsedSeconds that has not fired yet. The caller owns nextIndex, which
// is the store's scenarioEventIndex; passing the returned nextIndex back means no event fires twice.
export function dueEvents(
    scenario: ScenarioDefinition,
    nextIndex: number,
    simElapsedSeconds: number,
): ScenarioDueEvents {
    const eventCount = scenario.events.length;
    let startIndex = nextIndex;
    if (!Number.isInteger(startIndex) || startIndex < 0) {
        startIndex = 0;
    }
    if (startIndex > eventCount) {
        startIndex = eventCount;
    }
    if (!Number.isFinite(simElapsedSeconds)) {
        return { events: [], nextIndex: startIndex };
    }

    const fired: ScenarioEvent[] = [];
    let index = startIndex;
    while (index < eventCount) {
        const event = scenario.events[index];
        // Ordered ascending, so the first event in the future ends the scan. The boundary is inclusive.
        if (event.at_sim_seconds <= simElapsedSeconds) {
            fired.push(event);
            index += 1;
        } else {
            break;
        }
    }
    return { events: fired, nextIndex: index };
}


// UI view of a run: fired count, total count and when the next event is due.
export function scenarioProgress(scenario: ScenarioDefinition, eventIndex: number): ScenarioProgress {
    const totalCount = scenario.events.length;
    let firedCount = eventIndex;
    if (!Number.isInteger(firedCount) || firedCount < 0) {
        firedCount = 0;
    }
    if (firedCount > totalCount) {
        firedCount = totalCount;
    }

    let nextEventAt: number | null = null;
    if (firedCount < totalCount) {
        nextEventAt = scenario.events[firedCount].at_sim_seconds;
    }

    return {
        fired_count: firedCount,
        total_count: totalCount,
        next_event_at_sim_seconds: nextEventAt,
        is_complete: firedCount >= totalCount,
    };
}


// Nearest shelter by straight-line distance in the local grid metres (not walking distance).
// Ties are broken by shelter_id, so the result is deterministic.
export function nearestShelter(shelters: Shelter[], position: LocalPosition): NearestShelter | null {
    let nearest: NearestShelter | null = null;

    for (const shelter of shelters) {
        const distanceMetres = Math.hypot(shelter.x_m - position.x_m, shelter.z_m - position.z_m);

        if (nearest === null) {
            nearest = { shelter, distance_m: distanceMetres };
            continue;
        }
        if (distanceMetres < nearest.distance_m) {
            nearest = { shelter, distance_m: distanceMetres };
            continue;
        }
        if (distanceMetres === nearest.distance_m) {
            if (shelter.shelter_id < nearest.shelter.shelter_id) {
                nearest = { shelter, distance_m: distanceMetres };
            }
        }
    }

    return nearest;
}


// Simulation time of the solar particle event alert, in seconds. The environment readout uses it to
// map the storm profile (minutes since onset) onto the replay clock without a second hand-set time.
export function solarStormOnsetSimSeconds(scenario: ScenarioDefinition): number {
    for (const event of scenario.events) {
        if (event.event_type === "solar_particle_event_alert") {
            return event.at_sim_seconds;
        }
    }
    return 0;
}


// Minutes since the storm onset for a simulation time, used with the RAD sol 4190 profile.
export function minutesSinceStormOnset(simElapsedSeconds: number): number {
    const onsetSeconds = solarStormOnsetSimSeconds(SOLAR_STORM_SCENARIO);
    return (simElapsedSeconds - onsetSeconds) / SECONDS_PER_MINUTE;
}




// Storm countdown for the HUDs (D-033), from the scenario's space weather watch and storm alert events.
// "none": no watch yet. "watch": a space weather watch is on, the storm is expected at
// storm_at_sim_seconds. "active": the storm has started.
export type StormCountdownPhase = "none" | "watch" | "active";


export interface StormCountdown {
    phase: StormCountdownPhase;
    storm_at_sim_seconds: number | null;
    // Seconds until the expected storm (watch phase), else null. Estimate.
    seconds_to_storm: number | null;
    is_estimate: true;
}


function firstEventOfType(scenario: ScenarioDefinition, eventType: string): ScenarioEvent | null {
    for (const event of scenario.events) {
        if (event.event_type === eventType) {
            return event;
        }
    }
    return null;
}


// "none" before the watch or while the scenario is not running; "watch" from the watch until the
// storm alert; "active" from the alert on. The expected storm time comes from the watch payload
// (storm_expected_at_sim_seconds), falling back to the alert time. Without a watch event the phase
// goes straight from "none" to "active".
export function stormCountdownAt(scenario: ScenarioDefinition, simSeconds: number, isScenarioRunning: boolean): StormCountdown {
    const watchEvent = firstEventOfType(scenario, "space_weather_watch");
    const alertEvent = firstEventOfType(scenario, "solar_particle_event_alert");

    let stormAt: number | null = null;
    if (watchEvent !== null && typeof watchEvent.payload.storm_expected_at_sim_seconds === "number") {
        stormAt = watchEvent.payload.storm_expected_at_sim_seconds;
    } else if (alertEvent !== null) {
        stormAt = alertEvent.at_sim_seconds;
    }

    const none: StormCountdown = { phase: "none", storm_at_sim_seconds: stormAt, seconds_to_storm: null, is_estimate: true };
    if (!isScenarioRunning || !Number.isFinite(simSeconds)) {
        return none;
    }

    // The alert time is the boundary between "watch" and "active"; the payload time only feeds the countdown.
    let activeFromSeconds = stormAt;
    if (alertEvent !== null) {
        activeFromSeconds = alertEvent.at_sim_seconds;
    }
    if (activeFromSeconds !== null && simSeconds >= activeFromSeconds) {
        return { phase: "active", storm_at_sim_seconds: stormAt, seconds_to_storm: null, is_estimate: true };
    }
    if (watchEvent !== null && simSeconds >= watchEvent.at_sim_seconds && stormAt !== null) {
        return {
            phase: "watch",
            storm_at_sim_seconds: stormAt,
            seconds_to_storm: Math.max(stormAt - simSeconds, 0),
            is_estimate: true,
        };
    }
    return none;
}
