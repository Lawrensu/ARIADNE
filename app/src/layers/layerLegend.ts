// Legend and provenance model for the layer panel (owner: Malissa, Stage 2).
// Pure data, no React: legendFor() returns everything the panel needs to explain one layer.
// Provenance is copied from meta.json layers[] (or rocks.json), never typed in here.

import type { Provenance } from "../data/contracts";
import type { ProcessedData } from "../data/loadProcessed";
import type { OverlayLayerId } from "../state/layersSlice";
import type { ColorStop, RgbColor } from "./layerPalette";
import {
    MINERALOGY_TRANSPARENT_CLASS_NAMES,
    NO_GO_STRIPE_BRIGHT_COLOR,
    NO_GO_STRIPE_DARK_COLOR,
    ROCK_MARKER_COLOR,
    SKY_VIEW_RAMP,
    SLOPE_ABOVE_LIMIT_COLOR,
    SLOPE_RAMP,
    THERMAL_INERTIA_RAMP,
    VIEWSHED_DEAD_ZONE_COLOR,
} from "./layerPalette";
import { maxWalkableSlopeDegrees, mineralogyColorForClassName, thermalInertiaRange } from "./overlayRgba";



export interface LegendGradientStop {
    position: number;
    color: RgbColor;
    label: string;
}


export interface LegendEntry {
    label: string;
    color: RgbColor;
    // True when the swatch should be drawn striped (no-go), so it is not colour alone.
    is_striped: boolean;
}


export interface LayerLegend {
    layer_id: OverlayLayerId;
    title: string;
    unit: string;
    // Continuous layers: stops from low to high. Empty for categorical layers.
    gradient_stops: LegendGradientStop[];
    // Categories, and extra swatches such as "too steep". Empty when there are none.
    entries: LegendEntry[];
    source_dataset: string;
    product_id: string;
    native_resolution_m: number;
    is_estimate: boolean;
    // "est.", "est., low confidence" or null (nothing to flag).
    badge_text: string | null;
    description: string;
    // Short caution in plain words. Always set.
    caveat: string;
}


export const ESTIMATE_BADGE_TEXT = "est.";
export const LOW_CONFIDENCE_BADGE_TEXT = "est., low confidence";

export const ROCK_CONFIDENCE_THRESHOLD = 0.6;



function rampToGradientStops(ramp: ColorStop[], firstLabel: string, lastLabel: string): LegendGradientStop[] {
    const stops: LegendGradientStop[] = [];
    for (let i = 0; i < ramp.length; i++) {
        let label = "";
        if (i === 0) {
            label = firstLabel;
        }
        if (i === ramp.length - 1) {
            label = lastLabel;
        }
        stops.push({ position: ramp[i].position, color: ramp[i].color, label });
    }
    return stops;
}


function roundToNearestTen(value: number): number {
    return Math.round(value / 10) * 10;
}


function findEntry(processedData: ProcessedData, layerId: string) {
    const entry = processedData.layerEntries[layerId];
    if (entry === undefined) {
        throw new Error(`meta.json has no layers[] entry for "${layerId}"`);
    }
    return entry;
}


function badgeFor(isEstimate: boolean): string | null {
    if (isEstimate) {
        return ESTIMATE_BADGE_TEXT;
    }
    return null;
}


// Fills the provenance fields from a meta.json layers[] entry.
function legendFromEntry(
    layerId: OverlayLayerId,
    metaLayerId: string,
    processedData: ProcessedData,
    title: string,
    unit: string,
    caveat: string,
): LayerLegend {
    const entry = findEntry(processedData, metaLayerId);
    return {
        layer_id: layerId,
        title,
        unit,
        gradient_stops: [],
        entries: [],
        source_dataset: entry.source_dataset,
        product_id: entry.product_id,
        native_resolution_m: entry.native_resolution_m,
        is_estimate: entry.is_estimate,
        badge_text: badgeFor(entry.is_estimate),
        description: entry.description,
        caveat,
    };
}



function noGoLegend(processedData: ProcessedData): LayerLegend {
    // The no-go mask is derived from traversal_penalty, so its provenance is that layer's.
    const legend = legendFromEntry(
        "no_go",
        "traversal_penalty",
        processedData,
        "No-go cells",
        "cells where the walking cost is infinite",
        "Too steep, too rough or blocked by a large rock. Estimate: do not rely on it at the edge of a stripe.",
    );
    legend.entries = [
        { label: "No-go: do not walk here", color: NO_GO_STRIPE_BRIGHT_COLOR, is_striped: true },
    ];
    legend.description = "Cells the router treats as impassable (slope, roughness, large rocks).";
    return legend;
}


function slopeLegend(processedData: ProcessedData): LayerLegend {
    const limitDegrees = maxWalkableSlopeDegrees(processedData);
    const legend = legendFromEntry(
        "slope_degrees",
        "slope_degrees",
        processedData,
        "Slope",
        "degrees",
        `Steeper than ${limitDegrees} degrees is no-go for the suit.`,
    );
    legend.gradient_stops = rampToGradientStops(SLOPE_RAMP, "0", `${limitDegrees}`);
    legend.entries = [
        { label: `Above ${limitDegrees} degrees: no-go`, color: SLOPE_ABOVE_LIMIT_COLOR, is_striped: false },
    ];
    return legend;
}


