// "Phosphor hologram" terrain look (visual_direction.md 6.3, D-031). Pure maths, no React, no Three.js.
//
// The terrain is the real HiRISE orthoimage, recoloured: the image luminance is mapped onto a green
// ramp on near-black, walkable ground is lit, no-go ground (traversal_penalty = +Infinity,
// contracts.md 3.5) is dark with a fine diagonal hatch, and a faint 100 m grid gives scale.
// The fragment shader in phosphorTerrainShader.ts does the same maths per pixel on the GPU; every
// formula here has a GLSL twin with the same name, so the tested code and the drawn code agree.
//
// All colours are sRGB bytes. Local grid metres only (x east, z south), never lat/lon.

import type { GridDefinition } from "../data/contracts";



export type RgbBytes = [number, number, number];



// Walkable ground: luminance 0 maps to a dim green floor (never black, so a shadow on walkable
// ground never reads as no-go), luminance 1 maps to phosphor green (tokens.css --ariadne-phosphor-green).
export const WALKABLE_DARK_RGB: RgbBytes = [14, 38, 21];
export const WALKABLE_BRIGHT_RGB: RgbBytes = [92, 232, 127];

// No-go ground: a much darker ramp that stays below the walkable floor, so the relief is still
// there but the area reads as "off".
export const NO_GO_DARK_RGB: RgbBytes = [5, 10, 6];
export const NO_GO_BRIGHT_RGB: RgbBytes = [12, 30, 17];

// Hatch on no-go ground: grid green hairlines (tokens.css --ariadne-grid-green).
export const HATCH_RGB: RgbBytes = [58, 122, 80];
export const HATCH_OPACITY = 0.85;
export const HATCH_LINE_WIDTH_PX = 1.25;
// The hatch keeps about this screen spacing at any zoom: the period in metres is the smallest
// power-of-two multiple of the base period that is at least this many pixels wide.
export const HATCH_TARGET_PERIOD_PX = 7;
export const HATCH_BASE_PERIOD_M = 2;

// Scale grid: faint phosphor white lines every 100 m from the grid origin (north-west corner).
export const GRID_SPACING_M = 100;
export const GRID_RGB: RgbBytes = [234, 246, 226];
export const GRID_OPACITY = 0.16;
export const GRID_LINE_WIDTH_PX = 1;
// The grid fades out when its cells get smaller than this on screen (far away in the 3D view).
export const GRID_FADE_START_PX = 4;
export const GRID_FADE_END_PX = 10;

// Relief shading from the DTM normals, on top of the shadows already in the photo. Gentle: flat
// ground is unchanged, slopes facing the sun get up to this much brighter, slopes facing away darker.
export const RELIEF_SHADE_STRENGTH = 0.35;
export const RELIEF_SHADE_MIN = 0.7;
export const RELIEF_SHADE_MAX = 1.3;

// Contrast stretch: the darkest and brightest 1 percent of the image are clipped.
export const LUMINANCE_LOW_PERCENTILE = 0.01;
export const LUMINANCE_HIGH_PERCENTILE = 0.99;
// If the stretch range is narrower than this (a blank or broken image), the full 0..1 range is used.
export const MIN_LUMINANCE_STRETCH_RANGE = 0.05;
export const HISTOGRAM_BIN_COUNT = 256;

// The no-go mask is linearly filtered on the GPU; above this value a pixel counts as no-go.
export const NO_GO_MASK_THRESHOLD = 0.5;



export function rgbBytesToUnit(color: RgbBytes): [number, number, number] {
    return [color[0] / 255, color[1] / 255, color[2] / 255];
}


function clamp(value: number, low: number, high: number): number {
    return Math.min(Math.max(value, low), high);
}


function smoothstep(edgeLow: number, edgeHigh: number, value: number): number {
    const t = clamp((value - edgeLow) / (edgeHigh - edgeLow), 0, 1);
    return t * t * (3 - 2 * t);
}


function mixBytes(low: RgbBytes, high: RgbBytes, weight: number): RgbBytes {
    return [
        Math.round(low[0] + (high[0] - low[0]) * weight),
        Math.round(low[1] + (high[1] - low[1]) * weight),
        Math.round(low[2] + (high[2] - low[2]) * weight),
    ];
}



// Rec. 709 luma of sRGB values in 0..1 (the HiRISE image is effectively greyscale).
export function luminanceFromRgb(red: number, green: number, blue: number): number {
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}


