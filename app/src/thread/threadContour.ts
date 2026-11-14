// The Thread geometry: closed rings around every cell the astronaut can still walk home from
// (owner: Malissa, Stage 2). Pure functions, no React, no Three.js, so they run in Node tests.
//
// Input is return_field.bin: seconds to walk from each cell back to the staging point (+Infinity =
// unreachable, contracts.md 3.6). The Thread is the contour of that field at the threshold
// (time left, planned minus elapsed minus reserve, divided by the load factor; contracts.md 4.6): every cell inside the rings has return_field <= threshold.
//
// COORDINATE MAPPING (verified in threadContour.test.ts): d3-contour treats value (row, col) as sitting
// at the point (col + 0.5, row + 0.5) and returns coordinates in those "pixel" units. The centre of
// cell (row, col) is x = (col + 0.5) * cell_size_m, z = (row + 0.5) * cell_size_m (contracts.md 1.1).
// So a d3 point (px, py) maps to x_m = px * cell_size_m, z_m = py * cell_size_m, with no extra offset.
// The contour crosses between cell centres by linear interpolation. Where the reachable region touches
// the grid edge, d3 closes the ring along the outer grid boundary (0 .. width, 0 .. height).
//
// PERFORMANCE: see THREAD_THRESHOLD_QUANTUM_SECONDS below and the timing printed by threadContour.test.ts.

import { contours } from "d3-contour";

import type { GridDefinition, LocalPosition } from "../data/contracts";



// d3-contour cannot take +Infinity, so unreachable cells are given the value (threshold + this margin).
// The margin matters: d3 places the ring by linear interpolation between cell centres, so a huge sentinel
// (for example 1e7) would put the ring on the last reachable cell centre and collapse thin regions. With a
// margin of about one walking step the ring falls roughly between a reachable and an unreachable cell.
export const UNREACHABLE_MARGIN_SECONDS = 30;

// The Thread is recomputed only when the threshold moves by this many simulated seconds
// (ThreadLine.tsx). The threshold is rounded DOWN to a multiple, so the drawn ring never claims
// more safe range than the suit really has (conservative). 15 s of walking is ~20 m, 10 cells.
export const THREAD_THRESHOLD_QUANTUM_SECONDS = 15;

// d3-contour draws nothing for a cell whose value equals the level exactly. The level is nudged by this
// many seconds so that cells with return_field <= threshold are strictly inside the ring.
const CONTOUR_LEVEL_MARGIN_SECONDS = 0.001;


// Measured on the real 1013 x 934 field (threadContour.test.ts): about 35 ms at 300 s up to 250 to 700 ms at
// 1800 to 3600 s, too slow for every frame. While the clock plays fast, the quantum grows so the ring is
// recomputed at most about twice per real second.
const MAX_RECOMPUTES_PER_REAL_SECOND = 2;


// Quantum to use for the current clock state. Paused or slow: the base 15 s. Fast: speed / 2.
export function chooseThresholdQuantumSeconds(isSimPlaying: boolean, speedMultiplier: number): number {
    if (isSimPlaying === false) {
        return THREAD_THRESHOLD_QUANTUM_SECONDS;
    }
    return Math.max(THREAD_THRESHOLD_QUANTUM_SECONDS, speedMultiplier / MAX_RECOMPUTES_PER_REAL_SECOND);
}


// contracts.md 4.6 rule 4: a cell is inside the Thread when return_field x load_factor <= time left.
// The load factor is the same for every cell, so this equals return_field <= time left / load_factor.
// Returns that return_field threshold in seconds (0 when no time is left or the factor is not positive).
export function effectiveReturnFieldThresholdSeconds(timeLeftSeconds: number, loadFactorValue: number): number {
    if (timeLeftSeconds <= 0) {
        return 0;
    }
    if (loadFactorValue <= 0) {
        return 0;
    }
    return timeLeftSeconds / loadFactorValue;
}


// Rounds the threshold down to a multiple of the quantum.
export function quantiseThresholdSeconds(
    thresholdSeconds: number,
    quantumSeconds: number = THREAD_THRESHOLD_QUANTUM_SECONDS,
): number {
    if (thresholdSeconds <= 0) {
        return 0;
    }
    return Math.floor(thresholdSeconds / quantumSeconds) * quantumSeconds;
}


// Largest finite return time in the field (seconds). Above it the Thread cannot change any more: every
// reachable cell is already inside, so ThreadLine caps the threshold here and skips recomputing.
export function largestFiniteReturnSeconds(returnField: Float32Array): number {
    let largest = 0;
    for (let index = 0; index < returnField.length; index += 1) {
        const value = returnField[index];
        if (Number.isFinite(value) && value > largest) {
            largest = value;
        }
    }
    return largest;
}


// Number of cells whose return time is <= threshold (the staging cell, at 0 s, counts for threshold 0).
export function countReachableCells(returnField: Float32Array, thresholdSeconds: number): number {
    let count = 0;
    for (let index = 0; index < returnField.length; index += 1) {
        if (returnField[index] <= thresholdSeconds) {
            count += 1;
        }
    }
    return count;
}


// Reachable-within-threshold area in m^2 (cell count x cell area).
export function computeReachableAreaSquareMetres(
    returnField: Float32Array,
    grid: GridDefinition,
    thresholdSeconds: number,
): number {
    return countReachableCells(returnField, thresholdSeconds) * grid.cell_size_m * grid.cell_size_m;
}


// Closed rings (first point repeated at the end) in local grid metres, outer boundaries and holes alike.
// The field is negated so d3-contour (which keeps values >= threshold) keeps return_field <= threshold.
// Unreachable cells become a finite value just above the threshold (see UNREACHABLE_MARGIN_SECONDS).
// Works on the full-resolution field, no downsampling.
export function computeThreadContours(
    returnField: Float32Array,
    grid: GridDefinition,
    thresholdSeconds: number,
): LocalPosition[][] {
    const unreachableValue = thresholdSeconds + UNREACHABLE_MARGIN_SECONDS;
    const negatedField = new Float64Array(returnField.length);
    for (let index = 0; index < returnField.length; index += 1) {
        const value = returnField[index];
        if (Number.isFinite(value)) {
            negatedField[index] = -value;
        } else {
            negatedField[index] = -unreachableValue;
        }
    }

    const contourLevel = -(thresholdSeconds + CONTOUR_LEVEL_MARGIN_SECONDS);
    const contourGenerator = contours().size([grid.width, grid.height]).thresholds([contourLevel]);
    // d3-contour's typings ask for number[] but it only indexes the array, so a typed array works.
    const contourResults = contourGenerator(negatedField as unknown as number[]);

    const rings: LocalPosition[][] = [];
    for (const multiPolygon of contourResults) {
        for (const polygon of multiPolygon.coordinates) {
            for (const ring of polygon) {
                const points: LocalPosition[] = ring.map((point) => ({
                    x_m: point[0] * grid.cell_size_m,
                    z_m: point[1] * grid.cell_size_m,
                }));
                rings.push(points);
            }
        }
    }
    return rings;
}
