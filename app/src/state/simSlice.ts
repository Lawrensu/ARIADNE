// Sim slice: the simulation clock state (owner: Malissa, Stage 2; Letta extends sim/ in Stage 3).
// The app never claims live data: it replays recorded data on this clock (D-014).
// The ticking logic and the consumables maths live in src/sim/clock.ts; this slice only stores state.

import type { StateCreator } from "zustand";

import type { AriadneState } from "./store";



export interface SimSlice {
    // Simulated seconds since the Marswalk started (suit fully charged at 0).
    simElapsedSeconds: number;
    isSimPlaying: boolean;
    // Simulated seconds per real second.
    simSpeedMultiplier: number;
    setSimPlaying: (isPlaying: boolean) => void;
    setSimSpeedMultiplier: (multiplier: number) => void;
    setSimElapsedSeconds: (seconds: number) => void;
    resetSim: () => void;
}



export const createSimSlice: StateCreator<AriadneState, [], [], SimSlice> = (set) => ({
    simElapsedSeconds: 0,
    isSimPlaying: false,
    simSpeedMultiplier: 60,

    setSimPlaying: (isPlaying) => set({ isSimPlaying: isPlaying }),
    setSimSpeedMultiplier: (multiplier) => set({ simSpeedMultiplier: Math.max(multiplier, 0) }),
    setSimElapsedSeconds: (seconds) => set({ simElapsedSeconds: Math.max(seconds, 0) }),
    resetSim: () => set({ simElapsedSeconds: 0, isSimPlaying: false }),
});
