// What the map knows about one spot (owner: Malissa). Pure maths for the "Here" card: reads the
// processed layers at the cell under a local grid position and returns display rows with their
// provenance. Local grid only (x east, z south, metres); no latitude and longitude.
//
// Rounding follows the data: elevation 0.1 m (HiRISE DTM, 1 m cells), slope whole degrees,
// sky view 2 decimals, thermal inertia whole units (100 m context), walk back whole minutes.
// Model-derived rows carry badge_text "est."; nothing is shown more precisely than it is known.

import type { LocalPosition, Provenance } from "../data/contracts";
import type { ProcessedData } from "../data/loadProcessed";
import { cellFromPosition, cellIndex } from "../data/grid";
import type { GridCell } from "../data/grid";
import { mineralogyClassName } from "../layers/overlayRgba";



export type PointDataRowId =
    | "elevation"
    | "slope"
    | "walkable"
    | "sky_view"
    | "radio_to_rover"
    | "thermal_inertia"
    | "mineral"
    | "walk_back";


// "go": fine to walk. "caution": walk back is longer than the Thread time left. "no_go": blocked or
// unreachable. "neutral": a plain reading.
export type PointDataTone = "go" | "caution" | "no_go" | "neutral";


export interface PointDataRow {
    row_id: PointDataRowId;
    label: string;
    // The number or word to show, with its unit: "8°", "in view", "no-go".
    value_text: string;
    // "est." for model-derived values, "est., low confidence" for minerals, null for measured values.
    badge_text: string | null;
    tone: PointDataTone;
    // Where the number comes from (meta.json layers[] entry of the layer it was read from).
    provenance: Provenance;
    // Short context such as "100 m context" for coarse layers; null when there is none.
    note: string | null;
}


// "outside_patch": the position is off the ~2 x 2 km grid. "inside_patch": rows are filled.
export type PointDataState = "inside_patch" | "outside_patch";


export interface PointData {
    state: PointDataState;
    cell: GridCell | null;
    rows: PointDataRow[];
}


export const ESTIMATE_BADGE = "est.";
export const LOW_CONFIDENCE_BADGE = "est., low confidence";

const MINERAL_NO_DATA_VALUE = 0;
const MINERAL_NONE_DETECTED_CLASS_NAME = "none_detected";
const MINERAL_NO_DATA_CLASS_NAME = "no_data";



function provenanceFromLayer(processedData: ProcessedData, layerId: string): Provenance {
    const entry = processedData.layerEntries[layerId];
    if (entry === undefined) {
        return { source_dataset: "unknown", product_id: layerId, is_estimate: true };
    }
    return {
        source_dataset: entry.source_dataset,
        product_id: entry.product_id,
        resolution_m: entry.native_resolution_m,
        is_estimate: entry.is_estimate,
    };
}


function isInsideExtent(processedData: ProcessedData, position: LocalPosition): boolean {
    const grid = processedData.meta.grid;
    const widthM = grid.width * grid.cell_size_m;
    const heightM = grid.height * grid.cell_size_m;
    if (!Number.isFinite(position.x_m) || !Number.isFinite(position.z_m)) {
        return false;
    }
    if (position.x_m < 0 || position.x_m >= widthM) {
        return false;
    }
    if (position.z_m < 0 || position.z_m >= heightM) {
        return false;
    }
    return true;
}


export function formatWalkBackMinutes(seconds: number): string {
    if (seconds === Number.POSITIVE_INFINITY) {
        return "unreachable";
    }
    if (!Number.isFinite(seconds) || seconds < 0) {
        return "unknown";
    }
    const minutes = Math.round(seconds / 60);
    if (minutes < 1) {
        return "< 1 min";
    }
    return `${minutes} min`;
}


function mineralText(className: string, classValue: number): string {
    if (classValue === MINERAL_NO_DATA_VALUE || className === MINERAL_NO_DATA_CLASS_NAME) {
        return "none";
    }
    if (className === MINERAL_NONE_DETECTED_CLASS_NAME) {
        return "none";
    }
    return className.replace(/_/g, " ");
}


