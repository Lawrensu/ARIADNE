// Pure colour-map builders: grid layer in, RGBA bytes out (owner: Malissa, Stage 2).
// No Three.js and no React, so everything here runs and is tested on Node.
//
// Output format: Uint8Array of width * height * 4, row 0 = north, row-major (contracts.md 1.2).
// Alpha 0 means "draw nothing here" (no data, or a value that is not worth highlighting).

import type { ProcessedData } from "../data/loadProcessed";
import type { ColorStop, RgbColor } from "./layerPalette";
import {
    MINERALOGY_COLORS_BY_CLASS_NAME,
    MINERALOGY_FALLBACK_COLOR,
    MINERALOGY_TRANSPARENT_CLASS_NAMES,
    NO_GO_STRIPE_BRIGHT_COLOR,
    NO_GO_STRIPE_DARK_COLOR,
    NO_GO_STRIPE_WIDTH_CELLS,
    SKY_VIEW_RAMP,
    SLOPE_ABOVE_LIMIT_COLOR,
    SLOPE_RAMP,
    THERMAL_INERTIA_RAMP,
    VIEWSHED_DEAD_ZONE_COLOR,
    sampleRamp,
} from "./layerPalette";



// The overlays that are drawn as a texture on the terrain ("rocks" is drawn as markers instead).
export type GridOverlayLayerId =
    | "no_go"
    | "slope_degrees"
    | "sky_view_factor"
    | "thermal_inertia"
    | "mineralogy_class"
    | "viewshed_rover";


export const GRID_OVERLAY_LAYER_IDS: GridOverlayLayerId[] = [
    "no_go",
    "slope_degrees",
    "sky_view_factor",
    "thermal_inertia",
    "mineralogy_class",
    "viewshed_rover",
];


// Fallback when meta.json has no parameters block (contracts.md 3.1 makes it optional).
export const DEFAULT_MAX_WALKABLE_SLOPE_DEGREES = 25;



export function isGridOverlayLayerId(layerId: string): layerId is GridOverlayLayerId {
    return (GRID_OVERLAY_LAYER_IDS as string[]).includes(layerId);
}


export function maxWalkableSlopeDegrees(processedData: ProcessedData): number {
    const parameters = processedData.meta.parameters;
    if (parameters === undefined) {
        return DEFAULT_MAX_WALKABLE_SLOPE_DEGREES;
    }
    return parameters.max_walkable_slope_deg;
}


// Smallest and largest finite value in a layer. Returns null when no cell is finite.
export function finiteRange(values: Float32Array): { min: number; max: number } | null {
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < values.length; i++) {
        const value = values[i];
        if (Number.isFinite(value)) {
            if (value < min) {
                min = value;
            }
            if (value > max) {
                max = value;
            }
        }
    }
    if (min === Number.POSITIVE_INFINITY) {
        return null;
    }
    return { min, max };
}


// The real data range of the thermal inertia layer (a few distinct 100 m pixels, so a narrow range).
export function thermalInertiaRange(processedData: ProcessedData): { min: number; max: number } | null {
    return finiteRange(processedData.float32Layers.thermal_inertia);
}


// Class number to class name through meta.json mineralogy_classes. Unknown numbers return "unknown_class".
export function mineralogyClassName(processedData: ProcessedData, classValue: number): string {
    const name = processedData.meta.mineralogy_classes[String(classValue)];
    if (name === undefined) {
        return "unknown_class";
    }
    return name;
}


// Returns null for classes that are drawn transparent ("no_data", "none_detected").
export function mineralogyColorForClassName(className: string): RgbColor | null {
    if (MINERALOGY_TRANSPARENT_CLASS_NAMES.includes(className)) {
        return null;
    }
    const color = MINERALOGY_COLORS_BY_CLASS_NAME[className];
    if (color === undefined) {
        return MINERALOGY_FALLBACK_COLOR;
    }
    return color;
}



function writeCell(rgba: Uint8Array, cellIndex: number, color: RgbColor, alpha: number): void {
    const offset = cellIndex * 4;
    rgba[offset] = color[0];
    rgba[offset + 1] = color[1];
    rgba[offset + 2] = color[2];
    rgba[offset + 3] = alpha;
}


function rampPositionFor(value: number, rangeMin: number, rangeMax: number): number {
    if (rangeMax <= rangeMin) {
        return 0;
    }
    return (value - rangeMin) / (rangeMax - rangeMin);
}



