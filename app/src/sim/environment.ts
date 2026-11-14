// Environment replay (owner: Letta, Stage 3, built by the simulation sub-agent).
// Pure: no React and no store access. Two sources, both real and both replayed on the simulation
// clock (D-014):
//
// 1. Weather and background dose: data/processed/environment_timeline.json (REMS and RAD, sol 4760),
//    loaded into the store as EnvironmentTimeline (contracts.md 3.14). The last sample at or before
//    the elapsed time is shown, clamped to the first and last sample.
// 2. Storm dose: the May 2024 solar particle event that RAD measured at the surface (sol 4190). The
//    curve from data/reference/spe_profile_sol4190.json is an upper bound, clamped to its range.
//
// Sol 4760 and sol 4190 are different dates; the UI says so openly (D-025). No spatial radiation
// heatmap is drawn (D-015).

import type { EnvironmentSample, EnvironmentTimeline, Provenance, UvIndexLevel } from "../data/contracts";
import { minutesSinceStormOnset, solarStormOnsetSimSeconds, SOLAR_STORM_SCENARIO } from "./scenarioEngine";



// What the UI shows for one replayed weather sample.
export interface EnvironmentSampleView {
    seconds_since_replay_start: number;
    local_mean_solar_time: string;
    air_temperature_c: number;
    ground_temperature_c: number;
    pressure_pa: number;
    uv_index_level: UvIndexLevel;
    dust_opacity_tau: number;
    radiation_dose_rate_usv_per_hour: number;
    provenance: Provenance;
    is_estimate: boolean;
}


// One point of the RAD sol 4190 storm curve. minutes_since_onset 0 is the onset (2024-05-20T05:21:50Z).
export interface SolarStormProfileSample {
    minutes_since_onset: number;
    dose_rate_usv_per_hour_upper_bound: number;
}


export interface DoseRateUpperBoundView {
    dose_rate_usv_per_hour_upper_bound: number;
    // The profile point used (at or before the requested time, clamped to the profile range).
    minutes_since_onset: number;
    sol: number;
    event: string;
    provenance: Provenance;
    is_estimate: true;
}



export const SOLAR_STORM_SOL = 4190;


export const SOLAR_STORM_EVENT = "2024-05-20 solar energetic particle event";


export const SOLAR_STORM_ONSET_SIM_SECONDS = solarStormOnsetSimSeconds(SOLAR_STORM_SCENARIO);


