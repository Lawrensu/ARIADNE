import { describe, expect, it } from "vitest";

import type { EnvironmentTimeline, Meta } from "../data/contracts";
import {
    MARS24_PROVENANCE,
    MARS_SOL_SECONDS,
    formatMarsClock,
    marsLocalMeanSolarTimeHours,
    marsMeanSolarTimeHours,
    marsSolDate,
    patchCentreEastLongitudeDeg,
    replaySampleAt,
} from "./mars24";



// One Mars sol is 24 h 39 min 35.244 s (Mars24 technical notes).
const PUBLISHED_SOL_SECONDS = 24 * 3600 + 39 * 60 + 35.244;


// Signed difference between two clock readings in seconds, wrapped into (-12 h, +12 h].
function clockDifferenceSeconds(firstHours: number, secondHours: number): number {
    let difference = ((secondHours - firstHours + 12) % 24) - 12;
    if (difference <= -12) {
        difference += 24;
    }
    return difference * 3600;
}


function makeMeta(): Meta {
    return {
        contract_version: "1.1.1",
        generated_at_utc: "2026-11-14T06:20:36Z",
        pipeline_commit: "test",
        grid: { width: 1013, height: 934, cell_size_m: 2.0 },
        origin_northwest: { latitude_deg: -4.7809, longitude_deg: 137.3771 },
        crs: "IAU_2015:49900",
        elevation_reference: "mars_areoid",
        bounds: {
            width_m: 2026.0,
            height_m: 1868.0,
            south_east: { latitude_deg: -4.812414, longitude_deg: 137.4114 },
        },
        staging_point: { x_m: 775.0, z_m: 467.0 },
        texture: { file: "texture_hirise.jpg", width_px: 4096, height_px: 3777 },
        sun: { sun_azimuth_deg: 303.082442, sun_incidence_deg: 58.808048 },
        layers: [],
        mineralogy_classes: {},
        sources: [],
    };
}



describe("Mars24 published worked examples", () => {
    // Mars24 algorithm page, II: at 2000-01-06 00:00:00 UTC and 0 degrees, MST = 23.99425 h, which
    // the page prints as 23:59:39.
    it("matches the 2000 January 6 example at the prime meridian", () => {
        const instant = new Date("2000-01-06T00:00:00Z");
        const localHours = marsLocalMeanSolarTimeHours(instant, 0);
        expect(localHours).toBeGreaterThanOrEqual(0);
        expect(localHours).toBeLessThan(24);
        expect(Math.abs(clockDifferenceSeconds(localHours, 23.99425))).toBeLessThan(2);
        expect(Math.abs(clockDifferenceSeconds(marsMeanSolarTimeHours(instant), localHours))).toBeLessThan(1e-9);
        expect(Math.abs(marsSolDate(instant) - 44796.0)).toBeLessThan(0.01);
    });

    // Mars24 algorithm page, II: MER-A Spirit landing, 2004-01-03 13:46:31 UTC at 184.702 degrees
    // west. Published LMST = 0.85190 h (00:51:07). West longitude enters as a negative east value.
    it("matches the MER-A Spirit landing example at 184.702 degrees west", () => {
        const instant = new Date("2004-01-03T13:46:31Z");
        const localHours = marsLocalMeanSolarTimeHours(instant, -184.702);
        expect(Math.abs(clockDifferenceSeconds(localHours, 0.8519))).toBeLessThan(2);
    });
});



describe("Mars sol", () => {
    it("is 24 h 39 min 35.244 s long", () => {
        // The published figure is rounded; the Mars24 constant gives 88775.244147 s.
        expect(Math.abs(MARS_SOL_SECONDS - PUBLISHED_SOL_SECONDS)).toBeLessThan(0.001);
    });

    it("adds exactly one to the Mars Sol Date per sol", () => {
        const start = new Date("2026-11-14T00:00:00Z");
        const oneSolLater = new Date(start.getTime() + MARS_SOL_SECONDS * 1000);
        expect(marsSolDate(oneSolLater) - marsSolDate(start)).toBeCloseTo(1, 8);
    });

    it("repeats the same local mean solar time one sol later within 1 s", () => {
        const start = new Date("2026-11-14T00:00:00Z");
        const oneSolLater = new Date(start.getTime() + MARS_SOL_SECONDS * 1000);
        const eastLongitude = 137.39425;
        const first = marsLocalMeanSolarTimeHours(start, eastLongitude);
        const second = marsLocalMeanSolarTimeHours(oneSolLater, eastLongitude);
        expect(Math.abs(clockDifferenceSeconds(first, second))).toBeLessThan(1);
    });
});



