import { describe, expect, it } from "vitest";

import type { ProcessedData } from "../data/loadProcessed";
import { buildSceneMarkers } from "./markers";
import {
    imagePixelToPlane,
    labyrinthStartPosition,
    orthographicZoomToFit,
    patchFraming,
    pixelRectToPlaneRect,
    sunDirectionVector,
} from "./sceneMath";



describe("sunDirectionVector", () => {
    it("points east at the horizon for azimuth 90 and incidence 90", () => {
        const direction = sunDirectionVector(90, 90);
        expect(direction.x).toBeCloseTo(1);
        expect(direction.y).toBeCloseTo(0);
        expect(direction.z).toBeCloseTo(0);
    });

    it("points north (-z) for azimuth 0", () => {
        const direction = sunDirectionVector(0, 60);
        expect(direction.x).toBeCloseTo(0);
        expect(direction.z).toBeLessThan(0);
        expect(direction.y).toBeCloseTo(0.5);
    });

    it("points straight up for incidence 0", () => {
        const direction = sunDirectionVector(123, 0);
        expect(direction.y).toBeCloseTo(1);
    });

    it("returns a unit vector", () => {
        const direction = sunDirectionVector(303.08, 58.81);
        const length = Math.hypot(direction.x, direction.y, direction.z);
        expect(length).toBeCloseTo(1);
    });
});


describe("camera framing", () => {
    const grid = { width: 1013, height: 934, cell_size_m: 2 };

    it("centres on the patch", () => {
        const framing = patchFraming(grid);
        expect(framing.centre_x_m).toBe(1013);
        expect(framing.centre_z_m).toBe(934);
        expect(framing.width_m).toBe(2026);
        expect(framing.height_m).toBe(1868);
    });

    it("fits the limiting side", () => {
        const framing = patchFraming(grid);
        const zoom = orthographicZoomToFit(framing, 1000, 1000, 0);
        expect(zoom).toBeCloseTo(1000 / 2026);
    });

    it("starts the Labyrinth camera south of and above the target", () => {
        const framing = patchFraming(grid);
        const position = labyrinthStartPosition(framing, 100);
        expect(position.z).toBeGreaterThan(framing.centre_z_m);
        expect(position.y).toBeGreaterThan(100);
    });
});


describe("Gale context rectangle", () => {
    it("maps the top-left pixel to the north-west corner", () => {
        const corner = imagePixelToPlane(2000, 2000, 0, 0);
        expect(corner.x).toBe(-1000);
        expect(corner.y).toBe(1000);
    });

    it("maps the patch rectangle to its centre", () => {
        const rect = pixelRectToPlaneRect(2000, 2000, { x: 750, y: 633, width: 20, height: 19 });
        expect(rect.centre_x).toBeCloseTo(-240);
        expect(rect.centre_y).toBeCloseTo(1000 - 642.5);
        expect(rect.width).toBe(20);
        expect(rect.height).toBe(19);
    });
});


describe("buildSceneMarkers", () => {
    it("lists knots, the rover and non-rover shelters", () => {
        const processedData = {
            meta: { staging_point: { x_m: 10, z_m: 20 } },
            knots: [{ knot_id: "knot_1", name: "Sulfur stones", x_m: 1, z_m: 2 }],
            shelters: [
                { shelter_id: "shelter_rover", shelter_type: "pressurised_rover", x_m: 10, z_m: 20, is_estimate: false },
                { shelter_id: "shelter_overhang_02", shelter_type: "terrain_overhang", x_m: 5, z_m: 6, is_estimate: true },
            ],
        } as unknown as ProcessedData;
        const markers = buildSceneMarkers(processedData);
        expect(markers.map((marker) => marker.marker_kind)).toEqual(["knot", "staging_point", "shelter"]);
        expect(markers[1].label).toBe("Rover (staging point)");
        expect(markers[2].label).toBe("Overhang shelter 2 (est.)");
    });
});
