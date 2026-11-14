import { beforeAll, describe, expect, it } from "vitest";

import type { ProcessedData } from "../data/loadProcessed";
import { loadProcessedDataFromDisk } from "../data/loadProcessedFromDisk";
import {
    GRID_SPACING_M,
    HATCH_BASE_PERIOD_M,
    NO_GO_BRIGHT_RGB,
    NO_GO_DARK_RGB,
    WALKABLE_BRIGHT_RGB,
    WALKABLE_DARK_RGB,
    buildNoGoMaskSouthRowFirst,
    gridCoverage,
    hatchCoverage,
    hatchPeriodLevel,
    histogramPercentile,
    lineCoverage,
    luminanceFromRgb,
    luminanceHistogram,
    luminanceStretchFromHistogram,
    noGoGroundColor,
    phosphorTerrainColor,
    reliefShade,
    stretchLuminance,
    walkableGroundColor,
} from "./phosphorTerrain";



function brightness(color: [number, number, number]): number {
    return luminanceFromRgb(color[0] / 255, color[1] / 255, color[2] / 255);
}



describe("luminance ramp", () => {
    it("maps luminance 0 and 1 to the ramp ends", () => {
        expect(walkableGroundColor(0)).toEqual(WALKABLE_DARK_RGB);
        expect(walkableGroundColor(1)).toEqual(WALKABLE_BRIGHT_RGB);
        expect(noGoGroundColor(0)).toEqual(NO_GO_DARK_RGB);
        expect(noGoGroundColor(1)).toEqual(NO_GO_BRIGHT_RGB);
    });

    it("tops out at phosphor green and is green dominant everywhere", () => {
        expect(WALKABLE_BRIGHT_RGB).toEqual([92, 232, 127]);
        for (let step = 0; step <= 10; step++) {
            const color = walkableGroundColor(step / 10);
            expect(color[1]).toBeGreaterThan(color[0]);
            expect(color[1]).toBeGreaterThan(color[2]);
        }
    });

    it("is monotonic in brightness, so relief stays readable", () => {
        let previous = -1;
        for (let step = 0; step <= 20; step++) {
            const value = brightness(walkableGroundColor(step / 20));
            expect(value).toBeGreaterThan(previous);
            previous = value;
        }
    });

    it("keeps all no-go ground darker than the darkest walkable ground", () => {
        expect(brightness(noGoGroundColor(1))).toBeLessThan(brightness(walkableGroundColor(0)));
    });

    it("has at least 4:1 contrast from the walkable floor to its top", () => {
        const darkest = brightness(walkableGroundColor(0));
        const brightest = brightness(walkableGroundColor(1));
        expect(brightest / darkest).toBeGreaterThan(4);
    });

    it("stretches luminance into 0..1 and clamps", () => {
        expect(stretchLuminance(0.3, 0.2, 0.6)).toBeCloseTo(0.25);
        expect(stretchLuminance(0.1, 0.2, 0.6)).toBe(0);
        expect(stretchLuminance(0.9, 0.2, 0.6)).toBe(1);
        expect(stretchLuminance(0.4, 0.5, 0.5)).toBeCloseTo(0.4);
    });
});



describe("relief shade", () => {
    it("leaves flat ground unchanged and brightens sunward slopes", () => {
        expect(reliefShade(0.5, 0.5)).toBeCloseTo(1);
        expect(reliefShade(0.8, 0.5)).toBeGreaterThan(1);
        expect(reliefShade(0.2, 0.5)).toBeLessThan(1);
        expect(reliefShade(-1, 0.5)).toBeGreaterThanOrEqual(0.7);
        expect(reliefShade(0.3, 0)).toBe(1);
    });
});



describe("line coverage (hatch and grid)", () => {
    it("is 1 on a line and 0 half a period away", () => {
        expect(lineCoverage(0, 100, 1, 1)).toBeCloseTo(1);
        expect(lineCoverage(200, 100, 1, 1)).toBeCloseTo(1);
        expect(lineCoverage(50, 100, 1, 1)).toBe(0);
        expect(lineCoverage(-50, 100, 1, 1)).toBe(0);
    });

    it("draws the grid every 100 m from the north-west corner", () => {
        expect(gridCoverage(0, 37, 0.5, 1)).toBeCloseTo(1);
        expect(gridCoverage(300, 37, 0.5, 1)).toBeCloseTo(1);
        expect(gridCoverage(37, GRID_SPACING_M * 4, 0.5, 1)).toBeCloseTo(1);
        expect(gridCoverage(50, 50, 0.5, 1)).toBe(0);
    });

    it("fades the grid out when 100 m is only a few pixels", () => {
        expect(gridCoverage(0, 37, 50, 1)).toBe(0);
        expect(gridCoverage(0, 37, 1, 1)).toBeCloseTo(1);
    });

    it("hatch lines run diagonally at the base period when zoomed in", () => {
        expect(hatchPeriodLevel(0.01, 1)).toBe(0);
        // On a line: x + z = 0. Half a period across the diagonal: no line.
        expect(hatchCoverage(0, 0, 0.01, 1)).toBeCloseTo(1);
        expect(hatchCoverage(5, -5, 0.01, 1)).toBeCloseTo(1);
        const halfPeriodAcross = (HATCH_BASE_PERIOD_M / 2) * Math.SQRT2;
        expect(hatchCoverage(halfPeriodAcross, 0, 0.01, 1)).toBe(0);
    });

    it("hatch period grows with zoom-out so lines stay a few pixels apart", () => {
        const zoomedOut = hatchPeriodLevel(4, 1);
        const zoomedIn = hatchPeriodLevel(0.5, 1);
        expect(zoomedOut).toBeGreaterThan(zoomedIn);
        // Doubling the metres per pixel adds exactly one level (one doubling of the period).
        expect(hatchPeriodLevel(8, 1) - hatchPeriodLevel(4, 1)).toBeCloseTo(1);
    });
});