// Position along the ramp (0..1) after the contrast stretch.
export function stretchLuminance(luminance: number, low: number, high: number): number {
    if (high <= low) {
        return clamp(luminance, 0, 1);
    }
    return clamp((luminance - low) / (high - low), 0, 1);
}


export function walkableGroundColor(rampPosition: number): RgbBytes {
    return mixBytes(WALKABLE_DARK_RGB, WALKABLE_BRIGHT_RGB, clamp(rampPosition, 0, 1));
}


export function noGoGroundColor(rampPosition: number): RgbBytes {
    return mixBytes(NO_GO_DARK_RGB, NO_GO_BRIGHT_RGB, clamp(rampPosition, 0, 1));
}


// Brightness factor from the terrain normal. sunDotNormal is dot(normal, sun direction); sunDotUp is
// the same for flat ground (the sun height). Flat ground returns exactly 1.
export function reliefShade(sunDotNormal: number, sunDotUp: number): number {
    if (sunDotUp <= 0) {
        return 1;
    }
    const relative = Math.max(sunDotNormal, 0) / sunDotUp;
    return clamp(1 + RELIEF_SHADE_STRENGTH * (relative - 1), RELIEF_SHADE_MIN, RELIEF_SHADE_MAX);
}



// How much a pixel is covered by a line of a repeating set: lines at every multiple of periodM along
// one coordinate, lineWidthPx wide on screen, with a one-pixel soft edge (anti-aliasing).
// metresPerPixel is how many metres of that coordinate one screen pixel spans (fwidth in the shader).
export function lineCoverage(coordinateM: number, periodM: number, metresPerPixel: number, lineWidthPx: number): number {
    const phase = coordinateM / periodM + 0.5;
    const distanceToLineM = Math.abs(phase - Math.floor(phase) - 0.5) * periodM;
    const distanceToLinePx = distanceToLineM / Math.max(metresPerPixel, 1e-6);
    const halfWidthPx = 0.5 * lineWidthPx;
    return 1 - smoothstep(halfWidthPx - 0.5, halfWidthPx + 0.5, distanceToLinePx);
}


// The diagonal coordinate the hatch lines are drawn across (lines run south-west to north-east,
// "/" on a north-up map), in metres.
export function hatchCoordinateM(x_m: number, z_m: number): number {
    return (x_m + z_m) * Math.SQRT1_2;
}


// Zoom level of the hatch: 0 at the base period, 1 at twice the base period, and so on (fractional,
// so the shader can blend two neighbouring periods instead of popping).
export function hatchPeriodLevel(metresPerPixel: number, pixelRatio: number): number {
    const wantedPeriodM = HATCH_TARGET_PERIOD_PX * pixelRatio * metresPerPixel;
    return Math.max(Math.log2(wantedPeriodM / HATCH_BASE_PERIOD_M), 0);
}


// Hatch coverage at one point (0 = no line, 1 = on a line), blended between two periods.
export function hatchCoverage(x_m: number, z_m: number, metresPerPixel: number, pixelRatio: number): number {
    const coordinate = hatchCoordinateM(x_m, z_m);
    const level = hatchPeriodLevel(metresPerPixel, pixelRatio);
    const levelFloor = Math.floor(level);
    const levelBlend = level - levelFloor;
    const finePeriodM = HATCH_BASE_PERIOD_M * Math.pow(2, levelFloor);
    const lineWidthPx = HATCH_LINE_WIDTH_PX * pixelRatio;
    const fine = lineCoverage(coordinate, finePeriodM, metresPerPixel, lineWidthPx);
    const coarse = lineCoverage(coordinate, finePeriodM * 2, metresPerPixel, lineWidthPx);
    return fine + (coarse - fine) * levelBlend;
}


// Scale grid coverage at one point: the brighter of the east-west and north-south lines, faded out
// when 100 m is only a few pixels on screen.
export function gridCoverage(x_m: number, z_m: number, metresPerPixel: number, pixelRatio: number): number {
    const lineWidthPx = GRID_LINE_WIDTH_PX * pixelRatio;
    const alongX = lineCoverage(x_m, GRID_SPACING_M, metresPerPixel, lineWidthPx);
    const alongZ = lineCoverage(z_m, GRID_SPACING_M, metresPerPixel, lineWidthPx);
    const spacingPx = GRID_SPACING_M / Math.max(metresPerPixel, 1e-6) / pixelRatio;
    const fade = smoothstep(GRID_FADE_START_PX, GRID_FADE_END_PX, spacingPx);
    return Math.max(alongX, alongZ) * fade;
}



