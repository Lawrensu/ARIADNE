import { describe, expect, it } from "vitest";

import {
    advanceSimElapsedSeconds,
    computeConsumablesState,
    DEFAULT_CONSUMABLE_PARAMETERS,
    formatDurationHms,
    SIM_SPEED_PRESETS,
} from "./clock";



describe("advanceSimElapsedSeconds", () => {
    it("advances by real delta times the speed multiplier", () => {
        expect(advanceSimElapsedSeconds(100, 0.5, 60, 28800)).toBeCloseTo(130);
    });

    it("clamps to the limit and to zero", () => {
        expect(advanceSimElapsedSeconds(28790, 1, 60, 28800)).toBe(28800);
        expect(advanceSimElapsedSeconds(10, 1, -60, 28800)).toBe(0);
    });
});


describe("computeConsumablesState", () => {
    it("at 0 s: full suit, threshold is planned time minus reserve (contracts.md 4.6)", () => {
        const state = computeConsumablesState(0, DEFAULT_CONSUMABLE_PARAMETERS);
        expect(state.suit_remaining_s).toBe(8 * 3600);
        expect(state.planned_remaining_s).toBe(6 * 3600);
        expect(state.reserve_s).toBe(1800);
        expect(state.thread_threshold_s).toBe(19800);
        expect(state.planned_time_left_s).toBe(19800);
        expect(state.is_estimate).toBe(true);
    });

    it("at 5 h 30 min: planned time minus reserve is used up, Thread time left is 0", () => {
        const state = computeConsumablesState(5.5 * 3600, DEFAULT_CONSUMABLE_PARAMETERS);
        expect(state.suit_remaining_s).toBe(2.5 * 3600);
        expect(state.thread_threshold_s).toBe(0);
        expect(state.planned_remaining_s).toBe(1800);
    });

    it("at 7 h: one hour of O2 left, Thread time left stays 0, planned time used up", () => {
        const state = computeConsumablesState(7 * 3600, DEFAULT_CONSUMABLE_PARAMETERS);
        expect(state.suit_remaining_s).toBe(3600);
        expect(state.thread_threshold_s).toBe(0);
        expect(state.planned_remaining_s).toBe(0);
    });

    it("never goes negative past the reserve, and falls back to D-020 without parameters", () => {
        const state = computeConsumablesState(5.8 * 3600, undefined);
        expect(state.thread_threshold_s).toBe(0);
        expect(state.suit_capability_s).toBe(8 * 3600);
    });
});


describe("formatDurationHms and presets", () => {
    it("formats H:MM:SS", () => {
        expect(formatDurationHms(27015)).toBe("7:30:15");
        expect(formatDurationHms(-5)).toBe("0:00:00");
        expect(formatDurationHms(59.9)).toBe("0:00:59");
    });

    it("offers ascending speed presets", () => {
        expect([...SIM_SPEED_PRESETS].sort((a, b) => a - b)).toEqual(SIM_SPEED_PRESETS);
    });
});
