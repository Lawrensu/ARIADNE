// Suit HUD maths (owner: Letta, Stage 3, built by the HUD sub-agent).
// Pure functions only: no React, no store, so Vitest runs them in Node.
// Bearing uses the local grid only (contracts.md 1.1): x is east, z is south, 0 = north, clockwise.

import type {
    EnvironmentSample,
    GridDefinition,
    Knot,
    LocalPosition,
    WalkingParameters,
} from "../data/contracts";
import { walkingTimeSeconds } from "../routing/walkingTime";
import { returnFieldSecondsAt } from "../science/sciencePlan";
import type { SciencePlan, SciencePlanLeg, SciencePlanStop } from "../state/scienceSlice";


// The same string values as theme/StateBadge (D-012: descriptive strings, never renamed).
export type HudState = "go" | "caution" | "no_go";


// Thread margin thresholds (companion of the Thread tile). Below 0 min is no-go, below 15 min is
// caution, otherwise go. The 15 minute value is the same caution margin the science planner uses.
export const THREAD_CAUTION_MARGIN_MINUTES = 15;


// O2 display threshold: below one hour of the 8 h suit capability is a caution reading. It is a
// HUD readability call, not a planning value; the Thread never uses the suit capability (D-020).
export const O2_CAUTION_SECONDS = 3600;


const CARDINAL_WORDS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];




// Bearing in degrees, clockwise from north, wrapped to [0, 360).
export function normalizeBearing(degrees: number): number {
    if (!Number.isFinite(degrees)) {
        return Number.NaN;
    }
    const wrapped = degrees % 360;
    if (wrapped < 0) {
        return wrapped + 360;
    }
    return wrapped;
}


// Bearing from one local grid point to another: eastern = dx, southern = dz.
// bearing = atan2(eastern, -southern), so north is 0, east is 90, south is 180, west is 270.
export function bearingDegrees(fromX: number, fromZ: number, toX: number, toZ: number): number {
    const eastern = toX - fromX;
    const southern = toZ - fromZ;
    if (!Number.isFinite(eastern) || !Number.isFinite(southern)) {
        return Number.NaN;
    }
    if (eastern === 0 && southern === 0) {
        return 0;
    }
    const degrees = (Math.atan2(eastern, -southern) * 180) / Math.PI;
    return normalizeBearing(degrees);
}


// Nearest of the eight compass points, for example "N", "NE", "E".
export function bearingWord(bearing: number): string {
    if (!Number.isFinite(bearing)) {
        return "unknown";
    }
    const wrapped = normalizeBearing(bearing);
    const index = Math.round(wrapped / 45) % CARDINAL_WORDS.length;
    return CARDINAL_WORDS[index];
}




// Metres under 1000, kilometres with one decimal above. Non-finite values are "unknown".
export function formatDistanceMetres(distanceM: number): string {
    if (!Number.isFinite(distanceM) || distanceM < 0) {
        return "unknown";
    }
    if (distanceM < 1000) {
        return `${Math.round(distanceM)} m`;
    }
    return `${(distanceM / 1000).toFixed(1)} km`;
}


// "H:MM" for durations such as the O2 readout; minutes rounded down. Non-finite or negative is "unknown".
export function formatDurationHm(totalSeconds: number): string {
    if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
        return "unknown";
    }
    const wholeSeconds = Math.floor(totalSeconds);
    const hours = Math.floor(wholeSeconds / 3600);
    const minutes = Math.floor((wholeSeconds % 3600) / 60);
    const minutesText = minutes < 10 ? `0${minutes}` : `${minutes}`;
    return `${hours}:${minutesText}`;
}


// Whole minutes, rounded down. Used for est. walk times and task durations.
export function formatMinutesEstimate(totalSeconds: number): string {
    if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
        return "unknown";
    }
    return `${Math.floor(totalSeconds / 60)} min`;
}


// Seconds of the reroute walk still ahead (D-030: the detour is walked at constant speed in its
// routed walking time from started_at_sim_seconds). Never negative; 0 once the target is reached.
export function remainingDetourWalkSeconds(
    detour: { started_at_sim_seconds: number; walking_time_s: number },
    simElapsedSeconds: number,
): number {
    const walkedSeconds = simElapsedSeconds - detour.started_at_sim_seconds;
    const remainingSeconds = detour.walking_time_s - walkedSeconds;
    if (!Number.isFinite(remainingSeconds)) {
        return 0;
    }
    if (remainingSeconds < 0) {
        return 0;
    }
    return remainingSeconds;
}


