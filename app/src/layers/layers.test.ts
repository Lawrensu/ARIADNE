import { beforeAll, describe, expect, it } from "vitest";

import type { ProcessedData } from "../data/loadProcessed";
import { loadProcessedDataFromDisk } from "../data/loadProcessedFromDisk";
import { OVERLAY_LAYER_IDS } from "../state/layersSlice";
import type { OverlayLayerId } from "../state/layersSlice";
import { legendFor } from "./layerLegend";
import { NO_GO_STRIPE_BRIGHT_COLOR, NO_GO_STRIPE_DARK_COLOR, SLOPE_ABOVE_LIMIT_COLOR } from "./layerPalette";
import { GRID_OVERLAY_LAYER_IDS, buildOverlayRgba, mineralogyClassName } from "./overlayRgba";



let data: ProcessedData;

beforeAll(async () => {
    data = await loadProcessedDataFromDisk();
});



describe("buildOverlayRgba", () => {
    it("returns width * height * 4 bytes for every grid overlay", () => {
        const expectedLength = data.meta.grid.width * data.meta.grid.height * 4;
        for (const layerId of GRID_OVERLAY_LAYER_IDS) {
            expect(buildOverlayRgba(layerId, data).length, layerId).toBe(expectedLength);
        }
    });

    it("no_go has one opaque cell per +Infinity traversal_penalty cell", () => {
        const rgba = buildOverlayRgba("no_go", data);
        const penalty = data.float32Layers.traversal_penalty;
        let infiniteCount = 0;
        let opaqueCount = 0;
        for (let cellIndex = 0; cellIndex < penalty.length; cellIndex++) {
            const isInfinite = penalty[cellIndex] === Number.POSITIVE_INFINITY;
            const isOpaque = rgba[cellIndex * 4 + 3] === 255;
            if (isInfinite) {
                infiniteCount++;
            }
            if (isOpaque) {
                opaqueCount++;
            }
            if (isInfinite !== isOpaque) {
                throw new Error(`cell ${cellIndex}: infinite ${isInfinite} but opaque ${isOpaque}`);
            }
        }
        const percent = (100 * infiniteCount) / penalty.length;
        console.log(`no_go cells: ${opaqueCount} of ${penalty.length} (${percent.toFixed(2)} %)`);
        expect(opaqueCount).toBe(infiniteCount);
        expect(infiniteCount).toBeGreaterThan(0);
    });

    it("no_go uses both stripe colours so it is not a flat fill", () => {
        const rgba = buildOverlayRgba("no_go", data);
        const penalty = data.float32Layers.traversal_penalty;
        let brightCount = 0;
        let darkCount = 0;
        for (let cellIndex = 0; cellIndex < penalty.length; cellIndex++) {
            if (rgba[cellIndex * 4 + 3] === 255) {
                if (rgba[cellIndex * 4] === NO_GO_STRIPE_BRIGHT_COLOR[0]) {
                    brightCount++;
                }
                if (rgba[cellIndex * 4] === NO_GO_STRIPE_DARK_COLOR[0]) {
                    darkCount++;
                }
            }
        }
        expect(brightCount).toBeGreaterThan(0);
        expect(darkCount).toBeGreaterThan(0);
    });

    it("mineralogy is transparent where the class is 0 or none_detected, opaque otherwise", () => {
        const rgba = buildOverlayRgba("mineralogy_class", data);
        const classes = data.uint8Layers.mineralogy_class;
        let drawnCount = 0;
        let mismatchCount = 0;
        for (let cellIndex = 0; cellIndex < classes.length; cellIndex++) {
            const className = mineralogyClassName(data, classes[cellIndex]);
            const alpha = rgba[cellIndex * 4 + 3];
            if (classes[cellIndex] === 0 && alpha !== 0) {
                mismatchCount++;
            }
            if (className === "none_detected" && alpha !== 0) {
                mismatchCount++;
            }
            if (alpha !== 0) {
                drawnCount++;
            }
        }
        console.log(`mineralogy cells drawn: ${drawnCount}`);
        expect(mismatchCount).toBe(0);
        expect(drawnCount).toBeGreaterThan(0);
    });

    it("slope cells above the walkable limit get the no-go colour, others do not", () => {
        const rgba = buildOverlayRgba("slope_degrees", data);
        const slope = data.float32Layers.slope_degrees;
        const limit = data.meta.parameters?.max_walkable_slope_deg ?? 25;
        let steepCount = 0;
        let mismatchCount = 0;
        for (let cellIndex = 0; cellIndex < slope.length; cellIndex++) {
            const offset = cellIndex * 4;
            const isSteepColour =
                rgba[offset] === SLOPE_ABOVE_LIMIT_COLOR[0] &&
                rgba[offset + 1] === SLOPE_ABOVE_LIMIT_COLOR[1] &&
                rgba[offset + 2] === SLOPE_ABOVE_LIMIT_COLOR[2];
            if (Number.isNaN(slope[cellIndex])) {
                if (rgba[offset + 3] !== 0) {
                    mismatchCount++;
                }
            } else if (slope[cellIndex] > limit) {
                steepCount++;
                if (!isSteepColour) {
                    mismatchCount++;
                }
            } else {
                if (isSteepColour) {
                    mismatchCount++;
                }
            }
        }
        console.log(`slope cells above ${limit} degrees: ${steepCount}`);
        expect(mismatchCount).toBe(0);
        expect(steepCount).toBeGreaterThan(0);
    });

    it("viewshed highlights only the dead zone (value 0)", () => {
        const rgba = buildOverlayRgba("viewshed_rover", data);
        const viewshed = data.uint8Layers.viewshed_rover;
        let mismatchCount = 0;
        for (let cellIndex = 0; cellIndex < viewshed.length; cellIndex++) {
            const isOpaque = rgba[cellIndex * 4 + 3] === 255;
            const isDeadZone = viewshed[cellIndex] === 0;
            if (isOpaque !== isDeadZone) {
                mismatchCount++;
            }
        }
        expect(mismatchCount).toBe(0);
    });

    it("continuous layers are transparent exactly where the data is NaN", () => {
        const skyRgba = buildOverlayRgba("sky_view_factor", data);
        const thermalRgba = buildOverlayRgba("thermal_inertia", data);
        const sky = data.float32Layers.sky_view_factor;
        const thermal = data.float32Layers.thermal_inertia;
        let mismatchCount = 0;
        for (let cellIndex = 0; cellIndex < sky.length; cellIndex++) {
            if ((skyRgba[cellIndex * 4 + 3] === 0) !== !Number.isFinite(sky[cellIndex])) {
                mismatchCount++;
            }
            if ((thermalRgba[cellIndex * 4 + 3] === 0) !== !Number.isFinite(thermal[cellIndex])) {
                mismatchCount++;
            }
        }
        expect(mismatchCount).toBe(0);
    });
});