describe("east longitude", () => {
    it("advances LMST by 1 Mars hour for every 15 degrees east", () => {
        const instant = new Date("2026-11-14T00:00:00Z");
        const atPrimeMeridian = marsLocalMeanSolarTimeHours(instant, 0);
        const fifteenEast = marsLocalMeanSolarTimeHours(instant, 15);
        const advanceHours = ((fifteenEast - atPrimeMeridian + 24) % 24);
        expect(advanceHours).toBeCloseTo(1, 9);
    });

    it("wraps into [0, 24) for every tested date and longitude", () => {
        const instants = [
            "1970-01-01T00:00:00Z",
            "2000-01-06T00:00:00Z",
            "2004-01-03T13:46:31Z",
            "2017-01-01T00:00:00Z",
            "2026-11-14T00:00:00Z",
            "2026-12-31T23:59:59Z",
        ];
        const longitudes = [-360, -184.702, -0.001, 0, 15, 137.39425, 179.999, 360];
        for (const iso of instants) {
            for (const longitude of longitudes) {
                const hours = marsLocalMeanSolarTimeHours(new Date(iso), longitude);
                expect(hours).toBeGreaterThanOrEqual(0);
                expect(hours).toBeLessThan(24);
            }
        }
    });
});



describe("formatMarsClock", () => {
    it("formats hours, minutes and seconds with leading zeros", () => {
        expect(formatMarsClock(0)).toBe("00:00:00");
        expect(formatMarsClock(1.5)).toBe("01:30:00");
        expect(formatMarsClock(14.5343)).toBe("14:32:03");
        expect(formatMarsClock(23.99999)).toBe("00:00:00");
    });

    it("wraps negative and over-24 hour input", () => {
        expect(formatMarsClock(-1.5)).toBe("22:30:00");
        expect(formatMarsClock(-0.0001)).toBe("00:00:00");
        expect(formatMarsClock(24.25)).toBe("00:15:00");
        expect(formatMarsClock(49)).toBe("01:00:00");
    });

    it("does not invent a reading for non-finite input", () => {
        expect(formatMarsClock(Number.NaN)).toBe("--:--:--");
        expect(formatMarsClock(Number.POSITIVE_INFINITY)).toBe("--:--:--");
    });
});



describe("patchCentreEastLongitudeDeg", () => {
    it("uses the middle of the patch longitudes from meta.json", () => {
        expect(patchCentreEastLongitudeDeg(makeMeta())).toBeCloseTo(137.39425, 9);
    });
});



describe("replaySampleAt", () => {
    function makeTimeline(): EnvironmentTimeline {
        return {
            replay_source: { mission: "msl", instrument_set: ["rems", "rad"], sol: 4760 },
            samples: [
                {
                    seconds_since_replay_start: 0,
                    local_mean_solar_time: "09:00:00",
                    air_temperature_c: -40,
                    ground_temperature_c: -25,
                    pressure_pa: 740,
                    uv_index_level: "moderate",
                    dust_opacity_tau: 0.5,
                    radiation_dose_rate_usv_per_hour: 27,
                    provenance: {
                        source_dataset: "Curiosity REMS and RAD",
                        product_id: "test",
                        is_estimate: true,
                    },
                },
                {
                    seconds_since_replay_start: 3600,
                    local_mean_solar_time: "10:00:00",
                    air_temperature_c: -30,
                    ground_temperature_c: -20,
                    pressure_pa: 741,
                    uv_index_level: "high",
                    dust_opacity_tau: 0.5,
                    radiation_dose_rate_usv_per_hour: 28,
                    provenance: {
                        source_dataset: "Curiosity REMS and RAD",
                        product_id: "test",
                        is_estimate: true,
                    },
                },
            ],
        };
    }

    it("takes the last sample at or before the simulation time", () => {
        const timeline = makeTimeline();
        expect(replaySampleAt(timeline, 0)?.local_mean_solar_time).toBe("09:00:00");
        expect(replaySampleAt(timeline, 3599)?.local_mean_solar_time).toBe("09:00:00");
        expect(replaySampleAt(timeline, 3600)?.local_mean_solar_time).toBe("10:00:00");
        expect(replaySampleAt(timeline, 999_999)?.local_mean_solar_time).toBe("10:00:00");
    });

    it("clamps before the first sample and handles an empty timeline", () => {
        const timeline = makeTimeline();
        expect(replaySampleAt(timeline, -10)?.local_mean_solar_time).toBe("09:00:00");
        expect(replaySampleAt(timeline, Number.NaN)?.local_mean_solar_time).toBe("09:00:00");
        expect(replaySampleAt({ ...timeline, samples: [] }, 0)).toBeNull();
    });
});



describe("MARS24_PROVENANCE", () => {
    it("states that the estimate is model-derived", () => {
        expect(MARS24_PROVENANCE.is_estimate).toBe(true);
        expect(MARS24_PROVENANCE.source_dataset).toContain("Mars24");
        expect(MARS24_PROVENANCE.uncertainty).toBeDefined();
    });
});
