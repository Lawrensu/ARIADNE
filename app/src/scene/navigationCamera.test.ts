import { describe, expect, it } from "vitest";

import {
    CHASE_DISTANCE_BEHIND_M,
    CHASE_HEIGHT_ABOVE_TERRAIN_M,
    CHASE_LOOK_AHEAD_M,
    CHASE_MIN_CLEARANCE_M,
    FIRST_PERSON_EYE_HEIGHT_M,
    FIRST_PERSON_PITCH_DOWN_DEG,
    computeChaseRig,
    computeFirstPersonPose,
    dampAngleDeg,
    glideZoom,
    headingToGroundDirection,
    keepAboveTerrain,
    navigationZoom,
    normalizeHeadingDeg,
    shortestAngleDeltaDeg,
} from "./navigationCamera";



function flatTerrain(heightY: number) {
    return () => heightY;
}



describe("headingToGroundDirection", () => {
    it("heading 0 faces north (-z), 90 east (+x), 180 south (+z), 270 west (-x)", () => {
        const north = headingToGroundDirection(0);
        expect(north.x).toBeCloseTo(0);
        expect(north.z).toBeCloseTo(-1);
        const east = headingToGroundDirection(90);
        expect(east.x).toBeCloseTo(1);
        expect(east.z).toBeCloseTo(0);
        const south = headingToGroundDirection(180);
        expect(south.z).toBeCloseTo(1);
        const west = headingToGroundDirection(270);
        expect(west.x).toBeCloseTo(-1);
    });
});


describe("angles", () => {
    it("shortestAngleDeltaDeg takes the short way round the wrap", () => {
        expect(shortestAngleDeltaDeg(359, 1)).toBeCloseTo(2);
        expect(shortestAngleDeltaDeg(1, 359)).toBeCloseTo(-2);
        expect(shortestAngleDeltaDeg(0, 90)).toBeCloseTo(90);
    });

    it("normalizeHeadingDeg wraps into 0 to 360", () => {
        expect(normalizeHeadingDeg(-10)).toBeCloseTo(350);
        expect(normalizeHeadingDeg(370)).toBeCloseTo(10);
    });

    it("dampAngleDeg does not move for a zero frame time and reaches the target for a long one", () => {
        expect(dampAngleDeg(10, 100, 0, 0.5)).toBe(10);
        expect(dampAngleDeg(10, 100, 100, 0.5)).toBeCloseTo(100, 3);
    });

    it("dampAngleDeg turns a 170 degree corner gradually, not at once", () => {
        const afterOneFrame = dampAngleDeg(0, 170, 0.016, 0.5);
        expect(afterOneFrame).toBeGreaterThan(0);
        expect(afterOneFrame).toBeLessThan(10);
    });

    it("dampAngleDeg goes across the 359 to 1 wrap by 2 degrees, not 358", () => {
        const next = dampAngleDeg(359, 1, 100, 0.5);
        expect(next).toBeCloseTo(1, 3);
        const partial = dampAngleDeg(359, 1, 0.5, 0.5);
        const travelled = shortestAngleDeltaDeg(359, partial);
        expect(travelled).toBeGreaterThan(0);
        expect(travelled).toBeLessThan(2);
    });

    it("dampAngleDeg is frame-rate independent", () => {
        const oneLong = dampAngleDeg(0, 90, 0.032, 0.5);
        const twoShort = dampAngleDeg(dampAngleDeg(0, 90, 0.016, 0.5), 90, 0.016, 0.5);
        expect(twoShort).toBeCloseTo(oneLong, 6);
    });
});


describe("navigationZoom", () => {
    it("shows the requested metres across the shorter side", () => {
        expect(navigationZoom(1000, 500, 250)).toBeCloseTo(2);
        expect(navigationZoom(400, 900, 250)).toBeCloseTo(1.6);
    });

    it("falls back to 1 for a degenerate viewport", () => {
        expect(navigationZoom(0, 500, 250)).toBe(1);
    });
});


describe("glideZoom", () => {
    it("moves towards the target without overshooting", () => {
        const next = glideZoom(1, 4, 0.1, 0.35);
        expect(next).toBeGreaterThan(1);
        expect(next).toBeLessThan(4);
    });

    it("glides out as well as in", () => {
        const next = glideZoom(4, 1, 0.1, 0.35);
        expect(next).toBeLessThan(4);
        expect(next).toBeGreaterThan(1);
    });

    it("settles on the target when within half a percent", () => {
        expect(glideZoom(3.99, 4, 0.016, 0.35)).toBe(4);
    });

    it("does not move for a zero frame time", () => {
        expect(glideZoom(1, 4, 0, 0.35)).toBe(1);
    });
});