describe("legendFor", () => {
    it("copies provenance from meta.json layers[] for every grid layer", () => {
        for (const layerId of OVERLAY_LAYER_IDS) {
            if (layerId === "rocks") {
                continue;
            }
            // The no-go mask is derived from traversal_penalty.
            let metaLayerId: string = layerId;
            if (layerId === "no_go") {
                metaLayerId = "traversal_penalty";
            }
            const entry = data.meta.layers.find((layer) => layer.layer_id === metaLayerId);
            expect(entry, metaLayerId).toBeDefined();
            const legend = legendFor(layerId, data);
            expect(legend.layer_id).toBe(layerId);
            expect(legend.source_dataset).toBe(entry?.source_dataset);
            expect(legend.product_id).toBe(entry?.product_id);
            expect(legend.native_resolution_m).toBe(entry?.native_resolution_m);
            expect(legend.is_estimate).toBe(entry?.is_estimate);
            expect(legend.description.length).toBeGreaterThan(0);
            expect(legend.caveat.length).toBeGreaterThan(0);
        }
    });

    it("flags estimates with an est. badge and mineralogy as low confidence", () => {
        const slope: OverlayLayerId = "slope_degrees";
        expect(legendFor(slope, data).badge_text).toBe("est.");
        expect(legendFor("mineralogy_class", data).badge_text).toBe("est., low confidence");
        expect(legendFor("rocks", data).badge_text).toBe("est.");
        // THEMIS is a measurement in meta.json (is_estimate false): no badge, but the caveat says context.
        expect(legendFor("thermal_inertia", data).badge_text).toBeNull();
        expect(legendFor("thermal_inertia", data).caveat).toContain("100");
    });

    it("rocks legend uses rocks.json provenance and the rock count", () => {
        const legend = legendFor("rocks", data);
        expect(legend.source_dataset).toBe(data.rocks[0].provenance.source_dataset);
        expect(legend.product_id).toBe(data.rocks[0].provenance.product_id);
        expect(legend.description).toContain(String(data.rocks.length));
    });

    it("gradient layers have labelled ends and categorical layers have entries", () => {
        const slopeLegend = legendFor("slope_degrees", data);
        expect(slopeLegend.gradient_stops[0].label).toBe("0");
        expect(slopeLegend.gradient_stops[slopeLegend.gradient_stops.length - 1].label).toBe("25");
        expect(legendFor("mineralogy_class", data).entries.length).toBeGreaterThan(0);
        expect(legendFor("no_go", data).entries[0].is_striped).toBe(true);
    });
});