// Copied verbatim from data/reference/spe_profile_sol4190.json (upper-bound column only, because that
// is the value the app shows). It is embedded instead of imported from the repo root: the app's Vite
// root is app/, so a module outside it would need a vite.config server.fs.allow change, which is out
// of scope for this file. Update this list if the reference file changes.
export const SOLAR_STORM_PROFILE: SolarStormProfileSample[] = [
    { minutes_since_onset: -30, dose_rate_usv_per_hour_upper_bound: 17.1 },
    { minutes_since_onset: -20, dose_rate_usv_per_hour_upper_bound: 17.2 },
    { minutes_since_onset: -10, dose_rate_usv_per_hour_upper_bound: 17.4 },
    { minutes_since_onset: 0, dose_rate_usv_per_hour_upper_bound: 24.3 },
    { minutes_since_onset: 10, dose_rate_usv_per_hour_upper_bound: 65.4 },
    { minutes_since_onset: 20, dose_rate_usv_per_hour_upper_bound: 241.0 },
    { minutes_since_onset: 30, dose_rate_usv_per_hour_upper_bound: 643.8 },
    { minutes_since_onset: 40, dose_rate_usv_per_hour_upper_bound: 971.3 },
    { minutes_since_onset: 50, dose_rate_usv_per_hour_upper_bound: 1051.4 },
    { minutes_since_onset: 60, dose_rate_usv_per_hour_upper_bound: 1069.0 },
    { minutes_since_onset: 70, dose_rate_usv_per_hour_upper_bound: 1040.4 },
    { minutes_since_onset: 80, dose_rate_usv_per_hour_upper_bound: 974.6 },
    { minutes_since_onset: 90, dose_rate_usv_per_hour_upper_bound: 905.6 },
    { minutes_since_onset: 100, dose_rate_usv_per_hour_upper_bound: 864.0 },
    { minutes_since_onset: 110, dose_rate_usv_per_hour_upper_bound: 832.6 },
    { minutes_since_onset: 120, dose_rate_usv_per_hour_upper_bound: 784.8 },
    { minutes_since_onset: 130, dose_rate_usv_per_hour_upper_bound: 774.9 },
    { minutes_since_onset: 140, dose_rate_usv_per_hour_upper_bound: 738.2 },
    { minutes_since_onset: 150, dose_rate_usv_per_hour_upper_bound: 653.8 },
    { minutes_since_onset: 160, dose_rate_usv_per_hour_upper_bound: 580.2 },
    { minutes_since_onset: 170, dose_rate_usv_per_hour_upper_bound: 563.9 },
    { minutes_since_onset: 180, dose_rate_usv_per_hour_upper_bound: 537.2 },
    { minutes_since_onset: 190, dose_rate_usv_per_hour_upper_bound: 502.2 },
    { minutes_since_onset: 200, dose_rate_usv_per_hour_upper_bound: 465.1 },
    { minutes_since_onset: 210, dose_rate_usv_per_hour_upper_bound: 421.9 },
    { minutes_since_onset: 220, dose_rate_usv_per_hour_upper_bound: 381.5 },
    { minutes_since_onset: 230, dose_rate_usv_per_hour_upper_bound: 367.1 },
    { minutes_since_onset: 240, dose_rate_usv_per_hour_upper_bound: 356.3 },
    { minutes_since_onset: 250, dose_rate_usv_per_hour_upper_bound: 310.7 },
    { minutes_since_onset: 260, dose_rate_usv_per_hour_upper_bound: 297.3 },
    { minutes_since_onset: 270, dose_rate_usv_per_hour_upper_bound: 296.4 },
    { minutes_since_onset: 280, dose_rate_usv_per_hour_upper_bound: 279.7 },
    { minutes_since_onset: 290, dose_rate_usv_per_hour_upper_bound: 270.6 },
    { minutes_since_onset: 300, dose_rate_usv_per_hour_upper_bound: 273.0 },
    { minutes_since_onset: 310, dose_rate_usv_per_hour_upper_bound: 288.4 },
    { minutes_since_onset: 320, dose_rate_usv_per_hour_upper_bound: 323.6 },
    { minutes_since_onset: 330, dose_rate_usv_per_hour_upper_bound: 336.9 },
    { minutes_since_onset: 340, dose_rate_usv_per_hour_upper_bound: 325.9 },
    { minutes_since_onset: 350, dose_rate_usv_per_hour_upper_bound: 312.8 },
    { minutes_since_onset: 360, dose_rate_usv_per_hour_upper_bound: 309.0 },
    { minutes_since_onset: 370, dose_rate_usv_per_hour_upper_bound: 299.5 },
    { minutes_since_onset: 380, dose_rate_usv_per_hour_upper_bound: 296.8 },
    { minutes_since_onset: 390, dose_rate_usv_per_hour_upper_bound: 301.6 },
    { minutes_since_onset: 400, dose_rate_usv_per_hour_upper_bound: 293.1 },
    { minutes_since_onset: 410, dose_rate_usv_per_hour_upper_bound: 283.1 },
    { minutes_since_onset: 420, dose_rate_usv_per_hour_upper_bound: 272.8 },
    { minutes_since_onset: 430, dose_rate_usv_per_hour_upper_bound: 269.4 },
    { minutes_since_onset: 440, dose_rate_usv_per_hour_upper_bound: 261.6 },
    { minutes_since_onset: 450, dose_rate_usv_per_hour_upper_bound: 250.4 },
    { minutes_since_onset: 460, dose_rate_usv_per_hour_upper_bound: 241.3 },
    { minutes_since_onset: 470, dose_rate_usv_per_hour_upper_bound: 233.4 },
    { minutes_since_onset: 480, dose_rate_usv_per_hour_upper_bound: 224.7 },
    { minutes_since_onset: 490, dose_rate_usv_per_hour_upper_bound: 216.9 },
    { minutes_since_onset: 500, dose_rate_usv_per_hour_upper_bound: 207.7 },
    { minutes_since_onset: 510, dose_rate_usv_per_hour_upper_bound: 197.4 },
    { minutes_since_onset: 520, dose_rate_usv_per_hour_upper_bound: 192.4 },
    { minutes_since_onset: 530, dose_rate_usv_per_hour_upper_bound: 187.4 },
    { minutes_since_onset: 540, dose_rate_usv_per_hour_upper_bound: 185.3 },
    { minutes_since_onset: 550, dose_rate_usv_per_hour_upper_bound: 179.5 },
    { minutes_since_onset: 560, dose_rate_usv_per_hour_upper_bound: 175.9 },
    { minutes_since_onset: 570, dose_rate_usv_per_hour_upper_bound: 173.1 },
    { minutes_since_onset: 580, dose_rate_usv_per_hour_upper_bound: 169.5 },
    { minutes_since_onset: 590, dose_rate_usv_per_hour_upper_bound: 164.0 },
    { minutes_since_onset: 600, dose_rate_usv_per_hour_upper_bound: 159.7 },
    { minutes_since_onset: 610, dose_rate_usv_per_hour_upper_bound: 151.7 },
    { minutes_since_onset: 620, dose_rate_usv_per_hour_upper_bound: 154.1 },
    { minutes_since_onset: 630, dose_rate_usv_per_hour_upper_bound: 152.4 },
    { minutes_since_onset: 640, dose_rate_usv_per_hour_upper_bound: 150.7 },
    { minutes_since_onset: 650, dose_rate_usv_per_hour_upper_bound: 149.3 },
    { minutes_since_onset: 660, dose_rate_usv_per_hour_upper_bound: 146.5 },
    { minutes_since_onset: 670, dose_rate_usv_per_hour_upper_bound: 144.2 },
    { minutes_since_onset: 680, dose_rate_usv_per_hour_upper_bound: 141.6 },
    { minutes_since_onset: 690, dose_rate_usv_per_hour_upper_bound: 136.0 },
    { minutes_since_onset: 700, dose_rate_usv_per_hour_upper_bound: 132.0 },
    { minutes_since_onset: 710, dose_rate_usv_per_hour_upper_bound: 128.6 },
    { minutes_since_onset: 720, dose_rate_usv_per_hour_upper_bound: 125.1 },
    { minutes_since_onset: 730, dose_rate_usv_per_hour_upper_bound: 121.2 },
    { minutes_since_onset: 740, dose_rate_usv_per_hour_upper_bound: 120.7 },
    { minutes_since_onset: 750, dose_rate_usv_per_hour_upper_bound: 119.6 },
    { minutes_since_onset: 760, dose_rate_usv_per_hour_upper_bound: 118.4 },
    { minutes_since_onset: 770, dose_rate_usv_per_hour_upper_bound: 114.6 },
    { minutes_since_onset: 780, dose_rate_usv_per_hour_upper_bound: 113.4 },
    { minutes_since_onset: 790, dose_rate_usv_per_hour_upper_bound: 112.1 },
    { minutes_since_onset: 800, dose_rate_usv_per_hour_upper_bound: 109.3 },
    { minutes_since_onset: 810, dose_rate_usv_per_hour_upper_bound: 109.0 },
    { minutes_since_onset: 820, dose_rate_usv_per_hour_upper_bound: 107.1 },
];


