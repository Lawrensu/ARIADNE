import { describe, expect, it } from "vitest";

import type { StormCountdown } from "../sim/scenarioEngine";
import {
    formatNextScenarioEvent,
    formatSimTimeHms,
    formatStormCountdownShort,
    formatStormCountdownText,
    formatStormWatchLine,
    stormCountdownState,
} from "./stormCountdownText";



function watch(secondsToStorm: number | null): StormCountdown {
    return { phase: "watch", storm_at_sim_seconds: 6700, seconds_to_storm: secondsToStorm, is_estimate: true };
}

const NONE: StormCountdown = { phase: "none", storm_at_sim_seconds: null, seconds_to_storm: null, is_estimate: true };
const ACTIVE: StormCountdown = { phase: "active", storm_at_sim_seconds: 6700, seconds_to_storm: null, is_estimate: true };



describe("formatStormCountdownText", () => {
    it("words the watch in whole minutes, rounded down, with est.", () => {
        expect(formatStormCountdownText(watch(14 * 60))).toBe("STORM IN 14 MIN est.");
        expect(formatStormCountdownText(watch(14 * 60 + 59))).toBe("STORM IN 14 MIN est.");
        expect(formatStormCountdownText(watch(60))).toBe("STORM IN 1 MIN est.");
    });

    it("says under a minute for the last minute", () => {
        expect(formatStormCountdownText(watch(59))).toBe("STORM IN <1 MIN est.");
        expect(formatStormCountdownText(watch(0))).toBe("STORM IN <1 MIN est.");
    });

    it("says STORM ACTIVE once the storm has started", () => {
        expect(formatStormCountdownText(ACTIVE)).toBe("STORM ACTIVE");
    });

    it("shows nothing for none", () => {
        expect(formatStormCountdownText(NONE)).toBeNull();
        expect(formatStormCountdownShort(NONE)).toBeNull();
        expect(formatStormWatchLine(NONE)).toBeNull();
        expect(stormCountdownState(NONE)).toBeNull();
    });

    it("does not invent a number when the watch has no time", () => {
        expect(formatStormCountdownText(watch(null))).toBe("STORM WATCH");
        expect(formatStormCountdownShort(watch(Number.NaN))).toBe("STORM WATCH");
    });
});


describe("formatStormCountdownShort", () => {
    it("shortens for phones", () => {
        expect(formatStormCountdownShort(watch(14 * 60 + 5))).toBe("STORM 14m");
        expect(formatStormCountdownShort(watch(20))).toBe("STORM <1m");
        expect(formatStormCountdownShort(ACTIVE)).toBe("STORM ACTIVE");
    });
});


describe("formatStormWatchLine", () => {
    it("words the objective card line during the watch only", () => {
        expect(formatStormWatchLine(watch(14 * 60))).toBe("Space weather watch: storm in ~14 min est.");
        expect(formatStormWatchLine(watch(10))).toBe("Space weather watch: storm in <1 min est.");
        expect(formatStormWatchLine(ACTIVE)).toBeNull();
    });
});


describe("stormCountdownState", () => {
    it("is caution during the watch and no_go when active", () => {
        expect(stormCountdownState(watch(300))).toBe("caution");
        expect(stormCountdownState(ACTIVE)).toBe("no_go");
    });
});


describe("presenter line", () => {
    it("formats the simulation time as T+h:mm:ss", () => {
        expect(formatSimTimeHms(4900)).toBe("T+1:21:40");
        expect(formatSimTimeHms(5)).toBe("T+0:00:05");
        expect(formatSimTimeHms(Number.NaN)).toBe("T+?");
    });

    it("names the next scenario event", () => {
        expect(formatNextScenarioEvent("space_weather_watch", 4900)).toBe("Next: storm watch at T+1:21:40");
        expect(formatNextScenarioEvent("some_new_event", 60)).toBe("Next: some new event at T+0:01:00");
    });
});
