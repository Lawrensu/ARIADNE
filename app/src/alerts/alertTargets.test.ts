import { describe, expect, it } from "vitest";

import type { EnvironmentTimeline, Knot, Meta, Shelter } from "../data/contracts";
import type { ProcessedData } from "../data/loadProcessed";
import { walkingTimeSeconds } from "../routing/walkingTime";
import type { AlertRecord } from "../state/alertsSlice";
import {
    alertTargetLabel,
    formatAlertDistance,
    formatAlertDuration,
    nearestShelterId,
    resolveAlertTarget,
} from "./alertTargets";



const ELEVATION_REFERENCE = "mars_areoid";


function makeMeta(): Meta {
    return {
        contract_version: "1.1.1",
        generated_at_utc: "2026-11-14T06:20:36Z",
        pipeline_commit: "test",
        grid: { width: 1013, height: 934, cell_size_m: 2.0 },
        origin_northwest: { latitude_deg: -4.7809, longitude_deg: 137.3771 },
        crs: "IAU_2015:49900",
        elevation_reference: ELEVATION_REFERENCE,
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
        parameters: {
            suit_speed_factor: 0.6,
            gravity_adjustment: 1.0,
            max_walkable_slope_deg: 25.0,
            suit_capability_hours: 8.0,
            planned_marswalk_hours: 6.0,
            reserve_minutes: 30.0,
            base_carried_load_kg: 10.0,
            load_time_factor_per_kg: 0.01,
        },
    };
}


function makeKnot(): Knot {
    return {
        knot_id: "knot_sulfur_stones",
        name: "Sulfur stones",
        x_m: 1875.0,
        z_m: 285.0,
        latitude_deg: -4.795,
        longitude_deg: 137.402,
        science_rationale: "First pure sulfur found on Mars.",
        measurements: [],
        photos: [],
        science_tasks: [],
    };
}


function makeShelters(): Shelter[] {
    return [
        {
            shelter_id: "shelter_rover",
            shelter_type: "pressurised_rover",
            x_m: 775.0,
            z_m: 467.0,
            sky_view_factor: 0.859,
            is_estimate: false,
        },
        {
            shelter_id: "shelter_overhang_01",
            shelter_type: "terrain_overhang",
            x_m: 1331.0,
            z_m: 1139.0,
            sky_view_factor: 0.647,
            is_estimate: true,
        },
    ];
}


// Only the fields the target resolver reads are real; grid layers stay empty because resolving a
// target never touches them.
function makeProcessedData(): ProcessedData {
    const environmentTimeline: EnvironmentTimeline = {
        replay_source: { mission: "msl", instrument_set: ["rems", "rad"], sol: 4760 },
        samples: [],
    };
    return {
        meta: makeMeta(),
        float32Layers: {} as ProcessedData["float32Layers"],
        uint8Layers: {} as ProcessedData["uint8Layers"],
        layerEntries: {},
        rocks: [],
        knots: [makeKnot()],
        shelters: makeShelters(),
        environmentTimeline,
        textureUrl: "",
        galeContextUrl: null,
    };
}


function makeAlert(overrides: Partial<AlertRecord>): AlertRecord {
    return {
        alert_id: "alert_1",
        alert_type: "solar_particle_event_alert",
        severity: "no_go",
        what_happened: "Solar storm: high dose rate.",
        recommended_action: "Shelter at the nearest overhang.",
        distance_m: null,
        time_s: null,
        route_target_kind: null,
        route_target_id: null,
        route_target_label: null,
        created_at_sim_seconds: 1800,
        is_estimate: true,
        ...overrides,
    };
}


const ASTRONAUT_POSITION = { x_m: 1000.0, z_m: 467.0 };