// loadFactorNow multiplies the unloaded return_field seconds (contracts.md 4.6). Pass 1 for no load.
// timeLeftSeconds (optional) is the planned time left (computeConsumablesState, planned_time_left_s):
// when the walk back is longer than that, the walk back row is marked "caution".
export function pointDataAt(
    processedData: ProcessedData,
    position: LocalPosition,
    loadFactorNow: number,
    timeLeftSeconds?: number,
): PointData {
    if (!isInsideExtent(processedData, position)) {
        return { state: "outside_patch", cell: null, rows: [] };
    }

    const grid = processedData.meta.grid;
    const cell = cellFromPosition(grid, position);
    const index = cellIndex(grid, cell);
    const float32Layers = processedData.float32Layers;
    const uint8Layers = processedData.uint8Layers;
    const rows: PointDataRow[] = [];

    // Elevation: measured terrain model, no "est.".
    const elevationM = float32Layers.heightmap[index];
    let elevationText = "no data";
    if (Number.isFinite(elevationM)) {
        elevationText = `${elevationM.toFixed(1)} m`;
    }
    rows.push({
        row_id: "elevation",
        label: "Elevation",
        value_text: elevationText,
        badge_text: null,
        tone: "neutral",
        provenance: provenanceFromLayer(processedData, "heightmap"),
        note: null,
    });

    // Slope, whole degrees (est.).
    const slopeDegrees = float32Layers.slope_degrees[index];
    let slopeText = "no data";
    if (Number.isFinite(slopeDegrees)) {
        slopeText = `${Math.round(slopeDegrees)}°`;
    }
    rows.push({
        row_id: "slope",
        label: "Slope",
        value_text: slopeText,
        badge_text: ESTIMATE_BADGE,
        tone: "neutral",
        provenance: provenanceFromLayer(processedData, "slope_degrees"),
        note: null,
    });

    // Walkable: go or no-go from traversal_penalty. Word and tone, never colour alone.
    const traversalPenalty = float32Layers.traversal_penalty[index];
    let walkableText = "go";
    let walkableTone: PointDataTone = "go";
    if (traversalPenalty === Number.POSITIVE_INFINITY || Number.isNaN(traversalPenalty)) {
        walkableText = "no-go";
        walkableTone = "no_go";
    }
    rows.push({
        row_id: "walkable",
        label: "Walkable",
        value_text: walkableText,
        badge_text: ESTIMATE_BADGE,
        tone: walkableTone,
        provenance: provenanceFromLayer(processedData, "traversal_penalty"),
        note: null,
    });

    // Sky view factor, 0 (enclosed) to 1 (open sky), 2 decimals (est.).
    const skyView = float32Layers.sky_view_factor[index];
    let skyViewText = "no data";
    if (Number.isFinite(skyView)) {
        skyViewText = skyView.toFixed(2);
    }
    rows.push({
        row_id: "sky_view",
        label: "Sky view",
        value_text: skyViewText,
        badge_text: ESTIMATE_BADGE,
        tone: "neutral",
        provenance: provenanceFromLayer(processedData, "sky_view_factor"),
        note: "0 enclosed, 1 open sky",
    });

    // Radio line of sight to the rover: 1 in view, 0 dead zone (est.).
    const viewshedValue = uint8Layers.viewshed_rover[index];
    let radioText = "dead zone";
    let radioTone: PointDataTone = "no_go";
    if (viewshedValue === 1) {
        radioText = "in view";
        radioTone = "go";
    }
    rows.push({
        row_id: "radio_to_rover",
        label: "Radio to rover",
        value_text: radioText,
        badge_text: ESTIMATE_BADGE,
        tone: radioTone,
        provenance: provenanceFromLayer(processedData, "viewshed_rover"),
        note: null,
    });

    // Thermal inertia: coarse context, not this exact spot.
    const thermalEntry = processedData.layerEntries["thermal_inertia"];
    const thermalInertia = float32Layers.thermal_inertia[index];
    let thermalText = "no data";
    if (Number.isFinite(thermalInertia)) {
        thermalText = `${Math.round(thermalInertia)}`;
        if (thermalEntry !== undefined) {
            thermalText = `${Math.round(thermalInertia)} ${thermalEntry.unit}`;
        }
    }
    let thermalNote: string | null = "100 m context";
    if (thermalEntry !== undefined && thermalEntry.native_resolution_m > 0) {
        thermalNote = `${thermalEntry.native_resolution_m} m context`;
    }
    let thermalBadge: string | null = null;
    if (thermalEntry === undefined || thermalEntry.is_estimate) {
        thermalBadge = ESTIMATE_BADGE;
    }
    rows.push({
        row_id: "thermal_inertia",
        label: "Thermal inertia",
        value_text: thermalText,
        badge_text: thermalBadge,
        tone: "neutral",
        provenance: provenanceFromLayer(processedData, "thermal_inertia"),
        note: thermalNote,
    });

    // Mineral class from the orbital map: coarse and low confidence.
    const mineralValue = uint8Layers.mineralogy_class[index];
    const mineralClassName = mineralogyClassName(processedData, mineralValue);
    rows.push({
        row_id: "mineral",
        label: "Mineral",
        value_text: mineralText(mineralClassName, mineralValue),
        badge_text: LOW_CONFIDENCE_BADGE,
        tone: "neutral",
        provenance: provenanceFromLayer(processedData, "mineralogy_class"),
        note: null,
    });

    // Walk back to the rover: return_field (unloaded seconds) x load factor now (est.).
    const returnSeconds = float32Layers.return_field[index];
    let walkBackText = "unreachable";
    let walkBackTone: PointDataTone = "no_go";
    let walkBackNote: string | null = null;
    if (Number.isFinite(returnSeconds)) {
        const walkBackSeconds = returnSeconds * loadFactorNow;
        walkBackText = formatWalkBackMinutes(walkBackSeconds);
        walkBackTone = "neutral";
        if (timeLeftSeconds !== undefined && walkBackSeconds > timeLeftSeconds) {
            walkBackTone = "caution";
            walkBackNote = "longer than time left";
        }
    }
    rows.push({
        row_id: "walk_back",
        label: "Walk back",
        value_text: walkBackText,
        badge_text: ESTIMATE_BADGE,
        tone: walkBackTone,
        provenance: provenanceFromLayer(processedData, "return_field"),
        note: walkBackNote,
    });

    return { state: "inside_patch", cell, rows };
}


export function findRow(pointData: PointData, rowId: PointDataRowId): PointDataRow | undefined {
    return pointData.rows.find((row) => row.row_id === rowId);
}