// Countdown in whole minutes, rounded up so it never shows "0 min" while still walking:
// "12 min", "1 min", then "0 min" on arrival.
export function formatCountdownMinutes(remainingSeconds: number): string {
    if (!Number.isFinite(remainingSeconds) || remainingSeconds <= 0) {
        return "0 min";
    }
    return `${Math.ceil(remainingSeconds / 60)} min`;
}


// Signed whole minutes for the Thread margin: "+14 min", "-3 min", "0 min".
// Truncation towards zero keeps the HUD from inventing a minute of margin or of deficit.
export function formatSignedMinutes(totalSeconds: number): string {
    if (!Number.isFinite(totalSeconds)) {
        return "unknown";
    }
    const minutes = Math.trunc(totalSeconds / 60);
    if (minutes > 0) {
        return `+${minutes} min`;
    }
    if (minutes < 0) {
        return `${minutes} min`;
    }
    return "0 min";
}


// Science budget chip text. Positive: "+27 min left". Negative: "over by 10 min". No plan: "No plan yet".
export function formatScienceBudgetChip(budgetLeftSeconds: number | null): string {
    if (budgetLeftSeconds === null) {
        return "No plan yet";
    }
    if (!Number.isFinite(budgetLeftSeconds)) {
        return "unknown";
    }
    if (budgetLeftSeconds < 0) {
        return `over by ${Math.ceil(-budgetLeftSeconds / 60)} min`;
    }
    return `+${Math.floor(budgetLeftSeconds / 60)} min left`;
}


// Measurement with a unit, for the conditions sheet. Non-finite values never show NaN.
export function formatMeasurement(value: number, decimals: number, unit: string): string {
    if (!Number.isFinite(value)) {
        return "unknown";
    }
    return `${value.toFixed(decimals)} ${unit}`;
}




// Thread margin state: below 0 min is no-go, below 15 min is caution, otherwise go.
export function threadMarginState(marginSeconds: number): HudState {
    if (!Number.isFinite(marginSeconds)) {
        return "no_go";
    }
    const marginMinutes = marginSeconds / 60;
    if (marginMinutes < 0) {
        return "no_go";
    }
    if (marginMinutes < THREAD_CAUTION_MARGIN_MINUTES) {
        return "caution";
    }
    return "go";
}


// O2 state: empty is no-go, under one hour is caution, otherwise go.
export function o2State(o2RemainingSeconds: number): HudState {
    if (!Number.isFinite(o2RemainingSeconds)) {
        return "no_go";
    }
    if (o2RemainingSeconds <= 0) {
        return "no_go";
    }
    if (o2RemainingSeconds < O2_CAUTION_SECONDS) {
        return "caution";
    }
    return "go";
}


// Nearest replay sample at or around the simulation time. The timeline is ordered by time but a
// linear scan is cheap for one sol of samples and works with an unsorted test fixture too.
export function nearestEnvironmentSample(
    samples: EnvironmentSample[],
    secondsSinceReplayStart: number,
): EnvironmentSample | null {
    if (samples.length === 0) {
        return null;
    }
    if (!Number.isFinite(secondsSinceReplayStart)) {
        return samples[0];
    }
    let nearest = samples[0];
    let nearestDistance = Math.abs(nearest.seconds_since_replay_start - secondsSinceReplayStart);
    for (const sample of samples) {
        const distance = Math.abs(sample.seconds_since_replay_start - secondsSinceReplayStart);
        if (distance < nearestDistance) {
            nearest = sample;
            nearestDistance = distance;
        }
    }
    return nearest;
}




export interface NextKnotInput {
    knots: Knot[];
    // Current astronaut position in local grid metres.
    position: LocalPosition;
    sciencePlan: SciencePlan | null;
    completedTaskIds: string[];
    // meta.json parameters, for the straight-line walking-time fallback.
    parameters: WalkingParameters | undefined;
    // Load factor now (1 + load_time_factor_per_kg * carried kg, contracts.md 4.6).
    loadFactor: number;
}