// Upper bound is absorbed dose times the surface quality factor 3.05 (Hassler et al. 2014), which is
// probably too high for solar energetic protons. The product and onset time come from the reference
// file notes. Estimates, not measured dose equivalent.
export const SOLAR_STORM_PROVENANCE: Provenance = {
    source_dataset: "Curiosity RAD (MSL-M-RAD-3-RDR-V1.0)",
    product_id: "RAD_RDR_2024_140_18_30_4190_V00",
    timestamp: "2024-05-20T05:21:50Z",
    is_estimate: true,
    uncertainty:
        "Upper bound: absorbed dose times a surface quality factor of 3.05, probably too high for solar " +
        "energetic protons. Sol 4190 is a different date from the sol 4760 weather replay (D-025).",
};



function toSampleView(sample: EnvironmentSample): EnvironmentSampleView {
    return {
        seconds_since_replay_start: sample.seconds_since_replay_start,
        local_mean_solar_time: sample.local_mean_solar_time,
        air_temperature_c: sample.air_temperature_c,
        ground_temperature_c: sample.ground_temperature_c,
        pressure_pa: sample.pressure_pa,
        uv_index_level: sample.uv_index_level,
        dust_opacity_tau: sample.dust_opacity_tau,
        radiation_dose_rate_usv_per_hour: sample.radiation_dose_rate_usv_per_hour,
        provenance: sample.provenance,
        is_estimate: sample.provenance.is_estimate,
    };
}


