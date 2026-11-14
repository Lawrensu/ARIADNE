// TypeScript types for the files in data/processed/.
// Source of truth: docs/contracts.md (v1.0.0). Field names match it exactly; never rename them here.
// Section numbers in the comments point to docs/contracts.md.



// 1.5 Provenance. Every record that shows data in the UI carries one.
export interface Provenance {
    source_dataset: string;
    product_id: string;
    resolution_m?: number;
    timestamp?: string;
    is_estimate: boolean;
    uncertainty?: number | string;
}



// 3.1 meta.json
export interface LatLon {
    latitude_deg: number;
    longitude_deg: number;
}


export interface GridDefinition {
    width: number;
    height: number;
    cell_size_m: number;
}


export interface LocalPosition {
    x_m: number;
    z_m: number;
}


export type LayerDtype = "float32" | "uint8";


export interface LayerEntry {
    layer_id: string;
    file: string;
    dtype: LayerDtype;
    unit: string;
    source_dataset: string;
    product_id: string;
    native_resolution_m: number;
    is_estimate: boolean;
    description: string;
}


export interface SourceEntry {
    source_dataset: string;
    product_id: string;
    url: string;
    licence_credit: string;
}


export interface WalkingParameters {
    suit_speed_factor: number;
    gravity_adjustment: number;
    max_walkable_slope_deg: number;
    suit_capability_hours: number;
    planned_marswalk_hours: number;
    reserve_minutes: number;
}


export interface PixelRect {
    x: number;
    y: number;
    width: number;
    height: number;
}


export interface RegionalContext {
    file: string;
    width_px: number;
    height_px: number;
    patch_rect_px: PixelRect;
}


export interface Meta {
    contract_version: string;
    generated_at_utc: string;
    pipeline_commit: string;
    grid: GridDefinition;
    origin_northwest: LatLon;
    crs: string;
    elevation_reference: string;
    bounds: {
        width_m: number;
        height_m: number;
        south_east: LatLon;
    };
    staging_point: LocalPosition;
    texture: {
        file: string;
        width_px: number;
        height_px: number;
    };
    sun: {
        sun_azimuth_deg: number;
        sun_incidence_deg: number;
    };
    layers: LayerEntry[];
    mineralogy_classes: Record<string, string>;
    sources: SourceEntry[];
    parameters?: WalkingParameters;
    regional_context?: RegionalContext;
}



// 3.11 rocks.json
export interface Rock {
    rock_id: string;
    x_m: number;
    z_m: number;
    diameter_m: number;
    height_m: number;
    detection_method: string;
    confidence: number;
    provenance: Provenance;
}



// 3.12 knots.json
export interface KnotMeasurement {
    label: string;
    value: number | string;
    unit: string;
    provenance: Provenance;
}


export interface KnotPhoto {
    url: string;
    sol: number;
    camera: string;
    caption: string;
    credit: string;
}


export interface Knot {
    knot_id: string;
    name: string;
    x_m: number;
    z_m: number;
    latitude_deg: number;
    longitude_deg: number;
    science_rationale: string;
    measurements: KnotMeasurement[];
    photos: KnotPhoto[];
}



// 3.13 shelters.json
export type ShelterType = "pressurised_rover" | "habitat" | "terrain_overhang";


export interface Shelter {
    shelter_id: string;
    shelter_type: ShelterType;
    x_m: number;
    z_m: number;
    sky_view_factor: number;
    is_estimate: boolean;
}



// 3.14 environment_timeline.json
export type UvIndexLevel = "low" | "moderate" | "high" | "very_high" | "extreme";


export interface EnvironmentSample {
    seconds_since_replay_start: number;
    local_mean_solar_time: string;
    air_temperature_c: number;
    ground_temperature_c: number;
    pressure_pa: number;
    uv_index_level: UvIndexLevel;
    dust_opacity_tau: number;
    radiation_dose_rate_usv_per_hour: number;
    provenance: Provenance;
}


export interface EnvironmentTimeline {
    replay_source: {
        mission: string;
        instrument_set: string[];
        sol: number;
    };
    samples: EnvironmentSample[];
}



// Grid layers the app loads, by layer_id from meta.json layers[] (3.2 to 3.9, 3.16).
// roughness_m is in the contract but not shipped to the app (see scripts/copyProcessedData.mjs).
export type Float32LayerId =
    | "heightmap"
    | "slope_degrees"
    | "traversal_penalty"
    | "return_field"
    | "sky_view_factor"
    | "thermal_inertia";

export type Uint8LayerId = "mineralogy_class" | "viewshed_rover";

export const FLOAT32_LAYER_IDS: Float32LayerId[] = [
    "heightmap",
    "slope_degrees",
    "traversal_penalty",
    "return_field",
    "sky_view_factor",
    "thermal_inertia",
];

export const UINT8_LAYER_IDS: Uint8LayerId[] = ["mineralogy_class", "viewshed_rover"];
