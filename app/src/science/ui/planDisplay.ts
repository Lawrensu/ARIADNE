// Pure display helpers for the science plan UI (D-027, contracts.md 4.6). Owner: Malissa, Stage 2.
// No DOM, no React: tested with Vitest in Node. Every number is an estimate and is shown with "est.".

import type { Knot, LocalPosition, WalkingParameters } from "../../data/contracts";
import { formatDistance, formatWalkingTimeEstimate } from "../../planning/formatting";
import type { DropTaskSuggestion, SciencePlan, SciencePlanFeasibility, SciencePlanLeg } from "../../state/scienceSlice";
import type { LoadParameters } from "../loadFactor";



// Shapes are drawn by the component; the colour never carries the state alone (system_design.md "Colour states").
export type FeasibilityShape = "filled_circle" | "triangle" | "octagon";


export interface FeasibilityDisplay {
    label: string;
    shape: FeasibilityShape;
    explanation: string;
}


export interface LegRow {
    leg_kind: "walk_to_knot" | "walk_back_to_rover";
    title: string;
    time_text: string;
    distance_text: string;
    load_text: string;
    is_walk_back: boolean;
}



export function feasibilityDisplay(feasibility: SciencePlanFeasibility): FeasibilityDisplay {
    if (feasibility === "go") {
        return { label: "GO", shape: "filled_circle", explanation: "The plan fits with margin." };
    }
    if (feasibility === "caution") {
        return { label: "CAUTION", shape: "triangle", explanation: "The plan fits, but the margin is small." };
    }
    return { label: "NO-GO", shape: "octagon", explanation: "The plan does not fit in the time available." };
}


// Whole minutes with "est.", e.g. "est. 25 min".
export function formatMinutesEstimate(seconds: number): string {
    return formatWalkingTimeEstimate(seconds);
}


// Positive: "est. 45 min left". Negative: "est. 20 min over". Zero: "est. 0 min left".
export function formatBudgetLeft(budgetLeftSeconds: number): string {
    if (!Number.isFinite(budgetLeftSeconds)) {
        return "n/a";
    }
    if (budgetLeftSeconds < 0) {
        const minutesOver = Math.round(-budgetLeftSeconds / 60);
        return `est. ${minutesOver} min over`;
    }
    const minutesLeft = Math.round(budgetLeftSeconds / 60);
    return `est. ${minutesLeft} min left`;
}


// One decimal for kg, e.g. "est. 12.5 kg".
export function formatLoadKg(kilograms: number): string {
    return `est. ${kilograms.toFixed(1)} kg`;
}


// Two decimals for the factor, e.g. "1.13".
export function formatLoadFactor(factor: number): string {
    return factor.toFixed(2);
}


export function formatCarriedLoad(kilograms: number, factor: number): string {
    return `${formatLoadKg(kilograms)} (load factor ${formatLoadFactor(factor)})`;
}


export function formatTaskDuration(durationMinutes: number): string {
    return `est. ${Math.round(durationMinutes)} min`;
}


// "6 h minus 30 min reserve". Hours are shown with one decimal only when not whole.
export function formatPlanLimit(parameters: WalkingParameters | undefined): string {
    if (parameters === undefined) {
        return "n/a";
    }
    let hoursText: string;
    if (Number.isInteger(parameters.planned_marswalk_hours)) {
        hoursText = String(parameters.planned_marswalk_hours);
    } else {
        hoursText = parameters.planned_marswalk_hours.toFixed(1);
    }
    return `${hoursText} h minus ${Math.round(parameters.reserve_minutes)} min reserve`;
}


export function formatLoadRule(loadParameters: LoadParameters): string {
    return `1 + ${loadParameters.load_time_factor_per_kg} x kg, ${loadParameters.base_carried_load_kg} kg tool kit (est., D-027)`;
}


export function formatDropSuggestion(suggestion: DropTaskSuggestion, knotNameById: Map<string, string>): string {
    const knotName = knotNameById.get(suggestion.knot_id) ?? suggestion.knot_id;
    const minutesSaved = Math.max(1, Math.round(suggestion.saves_s / 60));
    return `Drop ${suggestion.label} at ${knotName} to save est. ${minutesSaved} min`;
}


export function buildLegRows(plan: SciencePlan): LegRow[] {
    return plan.legs.map((leg: SciencePlanLeg) => ({
        leg_kind: leg.leg_kind,
        title: `${leg.from_label} to ${leg.to_label}`,
        time_text: formatWalkingTimeEstimate(leg.walking_time_s),
        distance_text: formatDistance(leg.horizontal_distance_m),
        load_text: `carrying ${formatCarriedLoad(leg.carried_load_kg, leg.load_factor)}`,
        is_walk_back: leg.leg_kind === "walk_back_to_rover",
    }));
}


// Names of unreachable Knots, in plan order; unknown ids are shown as the id.
export function unreachableKnotNames(plan: SciencePlan, knotNameById: Map<string, string>): string[] {
    return plan.unreachable_knot_ids.map((knotId) => knotNameById.get(knotId) ?? knotId);
}


// Suggested visiting order: nearest neighbour by straight-line distance, starting at the rover.
// A suggestion only: the real walking time is computed on the walkable grid.
export function nearestNeighbourOrder(start: LocalPosition, knots: Knot[]): string[] {
    const remaining = [...knots];
    const orderedIds: string[] = [];
    let current = start;
    while (remaining.length > 0) {
        let bestIndex = 0;
        let bestDistanceM = Infinity;
        for (let index = 0; index < remaining.length; index++) {
            const distanceM = Math.hypot(remaining[index].x_m - current.x_m, remaining[index].z_m - current.z_m);
            if (distanceM < bestDistanceM) {
                bestDistanceM = distanceM;
                bestIndex = index;
            }
        }
        const nextKnot = remaining[bestIndex];
        orderedIds.push(nextKnot.knot_id);
        current = { x_m: nextKnot.x_m, z_m: nextKnot.z_m };
        remaining.splice(bestIndex, 1);
    }
    return orderedIds;
}


// Walking-out legs are drawn solid, the walk back dashed (SciencePlanLines).
export function isLegDashed(leg: SciencePlanLeg): boolean {
    return leg.leg_kind === "walk_back_to_rover";
}