// The last timeline sample at or before simElapsedSeconds. Earlier than the first sample returns the
// first, later than the last returns the last (the replay is clamped, never extrapolated).
// Null only when the timeline has no samples.
export function environmentSampleAt(
    timeline: EnvironmentTimeline,
    simElapsedSeconds: number,
): EnvironmentSampleView | null {
    const samples = timeline.samples;
    if (samples.length === 0) {
        return null;
    }

    let chosen = samples[0];
    for (const sample of samples) {
        if (sample.seconds_since_replay_start <= simElapsedSeconds) {
            chosen = sample;
        } else {
            break;
        }
    }
    return toSampleView(chosen);
}


// The RAD sol 4190 upper bound at a simulation time, mapped so that the scenario alert is the onset
// (minutes_since_onset 0). Values before or after the profile are clamped to its ends.
export function doseRateUpperBoundAt(simElapsedSeconds: number): DoseRateUpperBoundView {
    const requestedMinutes = minutesSinceStormOnset(simElapsedSeconds);

    let chosen = SOLAR_STORM_PROFILE[0];
    for (const sample of SOLAR_STORM_PROFILE) {
        if (sample.minutes_since_onset <= requestedMinutes) {
            chosen = sample;
        } else {
            break;
        }
    }

    return {
        dose_rate_usv_per_hour_upper_bound: chosen.dose_rate_usv_per_hour_upper_bound,
        minutes_since_onset: chosen.minutes_since_onset,
        sol: SOLAR_STORM_SOL,
        event: SOLAR_STORM_EVENT,
        provenance: SOLAR_STORM_PROVENANCE,
        is_estimate: true,
    };
}


// Mars local mean solar time as exported ("HH:MM:SS"), or the time part of an ISO 8601 timestamp.
// Anything else is passed through unchanged.
export function formatMarsLocalTime(value: string): string {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
        return "unknown";
    }
    if (/^\d{1,2}:\d{2}:\d{2}$/.test(trimmed)) {
        return trimmed;
    }
    const timePart = trimmed.match(/T(\d{2}:\d{2}:\d{2})/);
    if (timePart !== null) {
        return timePart[1];
    }
    return trimmed;
}


// One decimal place, with the contract unit (µSv/h). Non-finite input is shown as "no data".
export function formatDoseRate(doseRateUsvPerHour: number): string {
    if (!Number.isFinite(doseRateUsvPerHour)) {
        return "no data";
    }
    return `${doseRateUsvPerHour.toFixed(1)} µSv/h`;
}
