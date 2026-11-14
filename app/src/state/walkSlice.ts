// Walk slice (owner: Letta, Stage 3): where the astronaut is on the local grid and which way the
// suit is facing. The Suit HUD, the alerts and the scripted demo read it; the pipeline data never
// changes. Positions are local grid metres, never latitude and longitude (D-005).

import type { StateCreator } from "zustand";

import type { LocalPosition } from "../data/contracts";
import type { AriadneState } from "./store";



// "at_rover": at the staging point. "walking": between places. "at_knot": at a science stop.
// "sheltering": inside the rover or under an overhang after a storm alert.
export type WalkPhase = "at_rover" | "walking" | "at_knot" | "sheltering";



export interface WalkSlice {
    // Null until the Marswalk data loads; readers then fall back to meta.staging_point.
    astronautPosition: LocalPosition | null;
    // Compass heading in degrees, 0 = north, 90 = east (local grid +x), clockwise.
    astronautHeadingDeg: number;
    walkPhase: WalkPhase;
    setAstronautPosition: (position: LocalPosition, headingDeg?: number) => void;
    setWalkPhase: (phase: WalkPhase) => void;
    resetWalk: () => void;
}



export const createWalkSlice: StateCreator<AriadneState, [], [], WalkSlice> = (set) => ({
    astronautPosition: null,
    astronautHeadingDeg: 0,
    walkPhase: "at_rover",

    setAstronautPosition: (position, headingDeg) =>
        set((state) => {
            if (headingDeg === undefined) {
                return { astronautPosition: position, astronautHeadingDeg: state.astronautHeadingDeg };
            }
            return { astronautPosition: position, astronautHeadingDeg: headingDeg };
        }),

    setWalkPhase: (phase) => set({ walkPhase: phase }),

    resetWalk: () => set({ astronautPosition: null, astronautHeadingDeg: 0, walkPhase: "at_rover" }),
});