describe("resolveAlertTarget", () => {
    it("resolves a shelter target with distance and contract walking time", () => {
        const processedData = makeProcessedData();
        const alert = makeAlert({
            route_target_kind: "shelter",
            route_target_id: "shelter_overhang_01",
        });
        const target = resolveAlertTarget(processedData, alert, ASTRONAUT_POSITION);
        expect(target).not.toBeNull();
        if (target === null) {
            return;
        }
        expect(target.endpoint.endpoint_kind).toBe("shelter");
        expect(target.endpoint.endpoint_id).toBe("shelter_overhang_01");
        expect(target.endpoint.position).toEqual({ x_m: 1331.0, z_m: 1139.0 });
        expect(target.distance_m).toBeCloseTo(Math.hypot(331, 672), 9);
        // The walking time must be the shared contract function, not a second model.
        expect(target.walking_time_s).toBeCloseTo(
            walkingTimeSeconds(target.distance_m, 0, processedData.meta.parameters),
            9,
        );
        expect(target.walking_time_s).toBeGreaterThan(0);
    });

    it("resolves a Knot target and uses the Knot name", () => {
        const processedData = makeProcessedData();
        const alert = makeAlert({ route_target_kind: "knot", route_target_id: "knot_sulfur_stones" });
        const target = resolveAlertTarget(processedData, alert, ASTRONAUT_POSITION);
        expect(target).not.toBeNull();
        if (target === null) {
            return;
        }
        expect(target.endpoint.endpoint_kind).toBe("knot");
        expect(target.endpoint.label).toBe("Sulfur stones");
        expect(target.distance_m).toBeCloseTo(Math.hypot(875, -182), 9);
    });

    it("resolves the staging point as the rover", () => {
        const processedData = makeProcessedData();
        const alert = makeAlert({ route_target_kind: "staging_point", route_target_id: "staging_point" });
        const target = resolveAlertTarget(processedData, alert, ASTRONAUT_POSITION);
        expect(target).not.toBeNull();
        if (target === null) {
            return;
        }
        expect(target.endpoint.endpoint_kind).toBe("staging_point");
        expect(target.endpoint.label).toBe("Rover");
        expect(target.endpoint.position).toEqual({ x_m: 775.0, z_m: 467.0 });
        expect(target.distance_m).toBeCloseTo(225, 9);
        expect(target.walking_time_s).toBeCloseTo(268.03, 1);
    });

    it("prefers the alert's own label when it has one", () => {
        const processedData = makeProcessedData();
        const alert = makeAlert({
            route_target_kind: "shelter",
            route_target_id: "shelter_overhang_01",
            route_target_label: "Overhang by the ridge",
        });
        const target = resolveAlertTarget(processedData, alert, ASTRONAUT_POSITION);
        expect(target?.endpoint.label).toBe("Overhang by the ridge");
    });

    it("returns null for an unknown shelter id", () => {
        const processedData = makeProcessedData();
        const alert = makeAlert({ route_target_kind: "shelter", route_target_id: "shelter_missing" });
        expect(resolveAlertTarget(processedData, alert, ASTRONAUT_POSITION)).toBeNull();
    });

    it("returns null for an unknown Knot id", () => {
        const processedData = makeProcessedData();
        const alert = makeAlert({ route_target_kind: "knot", route_target_id: "knot_missing" });
        expect(resolveAlertTarget(processedData, alert, ASTRONAUT_POSITION)).toBeNull();
    });

    it("returns null when the alert has no target kind, no id, or a cell target", () => {
        const processedData = makeProcessedData();
        expect(resolveAlertTarget(processedData, makeAlert({}), ASTRONAUT_POSITION)).toBeNull();
        expect(
            resolveAlertTarget(
                processedData,
                makeAlert({ route_target_kind: "shelter", route_target_id: null }),
                ASTRONAUT_POSITION,
            ),
        ).toBeNull();
        expect(
            resolveAlertTarget(
                processedData,
                makeAlert({ route_target_kind: "cell", route_target_id: "cell_1" }),
                ASTRONAUT_POSITION,
            ),
        ).toBeNull();
    });

    it("gives zero distance and zero time when the astronaut is at the target", () => {
        const processedData = makeProcessedData();
        const alert = makeAlert({ route_target_kind: "staging_point", route_target_id: "staging_point" });
        const target = resolveAlertTarget(processedData, alert, { x_m: 775.0, z_m: 467.0 });
        expect(target?.distance_m).toBe(0);
        expect(target?.walking_time_s).toBe(0);
    });
});