describe("phosphorTerrainColor", () => {
    it("draws walkable ground lit and no-go ground dark, hatch only on no-go", () => {
        const walkable = phosphorTerrainColor({ rampPosition: 0.6, noGoMaskValue: 0, hatch: 1, grid: 0 });
        const noGo = phosphorTerrainColor({ rampPosition: 0.6, noGoMaskValue: 1, hatch: 0, grid: 0 });
        const noGoOnHatch = phosphorTerrainColor({ rampPosition: 0.6, noGoMaskValue: 1, hatch: 1, grid: 0 });
        expect(walkable).toEqual(walkableGroundColor(0.6));
        expect(brightness(noGo)).toBeLessThan(brightness(walkable) / 3);
        expect(brightness(noGoOnHatch)).toBeGreaterThan(brightness(noGo));
    });

    it("grid lines lighten the ground faintly", () => {
        const plain = phosphorTerrainColor({ rampPosition: 0.5, noGoMaskValue: 0, hatch: 0, grid: 0 });
        const onGrid = phosphorTerrainColor({ rampPosition: 0.5, noGoMaskValue: 0, hatch: 0, grid: 1 });
        expect(brightness(onGrid)).toBeGreaterThan(brightness(plain));
        expect(brightness(onGrid) - brightness(plain)).toBeLessThan(0.15);
    });
});



describe("luminance histogram and stretch", () => {
    it("finds percentiles of a two-tone image", () => {
        const rgba = new Uint8Array(100 * 4);
        for (let pixel = 0; pixel < 100; pixel++) {
            const value = pixel < 50 ? 51 : 204;
            rgba.set([value, value, value, 255], pixel * 4);
        }
        const histogram = luminanceHistogram(rgba);
        expect(histogramPercentile(histogram, 0.25)).toBeCloseTo(0.2, 1);
        expect(histogramPercentile(histogram, 0.75)).toBeCloseTo(0.8, 1);
        const stretch = luminanceStretchFromHistogram(histogram);
        expect(stretch.low).toBeCloseTo(0.2, 1);
        expect(stretch.high).toBeCloseTo(0.8, 1);
    });

    it("falls back to the full range for a flat image and skips transparent pixels", () => {
        const flat = new Uint8Array(40 * 4).fill(128);
        expect(luminanceStretchFromHistogram(luminanceHistogram(flat))).toEqual({ low: 0, high: 1 });
        const transparent = new Uint8Array(8);
        expect(luminanceHistogram(transparent).reduce((sum, count) => sum + count, 0)).toBe(0);
    });
});



describe("buildNoGoMaskSouthRowFirst", () => {
    it("flips rows so row 0 of the mask is the south row", () => {
        const grid = { width: 2, height: 2, cell_size_m: 2 };
        // North row: [walkable, no-go]; south row: [no-go, walkable].
        const penalty = new Float32Array([1, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, 1]);
        const mask = buildNoGoMaskSouthRowFirst(grid, penalty);
        expect(Array.from(mask)).toEqual([255, 0, 0, 255]);
    });

    it("treats NaN as no-go and rejects a wrong length", () => {
        const grid = { width: 2, height: 1, cell_size_m: 2 };
        expect(Array.from(buildNoGoMaskSouthRowFirst(grid, new Float32Array([Number.NaN, 1.5])))).toEqual([255, 0]);
        expect(() => buildNoGoMaskSouthRowFirst(grid, new Float32Array(3))).toThrow();
    });
});



describe("no-go mask on the real patch", () => {
    let data: ProcessedData;

    beforeAll(async () => {
        data = await loadProcessedDataFromDisk();
    });

    it("marks exactly the +Infinity traversal_penalty cells, quickly", () => {
        const startMs = performance.now();
        const mask = buildNoGoMaskSouthRowFirst(data.meta.grid, data.float32Layers.traversal_penalty);
        const elapsedMs = performance.now() - startMs;
        const { width, height } = data.meta.grid;
        let maskCount = 0;
        let mismatchCount = 0;
        for (let row = 0; row < height; row++) {
            for (let col = 0; col < width; col++) {
                const isInfinite = data.float32Layers.traversal_penalty[row * width + col] === Number.POSITIVE_INFINITY;
                const isMasked = mask[(height - 1 - row) * width + col] === 255;
                if (isMasked) {
                    maskCount++;
                }
                if (isInfinite !== isMasked) {
                    mismatchCount++;
                }
            }
        }
        console.log(`no-go mask: ${maskCount} of ${width * height} cells in ${elapsedMs.toFixed(1)} ms`);
        expect(mismatchCount).toBe(0);
        expect(maskCount).toBeGreaterThan(0);
        expect(elapsedMs).toBeLessThan(250);
    });
});