export interface NextKnotSelection {
    knot: Knot | null;
    // "science_plan": first incomplete plan stop. "nearest_knot": Euclidean fallback. "none": no Knots.
    source: "science_plan" | "nearest_knot" | "none";
    // Distance shown on the HUD: the plan leg when it exists, else the straight-line distance.
    distanceM: number;
    walkTimeSeconds: number;
    straightLineDistanceM: number;
    bearingDeg: number;
    bearingWord: string;
    // True when the science plan supplied the value, so the HUD can label it.
    isDistanceFromPlan: boolean;
    isWalkTimeFromPlan: boolean;
}


// A stop is complete when it has no chosen tasks or every chosen task is in completedTaskIds.
function isStopComplete(stop: SciencePlanStop, completedTaskIds: Set<string>): boolean {
    if (stop.chosen_task_ids.length === 0) {
        return true;
    }
    for (const taskId of stop.chosen_task_ids) {
        if (!completedTaskIds.has(taskId)) {
            return false;
        }
    }
    return true;
}


function nearestKnot(knots: Knot[], position: LocalPosition): Knot | null {
    let nearest: Knot | null = null;
    let nearestDistanceSquared = Number.POSITIVE_INFINITY;
    for (const knot of knots) {
        const eastern = knot.x_m - position.x_m;
        const southern = knot.z_m - position.z_m;
        if (!Number.isFinite(eastern) || !Number.isFinite(southern)) {
            continue;
        }
        const distanceSquared = eastern * eastern + southern * southern;
        if (distanceSquared < nearestDistanceSquared) {
            nearest = knot;
            nearestDistanceSquared = distanceSquared;
        }
    }
    return nearest;
}


function findPlanLegForKnot(plan: SciencePlan | null, knotId: string): SciencePlanLeg | null {
    if (plan === null) {
        return null;
    }
    for (const leg of plan.legs) {
        if (leg.leg_kind === "walk_to_knot" && leg.to_knot_id === knotId) {
            return leg;
        }
    }
    return null;
}


// Straight-line fallback: flat-ground contract walking time times the current load factor.
function straightLineWalkSeconds(
    distanceM: number,
    parameters: WalkingParameters | undefined,
    loadFactorNow: number,
): number {
    if (!Number.isFinite(distanceM) || distanceM < 0) {
        return Number.NaN;
    }
    if (!Number.isFinite(loadFactorNow) || loadFactorNow <= 0) {
        return Number.NaN;
    }
    if (distanceM === 0) {
        return 0;
    }
    const unloadedSeconds = walkingTimeSeconds(distanceM, 0, parameters);
    if (!Number.isFinite(unloadedSeconds)) {
        return Number.POSITIVE_INFINITY;
    }
    return unloadedSeconds * loadFactorNow;
}


// The next Knot: the first science plan stop that still has tasks to do, else the nearest Knot.
// Distance and walk time come from the plan leg when the plan covers that Knot (contracts.md 4.6);
// otherwise the straight-line distance and the walking model times the current load factor, est.
export function selectNextKnot(input: NextKnotInput): NextKnotSelection {
    const completedTaskIds = new Set(input.completedTaskIds);
    let knot: Knot | null = null;
    let source: NextKnotSelection["source"] = "none";

    if (input.sciencePlan !== null) {
        for (const stop of input.sciencePlan.stops) {
            if (isStopComplete(stop, completedTaskIds)) {
                continue;
            }
            const plannedKnot = input.knots.find((candidate) => candidate.knot_id === stop.knot_id);
            if (plannedKnot !== undefined) {
                knot = plannedKnot;
                source = "science_plan";
            }
            break;
        }
    }

    if (knot === null) {
        knot = nearestKnot(input.knots, input.position);
        if (knot !== null) {
            source = "nearest_knot";
        }
    }

    if (knot === null) {
        return {
            knot: null,
            source: "none",
            distanceM: Number.NaN,
            walkTimeSeconds: Number.NaN,
            straightLineDistanceM: Number.NaN,
            bearingDeg: Number.NaN,
            bearingWord: "unknown",
            isDistanceFromPlan: false,
            isWalkTimeFromPlan: false,
        };
    }

    const straightLineDistanceM = Math.hypot(knot.x_m - input.position.x_m, knot.z_m - input.position.z_m);
    const bearing = bearingDegrees(input.position.x_m, input.position.z_m, knot.x_m, knot.z_m);
    const leg = findPlanLegForKnot(input.sciencePlan, knot.knot_id);

    let distanceM = straightLineDistanceM;
    let isDistanceFromPlan = false;
    if (leg !== null && Number.isFinite(leg.horizontal_distance_m) && leg.horizontal_distance_m >= 0) {
        distanceM = leg.horizontal_distance_m;
        isDistanceFromPlan = true;
    }

    let walkTimeSecondsForKnot = Number.NaN;
    let isWalkTimeFromPlan = false;
    if (leg !== null && Number.isFinite(leg.walking_time_s) && leg.walking_time_s >= 0) {
        walkTimeSecondsForKnot = leg.walking_time_s;
        isWalkTimeFromPlan = true;
    } else {
        walkTimeSecondsForKnot = straightLineWalkSeconds(distanceM, input.parameters, input.loadFactor);
    }

    return {
        knot,
        source,
        distanceM,
        walkTimeSeconds: walkTimeSecondsForKnot,
        straightLineDistanceM,
        bearingDeg: bearing,
        bearingWord: bearingWord(bearing),
        isDistanceFromPlan,
        isWalkTimeFromPlan,
    };
}