describe("alertTargetLabel", () => {
    it("names every supported target kind", () => {
        const processedData = makeProcessedData();
        expect(alertTargetLabel(processedData, "shelter", "shelter_rover")).toBe("Rover shelter");
        expect(alertTargetLabel(processedData, "shelter", "shelter_overhang_01")).toBe("Terrain overhang 01");
        expect(alertTargetLabel(processedData, "knot", "knot_sulfur_stones")).toBe("Sulfur stones");
        expect(alertTargetLabel(processedData, "staging_point", "staging_point")).toBe("Rover");
    });

    it("returns null for unknown ids and unsupported kinds", () => {
        const processedData = makeProcessedData();
        expect(alertTargetLabel(processedData, "shelter", "shelter_missing")).toBeNull();
        expect(alertTargetLabel(processedData, "knot", "knot_missing")).toBeNull();
        expect(alertTargetLabel(processedData, "cell", "cell_1")).toBeNull();
        expect(alertTargetLabel(processedData, null, null)).toBeNull();
    });
});



describe("nearestShelterId", () => {
    it("finds the closest shelter", () => {
        const shelters = makeShelters();
        expect(nearestShelterId(shelters, { x_m: 1300.0, z_m: 1100.0 })).toBe("shelter_overhang_01");
        expect(nearestShelterId(shelters, { x_m: 780.0, z_m: 470.0 })).toBe("shelter_rover");
    });

    it("breaks ties on shelter_id", () => {
        const shelters: Shelter[] = [
            {
                shelter_id: "shelter_b",
                shelter_type: "terrain_overhang",
                x_m: 10.0,
                z_m: 0.0,
                sky_view_factor: 0.6,
                is_estimate: true,
            },
            {
                shelter_id: "shelter_a",
                shelter_type: "terrain_overhang",
                x_m: -10.0,
                z_m: 0.0,
                sky_view_factor: 0.6,
                is_estimate: true,
            },
        ];
        expect(nearestShelterId(shelters, { x_m: 0.0, z_m: 0.0 })).toBe("shelter_a");
    });

    it("returns null when there are no shelters", () => {
        expect(nearestShelterId([], { x_m: 0.0, z_m: 0.0 })).toBeNull();
    });
});



describe("formatAlertDistance", () => {
    it("uses whole metres below 1 km and tenths of a kilometre above", () => {
        expect(formatAlertDistance(0)).toBe("0 m");
        expect(formatAlertDistance(9.6)).toBe("10 m");
        expect(formatAlertDistance(340.4)).toBe("340 m");
        expect(formatAlertDistance(999.4)).toBe("999 m");
        expect(formatAlertDistance(999.6)).toBe("1.0 km");
        expect(formatAlertDistance(1000)).toBe("1.0 km");
        expect(formatAlertDistance(2043)).toBe("2.0 km");
    });

    it("handles unusable input without inventing a number", () => {
        expect(formatAlertDistance(Number.NaN)).toBe("n/a");
        expect(formatAlertDistance(Number.POSITIVE_INFINITY)).toBe("n/a");
        expect(formatAlertDistance(-5)).toBe("n/a");
    });
});



describe("formatAlertDuration", () => {
    it("uses minutes below an hour, then h:mm", () => {
        expect(formatAlertDuration(0)).toBe("under 1 min");
        expect(formatAlertDuration(29)).toBe("under 1 min");
        expect(formatAlertDuration(59)).toBe("1 min");
        expect(formatAlertDuration(60)).toBe("1 min");
        expect(formatAlertDuration(90)).toBe("2 min");
        expect(formatAlertDuration(3599)).toBe("1:00");
        expect(formatAlertDuration(3600)).toBe("1:00");
        expect(formatAlertDuration(3900)).toBe("1:05");
        expect(formatAlertDuration(5400)).toBe("1:30");
        expect(formatAlertDuration(36_000)).toBe("10:00");
    });

    it("handles unusable input without inventing a number", () => {
        expect(formatAlertDuration(Number.NaN)).toBe("unreachable");
        expect(formatAlertDuration(Number.POSITIVE_INFINITY)).toBe("unreachable");
        expect(formatAlertDuration(-10)).toBe("under 1 min");
    });
});
