// Rover meet point (D-033): synthetic paths.

import { describe, expect, it } from "vitest";

import { computeRoverMeet, ROVER_DISPATCH_DELAY_S, ROVER_DRIVE_SPEED_M_PER_S } from "./roverMeet";



// Astronaut at x = 0, rover at x = 100, one straight line east.
const STRAIGHT_PATH = [
    { x_m: 0, z_m: 0 },
    { x_m: 50, z_m: 0 },
    { x_m: 100, z_m: 0 },
];



describe("computeRoverMeet", () => {
    it("has the documented estimate constants", () => {
        expect(ROVER_DRIVE_SPEED_M_PER_S).toBeCloseTo(2.0, 9);
        expect(ROVER_DISPATCH_DELAY_S).toBe(120);
    });

    it("meets in the middle when both are equally fast and there is no delay", () => {
        // Astronaut walks 100 m in 50 s (2 m/s), rover drives 2 m/s with no delay.
        const meet = computeRoverMeet(STRAIGHT_PATH, 50, 1000, 2, 0);
        expect(meet.meet_distance_m).toBeCloseTo(50, 9);
        expect(meet.meet_at_sim_seconds).toBeCloseTo(1025, 9);
        expect(meet.meet_position.x_m).toBeCloseTo(50, 9);
        expect(meet.astronaut_walk_time_s).toBeCloseTo(25, 9);
        expect(meet.rover_depart_at_sim_seconds).toBe(1000);
        expect(meet.rover_arrive_at_sim_seconds).toBeCloseTo(1025, 9);
        expect(meet.rover_drive_distance_m).toBeCloseTo(50, 9);
    });

    it("cuts the astronaut path and reverses the rover path at the meeting point", () => {
        const meet = computeRoverMeet(STRAIGHT_PATH, 50, 0, 2, 0);
        expect(meet.astronaut_path[0]).toEqual({ x_m: 0, z_m: 0 });
        expect(meet.astronaut_path[meet.astronaut_path.length - 1]).toEqual(meet.meet_position);
        expect(meet.rover_path[0]).toEqual({ x_m: 100, z_m: 0 });
        expect(meet.rover_path[meet.rover_path.length - 1]).toEqual(meet.meet_position);
    });

    it("cuts at a corner without losing it", () => {
        // 60 m east then 40 m south; astronaut 100 m in 100 s (1 m/s), rover 1 m/s, no delay: meet at 50 m.
        const bent = [{ x_m: 0, z_m: 0 }, { x_m: 60, z_m: 0 }, { x_m: 60, z_m: 40 }];
        const meet = computeRoverMeet(bent, 100, 0, 1, 0);
        expect(meet.meet_distance_m).toBeCloseTo(50, 9);
        expect(meet.astronaut_path).toEqual([{ x_m: 0, z_m: 0 }, { x_m: 50, z_m: 0 }]);
        expect(meet.rover_path).toEqual([{ x_m: 60, z_m: 40 }, { x_m: 60, z_m: 0 }, { x_m: 50, z_m: 0 }]);
    });

    it("meets close to the astronaut when the rover is much faster", () => {
        const slow = computeRoverMeet(STRAIGHT_PATH, 100, 0, 2, 0);
        const fast = computeRoverMeet(STRAIGHT_PATH, 100, 0, 50, 0);
        expect(fast.meet_distance_m).toBeLessThan(slow.meet_distance_m);
        expect(fast.meet_distance_m).toBeLessThan(3);
        expect(fast.meet_at_sim_seconds).toBeLessThan(slow.meet_at_sim_seconds);
    });

    it("meets later and farther along the path with a dispatch delay, never later than walking home", () => {
        const noDelay = computeRoverMeet(STRAIGHT_PATH, 100, 0, 2, 0);
        const delayed = computeRoverMeet(STRAIGHT_PATH, 100, 0, 2, 20);
        expect(delayed.meet_distance_m).toBeGreaterThan(noDelay.meet_distance_m);
        expect(delayed.meet_at_sim_seconds).toBeLessThan(100);
        // Both arrive at the same time.
        expect(delayed.rover_arrive_at_sim_seconds).toBeCloseTo(delayed.meet_at_sim_seconds, 9);
        expect(delayed.rover_depart_at_sim_seconds).toBe(20);
    });

    it("meets at the rover when the delay is longer than the walk", () => {
        const meet = computeRoverMeet(STRAIGHT_PATH, 60, 500, 2, 600);
        expect(meet.meet_distance_m).toBeCloseTo(100, 9);
        expect(meet.meet_at_sim_seconds).toBeCloseTo(560, 9);
        expect(meet.meet_position).toEqual({ x_m: 100, z_m: 0 });
        expect(meet.astronaut_path[meet.astronaut_path.length - 1]).toEqual({ x_m: 100, z_m: 0 });
        expect(meet.rover_drive_distance_m).toBe(0);
        expect(meet.rover_path).toEqual([{ x_m: 100, z_m: 0 }]);
        expect(meet.rover_arrive_at_sim_seconds).toBeCloseTo(560, 9);
    });

    it("handles a zero-length path (already at the rover)", () => {
        const meet = computeRoverMeet([{ x_m: 5, z_m: 5 }], 0, 300);
        expect(meet.meet_distance_m).toBe(0);
        expect(meet.meet_at_sim_seconds).toBe(300);
        expect(meet.meet_position).toEqual({ x_m: 5, z_m: 5 });
        expect(meet.astronaut_path).toEqual([{ x_m: 5, z_m: 5 }]);
        expect(meet.rover_drive_distance_m).toBe(0);

        const twoSamePoints = computeRoverMeet([{ x_m: 5, z_m: 5 }, { x_m: 5, z_m: 5 }], 0, 300);
        expect(twoSamePoints.meet_at_sim_seconds).toBe(300);
    });

    it("never moves the meeting point before the astronaut or past the rover", () => {
        for (const delay of [0, 10, 59, 60, 61, 1000]) {
            const meet = computeRoverMeet(STRAIGHT_PATH, 60, 0, 2, delay);
            expect(meet.meet_distance_m).toBeGreaterThanOrEqual(0);
            expect(meet.meet_distance_m).toBeLessThanOrEqual(100);
            expect(meet.meet_at_sim_seconds).toBeLessThanOrEqual(60 + 1e-9);
        }
    });
});
