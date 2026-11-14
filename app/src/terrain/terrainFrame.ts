// Shared terrain maths used by scene/, layers/, thread/ and route drawing (owner: Malissa, Stage 2).
// No React, no Three.js: plain functions, so they are easy to test.
//
// Scene coordinates are the local grid (contracts.md 1.1): x east, z south, metres.
// Scene y is elevation above a reference (the lowest finite height in the patch), times a
// vertical exaggeration, so the numbers stay small. Never use lat/lon here.

import type { GridDefinition } from "../data/contracts";



export interface TerrainFrame {
    grid: GridDefinition;
    heightmap: Float32Array;
    // Elevation (metres above the Mars areoid) that maps to scene y = 0.
    referenceElevationM: number;
    // 1 = true scale. Kept at 1 by default so the Labyrinth view never exaggerates the slopes.
    verticalExaggeration: number;
}


export const DEFAULT_VERTICAL_EXAGGERATION = 1;



export function lowestFiniteValue(values: Float32Array): number {
    let lowest = Number.POSITIVE_INFINITY;
    for (let i = 0; i < values.length; i++) {
        const value = values[i];
        if (Number.isFinite(value) && value < lowest) {
            lowest = value;
        }
    }
    if (lowest === Number.POSITIVE_INFINITY) {
        return 0;
    }
    return lowest;
}


export function createTerrainFrame(
    grid: GridDefinition,
    heightmap: Float32Array,
    verticalExaggeration: number = DEFAULT_VERTICAL_EXAGGERATION,
): TerrainFrame {
    return {
        grid,
        heightmap,
        referenceElevationM: lowestFiniteValue(heightmap),
        verticalExaggeration,
    };
}


export function elevationToSceneY(frame: TerrainFrame, elevationM: number): number {
    return (elevationM - frame.referenceElevationM) * frame.verticalExaggeration;
}


function clamp(value: number, low: number, high: number): number {
    return Math.min(Math.max(value, low), high);
}


// Elevation in metres at any point, by bilinear interpolation between cell centres.
// Points outside the grid use the nearest edge cells. NaN cells (no DTM data) are skipped;
// if all four neighbours are NaN the reference elevation is returned.
export function sampleElevationM(frame: TerrainFrame, x_m: number, z_m: number): number {
    const grid = frame.grid;
    const colFloat = clamp(x_m / grid.cell_size_m - 0.5, 0, grid.width - 1);
    const rowFloat = clamp(z_m / grid.cell_size_m - 0.5, 0, grid.height - 1);
    const col0 = Math.floor(colFloat);
    const row0 = Math.floor(rowFloat);
    const col1 = Math.min(col0 + 1, grid.width - 1);
    const row1 = Math.min(row0 + 1, grid.height - 1);
    const colWeight = colFloat - col0;
    const rowWeight = rowFloat - row0;

    const corners = [
        { value: frame.heightmap[row0 * grid.width + col0], weight: (1 - colWeight) * (1 - rowWeight) },
        { value: frame.heightmap[row0 * grid.width + col1], weight: colWeight * (1 - rowWeight) },
        { value: frame.heightmap[row1 * grid.width + col0], weight: (1 - colWeight) * rowWeight },
        { value: frame.heightmap[row1 * grid.width + col1], weight: colWeight * rowWeight },
    ];

    let weightedSum = 0;
    let weightTotal = 0;
    for (const corner of corners) {
        if (Number.isFinite(corner.value)) {
            weightedSum += corner.value * corner.weight;
            weightTotal += corner.weight;
        }
    }
    if (weightTotal > 0) {
        return weightedSum / weightTotal;
    }
    for (const corner of corners) {
        if (Number.isFinite(corner.value)) {
            return corner.value;
        }
    }
    return frame.referenceElevationM;
}


// Scene y of the terrain surface at a local grid position. Use this to place markers and lines.
export function sampleTerrainSceneY(frame: TerrainFrame, x_m: number, z_m: number): number {
    return elevationToSceneY(frame, sampleElevationM(frame, x_m, z_m));
}



// Texture coordinates for a local grid position. The HiRISE texture and every overlay cover the
// grid extent exactly (contracts.md 3.10): u = 0 at the west edge, v = 1 at the north edge.
export function gridPositionToUv(grid: GridDefinition, x_m: number, z_m: number): { u: number; v: number } {
    const widthM = grid.width * grid.cell_size_m;
    const heightM = grid.height * grid.cell_size_m;
    return {
        u: x_m / widthM,
        v: 1 - z_m / heightM,
    };
}
