import { describe, expect, it } from "vitest";

import type { Knot } from "../../data/contracts";
import type { SciencePlan, SciencePlanLeg } from "../../state/scienceSlice";
import {
    buildLegRows,
    feasibilityDisplay,
    formatBudgetLeft,
    formatCarriedLoad,
    formatDropSuggestion,
    formatLoadFactor,
    formatLoadKg,
    formatLoadRule,
    formatPlanLimit,
    isLegDashed,
    nearestNeighbourOrder,
    unreachableKnotNames,
} from "./planDisplay";


function makeKnot(knotId: string, x: number, z: number): Knot {
    return {
        knot_id: knotId,
        name: knotId,
        x_m: x,
        z_m: z,
        latitude_deg: 0,
        longitude_deg: 0,
        science_rationale: "",
        measurements: [],
        photos: [],
        science_tasks: [],
    };
}


function makeLeg(kind: "walk_to_knot" | "walk_back_to_rover"): SciencePlanLeg {
    return {
        leg_kind: kind,
        from_label: "Rover",
        to_label: "Sulfur stones",
        to_knot_id: "k1",
        carried_load_kg: 12.5,
        load_factor: 1.125,
        unloaded_walking_time_s: 1200,
        walking_time_s: 1350,
        horizontal_distance_m: 523,
        path_positions: [],
        is_estimate: true,
    };
}


describe("feasibilityDisplay", () => {
    it("pairs every state with a label and a shape", () => {
        expect(feasibilityDisplay("go")).toMatchObject({ label: "GO", shape: "filled_circle" });
        expect(feasibilityDisplay("caution")).toMatchObject({ label: "CAUTION", shape: "triangle" });
        expect(feasibilityDisplay("no_go")).toMatchObject({ label: "NO-GO", shape: "octagon" });
    });
});


describe("formatting", () => {
    it("shows budget left and over", () => {
        expect(formatBudgetLeft(45 * 60)).toBe("est. 45 min left");
        expect(formatBudgetLeft(-20 * 60)).toBe("est. 20 min over");
        expect(formatBudgetLeft(0)).toBe("est. 0 min left");
    });

    it("formats load with one decimal and the factor with two", () => {
        expect(formatLoadKg(12.46)).toBe("est. 12.5 kg");
        expect(formatLoadFactor(1.126)).toBe("1.13");
        expect(formatCarriedLoad(12.5, 1.126)).toBe("est. 12.5 kg (load factor 1.13)");
    });

    it("formats the plan limit and load rule", () => {
        const parameters = {
            suit_speed_factor: 0.6,
            gravity_adjustment: 1,
            max_walkable_slope_deg: 30,
            suit_capability_hours: 8,
            planned_marswalk_hours: 6,
            reserve_minutes: 30,
        };
        expect(formatPlanLimit(parameters)).toBe("6 h minus 30 min reserve");
        expect(formatPlanLimit(undefined)).toBe("n/a");
        expect(formatLoadRule({ base_carried_load_kg: 10, load_time_factor_per_kg: 0.01 })).toBe(
            "1 + 0.01 x kg, 10 kg tool kit (est., D-027)",
        );
    });

    it("words the drop suggestion", () => {
        const names = new Map([["k1", "Sulfur stones"]]);
        const text = formatDropSuggestion({ knot_id: "k1", task_id: "t1", label: "Rock chip", saves_s: 610 }, names);
        expect(text).toBe("Drop Rock chip at Sulfur stones to save est. 10 min");
    });
});


describe("plan rows", () => {
    it("builds leg rows and marks the walk back", () => {
        const plan = { legs: [makeLeg("walk_to_knot"), makeLeg("walk_back_to_rover")] } as SciencePlan;
        const rows = buildLegRows(plan);
        expect(rows).toHaveLength(2);
        expect(rows[0].title).toBe("Rover to Sulfur stones");
        expect(rows[0].time_text).toBe("est. 23 min");
        expect(rows[0].is_walk_back).toBe(false);
        expect(rows[1].is_walk_back).toBe(true);
        expect(isLegDashed(makeLeg("walk_back_to_rover"))).toBe(true);
        expect(isLegDashed(makeLeg("walk_to_knot"))).toBe(false);
    });

    it("names unreachable Knots, falling back to the id", () => {
        const plan = { unreachable_knot_ids: ["k1", "k9"] } as SciencePlan;
        expect(unreachableKnotNames(plan, new Map([["k1", "Sulfur stones"]]))).toEqual(["Sulfur stones", "k9"]);
    });
});


describe("nearestNeighbourOrder", () => {
    it("visits the nearest Knot first, then the nearest to that", () => {
        const knots = [makeKnot("far", 500, 0), makeKnot("near", 50, 0), makeKnot("middle", 200, 0)];
        expect(nearestNeighbourOrder({ x_m: 0, z_m: 0 }, knots)).toEqual(["near", "middle", "far"]);
    });

    it("returns an empty list for no Knots", () => {
        expect(nearestNeighbourOrder({ x_m: 0, z_m: 0 }, [])).toEqual([]);
    });
});
