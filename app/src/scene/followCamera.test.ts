import { describe, expect, it } from "vitest";

import {
    FOLLOW_RESUME_DELAY_SECONDS,
    FOLLOW_SMOOTHING_TIME_CONSTANT_SECONDS,
    FOLLOW_SNAP_DISTANCE_M,
    followBlendFraction,
    followSmoothingFactor,
    isFollowActive,
    shouldResumeFollowing,
} from "./followCamera";



describe("followSmoothingFactor", () => {
    it("is 0 for a zero or negative frame time", () => {
        expect(followSmoothingFactor(0, 0.25)).toBe(0);
        expect(followSmoothingFactor(-0.1, 0.25)).toBe(0);
    });

    it("is 1 for a zero time constant (no smoothing)", () => {
        expect(followSmoothingFactor(0.016, 0)).toBe(1);
    });

    it("closes about 63 % of the gap after one time constant", () => {
        expect(followSmoothingFactor(0.25, 0.25)).toBeCloseTo(1 - Math.exp(-1));
    });

    it("is frame-rate independent: two short frames equal one long frame", () => {
        const oneLongFrame = followSmoothingFactor(0.032, FOLLOW_SMOOTHING_TIME_CONSTANT_SECONDS);
        const shortFrame = followSmoothingFactor(0.016, FOLLOW_SMOOTHING_TIME_CONSTANT_SECONDS);
        const gapLeftAfterTwoShortFrames = (1 - shortFrame) * (1 - shortFrame);
        expect(1 - gapLeftAfterTwoShortFrames).toBeCloseTo(oneLongFrame, 10);
    });

    it("stays below 1 and approaches it for long frames", () => {
        const factor = followSmoothingFactor(5, 0.25);
        expect(factor).toBeLessThanOrEqual(1);
        expect(factor).toBeGreaterThan(0.999);
    });
});



describe("followBlendFraction", () => {
    it("snaps when the gap is wider than the snap distance", () => {
        expect(followBlendFraction(FOLLOW_SNAP_DISTANCE_M + 1, 0.016)).toBe(1);
    });

    it("smooths when the gap is within the snap distance", () => {
        const expected = followSmoothingFactor(0.016, FOLLOW_SMOOTHING_TIME_CONSTANT_SECONDS);
        expect(followBlendFraction(FOLLOW_SNAP_DISTANCE_M, 0.016)).toBeCloseTo(expected);
        expect(followBlendFraction(20, 0.016)).toBeCloseTo(expected);
    });
});



describe("shouldResumeFollowing", () => {
    it("never resumes while a drag is in progress", () => {
        expect(shouldResumeFollowing(100, 10, true, FOLLOW_RESUME_DELAY_SECONDS)).toBe(false);
        expect(shouldResumeFollowing(100, null, true, FOLLOW_RESUME_DELAY_SECONDS)).toBe(false);
    });

    it("waits for the resume delay after the last interaction", () => {
        expect(shouldResumeFollowing(14.9, 10, false, 5)).toBe(false);
        expect(shouldResumeFollowing(15, 10, false, 5)).toBe(true);
        expect(shouldResumeFollowing(20, 10, false, 5)).toBe(true);
    });

    it("resumes when there is no recorded interaction", () => {
        expect(shouldResumeFollowing(0, null, false, 5)).toBe(true);
    });

    it("uses a 5 second delay", () => {
        expect(FOLLOW_RESUME_DELAY_SECONDS).toBe(5);
    });
});



describe("isFollowActive", () => {
    it("is off before a walk", () => {
        expect(isFollowActive(false, false, false)).toBe(false);
        expect(isFollowActive(false, true, false)).toBe(false);
    });

    it("is off without an astronaut position", () => {
        expect(isFollowActive(true, false, false)).toBe(false);
    });

    it("is off while paused by the user", () => {
        expect(isFollowActive(true, true, true)).toBe(false);
    });

    it("is on during a walk with a position and no pause", () => {
        expect(isFollowActive(true, true, false)).toBe(true);
    });
});
