import { describe, expect, it } from "vitest";

import type { Shelter } from "../data/contracts";
import type { ScenarioDefinition, ScenarioEvent } from "./scenarioEngine";
import { dueEvents, nearestShelter, scenarioProgress, SOLAR_STORM_SCENARIO } from "./scenarioEngine";



function testEvent(atSimSeconds: number, eventType: string): ScenarioEvent {
    return {
        at_sim_seconds: atSimSeconds,
        event_type: eventType,
        payload: {},
        display_message: eventType,
        recommended_action: "act",
    };
}


function testScenario(events: ScenarioEvent[]): ScenarioDefinition {
    return {
        scenario_id: "test_scenario",
        description: "Test scenario.",
        events,
    };
}


function testShelter(shelterId: string, xMetres: number, zMetres: number): Shelter {
    return {
        shelter_id: shelterId,
        shelter_type: "terrain_overhang",
        x_m: xMetres,
        z_m: zMetres,
        sky_view_factor: 0.6,
        is_estimate: true,
    };
}



describe("dueEvents", () => {
    it("returns nothing for a scenario with no events", () => {
        const result = dueEvents(testScenario([]), 0, 1000);
        expect(result.events).toEqual([]);
        expect(result.nextIndex).toBe(0);
    });

    it("returns only the events at or before the elapsed time", () => {
        const scenario = testScenario([testEvent(10, "a"), testEvent(20, "b"), testEvent(30, "c")]);
        const result = dueEvents(scenario, 0, 20);
        expect(result.events.map((event) => event.event_type)).toEqual(["a", "b"]);
        expect(result.nextIndex).toBe(2);
    });

    it("fires an event exactly at the boundary", () => {
        const scenario = testScenario([testEvent(20, "b"), testEvent(30, "c")]);
        const result = dueEvents(scenario, 0, 20);
        expect(result.events.map((event) => event.event_type)).toEqual(["b"]);
        expect(result.nextIndex).toBe(1);
    });

    it("fires every event once the elapsed time is past the last one", () => {
        const scenario = testScenario([testEvent(10, "a"), testEvent(20, "b"), testEvent(30, "c")]);
        const result = dueEvents(scenario, 0, 5000);
        expect(result.events).toHaveLength(3);
        expect(result.nextIndex).toBe(3);
    });

    it("never skips an event that is already past but not fired", () => {
        const scenario = testScenario([testEvent(10, "a"), testEvent(20, "b"), testEvent(30, "c")]);
        const result = dueEvents(scenario, 0, 1000);
        expect(result.events).toHaveLength(3);
    });

    it("does not return an event twice when the next index is passed back", () => {
        const scenario = testScenario([testEvent(10, "a"), testEvent(20, "b"), testEvent(30, "c")]);
        const first = dueEvents(scenario, 0, 25);
        expect(first.events.map((event) => event.event_type)).toEqual(["a", "b"]);

        const second = dueEvents(scenario, first.nextIndex, 25);
        expect(second.events).toEqual([]);
        expect(second.nextIndex).toBe(first.nextIndex);
    });

    it("is deterministic: the same inputs give the same fired list twice", () => {
        const scenario = testScenario([testEvent(10, "a"), testEvent(20, "b"), testEvent(30, "c")]);
        const firstRun = dueEvents(scenario, 1, 25);
        const secondRun = dueEvents(scenario, 1, 25);
        expect(firstRun).toEqual(secondRun);
    });

    it("handles a next index outside the event list", () => {
        const scenario = testScenario([testEvent(10, "a")]);
        expect(dueEvents(scenario, -5, 20)).toEqual({ events: [scenario.events[0]], nextIndex: 1 });
        expect(dueEvents(scenario, 99, 20)).toEqual({ events: [], nextIndex: 1 });
    });

    it("fires nothing for a non-finite elapsed time", () => {
        const scenario = testScenario([testEvent(10, "a")]);
        expect(dueEvents(scenario, 0, Number.NaN)).toEqual({ events: [], nextIndex: 0 });
    });
});



