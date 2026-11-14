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
