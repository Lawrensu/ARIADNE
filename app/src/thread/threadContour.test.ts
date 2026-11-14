import { describe, expect, it } from "vitest";

import type { GridDefinition } from "../data/contracts";
import { loadProcessedDataFromDisk } from "../data/loadProcessedFromDisk";
import {
    computeReachableAreaSquareMetres,
    computeThreadContours,
    quantiseThresholdSeconds,
} from "./threadContour";



// Synthetic field: return time = distance from the centre in metres (1 s per metre).
function buildRadialField(grid: GridDefinition, centreX_m: number, centreZ_m: number): Float32Array {
    const field = new Float32Array(grid.width * grid.height);
    for (let row = 0; row < grid.height; row += 1) {
        for (let col = 0; col < grid.width; col += 1) {
            const x_m = (col + 0.5) * grid.cell_size_m;
            const z_m = (row + 0.5) * grid.cell_size_m;
            field[row * grid.width + col] = Math.hypot(x_m - centreX_m, z_m - centreZ_m);
        }
    }
    return field;
}



describe("computeThreadContours on a synthetic radial field", () => {
    const grid: GridDefinition = { width: 101, height: 101, cell_size_m: 2 };
    const centre_m = 101; // centre of cell (50, 50)

    it("places ring points at the expected radius, in cell-centre metres", () => {
        const field = buildRadialField(grid, centre_m, centre_m);
        const rings = computeThreadContours(field, grid, 60);
        expect(rings.length).toBe(1);
        for (const point of rings[0]) {
            const distance = Math.hypot(point.x_m - centre_m, point.z_m - centre_m);
            expect(Math.abs(distance - 60)).toBeLessThanOrEqual(grid.cell_size_m);
        }
    });

    it("maps one reachable cell to a diamond around its centre (no half-cell offset)", () => {
        const tinyGrid: GridDefinition = { width: 7, height: 5, cell_size_m: 2 };
        const field = new Float32Array(35).fill(Number.POSITIVE_INFINITY);
        field[2 * 7 + 3] = 0; // row 2, col 3 -> centre x = 7, z = 5
        const rings = computeThreadContours(field, tinyGrid, 0);
        expect(rings.length).toBe(1);
        const openRing = rings[0].slice(0, -1);
        const meanX = openRing.reduce((sum, point) => sum + point.x_m, 0) / openRing.length;
        const meanZ = openRing.reduce((sum, point) => sum + point.z_m, 0) / openRing.length;
        expect(meanX).toBeCloseTo(7, 5);
        expect(meanZ).toBeCloseTo(5, 5);
    });

    it("handles +Infinity cells and returns closed rings", () => {
        const field = buildRadialField(grid, centre_m, centre_m);
        field[10] = Number.POSITIVE_INFINITY;
        const rings = computeThreadContours(field, grid, 60);
        for (const ring of rings) {
            expect(ring[0]).toEqual(ring[ring.length - 1]);
        }
    });

    it("computes reachable area close to pi r^2", () => {
        const field = buildRadialField(grid, centre_m, centre_m);
        const area = computeReachableAreaSquareMetres(field, grid, 60);
        expect(Math.abs(area - Math.PI * 60 * 60) / (Math.PI * 60 * 60)).toBeLessThan(0.05);
    });

    it("quantises thresholds downwards", () => {
        expect(quantiseThresholdSeconds(29)).toBe(15);
        expect(quantiseThresholdSeconds(30)).toBe(30);
        expect(quantiseThresholdSeconds(-3)).toBe(0);
    });
});



describe("computeThreadContours on the real return_field", () => {
    it("shrinks with the threshold, stays inside the grid, is empty at 0, and is fast enough", async () => {
        const data = await loadProcessedDataFromDisk();
        const returnField = data.float32Layers.return_field;
        const grid = data.meta.grid;
        const extentX = grid.width * grid.cell_size_m;
        const extentZ = grid.height * grid.cell_size_m;

        const thresholds = [3600, 1800, 900, 300];
        const areas: number[] = [];
        for (const threshold of thresholds) {
            const startMs = performance.now();
            const rings = computeThreadContours(returnField, grid, threshold);
            const elapsedMs = performance.now() - startMs;
            const area = computeReachableAreaSquareMetres(returnField, grid, threshold);
            areas.push(area);
            console.log(
                `Thread threshold ${threshold} s: ${rings.length} rings, area ${Math.round(area)} m^2, ` +
                    `contour time ${elapsedMs.toFixed(1)} ms`,
            );
            expect(rings.length).toBeGreaterThan(0);
            for (const ring of rings) {
                for (const point of ring) {
                    expect(point.x_m).toBeGreaterThanOrEqual(0);
                    expect(point.x_m).toBeLessThanOrEqual(extentX);
                    expect(point.z_m).toBeGreaterThanOrEqual(0);
                    expect(point.z_m).toBeLessThanOrEqual(extentZ);
                }
            }
        }
        for (let index = 1; index < areas.length; index += 1) {
            expect(areas[index]).toBeLessThan(areas[index - 1]);
        }

        const areaAtZero = computeReachableAreaSquareMetres(returnField, grid, 0);
        const zeroRings = computeThreadContours(returnField, grid, 0);
        console.log(`Thread threshold 0 s: ${zeroRings.length} rings, area ${areaAtZero} m^2`);
        expect(areaAtZero).toBeLessThanOrEqual(4 * grid.cell_size_m * grid.cell_size_m);
    }, 60000);
});
