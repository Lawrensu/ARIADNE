import { describe, expect, it } from "vitest";

import type { GridDefinition } from "../data/contracts";
import { createTerrainFrame, gridPositionToUv, sampleElevationM } from "./terrainFrame";
import { buildTerrainGeometry, createGridOverlayTexture } from "./terrainGeometry";



const grid: GridDefinition = { width: 3, height: 2, cell_size_m: 2 };
// Row 0 (north): 10, 20, 30. Row 1 (south): 40, NaN, 60.
const heightmap = new Float32Array([10, 20, 30, 40, Number.NaN, 60]);



describe("sampleElevationM", () => {
    it("returns the cell value at a cell centre", () => {
        const frame = createTerrainFrame(grid, heightmap);
        expect(sampleElevationM(frame, 1, 1)).toBeCloseTo(10);
        expect(sampleElevationM(frame, 5, 1)).toBeCloseTo(30);
    });

    it("interpolates between cell centres and skips NaN cells", () => {
        const frame = createTerrainFrame(grid, heightmap);
        expect(sampleElevationM(frame, 2, 1)).toBeCloseTo(15);
        expect(Number.isFinite(sampleElevationM(frame, 3, 3))).toBe(true);
    });

    it("uses the lowest finite height as the reference", () => {
        const frame = createTerrainFrame(grid, heightmap);
        expect(frame.referenceElevationM).toBe(10);
    });
});



describe("gridPositionToUv", () => {
    it("maps the NW corner to (0, 1) and the SE corner to (1, 0)", () => {
        expect(gridPositionToUv(grid, 0, 0)).toEqual({ u: 0, v: 1 });
        expect(gridPositionToUv(grid, 6, 4)).toEqual({ u: 1, v: 0 });
    });
});



describe("buildTerrainGeometry", () => {
    it("covers the grid extent exactly", () => {
        const frame = createTerrainFrame(grid, heightmap);
        const geometry = buildTerrainGeometry(frame, 1);
        const box = geometry.boundingBox!;
        expect(box.min.x).toBe(0);
        expect(box.max.x).toBe(6);
        expect(box.min.z).toBe(0);
        expect(box.max.z).toBe(4);
    });
});



describe("createGridOverlayTexture", () => {
    it("puts grid row 0 (north) in the last texture row (v = 1)", () => {
        const rgba = new Uint8Array(3 * 2 * 4);
        rgba[0] = 255; // red channel of row 0, col 0 (north-west cell)
        const texture = createGridOverlayTexture(grid, rgba);
        const data = texture.image.data as Uint8Array;
        const lastRowStart = (grid.height - 1) * grid.width * 4;
        expect(data[lastRowStart]).toBe(255);
        expect(data[0]).toBe(0);
    });
});
