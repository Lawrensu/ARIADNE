// Mars mean solar time in the app, after the NASA GISS Mars24 algorithm of Allison and McEwen
// (2000) and the Mars24 algorithm page (updated 2025-01-07, D-024 rule 6). No network, no
// dependencies: the same equations run in the browser as an estimate.
//
// This file computes mean solar time only (MST at the prime meridian, LMST at a longitude). It does
// not compute true solar time, the equation of time, the sun position or sunrise and sunset.
//
// Units: all public functions take a JavaScript Date (an absolute UTC instant) and return Mars
// hours on the 24 Mars-hour clock (one Mars sol is 24 h 39 min 35.244 s, so one Mars "hour" is
// 1/24 of a sol, slightly longer than an Earth hour).
//
// Provenance: mean solar time is an estimate. MARS24_PROVENANCE says so and is attached to every
// value the MarsClock shows.

import type { EnvironmentSample, EnvironmentTimeline, Meta, Provenance } from "../data/contracts";



// Mars24 constants (Allison and McEwen 2000; NASA GISS Mars24 algorithm page).
export const MARS_SOL_DAYS = 1.0274912517;
export const MARS_SOL_SECONDS = MARS_SOL_DAYS * 86_400;

// Julian Date of the Unix epoch, and milliseconds per day.
const JULIAN_DATE_UNIX_EPOCH = 2_440_587.5;
const MILLISECONDS_PER_DAY = 86_400_000;
const SECONDS_PER_DAY = 86_400;
const HOURS_PER_MARS_DAY = 24;

// Mars Sol Date (AM2000): sols since 1873 December 29, about Greenwich noon (JD 2405522.0).
const MARS_SOL_DATE_EPOCH_JD_TT = 2_405_522.0028779;

// Mars24 mean solar time at the prime meridian (equation C-2 on the algorithm page).
const MEAN_SOLAR_TIME_EPOCH_JD_TT = 2_451_549.5;
const MEAN_SOLAR_TIME_EPOCH_MSD = 44_796.0;
const MEAN_SOLAR_TIME_OFFSET_DAYS = 0.0009626;

// Terrestrial Time minus International Atomic Time, fixed by definition.
const TT_MINUS_TAI_SECONDS = 32.184;



export const MARS24_PROVENANCE: Provenance = {
    source_dataset: "NASA GISS Mars24 (Allison and McEwen 2000)",
    product_id: "Mars24 algorithm and worked examples, updated 2025-01-07",
    is_estimate: true,
    uncertainty: "Mean solar time only, not true solar time. Leap seconds stop at 2017, and polar motion and nutation are ignored. Shown as est.",
};



interface LeapSecondEntry {
    effectiveUtcMilliseconds: number;
    taiMinusUtcSeconds: number;
}



