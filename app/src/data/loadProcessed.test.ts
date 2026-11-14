import { describe, expect, it } from "vitest";

import { cellCentre, cellFromPosition, cellIndex } from "./grid";
import { decodeFloat32LittleEndian } from "./loadProcessed";
import { loadProcessedDataFromDisk } from "./loadProcessedFromDisk";



describe("decodeFloat32LittleEndian", () => {
    it("reads little-endian float32 values including +Infinity and NaN", () => {
        const buffer = new ArrayBuffer(12);
        const view = new DataView(buffer);
        view.setFloat32(0, 1.5, true);
        view.setFloat32(4, Number.POSITIVE_INFINITY, true);
        view.setFloat32(8, Number.NaN, true);
        const values = decodeFloat32LittleEndian(buffer);
        expect(values[0]).toBe(1.5);
        expect(values[1]).toBe(Number.POSITIVE_INFINITY);
        expect(Number.isNaN(values[2])).toBe(true);
    });
});



describe("loadProcessedData on the real data/processed/", () => {
    it("loads every grid with the size from meta.json", async () => {
        const data = await loadProcessedDataFromDisk();
        const cellCount = data.meta.grid.width * data.meta.grid.height;
        for (const layer of Object.values(data.float32Layers)) {
            expect(layer.length).toBe(cellCount);
        }
        for (const layer of Object.values(data.uint8Layers)) {
            expect(layer.length).toBe(cellCount);
        }
    });

    it("has return_field 0 at the staging point (contracts.md 3.6)", async () => {
        const data = await loadProcessedDataFromDisk();
        const grid = data.meta.grid;
        const stagingCell = cellFromPosition(grid, data.meta.staging_point);
        expect(data.float32Layers.return_field[cellIndex(grid, stagingCell)]).toBe(0);
        const centre = cellCentre(grid, stagingCell);
        expect(Math.abs(centre.x_m - data.meta.staging_point.x_m)).toBeLessThanOrEqual(grid.cell_size_m / 2);
    });

    it("has a finite return_field at every Knot (contracts.md 3.12)", async () => {
        const data = await loadProcessedDataFromDisk();
        const grid = data.meta.grid;
        expect(data.knots.length).toBeGreaterThan(0);
        for (const knot of data.knots) {
            const value = data.float32Layers.return_field[cellIndex(grid, cellFromPosition(grid, knot))];
            expect(Number.isFinite(value)).toBe(true);
        }
    });
});
