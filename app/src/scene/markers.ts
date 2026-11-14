// Marker descriptions for the 3D scene: Knots, the rover (staging point) and shelters.
// Pure functions, no React.

import type { LocalPosition } from "../data/contracts";
import type { ProcessedData } from "../data/loadProcessed";



export type MarkerKind = "knot" | "staging_point" | "shelter";


export interface SceneMarker {
    marker_kind: MarkerKind;
    marker_id: string;
    label: string;
    position: LocalPosition;
}


export const ROVER_MARKER_ID = "staging_point";
export const ROVER_MARKER_LABEL = "Rover (staging point)";



function shelterLabel(shelterType: string, shelterId: string, isEstimate: boolean): string {
    let baseLabel: string;
    if (shelterType === "terrain_overhang") {
        baseLabel = "Overhang shelter";
    } else if (shelterType === "habitat") {
        baseLabel = "Habitat";
    } else {
        baseLabel = "Shelter";
    }
    // Shelter ids end with a number, for example shelter_overhang_02: show it so the labels differ.
    const idParts = shelterId.split("_");
    const lastPart = idParts[idParts.length - 1];
    let numberedLabel = baseLabel;
    if (/^\d+$/.test(lastPart)) {
        numberedLabel = `${baseLabel} ${Number(lastPart)}`;
    }
    if (isEstimate) {
        return `${numberedLabel} (est.)`;
    }
    return numberedLabel;
}


export function buildSceneMarkers(processedData: ProcessedData): SceneMarker[] {
    const markers: SceneMarker[] = [];

    for (const knot of processedData.knots) {
        markers.push({
            marker_kind: "knot",
            marker_id: knot.knot_id,
            label: knot.name,
            position: { x_m: knot.x_m, z_m: knot.z_m },
        });
    }

    markers.push({
        marker_kind: "staging_point",
        marker_id: ROVER_MARKER_ID,
        label: ROVER_MARKER_LABEL,
        position: { ...processedData.meta.staging_point },
    });

    for (const shelter of processedData.shelters) {
        // The pressurised rover shelter sits at the staging point and is drawn as the rover marker.
        if (shelter.shelter_type === "pressurised_rover") {
            continue;
        }
        markers.push({
            marker_kind: "shelter",
            marker_id: shelter.shelter_id,
            label: shelterLabel(shelter.shelter_type, shelter.shelter_id, shelter.is_estimate),
            position: { x_m: shelter.x_m, z_m: shelter.z_m },
        });
    }

    return markers;
}



// Which markers show a label (visual_direction.md 6.3): Knots and the rover always; the current
// objective, a hovered marker and a selected marker always; a shelter otherwise only on hover or
// while an active alert routes to it.

// The rover shelter in shelters.json is drawn as the rover marker, so its id maps to the rover's.
export const ROVER_SHELTER_ID = "shelter_rover";


export function markerIdForTarget(targetId: string): string {
    if (targetId === ROVER_SHELTER_ID) {
        return ROVER_MARKER_ID;
    }
    return targetId;
}


export interface ObjectiveInput {
    // Store walkDetour: while rerouted, its target is the objective.
    detour: { target_kind: string; target_id: string } | null;
    // Store walkPlanSnapshot while a walk runs, otherwise the planned sciencePlan.
    plan: { stops: { knot_id: string; chosen_task_ids: string[] }[] } | null;
    completedTaskIds: string[];
}


// The marker id of the current objective, or null. On a detour: its target (a cell target has no
// marker). On the plan: the first stop with a chosen task not done yet; when every stop is done, the
// rover (the walk back is next).
export function currentObjectiveMarkerId(input: ObjectiveInput): string | null {
    if (input.detour !== null) {
        if (input.detour.target_kind === "cell") {
            return null;
        }
        return markerIdForTarget(input.detour.target_id);
    }
    if (input.plan === null || input.plan.stops.length === 0) {
        return null;
    }
    const completed = new Set(input.completedTaskIds);
    for (const stop of input.plan.stops) {
        const hasOpenTask = stop.chosen_task_ids.some((taskId) => !completed.has(taskId));
        if (hasOpenTask) {
            return stop.knot_id;
        }
    }
    return ROVER_MARKER_ID;
}


// Marker ids that an active (not dismissed) alert offers a route to.
export function alertTargetMarkerIds(
    alerts: { alert_id: string; route_target_id: string | null }[],
    dismissedAlertIds: string[],
): Set<string> {
    const dismissed = new Set(dismissedAlertIds);
    const targets = new Set<string>();
    for (const alert of alerts) {
        if (dismissed.has(alert.alert_id)) {
            continue;
        }
        if (alert.route_target_id === null) {
            continue;
        }
        targets.add(markerIdForTarget(alert.route_target_id));
    }
    return targets;
}


export interface MarkerLabelContext {
    objectiveMarkerId: string | null;
    hoveredMarkerId: string | null;
    selectedMarkerIds: Set<string>;
    alertTargetMarkerIds: Set<string>;
}


export function shouldShowMarkerLabel(marker: SceneMarker, context: MarkerLabelContext): boolean {
    if (marker.marker_kind === "knot") {
        return true;
    }
    if (marker.marker_kind === "staging_point") {
        return true;
    }
    if (marker.marker_id === context.objectiveMarkerId) {
        return true;
    }
    if (marker.marker_id === context.hoveredMarkerId) {
        return true;
    }
    if (context.selectedMarkerIds.has(marker.marker_id)) {
        return true;
    }
    if (context.alertTargetMarkerIds.has(marker.marker_id)) {
        return true;
    }
    return false;
}


// Filled (emphasis) label for the current objective and a selected marker, plain plate otherwise.
export function isMarkerEmphasised(marker: SceneMarker, context: MarkerLabelContext): boolean {
    if (marker.marker_id === context.objectiveMarkerId) {
        return true;
    }
    if (context.selectedMarkerIds.has(marker.marker_id)) {
        return true;
    }
    return false;
}
