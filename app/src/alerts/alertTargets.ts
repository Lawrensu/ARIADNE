// Alert targets (owner: Letta, Stage 3): where an alert's one-tap [ROUTE] goes, how far away it is
// and how long the walk would take. Pure functions: no React and no store, so the same code is
// tested directly and reused by the Suit HUD later.
//
// Distance is straight-line (Euclidean) on the local grid, never latitude or longitude (D-005).
// Walking time comes from the shared contract function on flat ground, so it is an estimate and is
// always shown as "est." (contracts.md 4). The planned route can differ: it follows terrain.

import type { Knot, LocalPosition, Shelter } from "../data/contracts";
import type { ProcessedData } from "../data/loadProcessed";
import { walkingTimeSeconds } from "../routing/walkingTime";
import type { AlertRecord } from "../state/alertsSlice";
import type { RouteEndpoint, RouteEndpointKind } from "../state/routeSlice";



export interface ResolvedAlertTarget {
    endpoint: RouteEndpoint;
    distance_m: number;
    walking_time_s: number;
}



// Shelter names come from the contract type; the trailing id number tells overhangs apart.
function shelterDisplayLabel(shelter: Shelter): string {
    if (shelter.shelter_type === "pressurised_rover") {
        return "Rover shelter";
    }
    if (shelter.shelter_type === "habitat") {
        return "Habitat";
    }
    const idParts = shelter.shelter_id.split("_");
    const lastPart = idParts[idParts.length - 1];
    if (lastPart.length > 0 && !Number.isNaN(Number(lastPart))) {
        return `Terrain overhang ${lastPart}`;
    }
    return "Terrain overhang";
}


function findKnot(processedData: ProcessedData, knotId: string): Knot | undefined {
    return processedData.knots.find((knot) => knot.knot_id === knotId);
}


function findShelter(processedData: ProcessedData, shelterId: string): Shelter | undefined {
    return processedData.shelters.find((shelter) => shelter.shelter_id === shelterId);
}



// Human label for a target, or null when the id is not in the processed data. "staging_point" is
// the rover, the string constant used by routeSlice.ts.
export function alertTargetLabel(
    processedData: ProcessedData,
    kind: RouteEndpointKind | null,
    id: string | null,
): string | null {
    if (kind === null) {
        return null;
    }
    if (kind === "staging_point") {
        return "Rover";
    }
    if (kind === "shelter") {
        if (id === null) {
            return null;
        }
        const shelter = findShelter(processedData, id);
        if (shelter === undefined) {
            return null;
        }
        return shelterDisplayLabel(shelter);
    }
    if (kind === "knot") {
        if (id === null) {
            return null;
        }
        const knot = findKnot(processedData, id);
        if (knot === undefined) {
            return null;
        }
        return knot.name;
    }
    // "cell": an alert cannot name a picked cell, so there is no stored position to route to.
    return null;
}


// Closest shelter to a local grid position; ties break on shelter_id so the result is stable. Null
// when there are no shelters at all.
export function nearestShelterId(shelters: Shelter[], position: LocalPosition): string | null {
    if (shelters.length === 0) {
        return null;
    }
    let bestShelter = shelters[0];
    let bestDistance = Math.hypot(bestShelter.x_m - position.x_m, bestShelter.z_m - position.z_m);
    for (const shelter of shelters) {
        const distance = Math.hypot(shelter.x_m - position.x_m, shelter.z_m - position.z_m);
        const isCloser = distance < bestDistance;
        const isTieWithSmallerId = distance === bestDistance && shelter.shelter_id < bestShelter.shelter_id;
        if (isCloser || isTieWithSmallerId) {
            bestShelter = shelter;
            bestDistance = distance;
        }
    }
    return bestShelter.shelter_id;
}


// Metres below 1 km (whole metres, the grid is 2 m so finer digits would be fake), then tenths of
// a kilometre. Non-finite input reads "n/a".
export function formatAlertDistance(metres: number): string {
    if (!Number.isFinite(metres) || metres < 0) {
        return "n/a";
    }
    if (metres < 1000) {
        const roundedMetres = Math.round(metres);
        if (roundedMetres < 1000) {
            return `${roundedMetres} m`;
        }
    }
    return `${(metres / 1000).toFixed(1)} km`;
}


// Whole minutes below an hour, then "h:mm". Seconds below half a minute read "under 1 min"; a
// walking time that the contract function rejects (steeper than the slope limit) reads
// "unreachable".
export function formatAlertDuration(seconds: number): string {
    if (!Number.isFinite(seconds)) {
        return "unreachable";
    }
    if (seconds < 0) {
        return "under 1 min";
    }
    const totalMinutes = Math.round(seconds / 60);
    if (totalMinutes < 1) {
        return "under 1 min";
    }
    if (totalMinutes < 60) {
        return `${totalMinutes} min`;
    }
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (minutes < 10) {
        return `${hours}:0${minutes}`;
    }
    return `${hours}:${minutes}`;
}



// Resolve an alert's route target into a route endpoint plus distance and walking time from the
// astronaut's current local grid position. Null when the alert has no target or the target id is
// not in the processed data (the alert still renders, without a [ROUTE] button).
export function resolveAlertTarget(
    processedData: ProcessedData,
    alert: AlertRecord,
    fromPosition: LocalPosition,
): ResolvedAlertTarget | null {
    const kind = alert.route_target_kind;
    if (kind === null) {
        return null;
    }

    let position: LocalPosition;
    let label: string;
    if (kind === "staging_point") {
        position = processedData.meta.staging_point;
        label = "Rover";
    } else if (kind === "shelter") {
        if (alert.route_target_id === null) {
            return null;
        }
        const shelter = findShelter(processedData, alert.route_target_id);
        if (shelter === undefined) {
            return null;
        }
        position = { x_m: shelter.x_m, z_m: shelter.z_m };
        label = shelterDisplayLabel(shelter);
    } else if (kind === "knot") {
        if (alert.route_target_id === null) {
            return null;
        }
        const knot = findKnot(processedData, alert.route_target_id);
        if (knot === undefined) {
            return null;
        }
        position = { x_m: knot.x_m, z_m: knot.z_m };
        label = knot.name;
    } else {
        // "cell": no position is stored in the alert contract.
        return null;
    }

    const distanceMetres = Math.hypot(position.x_m - fromPosition.x_m, position.z_m - fromPosition.z_m);
    let walkingSeconds = 0;
    if (distanceMetres > 0) {
        walkingSeconds = walkingTimeSeconds(distanceMetres, 0, processedData.meta.parameters);
    }

    const endpoint: RouteEndpoint = {
        endpoint_kind: kind,
        endpoint_id: alert.route_target_id === null ? kind : alert.route_target_id,
        label: alert.route_target_label === null ? label : alert.route_target_label,
        position,
    };
    return {
        endpoint,
        distance_m: distanceMetres,
        walking_time_s: walkingSeconds,
    };
}