// 3.5: +Infinity in traversal_penalty is impassable. Drawn as diagonal stripes of two reds.
function buildNoGoRgba(processedData: ProcessedData): Uint8Array {
    const { width, height } = processedData.meta.grid;
    const penalty = processedData.float32Layers.traversal_penalty;
    const rgba = new Uint8Array(width * height * 4);
    for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
            const cellIndex = row * width + col;
            if (penalty[cellIndex] === Number.POSITIVE_INFINITY) {
                const stripeNumber = Math.floor((row + col) / NO_GO_STRIPE_WIDTH_CELLS);
                if (stripeNumber % 2 === 0) {
                    writeCell(rgba, cellIndex, NO_GO_STRIPE_BRIGHT_COLOR, 255);
                } else {
                    writeCell(rgba, cellIndex, NO_GO_STRIPE_DARK_COLOR, 255);
                }
            }
        }
    }
    return rgba;
}


// Slope ramp from 0 to the walkable limit; steeper cells get the no-go colour. NaN is transparent.
function buildSlopeRgba(processedData: ProcessedData): Uint8Array {
    const { width, height } = processedData.meta.grid;
    const slope = processedData.float32Layers.slope_degrees;
    const limitDegrees = maxWalkableSlopeDegrees(processedData);
    const rgba = new Uint8Array(width * height * 4);
    for (let cellIndex = 0; cellIndex < width * height; cellIndex++) {
        const value = slope[cellIndex];
        if (Number.isNaN(value)) {
            continue;
        }
        if (value > limitDegrees) {
            writeCell(rgba, cellIndex, SLOPE_ABOVE_LIMIT_COLOR, 255);
        } else {
            const position = rampPositionFor(value, 0, limitDegrees);
            writeCell(rgba, cellIndex, sampleRamp(SLOPE_RAMP, position), 255);
        }
    }
    return rgba;
}


// Continuous ramp over [rangeMin, rangeMax]. Cells that are not finite are transparent.
function buildRampRgba(values: Float32Array, ramp: ColorStop[], rangeMin: number, rangeMax: number): Uint8Array {
    const rgba = new Uint8Array(values.length * 4);
    for (let cellIndex = 0; cellIndex < values.length; cellIndex++) {
        const value = values[cellIndex];
        if (Number.isFinite(value)) {
            const position = rampPositionFor(value, rangeMin, rangeMax);
            writeCell(rgba, cellIndex, sampleRamp(ramp, position), 255);
        }
    }
    return rgba;
}


function buildMineralogyRgba(processedData: ProcessedData): Uint8Array {
    const { width, height } = processedData.meta.grid;
    const classes = processedData.uint8Layers.mineralogy_class;
    const rgba = new Uint8Array(width * height * 4);
    // Look each class up once, not once per cell.
    const colorByClassValue = new Map<number, RgbColor | null>();
    for (let cellIndex = 0; cellIndex < width * height; cellIndex++) {
        const classValue = classes[cellIndex];
        let color = colorByClassValue.get(classValue);
        if (color === undefined) {
            color = mineralogyColorForClassName(mineralogyClassName(processedData, classValue));
            colorByClassValue.set(classValue, color);
        }
        if (color !== null) {
            writeCell(rgba, cellIndex, color, 255);
        }
    }
    return rgba;
}


// 3.16: 0 = comms dead zone (highlighted), 1 = line of sight (transparent).
function buildViewshedRgba(processedData: ProcessedData): Uint8Array {
    const { width, height } = processedData.meta.grid;
    const viewshed = processedData.uint8Layers.viewshed_rover;
    const rgba = new Uint8Array(width * height * 4);
    for (let cellIndex = 0; cellIndex < width * height; cellIndex++) {
        if (viewshed[cellIndex] === 0) {
            writeCell(rgba, cellIndex, VIEWSHED_DEAD_ZONE_COLOR, 255);
        }
    }
    return rgba;
}



export function buildOverlayRgba(layerId: GridOverlayLayerId, processedData: ProcessedData): Uint8Array {
    if (layerId === "no_go") {
        return buildNoGoRgba(processedData);
    }
    if (layerId === "slope_degrees") {
        return buildSlopeRgba(processedData);
    }
    if (layerId === "sky_view_factor") {
        return buildRampRgba(processedData.float32Layers.sky_view_factor, SKY_VIEW_RAMP, 0, 1);
    }
    if (layerId === "thermal_inertia") {
        const range = thermalInertiaRange(processedData);
        if (range === null) {
            const cellCount = processedData.meta.grid.width * processedData.meta.grid.height;
            return new Uint8Array(cellCount * 4);
        }
        return buildRampRgba(processedData.float32Layers.thermal_inertia, THERMAL_INERTIA_RAMP, range.min, range.max);
    }
    if (layerId === "mineralogy_class") {
        return buildMineralogyRgba(processedData);
    }
    if (layerId === "viewshed_rover") {
        return buildViewshedRgba(processedData);
    }
    throw new Error(`No colour map for overlay "${layerId}"`);
}
