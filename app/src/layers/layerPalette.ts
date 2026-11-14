// All overlay colours in one place (owner: Malissa, Stage 2; retuned for the phosphor map, D-031).
// The terrain is phosphor green (terrain/phosphorTerrain.ts), so the overlays use the other palette
// channels from theme/tokens.css: parchment for data values, caution amber, no-go red-orange, plus
// dark panel green and phosphor white as ramp ends. Few hues; layers differ by ramp, pattern and shape.
// Colour-blind note: every ramp runs from dark to light (lightness, not only hue), no-go also uses a
// stripe pattern, and no state is colour alone.



export type RgbColor = [number, number, number];


export interface ColorStop {
    // Position along the ramp, 0 at the low end and 1 at the high end.
    position: number;
    color: RgbColor;
}



// Cells with no data are written as RGBA (0, 0, 0, 0) by the builders, not from here.


// No-go: stripes of two reds so the cells are readable without relying on hue alone.
// No-go red-orange (--ariadne-no-go #ff6b4a) and a dark rust between the stripes.
export const NO_GO_STRIPE_BRIGHT_COLOR: RgbColor = [255, 107, 74];
export const NO_GO_STRIPE_DARK_COLOR: RgbColor = [74, 22, 14];
// Stripes run diagonally; one bright and one dark band are each this many cells wide.
export const NO_GO_STRIPE_WIDTH_CELLS = 3;

// Flat colour for "too steep" on the slope map (same red family as no-go, no stripes).
export const SLOPE_ABOVE_LIMIT_COLOR: RgbColor = [255, 107, 74];


// Slope: dark panel green (flat) through dim amber to caution amber (--ariadne-caution #ffc857) at
// the walkable limit; steeper than the limit is no-go red-orange.
export const SLOPE_RAMP: ColorStop[] = [
    { position: 0.0, color: [10, 20, 12] },
    { position: 0.4, color: [88, 74, 36] },
    { position: 0.75, color: [190, 146, 62] },
    { position: 1.0, color: [255, 200, 87] },
];


// Sky-view factor: dark (shielded) to parchment (--ariadne-parchment #e9d8a6, open sky).
export const SKY_VIEW_RAMP: ColorStop[] = [
    { position: 0.0, color: [10, 20, 12] },
    { position: 0.4, color: [70, 70, 54] },
    { position: 0.7, color: [150, 140, 108] },
    { position: 1.0, color: [233, 216, 166] },
];


// Thermal inertia: dark (low) through muted green (--ariadne-muted-green) to phosphor white (high).
export const THERMAL_INERTIA_RAMP: ColorStop[] = [
    { position: 0.0, color: [10, 20, 12] },
    { position: 0.45, color: [94, 112, 92] },
    { position: 0.75, color: [169, 191, 164] },
    { position: 1.0, color: [234, 246, 226] },
];


// Mineralogy categories by the class names in meta.json mineralogy_classes: palette channels only
// (parchment, caution amber, phosphor white, muted green), never the no-go red-orange.
// A class name that is not listed here uses MINERALOGY_FALLBACK_COLOR.
// "no_data" and "none_detected" are not listed: they are drawn transparent.
export const MINERALOGY_COLORS_BY_CLASS_NAME: Record<string, RgbColor> = {
    clay_bearing: [233, 216, 166],
    sulfate_bearing: [255, 200, 87],
    hematite_bearing: [234, 246, 226],
    carbonate_bearing: [169, 191, 164],
};
export const MINERALOGY_FALLBACK_COLOR: RgbColor = [234, 246, 226];
export const MINERALOGY_TRANSPARENT_CLASS_NAMES: string[] = ["no_data", "none_detected"];


// Rover viewshed: only the comms dead zone (value 0) is highlighted, in caution amber.
export const VIEWSHED_DEAD_ZONE_COLOR: RgbColor = [255, 200, 87];


// Rock markers in the 3D view: parchment, so they stand out on the green terrain.
export const ROCK_MARKER_COLOR: RgbColor = [233, 216, 166];



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
