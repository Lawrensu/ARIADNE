// Walk slice (owner: Letta, Stage 3; simulated walk added by Lawrence, D-030): where the astronaut
// is on the local grid and which way the suit is facing. The Suit HUD, the alerts and the scripted
// demo read it; the pipeline data never changes. Positions are local grid metres, never latitude
// and longitude (D-005).
//
// The position is simulated (Mars has no GPS): the walk driver (src/sim/useWalkDriver.ts) moves the
// astronaut along a frozen copy of the science plan on the simulation clock, and along a detour
// route after a reroute. See src/sim/walkTimeline.ts for the maths.

import type { StateCreator } from "zustand";

import type { LocalPosition } from "../data/contracts";
import type { RouteEndpointKind } from "./routeSlice";
import type { SciencePlan } from "./scienceSlice";
import type { AriadneState } from "./store";



// "at_rover": at the staging point. "walking": between places. "at_knot": at a science stop.
// "sheltering": inside the rover or under an overhang after a storm alert.
export type WalkPhase = "at_rover" | "walking" | "at_knot" | "sheltering";



// A reroute: the astronaut leaves the plan at started_at_sim_seconds and walks path_positions to the
// target in walking_time_s (walking model x load factor at the time of the reroute, est.).
export interface WalkDetour {
    started_at_sim_seconds: number;
    path_positions: LocalPosition[];
    walking_time_s: number;
    target_kind: RouteEndpointKind;
    target_id: string;
    target_label: string;
    // Phase once the target is reached: "sheltering" for a shelter (the rover counts), "at_knot" for a Knot.
    phase_on_arrival: WalkPhase;
    is_estimate: true;
}



export interface WalkSlice {
    // Null until the Marswalk data loads; readers then fall back to meta.staging_point.
    astronautPosition: LocalPosition | null;
    // Compass heading in degrees, 0 = north, 90 = east (local grid +x), clockwise.
    astronautHeadingDeg: number;
    walkPhase: WalkPhase;
    // Simulated walk (D-030). Null while the astronaut waits at the rover.
    walkStartedAtSimSeconds: number | null;
    // The science plan frozen when the walk started, so a recomputed plan never moves the astronaut.
    walkPlanSnapshot: SciencePlan | null;
    walkDetour: WalkDetour | null;
    // Breadcrumb trail of where the astronaut has been, in order, local grid metres.
    walkTrail: LocalPosition[];
    setAstronautPosition: (position: LocalPosition, headingDeg?: number) => void;
    setWalkPhase: (phase: WalkPhase) => void;
    startWalk: (atSimSeconds: number, plan: SciencePlan) => void;
    setWalkDetour: (detour: WalkDetour | null) => void;
    // Moves the frozen plan's start time (negative = earlier). Used to leave a Knot early once every
    // task there is ticked off (sim/walkTimeline.ts earlyDepartureShiftSeconds); the trail is kept.
    shiftWalkStart: (deltaSeconds: number) => void;
    setWalkTrail: (trail: LocalPosition[]) => void;
    resetWalk: () => void;
}



export const createWalkSlice: StateCreator<AriadneState, [], [], WalkSlice> = (set) => ({
    astronautPosition: null,
    astronautHeadingDeg: 0,
    walkPhase: "at_rover",
    walkStartedAtSimSeconds: null,
    walkPlanSnapshot: null,
    walkDetour: null,
    walkTrail: [],

    setAstronautPosition: (position, headingDeg) =>
        set((state) => {
            if (headingDeg === undefined) {
                return { astronautPosition: position, astronautHeadingDeg: state.astronautHeadingDeg };
            }
            return { astronautPosition: position, astronautHeadingDeg: headingDeg };
        }),

    setWalkPhase: (phase) => set({ walkPhase: phase }),

    startWalk: (atSimSeconds, plan) =>
        set({
            walkStartedAtSimSeconds: atSimSeconds,
            walkPlanSnapshot: plan,
            walkDetour: null,
            walkTrail: [],
        }),

    setWalkDetour: (detour) => set({ walkDetour: detour }),

    shiftWalkStart: (deltaSeconds) =>
        set((state) => {
            if (state.walkStartedAtSimSeconds === null) {
                return {};
            }
            return { walkStartedAtSimSeconds: state.walkStartedAtSimSeconds + deltaSeconds };
        }),

    setWalkTrail: (trail) => set({ walkTrail: trail }),

    resetWalk: () =>
        set({
            astronautPosition: null,
            astronautHeadingDeg: 0,
            walkPhase: "at_rover",
            walkStartedAtSimSeconds: null,
            walkPlanSnapshot: null,
            walkDetour: null,
            walkTrail: [],
        }),
});
