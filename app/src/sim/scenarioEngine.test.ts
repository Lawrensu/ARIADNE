import { describe, expect, it } from "vitest";

import type { Shelter } from "../data/contracts";
import type { ScenarioDefinition, ScenarioEvent } from "./scenarioEngine";
import { dueEvents, nearestShelter, scenarioProgress, SOLAR_STORM_SCENARIO, stormCountdownAt } from "./scenarioEngine";



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
        expect(SOLAR_STORM_SCENARIO.events).toHaveLength(4);

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

    it("has a space weather watch 30 minutes before the storm alert", () => {
        const watch = SOLAR_STORM_SCENARIO.events.find((event) => event.event_type === "space_weather_watch");
        const alert = SOLAR_STORM_SCENARIO.events.find((event) => event.event_type === "solar_particle_event_alert");
        expect(watch).toBeDefined();
        expect(alert).toBeDefined();
        expect(watch?.at_sim_seconds).toBe(4900);
        expect(watch?.payload.storm_expected_at_sim_seconds).toBe(alert?.at_sim_seconds);
        expect((alert?.at_sim_seconds ?? 0) - (watch?.at_sim_seconds ?? 0)).toBe(30 * 60);
    });
});



describe("stormCountdownAt", () => {
    it("is none before the watch", () => {
        const countdown = stormCountdownAt(SOLAR_STORM_SCENARIO, 4899, true);
        expect(countdown.phase).toBe("none");
        expect(countdown.seconds_to_storm).toBeNull();
        expect(countdown.storm_at_sim_seconds).toBe(6700);
        expect(countdown.is_estimate).toBe(true);
    });

    it("counts down from the watch to the storm", () => {
        const atWatch = stormCountdownAt(SOLAR_STORM_SCENARIO, 4900, true);
        expect(atWatch.phase).toBe("watch");
        expect(atWatch.seconds_to_storm).toBe(1800);
        const later = stormCountdownAt(SOLAR_STORM_SCENARIO, 6000, true);
        expect(later.phase).toBe("watch");
        expect(later.seconds_to_storm).toBe(700);
        expect(later.storm_at_sim_seconds).toBe(6700);
    });

    it("is active from the storm alert on", () => {
        for (const at of [6700, 6760, 9000]) {
            const countdown = stormCountdownAt(SOLAR_STORM_SCENARIO, at, true);
            expect(countdown.phase).toBe("active");
            expect(countdown.seconds_to_storm).toBeNull();
        }
    });

    it("is none while the scenario is not running", () => {
        expect(stormCountdownAt(SOLAR_STORM_SCENARIO, 6000, false).phase).toBe("none");
        expect(stormCountdownAt(SOLAR_STORM_SCENARIO, 7000, false).phase).toBe("none");
    });

    it("falls back to the alert time without a watch payload", () => {
        const scenario = testScenario([
            { ...testEvent(100, "space_weather_watch"), payload: {} },
            testEvent(400, "solar_particle_event_alert"),
        ]);
        const countdown = stormCountdownAt(scenario, 150, true);
        expect(countdown.phase).toBe("watch");
        expect(countdown.storm_at_sim_seconds).toBe(400);
        expect(countdown.seconds_to_storm).toBe(250);
    });

    it("goes straight from none to active without a watch event", () => {
        const scenario = testScenario([testEvent(400, "solar_particle_event_alert")]);
        expect(stormCountdownAt(scenario, 300, true).phase).toBe("none");
        expect(stormCountdownAt(scenario, 400, true).phase).toBe("active");
    });

    it("is none for a scenario with no storm", () => {
        const countdown = stormCountdownAt(testScenario([]), 100, true);
        expect(countdown.phase).toBe("none");
        expect(countdown.storm_at_sim_seconds).toBeNull();
    });
});
