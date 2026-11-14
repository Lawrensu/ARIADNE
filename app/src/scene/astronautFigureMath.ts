// Pure maths for the 3D astronaut figure (AstronautFigure.tsx): how big to draw it so it stays
// readable at any camera distance, which way it faces, and the walk animation pose. No React, no
// WebGL, so Vitest can check it in Node.
//
// Scene axes: x east, z south, y up, metres (local grid only). The figure model faces -z (north).



// A true-size astronaut (about 2 m) would be a few pixels tall from a camera 200 to 5000 m away,
// so the figure is scaled with distance to stay about this many pixels tall on screen.
export const FIGURE_TARGET_HEIGHT_PX = 56;

// Never draw the figure smaller than a real suited astronaut, and never so large that it covers a
// whole terrain feature when the camera is pulled far back (the figure then shrinks below target).
export const FIGURE_MIN_HEIGHT_M = 2;
export const FIGURE_MAX_HEIGHT_M = 600;


// Walk animation, in real (display) seconds, not simulation seconds: the sim clock can run many
// times faster than real time, and limbs swinging at that rate would only flicker.
export const WALK_STRIDE_HZ = 1.1;
export const WALK_LEG_SWING_RAD = 0.5;
export const WALK_ARM_SWING_RAD = 0.35;
// Vertical bob as a fraction of the figure height (two bobs per stride, one per step).
export const WALK_BOB_FRACTION = 0.03;

// "working" pose at a Knot: both arms reach forward, as if sampling or photographing.
export const WORKING_ARM_FORWARD_RAD = 1.0;

// Ground ring pulse while working at a Knot: the ring grows and shrinks by this fraction.
export const RING_PULSE_HZ = 0.8;
export const RING_PULSE_FRACTION = 0.18;



// "walking": limbs swing. "working": arms forward at a Knot. "idle": standing still.
export type FigurePoseKind = "walking" | "working" | "idle";


export interface FigurePose {
    pose_kind: FigurePoseKind;
    // Rotation about x of the left leg pivot; the right leg uses the negative. Positive = forward (-z).
    left_leg_swing_rad: number;
    // Rotation about x of the left arm pivot. Positive = forward (-z).
    left_arm_swing_rad: number;
    right_arm_swing_rad: number;
    // Lift of the whole body above the ground, as a fraction of the figure height.
    bob_fraction: number;
    // Scale of the ground ring (1 = rest size).
    ring_scale: number;
}



// Height in metres at which the figure appears FIGURE_TARGET_HEIGHT_PX tall on a perspective
// camera. Pixels per metre at distance d are viewportHeightPx / (2 d tan(fov / 2)).
export function figureHeightForCameraDistance(
    distanceM: number,
    verticalFovDeg: number,
    viewportHeightPx: number,
): number {
    if (Number.isFinite(distanceM) === false || distanceM <= 0) {
        return FIGURE_MIN_HEIGHT_M;
    }
    if (Number.isFinite(viewportHeightPx) === false || viewportHeightPx <= 0) {
        return FIGURE_MIN_HEIGHT_M;
    }
    if (Number.isFinite(verticalFovDeg) === false || verticalFovDeg <= 0 || verticalFovDeg >= 180) {
        return FIGURE_MIN_HEIGHT_M;
    }

    const halfFovRad = (verticalFovDeg * Math.PI) / 360;
    const visibleHeightM = 2 * distanceM * Math.tan(halfFovRad);
    const metresPerPixel = visibleHeightM / viewportHeightPx;
    const heightM = FIGURE_TARGET_HEIGHT_PX * metresPerPixel;

    if (heightM < FIGURE_MIN_HEIGHT_M) {
        return FIGURE_MIN_HEIGHT_M;
    }
    if (heightM > FIGURE_MAX_HEIGHT_M) {
        return FIGURE_MAX_HEIGHT_M;
    }
    return heightM;
}


// Rotation about y (radians) for a compass heading (0 = north = -z, 90 = east = +x, clockwise seen
// from above). A positive three.js y rotation turns counter-clockwise seen from above, so the
// compass heading is negated.
export function headingDegToRotationY(headingDeg: number): number {
    if (Number.isFinite(headingDeg) === false) {
        return 0;
    }
    return -(headingDeg * Math.PI) / 180;
}



function standingPose(poseKind: FigurePoseKind, armForwardRad: number, ringScale: number): FigurePose {
    return {
        pose_kind: poseKind,
        left_leg_swing_rad: 0,
        left_arm_swing_rad: armForwardRad,
        right_arm_swing_rad: armForwardRad,
        bob_fraction: 0,
        ring_scale: ringScale,
    };
}


// Pose at a given real time. Walking animates only while the sim clock plays; a paused walk stands.
export function figurePoseAt(isWalking: boolean, isAtKnot: boolean, isSimPlaying: boolean, timeSeconds: number): FigurePose {
    if (isWalking) {
        if (isSimPlaying) {
            const stridePhaseRad = 2 * Math.PI * WALK_STRIDE_HZ * timeSeconds;
            const swing = Math.sin(stridePhaseRad);
            return {
                pose_kind: "walking",
                left_leg_swing_rad: WALK_LEG_SWING_RAD * swing,
                // Arms swing opposite to the leg on the same side.
                left_arm_swing_rad: -WALK_ARM_SWING_RAD * swing,
                right_arm_swing_rad: WALK_ARM_SWING_RAD * swing,
                bob_fraction: WALK_BOB_FRACTION * Math.abs(swing),
                ring_scale: 1,
            };
        }
        return standingPose("idle", 0, 1);
    }

    if (isAtKnot) {
        const pulse = 0.5 + 0.5 * Math.sin(2 * Math.PI * RING_PULSE_HZ * timeSeconds);
        return standingPose("working", WORKING_ARM_FORWARD_RAD, 1 + RING_PULSE_FRACTION * pulse);
    }

    return standingPose("idle", 0, 1);
}
