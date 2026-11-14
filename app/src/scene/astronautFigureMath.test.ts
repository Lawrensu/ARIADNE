import * as THREE from "three";
import { describe, expect, it } from "vitest";

import {
    FIGURE_MAX_HEIGHT_M,
    FIGURE_MIN_HEIGHT_M,
    FIGURE_TARGET_HEIGHT_PX,
    WALK_LEG_SWING_RAD,
    WORKING_ARM_FORWARD_RAD,
    figureHeightForCameraDistance,
    figurePoseAt,
    headingDegToRotationY,
} from "./astronautFigureMath";



// The direction the figure model faces (-z) after applying the y rotation, as three.js does.
function facingAfterRotation(rotationY: number): THREE.Vector3 {
    const forward = new THREE.Vector3(0, 0, -1);
    return forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
}



describe("figureHeightForCameraDistance", () => {
    it("keeps the figure the target number of pixels tall at a mid distance", () => {
        const distanceM = 1000;
        const fovDeg = 40;
        const viewportPx = 800;
        const heightM = figureHeightForCameraDistance(distanceM, fovDeg, viewportPx);
        const pixelsPerMetre = viewportPx / (2 * distanceM * Math.tan((fovDeg * Math.PI) / 360));
        expect(heightM * pixelsPerMetre).toBeCloseTo(FIGURE_TARGET_HEIGHT_PX);
    });

    it("grows linearly with distance", () => {
        const near = figureHeightForCameraDistance(500, 40, 800);
        const far = figureHeightForCameraDistance(1000, 40, 800);
        expect(far).toBeCloseTo(near * 2);
    });

    it("never goes below true astronaut size when the camera is close", () => {
        expect(figureHeightForCameraDistance(5, 40, 800)).toBe(FIGURE_MIN_HEIGHT_M);
    });

    it("is clamped when the camera is very far", () => {
        expect(figureHeightForCameraDistance(100000, 40, 800)).toBe(FIGURE_MAX_HEIGHT_M);
    });

    it("falls back to the minimum for bad inputs", () => {
        expect(figureHeightForCameraDistance(0, 40, 800)).toBe(FIGURE_MIN_HEIGHT_M);
        expect(figureHeightForCameraDistance(Number.NaN, 40, 800)).toBe(FIGURE_MIN_HEIGHT_M);
        expect(figureHeightForCameraDistance(1000, 40, 0)).toBe(FIGURE_MIN_HEIGHT_M);
        expect(figureHeightForCameraDistance(1000, 0, 800)).toBe(FIGURE_MIN_HEIGHT_M);
    });
});



describe("headingDegToRotationY", () => {
    it("faces north (-z) at heading 0", () => {
        const facing = facingAfterRotation(headingDegToRotationY(0));
        expect(facing.x).toBeCloseTo(0);
        expect(facing.z).toBeCloseTo(-1);
    });

    it("faces east (+x) at heading 90", () => {
        const facing = facingAfterRotation(headingDegToRotationY(90));
        expect(facing.x).toBeCloseTo(1);
        expect(facing.z).toBeCloseTo(0);
    });

    it("faces south (+z) at heading 180 and west (-x) at heading 270", () => {
        const south = facingAfterRotation(headingDegToRotationY(180));
        expect(south.x).toBeCloseTo(0);
        expect(south.z).toBeCloseTo(1);
        const west = facingAfterRotation(headingDegToRotationY(270));
        expect(west.x).toBeCloseTo(-1);
        expect(west.z).toBeCloseTo(0);
    });

    it("returns 0 for a non-finite heading", () => {
        expect(headingDegToRotationY(Number.NaN)).toBe(0);
    });
});



describe("figurePoseAt", () => {
    it("swings the legs while walking with the clock playing", () => {
        // A quarter stride in: the swing is at its peak.
        const quarterStrideS = 1 / (4 * 1.1);
        const pose = figurePoseAt(true, false, true, quarterStrideS);
        expect(pose.pose_kind).toBe("walking");
        expect(pose.left_leg_swing_rad).toBeCloseTo(WALK_LEG_SWING_RAD);
        expect(pose.left_arm_swing_rad).toBeLessThan(0);
        expect(pose.right_arm_swing_rad).toBeGreaterThan(0);
        expect(pose.bob_fraction).toBeGreaterThan(0);
    });

    it("stands still when the walk is paused", () => {
        const pose = figurePoseAt(true, false, false, 0.3);
        expect(pose.pose_kind).toBe("idle");
        expect(pose.left_leg_swing_rad).toBe(0);
        expect(pose.bob_fraction).toBe(0);
    });

    it("reaches forward and pulses the ring at a Knot", () => {
        const pose = figurePoseAt(false, true, true, 0.3);
        expect(pose.pose_kind).toBe("working");
        expect(pose.left_arm_swing_rad).toBe(WORKING_ARM_FORWARD_RAD);
        expect(pose.ring_scale).toBeGreaterThanOrEqual(1);
    });

    it("is idle at the rover", () => {
        const pose = figurePoseAt(false, false, true, 0.3);
        expect(pose.pose_kind).toBe("idle");
        expect(pose.ring_scale).toBe(1);
    });
});