function skyViewLegend(processedData: ProcessedData): LayerLegend {
    const legend = legendFromEntry(
        "sky_view_factor",
        "sky_view_factor",
        processedData,
        "Sky view",
        "fraction of open sky, 0 to 1",
        "A proxy for relative cosmic ray exposure, not a measured dose.",
    );
    legend.gradient_stops = rampToGradientStops(SKY_VIEW_RAMP, "0 shielded", "1 open sky");
    return legend;
}


function thermalInertiaLegend(processedData: ProcessedData): LayerLegend {
    const legend = legendFromEntry(
        "thermal_inertia",
        "thermal_inertia",
        processedData,
        "Thermal inertia",
        processedData.layerEntries.thermal_inertia.unit,
        `Context, ${processedData.layerEntries.thermal_inertia.native_resolution_m} m native: smooth blocks, not walk-level detail. About 20% absolute accuracy.`,
    );
    const range = thermalInertiaRange(processedData);
    let firstLabel = "low";
    let lastLabel = "high";
    if (range !== null) {
        firstLabel = `${roundToNearestTen(range.min)}`;
        lastLabel = `${roundToNearestTen(range.max)}`;
    }
    legend.gradient_stops = rampToGradientStops(THERMAL_INERTIA_RAMP, firstLabel, lastLabel);
    return legend;
}


function mineralogyLegend(processedData: ProcessedData): LayerLegend {
    const legend = legendFromEntry(
        "mineralogy_class",
        "mineralogy_class",
        processedData,
        "Minerals",
        "candidate mineral class",
        "Weak signatures, low confidence. Never used for routing.",
    );
    // Always flagged, even if a future meta.json says otherwise: the layer is weak by design.
    legend.is_estimate = true;
    legend.badge_text = LOW_CONFIDENCE_BADGE_TEXT;

    const classNumbers = Object.keys(processedData.meta.mineralogy_classes);
    for (const classNumber of classNumbers) {
        const className = processedData.meta.mineralogy_classes[classNumber];
        if (MINERALOGY_TRANSPARENT_CLASS_NAMES.includes(className)) {
            continue;
        }
        const color = mineralogyColorForClassName(className);
        if (color !== null) {
            legend.entries.push({ label: className.replace(/_/g, " "), color, is_striped: false });
        }
    }
    return legend;
}


function viewshedLegend(processedData: ProcessedData): LayerLegend {
    const legend = legendFromEntry(
        "viewshed_rover",
        "viewshed_rover",
        processedData,
        "Rover radio view",
        "line of sight to the rover antenna",
        "Highlighted cells have no line of sight to the rover (comms dead zone). Terrain only, est.",
    );
    legend.entries = [
        { label: "Comms dead zone", color: VIEWSHED_DEAD_ZONE_COLOR, is_striped: false },
    ];
    return legend;
}


function rocksLegend(processedData: ProcessedData): LayerLegend {
    const rocks = processedData.rocks;
    let provenance: Provenance;
    if (rocks.length > 0) {
        provenance = rocks[0].provenance;
    } else {
        provenance = {
            source_dataset: "HiRISE orthoimage",
            product_id: "unknown",
            is_estimate: true,
        };
    }
    let resolutionM = 0;
    if (provenance.resolution_m !== undefined) {
        resolutionM = provenance.resolution_m;
    }
    return {
        layer_id: "rocks",
        title: "Rocks",
        unit: "metres across (marker size)",
        gradient_stops: [],
        entries: [
            { label: `${rocks.length} rocks, shadow-based`, color: ROCK_MARKER_COLOR, is_striped: false },
        ],
        source_dataset: provenance.source_dataset,
        product_id: provenance.product_id,
        native_resolution_m: resolutionM,
        is_estimate: true,
        badge_text: ESTIMATE_BADGE_TEXT,
        description: `${rocks.length} rocks, shadow-based detection, confidence ${ROCK_CONFIDENCE_THRESHOLD} or more.`,
        caveat: "Some may be terrain edges. Rocks under about 1.5 m are not listed. Markers are drawn larger than life so they can be seen.",
    };
}



export function legendFor(layerId: OverlayLayerId, processedData: ProcessedData): LayerLegend {
    if (layerId === "no_go") {
        return noGoLegend(processedData);
    }
    if (layerId === "slope_degrees") {
        return slopeLegend(processedData);
    }
    if (layerId === "sky_view_factor") {
        return skyViewLegend(processedData);
    }
    if (layerId === "thermal_inertia") {
        return thermalInertiaLegend(processedData);
    }
    if (layerId === "mineralogy_class") {
        return mineralogyLegend(processedData);
    }
    if (layerId === "viewshed_rover") {
        return viewshedLegend(processedData);
    }
    return rocksLegend(processedData);
}


// A CSS background for a striped swatch (the same two reds as the no-go overlay).
export const STRIPED_SWATCH_BACKGROUND = `repeating-linear-gradient(45deg, rgb(${NO_GO_STRIPE_BRIGHT_COLOR.join(",")}) 0 4px, rgb(${NO_GO_STRIPE_DARK_COLOR.join(",")}) 4px 8px)`;
