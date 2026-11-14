// All overlay colours in one place (owner: Malissa, Stage 2).
// PLACEHOLDER palette: Stage 3 (Letta) proposes the final ochre/rust CRT palette; change colours here only.
// Colour-blind note: the ramps are viridis-like and magma-like (they vary in lightness, not only hue),
// the categories come from the Okabe-Ito set, and no-go also uses a stripe pattern, so no state is colour alone.



export type RgbColor = [number, number, number];


export interface ColorStop {
    // Position along the ramp, 0 at the low end and 1 at the high end.
    position: number;
    color: RgbColor;
}



// Cells with no data are written as RGBA (0, 0, 0, 0) by the builders, not from here.


// No-go: stripes of two reds so the cells are readable without relying on hue alone.
export const NO_GO_STRIPE_BRIGHT_COLOR: RgbColor = [235, 64, 52];
export const NO_GO_STRIPE_DARK_COLOR: RgbColor = [110, 18, 20];
// Stripes run diagonally; one bright and one dark band are each this many cells wide.
export const NO_GO_STRIPE_WIDTH_CELLS = 3;

// Flat colour for "too steep" on the slope map (same red family as no-go, no stripes).
export const SLOPE_ABOVE_LIMIT_COLOR: RgbColor = [235, 64, 52];


// Slope: viridis-like, flat (dark purple) to the walkable limit (yellow).
export const SLOPE_RAMP: ColorStop[] = [
    { position: 0.0, color: [68, 1, 84] },
    { position: 0.25, color: [59, 82, 139] },
    { position: 0.5, color: [33, 145, 140] },
    { position: 0.75, color: [94, 201, 98] },
    { position: 1.0, color: [253, 231, 37] },
];


// Sky-view factor: dark blue (shielded) to pale yellow (open sky), cividis-like.
export const SKY_VIEW_RAMP: ColorStop[] = [
    { position: 0.0, color: [0, 32, 77] },
    { position: 0.35, color: [66, 78, 108] },
    { position: 0.65, color: [125, 124, 120] },
    { position: 1.0, color: [255, 233, 69] },
];


// Thermal inertia: magma-like, low (black-purple) to high (pale yellow).
export const THERMAL_INERTIA_RAMP: ColorStop[] = [
    { position: 0.0, color: [20, 11, 52] },
    { position: 0.33, color: [140, 41, 129] },
    { position: 0.66, color: [247, 112, 92] },
    { position: 1.0, color: [252, 253, 191] },
];


// Mineralogy categories by the class names in meta.json mineralogy_classes (Okabe-Ito colours).
// A class name that is not listed here uses MINERALOGY_FALLBACK_COLOR.
// "no_data" and "none_detected" are not listed: they are drawn transparent.
export const MINERALOGY_COLORS_BY_CLASS_NAME: Record<string, RgbColor> = {
    clay_bearing: [0, 114, 178],
    sulfate_bearing: [230, 159, 0],
    hematite_bearing: [204, 121, 167],
    carbonate_bearing: [0, 158, 115],
};
export const MINERALOGY_FALLBACK_COLOR: RgbColor = [240, 240, 240];
export const MINERALOGY_TRANSPARENT_CLASS_NAMES: string[] = ["no_data", "none_detected"];


// Rover viewshed: only the comms dead zone (value 0) is highlighted.
export const VIEWSHED_DEAD_ZONE_COLOR: RgbColor = [240, 228, 66];


// Rock markers in the 3D view.
export const ROCK_MARKER_COLOR: RgbColor = [86, 180, 233];



export function rgbToCssString(color: RgbColor): string {
    return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
}


export function rgbToHexNumber(color: RgbColor): number {
    return (color[0] << 16) | (color[1] << 8) | color[2];
}


// Linear interpolation along a ramp. `position` is clamped to 0..1.
export function sampleRamp(ramp: ColorStop[], position: number): RgbColor {
    if (position <= ramp[0].position) {
        return ramp[0].color;
    }
    const lastStop = ramp[ramp.length - 1];
    if (position >= lastStop.position) {
        return lastStop.color;
    }
    for (let i = 0; i < ramp.length - 1; i++) {
        const lower = ramp[i];
        const upper = ramp[i + 1];
        if (position >= lower.position && position <= upper.position) {
            const span = upper.position - lower.position;
            const weight = (position - lower.position) / span;
            return [
                Math.round(lower.color[0] + (upper.color[0] - lower.color[0]) * weight),
                Math.round(lower.color[1] + (upper.color[1] - lower.color[1]) * weight),
                Math.round(lower.color[2] + (upper.color[2] - lower.color[2]) * weight),
            ];
        }
    }
    return lastStop.color;
}