// Leap seconds: TAI minus UTC per IERS/USNO table (Mars24 A-4). The last entry is 2017-01-01;
// no leap second has been added since, so later dates reuse 37 s.
const LEAP_SECOND_TABLE: LeapSecondEntry[] = [
    { effectiveUtcMilliseconds: Date.UTC(1972, 0, 1), taiMinusUtcSeconds: 10 },
    { effectiveUtcMilliseconds: Date.UTC(1972, 6, 1), taiMinusUtcSeconds: 11 },
    { effectiveUtcMilliseconds: Date.UTC(1973, 0, 1), taiMinusUtcSeconds: 12 },
    { effectiveUtcMilliseconds: Date.UTC(1974, 0, 1), taiMinusUtcSeconds: 13 },
    { effectiveUtcMilliseconds: Date.UTC(1975, 0, 1), taiMinusUtcSeconds: 14 },
    { effectiveUtcMilliseconds: Date.UTC(1976, 0, 1), taiMinusUtcSeconds: 15 },
    { effectiveUtcMilliseconds: Date.UTC(1977, 0, 1), taiMinusUtcSeconds: 16 },
    { effectiveUtcMilliseconds: Date.UTC(1978, 0, 1), taiMinusUtcSeconds: 17 },
    { effectiveUtcMilliseconds: Date.UTC(1979, 0, 1), taiMinusUtcSeconds: 18 },
    { effectiveUtcMilliseconds: Date.UTC(1980, 0, 1), taiMinusUtcSeconds: 19 },
    { effectiveUtcMilliseconds: Date.UTC(1981, 6, 1), taiMinusUtcSeconds: 20 },
    { effectiveUtcMilliseconds: Date.UTC(1982, 6, 1), taiMinusUtcSeconds: 21 },
    { effectiveUtcMilliseconds: Date.UTC(1983, 6, 1), taiMinusUtcSeconds: 22 },
    { effectiveUtcMilliseconds: Date.UTC(1985, 6, 1), taiMinusUtcSeconds: 23 },
    { effectiveUtcMilliseconds: Date.UTC(1988, 0, 1), taiMinusUtcSeconds: 24 },
    { effectiveUtcMilliseconds: Date.UTC(1990, 0, 1), taiMinusUtcSeconds: 25 },
    { effectiveUtcMilliseconds: Date.UTC(1991, 0, 1), taiMinusUtcSeconds: 26 },
    { effectiveUtcMilliseconds: Date.UTC(1992, 6, 1), taiMinusUtcSeconds: 27 },
    { effectiveUtcMilliseconds: Date.UTC(1993, 6, 1), taiMinusUtcSeconds: 28 },
    { effectiveUtcMilliseconds: Date.UTC(1994, 6, 1), taiMinusUtcSeconds: 29 },
    { effectiveUtcMilliseconds: Date.UTC(1996, 0, 1), taiMinusUtcSeconds: 30 },
    { effectiveUtcMilliseconds: Date.UTC(1997, 6, 1), taiMinusUtcSeconds: 31 },
    { effectiveUtcMilliseconds: Date.UTC(1999, 0, 1), taiMinusUtcSeconds: 32 },
    { effectiveUtcMilliseconds: Date.UTC(2006, 0, 1), taiMinusUtcSeconds: 33 },
    { effectiveUtcMilliseconds: Date.UTC(2009, 0, 1), taiMinusUtcSeconds: 34 },
    { effectiveUtcMilliseconds: Date.UTC(2012, 6, 1), taiMinusUtcSeconds: 35 },
    { effectiveUtcMilliseconds: Date.UTC(2015, 6, 1), taiMinusUtcSeconds: 36 },
    { effectiveUtcMilliseconds: Date.UTC(2017, 0, 1), taiMinusUtcSeconds: 37 },
];



// Julian Date in Universal Time (Mars24 A-2).
function julianDateUtc(utcDate: Date): number {
    return JULIAN_DATE_UNIX_EPOCH + utcDate.getTime() / MILLISECONDS_PER_DAY;
}


// Terrestrial Time minus UTC in seconds (Mars24 A-4).
function ttMinusUtcSeconds(utcDate: Date): number {
    const milliseconds = utcDate.getTime();
    if (milliseconds < LEAP_SECOND_TABLE[0].effectiveUtcMilliseconds) {
        // Before 1972 Mars24 uses a polynomial in Julian centuries since J2000 (A-4).
        const centuries = (julianDateUtc(utcDate) - 2_451_545.0) / 36_525.0;
        const centuries2 = centuries * centuries;
        const centuries3 = centuries2 * centuries;
        const centuries4 = centuries3 * centuries;
        return 64.184 + 59 * centuries - 51.2 * centuries2 - 67.1 * centuries3 - 16.4 * centuries4;
    }

    let taiMinusUtcSeconds = LEAP_SECOND_TABLE[0].taiMinusUtcSeconds;
    for (const entry of LEAP_SECOND_TABLE) {
        if (milliseconds >= entry.effectiveUtcMilliseconds) {
            taiMinusUtcSeconds = entry.taiMinusUtcSeconds;
        }
    }
    return taiMinusUtcSeconds + TT_MINUS_TAI_SECONDS;
}


// Julian Date in Terrestrial Time (Mars24 A-5).
function julianDateTt(utcDate: Date): number {
    const julianDate = julianDateUtc(utcDate);
    return julianDate + ttMinusUtcSeconds(utcDate) / SECONDS_PER_DAY;
}


// Reset a clock reading into [0, hoursPerCycle) (Mars24 "mod").
function moduloHours(hours: number, hoursPerCycle: number): number {
    const wrapped = hours % hoursPerCycle;
    if (wrapped < 0) {
        return wrapped + hoursPerCycle;
    }
    if (wrapped === 0) {
        return 0;
    }
    return wrapped;
}