describe("scenarioProgress", () => {
    const scenario = testScenario([testEvent(10, "a"), testEvent(20, "b"), testEvent(30, "c")]);

    it("reports nothing fired at the start", () => {
        expect(scenarioProgress(scenario, 0)).toEqual({
            fired_count: 0,
            total_count: 3,
            next_event_at_sim_seconds: 10,
            is_complete: false,
        });
    });

    it("reports the next event time in the middle of a run", () => {
        const progress = scenarioProgress(scenario, 1);
        expect(progress.fired_count).toBe(1);
        expect(progress.next_event_at_sim_seconds).toBe(20);
        expect(progress.is_complete).toBe(false);
    });

    it("reports complete after the last event", () => {
        const progress = scenarioProgress(scenario, 3);
        expect(progress.fired_count).toBe(3);
        expect(progress.next_event_at_sim_seconds).toBeNull();
        expect(progress.is_complete).toBe(true);
    });

    it("clamps an index past the end", () => {
        expect(scenarioProgress(scenario, 99).fired_count).toBe(3);
    });

    it("reports an empty scenario as complete", () => {
        const progress = scenarioProgress(testScenario([]), 0);
        expect(progress.total_count).toBe(0);
        expect(progress.is_complete).toBe(true);
    });
});



describe("nearestShelter", () => {
    it("picks the closest shelter by local grid distance", () => {
        const shelters = [
            testShelter("shelter_far", 100, 0),
            testShelter("shelter_near", 0, 3),
            testShelter("shelter_middle", 10, 0),
        ];
        const nearest = nearestShelter(shelters, { x_m: 0, z_m: 0 });
        expect(nearest).not.toBeNull();
        expect(nearest?.shelter.shelter_id).toBe("shelter_near");
        expect(nearest?.distance_m).toBeCloseTo(3);
    });

    it("breaks a distance tie by shelter_id", () => {
        const shelters = [
            testShelter("shelter_b", 10, 0),
            testShelter("shelter_a", -10, 0),
        ];
        const nearest = nearestShelter(shelters, { x_m: 0, z_m: 0 });
        expect(nearest?.shelter.shelter_id).toBe("shelter_a");
        expect(nearest?.distance_m).toBeCloseTo(10);
    });

    it("returns null when there are no shelters", () => {
        expect(nearestShelter([], { x_m: 0, z_m: 0 })).toBeNull();
    });
});



describe("the shipped scenario", () => {
    it("matches contracts.md 3.15 and is ordered by time", () => {
        expect(SOLAR_STORM_SCENARIO.scenario_id).toBe("solar_particle_event_reroute");
        expect(SOLAR_STORM_SCENARIO.events).toHaveLength(3);

        for (let index = 1; index < SOLAR_STORM_SCENARIO.events.length; index++) {
            const previous = SOLAR_STORM_SCENARIO.events[index - 1];
            const current = SOLAR_STORM_SCENARIO.events[index];
            expect(current.at_sim_seconds).toBeGreaterThan(previous.at_sim_seconds);
        }
    });

    it("stays well inside the 8 h suit capability", () => {
        for (const event of SOLAR_STORM_SCENARIO.events) {
            expect(event.at_sim_seconds).toBeGreaterThan(0);
            expect(event.at_sim_seconds).toBeLessThan(8 * 3600);
        }
    });

    it("reroutes to the same real shelter in the storm events", () => {
        const shelterIds = SOLAR_STORM_SCENARIO.events
            .filter((event) => event.payload.shelter_id !== undefined)
            .map((event) => event.payload.shelter_id);
        // The pressurised rover is the shelter (D-030): overhangs give weak protection.
        expect(shelterIds).toEqual(["shelter_rover", "shelter_rover"]);
    });
});