describe("computeChaseRig", () => {
    it("heading north: camera is south of the astronaut, looking north", () => {
        const rig = computeChaseRig({ position: { x_m: 100, z_m: 200 }, headingDeg: 0, scale: 1, sampleTerrainY: flatTerrain(10) });
        expect(rig.cameraPosition.x).toBeCloseTo(100);
        expect(rig.cameraPosition.z).toBeCloseTo(200 + CHASE_DISTANCE_BEHIND_M);
        expect(rig.cameraPosition.y).toBeCloseTo(10 + CHASE_HEIGHT_ABOVE_TERRAIN_M);
        expect(rig.lookAtPosition.z).toBeCloseTo(200 - CHASE_LOOK_AHEAD_M);
    });

    it("heading east: camera is west of the astronaut", () => {
        const rig = computeChaseRig({ position: { x_m: 100, z_m: 200 }, headingDeg: 90, scale: 1, sampleTerrainY: flatTerrain(0) });
        expect(rig.cameraPosition.x).toBeCloseTo(100 - CHASE_DISTANCE_BEHIND_M);
        expect(rig.cameraPosition.z).toBeCloseTo(200);
        expect(rig.lookAtPosition.x).toBeCloseTo(100 + CHASE_LOOK_AHEAD_M);
    });

    it("uses the terrain height at the camera position", () => {
        const slope = (_x: number, z: number) => z * 0.1;
        const rig = computeChaseRig({ position: { x_m: 0, z_m: 100 }, headingDeg: 0, scale: 1, sampleTerrainY: slope });
        const cameraZ = 100 + CHASE_DISTANCE_BEHIND_M;
        expect(rig.cameraPosition.y).toBeCloseTo(cameraZ * 0.1 + CHASE_HEIGHT_ABOVE_TERRAIN_M);
    });

    it("stays above the astronaut's terrain when the ground behind is a deep hollow", () => {
        const hollow = (_x: number, z: number) => {
            if (z > 110) {
                return -500;
            }
            return 50;
        };
        const rig = computeChaseRig({ position: { x_m: 0, z_m: 100 }, headingDeg: 0, scale: 1, sampleTerrainY: hollow });
        expect(rig.cameraPosition.y).toBeGreaterThanOrEqual(50 + CHASE_MIN_CLEARANCE_M);
    });

    it("scale moves the camera farther and higher", () => {
        const near = computeChaseRig({ position: { x_m: 0, z_m: 0 }, headingDeg: 0, scale: 1, sampleTerrainY: flatTerrain(0) });
        const far = computeChaseRig({ position: { x_m: 0, z_m: 0 }, headingDeg: 0, scale: 2, sampleTerrainY: flatTerrain(0) });
        expect(far.cameraPosition.z).toBeGreaterThan(near.cameraPosition.z);
        expect(far.cameraPosition.y).toBeGreaterThan(near.cameraPosition.y);
    });
});


describe("keepAboveTerrain", () => {
    it("lifts a camera that sank below the clearance", () => {
        const lifted = keepAboveTerrain({ x: 0, y: 1, z: 0 }, flatTerrain(10));
        expect(lifted.y).toBeCloseTo(10 + CHASE_MIN_CLEARANCE_M);
    });

    it("leaves a high camera alone", () => {
        const point = { x: 0, y: 100, z: 0 };
        expect(keepAboveTerrain(point, flatTerrain(10))).toBe(point);
    });
});


describe("computeFirstPersonPose", () => {
    it("puts the eye 1.7 m above the terrain at the position", () => {
        const pose = computeFirstPersonPose({ position: { x_m: 5, z_m: 6 }, headingDeg: 0, sampleTerrainY: flatTerrain(20) });
        expect(pose.eyePosition.x).toBeCloseTo(5);
        expect(pose.eyePosition.z).toBeCloseTo(6);
        expect(pose.eyePosition.y).toBeCloseTo(20 + FIRST_PERSON_EYE_HEIGHT_M);
    });

    it("looks along the heading and downward by the pitch", () => {
        const pose = computeFirstPersonPose({ position: { x_m: 0, z_m: 0 }, headingDeg: 90, sampleTerrainY: flatTerrain(0) });
        expect(pose.lookAtPosition.x).toBeGreaterThan(9);
        expect(pose.lookAtPosition.z).toBeCloseTo(0);
        const drop = pose.eyePosition.y - pose.lookAtPosition.y;
        const horizontal = pose.lookAtPosition.x;
        const pitchDeg = (Math.atan2(drop, horizontal) * 180) / Math.PI;
        expect(pitchDeg).toBeCloseTo(FIRST_PERSON_PITCH_DOWN_DEG);
    });
});