function padTwoDigits(value: number): string {
    if (value < 10) {
        return `0${value}`;
    }
    return `${value}`;
}




// Mars Sol Date: sols since the AM2000 epoch, as a fractional number (44796.0 is roughly
// 2000 January 6.0). Uses Terrestrial Time like Mars24.
export function marsSolDate(utcDate: Date): number {
    return (julianDateTt(utcDate) - MARS_SOL_DATE_EPOCH_JD_TT) / MARS_SOL_DAYS;
}


// Mean solar time at the Mars prime meridian, in Mars hours on the 24-hour clock, before the
// +-0.5 day ambiguity is folded away (Mars24 equation C-2). 0 is mean midnight at 0 degrees.
export function marsMeanSolarTimeHours(utcDate: Date): number {
    const daysSinceEpoch = (julianDateTt(utcDate) - MEAN_SOLAR_TIME_EPOCH_JD_TT) / MARS_SOL_DAYS;
    const marsHours = HOURS_PER_MARS_DAY * (daysSinceEpoch + MEAN_SOLAR_TIME_EPOCH_MSD - MEAN_SOLAR_TIME_OFFSET_DAYS);
    return moduloHours(marsHours, HOURS_PER_MARS_DAY);
}


// Local Mean Solar Time in Mars hours at an east-positive longitude in degrees (Mars24 C-3, with
// the west-positive planetographic longitude negated, so +15 degrees east is 1 Mars hour later).
// Returns a value in [0, 24).
export function marsLocalMeanSolarTimeHours(utcDate: Date, eastLongitudeDeg: number): number {
    if (!Number.isFinite(eastLongitudeDeg)) {
        return Number.NaN;
    }
    const hoursEastOfPrimeMeridian = eastLongitudeDeg / 15;
    const localHours = marsMeanSolarTimeHours(utcDate) + hoursEastOfPrimeMeridian;
    return moduloHours(localHours, HOURS_PER_MARS_DAY);
}


// "HH:MM:SS" on the 24 Mars-hour clock. Negative or over-24 input is wrapped, rounding carries
// into the next sol. A non-finite input reads "--:--:--" rather than a made-up value.
export function formatMarsClock(hours: number): string {
    if (!Number.isFinite(hours)) {
        return "--:--:--";
    }
    const wrappedHours = moduloHours(hours, HOURS_PER_MARS_DAY);
    let totalSeconds = Math.round(wrappedHours * 3600);
    if (totalSeconds >= SECONDS_PER_DAY) {
        totalSeconds = 0;
    }
    const clockHours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${padTwoDigits(clockHours)}:${padTwoDigits(minutes)}:${padTwoDigits(seconds)}`;
}


// The east longitude of the middle of the patch, for the live Mars24 estimate. meta.json stores the
// north-west origin and the south-east corner in east-positive degrees; averaging them avoids any
// grid to latitude or longitude maths (D-005: lat/lon is display and clock only).
export function patchCentreEastLongitudeDeg(meta: Meta): number {
    const westLongitude = meta.origin_northwest.longitude_deg;
    const eastLongitude = meta.bounds.south_east.longitude_deg;
    return westLongitude + (eastLongitude - westLongitude) / 2;
}


// The replayed environment sample for a simulation time: the last sample at or before elapsed
// seconds, clamped to the first sample before the replay starts and to the last sample after it
// ends (contracts.md 3.14, samples are ordered by seconds_since_replay_start).
export function replaySampleAt(
    environmentTimeline: EnvironmentTimeline,
    simElapsedSeconds: number,
): EnvironmentSample | null {
    const samples = environmentTimeline.samples;
    if (samples.length === 0) {
        return null;
    }
    const firstSample = samples[0];
    if (!Number.isFinite(simElapsedSeconds) || simElapsedSeconds <= firstSample.seconds_since_replay_start) {
        return firstSample;
    }

    let chosenSample = firstSample;
    for (const sample of samples) {
        if (sample.seconds_since_replay_start <= simElapsedSeconds) {
            chosenSample = sample;
        } else {
            break;
        }
    }
    return chosenSample;
}