export interface HudNumbersInput {
    grid: GridDefinition;
    returnField: Float32Array;
    position: LocalPosition;
    // Planned Marswalk time left from computeThreadInfo(...).time_left_s, seconds.
    timeLeftSeconds: number;
    // Current load factor (contracts.md 4.6).
    loadFactor: number;
    o2RemainingSeconds: number;
    nextKnotDistanceM: number;
    nextKnotWalkTimeSeconds: number;
}


export interface HudNumbers {
    distanceText: string;
    distanceState: HudState;
    threadMarginSeconds: number;
    threadMarginText: string;
    threadState: HudState;
    walkBackNowSeconds: number;
    timeLeftSeconds: number;
    o2RemainingSeconds: number;
    o2Text: string;
    o2State: HudState;
    nextKnotWalkTimeText: string;
}


// The three big HUD readings. Thread margin = time left - return_field[current cell] x load factor
// (contracts.md 4.6, D-027). Every derived value is an estimate; non-finite inputs show "unknown".
export function computeHudNumbers(input: HudNumbersInput): HudNumbers {
    const returnFieldSeconds = returnFieldSecondsAt(input.grid, input.returnField, input.position);

    let walkBackNowSeconds = Number.NaN;
    if (Number.isFinite(returnFieldSeconds) && Number.isFinite(input.loadFactor)) {
        walkBackNowSeconds = returnFieldSeconds * input.loadFactor;
    }

    let threadMarginSeconds = Number.NaN;
    if (Number.isFinite(input.timeLeftSeconds) && Number.isFinite(walkBackNowSeconds)) {
        threadMarginSeconds = input.timeLeftSeconds - walkBackNowSeconds;
    }

    let distanceState: HudState = "no_go";
    if (Number.isFinite(input.nextKnotDistanceM)) {
        distanceState = "go";
    }

    return {
        distanceText: formatDistanceMetres(input.nextKnotDistanceM),
        distanceState,
        threadMarginSeconds,
        threadMarginText: formatSignedMinutes(threadMarginSeconds),
        threadState: threadMarginState(threadMarginSeconds),
        walkBackNowSeconds,
        timeLeftSeconds: input.timeLeftSeconds,
        o2RemainingSeconds: input.o2RemainingSeconds,
        o2Text: formatDurationHm(input.o2RemainingSeconds),
        o2State: o2State(input.o2RemainingSeconds),
        nextKnotWalkTimeText: formatMinutesEstimate(input.nextKnotWalkTimeSeconds),
    };
}


// All readings unknown, for when the pipeline data or the position is not loaded yet.
export function emptyHudNumbers(): HudNumbers {
    return {
        distanceText: "unknown",
        distanceState: "no_go",
        threadMarginSeconds: Number.NaN,
        threadMarginText: "unknown",
        threadState: "no_go",
        walkBackNowSeconds: Number.NaN,
        timeLeftSeconds: Number.NaN,
        o2RemainingSeconds: Number.NaN,
        o2Text: "unknown",
        o2State: "no_go",
        nextKnotWalkTimeText: "unknown",
    };
}
