import { beforeAll, describe, expect, it } from "vitest";

import { cellCentre, cellFromIndex } from "../data/grid";
import type { ProcessedData } from "../data/loadProcessed";
import { loadProcessedDataFromDisk } from "../data/loadProcessedFromDisk";
import { findRow, formatWalkBackMinutes, pointDataAt } from "./pointData";



let data: ProcessedData;

beforeAll(async () => {
    data = await loadProcessedDataFromDisk();
});



describe("pointDataAt", () => {
    it("fills every row at the staging point, with provenance and badges", () => {
        const result = pointDataAt(data, data.meta.staging_point, 1);
        expect(result.state).toBe("inside_patch");
        expect(result.rows.length).toBe(8);
        for (const row of result.rows) {
            expect(row.value_text.length, row.row_id).toBeGreaterThan(0);
            expect(row.provenance.source_dataset.length, row.row_id).toBeGreaterThan(0);
            expect(row.provenance.product_id.length, row.row_id).toBeGreaterThan(0);
        }
        expect(findRow(result, "elevation")?.badge_text).toBeNull();
        expect(findRow(result, "slope")?.badge_text).toBe("est.");
        expect(findRow(result, "slope")?.value_text.endsWith("°")).toBe(true);
        expect(findRow(result, "mineral")?.badge_text).toBe("est., low confidence");
        expect(findRow(result, "walk_back")?.provenance.product_id).toBe(data.layerEntries["return_field"].product_id);
    });

    it("walk back at the rover is under a minute, and scales with the load factor at a Knot", () => {
        const atRover = pointDataAt(data, data.meta.staging_point, 1);
        expect(findRow(atRover, "walk_back")?.value_text).toBe("< 1 min");

        const knot = data.knots[0];
        const knotLight = pointDataAt(data, { x_m: knot.x_m, z_m: knot.z_m }, 1);
        const knotLoaded = pointDataAt(data, { x_m: knot.x_m, z_m: knot.z_m }, 1.5);
        const lightMinutes = parseInt(findRow(knotLight, "walk_back")?.value_text ?? "", 10);
        const loadedMinutes = parseInt(findRow(knotLoaded, "walk_back")?.value_text ?? "", 10);
        expect(lightMinutes).toBeGreaterThan(0);
        expect(loadedMinutes).toBeGreaterThan(lightMinutes);
    });

    it("marks the walk back as caution when it is longer than the time left", () => {
        const knot = data.knots[0];
        const position = { x_m: knot.x_m, z_m: knot.z_m };
        const plenty = findRow(pointDataAt(data, position, 1, 100000), "walk_back");
        const tight = findRow(pointDataAt(data, position, 1, 10), "walk_back");
        expect(plenty?.tone).toBe("neutral");
        expect(tight?.tone).toBe("caution");
    });

    it("reads a Knot cell: walkable word and radio word are never empty", () => {
        const knot = data.knots[0];
        const result = pointDataAt(data, { x_m: knot.x_m, z_m: knot.z_m }, 1.1);
        expect(result.state).toBe("inside_patch");
        expect(["go", "no-go"]).toContain(findRow(result, "walkable")?.value_text);
        expect(["in view", "dead zone"]).toContain(findRow(result, "radio_to_rover")?.value_text);
    });

    it("marks a no-go cell with the word and the no_go tone", () => {
        const penalty = data.float32Layers.traversal_penalty;
        const index = penalty.findIndex((value) => value === Number.POSITIVE_INFINITY);
        expect(index).toBeGreaterThanOrEqual(0);
        const position = cellCentre(data.meta.grid, cellFromIndex(data.meta.grid, index));
        const walkable = findRow(pointDataAt(data, position, 1), "walkable");
        expect(walkable?.value_text).toBe("no-go");
        expect(walkable?.tone).toBe("no_go");
    });

    it("writes mineral names without underscores", () => {
        const classes = data.uint8Layers.mineralogy_class;
        const grid = data.meta.grid;
        for (let index = 0; index < classes.length; index += 997) {
            const position = cellCentre(grid, cellFromIndex(grid, index));
            const row = findRow(pointDataAt(data, position, 1), "mineral");
            expect(row?.value_text).not.toContain("_");
            expect(row?.value_text.length).toBeGreaterThan(0);
        }
    });

    it("returns the outside_patch state off the grid", () => {
        const grid = data.meta.grid;
        const outsideEast = pointDataAt(data, { x_m: grid.width * grid.cell_size_m + 5, z_m: 100 }, 1);
        const outsideWest = pointDataAt(data, { x_m: -1, z_m: 100 }, 1);
        const notANumber = pointDataAt(data, { x_m: Number.NaN, z_m: 100 }, 1);
        for (const result of [outsideEast, outsideWest, notANumber]) {
            expect(result.state).toBe("outside_patch");
            expect(result.rows.length).toBe(0);
            expect(result.cell).toBeNull();
        }
    });
});


describe("formatWalkBackMinutes", () => {
    it("rounds to whole minutes and handles unreachable", () => {
        expect(formatWalkBackMinutes(Number.POSITIVE_INFINITY)).toBe("unreachable");
        expect(formatWalkBackMinutes(29)).toBe("< 1 min");
        expect(formatWalkBackMinutes(1230)).toBe("21 min");
        expect(formatWalkBackMinutes(Number.NaN)).toBe("unknown");
    });
});
