import { describe, expect, it } from "vitest";

import {
    compassPlacement,
    formatBearingDegrees,
    formatNextStepLine,
    formatSpeedLabel,
    formatSyncLabel,
    formatTaskLine,
    formatWorldMarkerLabel,
    isInsideMinimap,
    minimapPolylinePoints,
    nextSpeedPreset,
    projectToMinimap,
    projectToMinimapClamped,
    relativeBearingWord,
    signedDeltaDegrees,
} from "./visorMath";
import type { MinimapView } from "./visorMath";



const VIEW: MinimapView = { centre: { x_m: 100, z_m: 200 }, radiusM: 300, sizeUnits: 200 };



describe("minimap projection", () => {
    it("puts the centre in the middle", () => {
        expect(projectToMinimap({ x_m: 100, z_m: 200 }, VIEW)).toEqual({ x: 100, y: 100 });
    });

    it("puts east to the right and south down", () => {
        const east = projectToMinimap({ x_m: 400, z_m: 200 }, VIEW);
        expect(east.x).toBeCloseTo(200);
        expect(east.y).toBeCloseTo(100);
        const south = projectToMinimap({ x_m: 100, z_m: 500 }, VIEW);
        expect(south.x).toBeCloseTo(100);
        expect(south.y).toBeCloseTo(200);
    });

    it("tells inside from outside the circle", () => {
        expect(isInsideMinimap({ x_m: 100, z_m: 499 }, VIEW)).toBe(true);
        expect(isInsideMinimap({ x_m: 100, z_m: 501 }, VIEW)).toBe(false);
    });

    it("pulls a far point onto the rim at the same bearing", () => {
        const clamped = projectToMinimapClamped({ x_m: 100 + 3000, z_m: 200 }, VIEW, 10);
        expect(clamped.x).toBeCloseTo(190);
        expect(clamped.y).toBeCloseTo(100);
    });

    it("leaves a near point where it is when clamping", () => {
        const near = projectToMinimapClamped({ x_m: 130, z_m: 200 }, VIEW, 10);
        expect(near.x).toBeCloseTo(110);
    });

    it("writes polyline points", () => {
        const text = minimapPolylinePoints(
            [
                { x_m: 100, z_m: 200 },
                { x_m: 400, z_m: 200 },
            ],
            VIEW,
        );
        expect(text).toBe("100.0,100.0 200.0,100.0");
    });

    it("gives an empty string for an empty path", () => {
        expect(minimapPolylinePoints([], VIEW)).toBe("");
    });
});



describe("bearing helpers", () => {
    it("wraps the signed difference across north", () => {
        expect(signedDeltaDegrees(10, 350)).toBe(20);
        expect(signedDeltaDegrees(350, 10)).toBe(-20);
    });

    it("places a bearing on the compass strip", () => {
        expect(compassPlacement(90, 90)).toEqual({ leftPercent: 50, edge: "inside" });
        expect(compassPlacement(120, 90).leftPercent).toBeCloseTo(75);
        expect(compassPlacement(200, 90)).toMatchObject({ edge: "right" });
        expect(compassPlacement(0, 90)).toMatchObject({ edge: "left", leftPercent: 0 });
    });

    it("says ahead, left, right and behind", () => {
        expect(relativeBearingWord(95, 90)).toBe("AHEAD");
        expect(relativeBearingWord(130, 90)).toBe("RIGHT 40°");
        expect(relativeBearingWord(0, 90)).toBe("LEFT 90°");
        expect(relativeBearingWord(270, 90)).toBe("BEHIND");
        expect(relativeBearingWord(Number.NaN, 90)).toBe("UNKNOWN");
    });

    it("formats bearings", () => {
        expect(formatBearingDegrees(359.6)).toBe("0°");
        expect(formatBearingDegrees(-90)).toBe("270°");
        expect(formatBearingDegrees(null)).toBe("--");
    });
});



describe("label text", () => {
    it("labels a world marker with name and distance", () => {
        expect(formatWorldMarkerLabel("Boxwork ridge", 240)).toBe("Boxwork ridge 240 m");
        expect(formatWorldMarkerLabel("Rover", 1500)).toBe("Rover 1.5 km");
    });

    it("writes the next step with est. in front of the time", () => {
        expect(formatNextStepLine({ kind: "knot", label: "Boxwork ridge", distanceM: 240, walkSeconds: 380 })).toBe(
            "NEXT: Boxwork ridge, 240 m, est. 6 min",
        );
        expect(formatNextStepLine({ kind: "shelter", label: "Rover shelter", distanceM: 340, walkSeconds: 400 })).toBe(
            "SHELTER: Rover shelter, 340 m, est. 6 min",
        );
    });

    it("writes the task line", () => {
        expect(formatTaskLine("Collect sample")).toBe("TASK: Collect sample");
    });

    it("writes the sync label", () => {
        expect(formatSyncLabel(0)).toBe("SOLO");
        expect(formatSyncLabel(1)).toBe("SYNCED");
    });
});



describe("speed presets", () => {
    const presets = [1, 10, 60];

    it("cycles and wraps", () => {
        expect(nextSpeedPreset(1, presets)).toBe(10);
        expect(nextSpeedPreset(60, presets)).toBe(1);
        expect(nextSpeedPreset(7, presets)).toBe(1);
        expect(formatSpeedLabel(60)).toBe("x60");
    });
});