// One terrain pixel, the same order of operations as the fragment shader. Used by the tests and
// handy for a CPU preview. noGoMaskValue is the filtered mask (0 walkable .. 1 no-go).
export function phosphorTerrainColor(input: {
    rampPosition: number;
    noGoMaskValue: number;
    hatch: number;
    grid: number;
}): RgbBytes {
    const walkable = walkableGroundColor(input.rampPosition);
    const noGoBase = noGoGroundColor(input.rampPosition);
    const noGoHatched = mixBytes(noGoBase, HATCH_RGB, input.hatch * HATCH_OPACITY);
    const noGoWeight = smoothstep(NO_GO_MASK_THRESHOLD - 0.15, NO_GO_MASK_THRESHOLD + 0.15, input.noGoMaskValue);
    const ground = mixBytes(walkable, noGoHatched, noGoWeight);
    return mixBytes(ground, GRID_RGB, input.grid * GRID_OPACITY);
}



// No-go mask for the GPU: one byte per cell, 255 where traversal_penalty is +Infinity (contracts.md
// 3.5; NaN is not allowed there, but is treated as no-go too, never as walkable). The rows are
// flipped (row 0 = south) because a DataTexture puts its first row at v = 0, and the terrain UVs
// have north at v = 1 (same rule as createGridOverlayTexture).
export function buildNoGoMaskSouthRowFirst(grid: GridDefinition, traversalPenalty: Float32Array): Uint8Array {
    const cellCount = grid.width * grid.height;
    if (traversalPenalty.length !== cellCount) {
        throw new Error(`traversal_penalty has ${traversalPenalty.length} cells, expected ${cellCount}`);
    }
    const mask = new Uint8Array(cellCount);
    for (let row = 0; row < grid.height; row++) {
        const targetRowStart = (grid.height - 1 - row) * grid.width;
        const sourceRowStart = row * grid.width;
        for (let col = 0; col < grid.width; col++) {
            const penalty = traversalPenalty[sourceRowStart + col];
            let isNoGo: boolean;
            if (penalty === Number.POSITIVE_INFINITY) {
                isNoGo = true;
            } else if (Number.isNaN(penalty)) {
                isNoGo = true;
            } else {
                isNoGo = false;
            }
            if (isNoGo) {
                mask[targetRowStart + col] = 255;
            }
        }
    }
    return mask;
}



// Luminance histogram (HISTOGRAM_BIN_COUNT bins over 0..1) of RGBA bytes, for example a small
// downscaled copy of the HiRISE image. Fully transparent pixels are skipped.
export function luminanceHistogram(rgba: Uint8Array | Uint8ClampedArray): Uint32Array {
    const histogram = new Uint32Array(HISTOGRAM_BIN_COUNT);
    for (let offset = 0; offset + 3 < rgba.length; offset += 4) {
        if (rgba[offset + 3] === 0) {
            continue;
        }
        const luminance = luminanceFromRgb(rgba[offset] / 255, rgba[offset + 1] / 255, rgba[offset + 2] / 255);
        const bin = Math.min(Math.floor(luminance * HISTOGRAM_BIN_COUNT), HISTOGRAM_BIN_COUNT - 1);
        histogram[bin] += 1;
    }
    return histogram;
}


// Luminance (0..1, bin centre) below which `fraction` of the counted pixels lie.
export function histogramPercentile(histogram: Uint32Array, fraction: number): number {
    let total = 0;
    for (let bin = 0; bin < histogram.length; bin++) {
        total += histogram[bin];
    }
    if (total === 0) {
        return clamp(fraction, 0, 1);
    }
    const wanted = fraction * total;
    let running = 0;
    for (let bin = 0; bin < histogram.length; bin++) {
        running += histogram[bin];
        if (running >= wanted) {
            return (bin + 0.5) / histogram.length;
        }
    }
    return 1;
}


export interface LuminanceStretch {
    low: number;
    high: number;
}


// Contrast stretch from the image's own histogram, so the relief uses the whole green ramp.
// Falls back to 0..1 when the range is too narrow to be real.
export function luminanceStretchFromHistogram(histogram: Uint32Array): LuminanceStretch {
    const low = histogramPercentile(histogram, LUMINANCE_LOW_PERCENTILE);
    const high = histogramPercentile(histogram, LUMINANCE_HIGH_PERCENTILE);
    if (high - low < MIN_LUMINANCE_STRETCH_RANGE) {
        return { low: 0, high: 1 };
    }
    return { low, high };
}
