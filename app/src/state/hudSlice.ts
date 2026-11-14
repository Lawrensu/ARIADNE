// Suit HUD slice (owner: Letta, Stage 3, built by the HUD sub-agent): whether the full-screen
// suit display is open and which on-demand sheet is showing. At most three numbers are always
// visible; everything else is one tap away (system_design.md, UX principles).

import type { StateCreator } from "zustand";

import type { AriadneState } from "./store";



// "none": the three numbers and the compass only. "science_budget": the plan and tasks.
// "conditions": weather, dose and provenance for the three numbers.
export type HudSheet = "none" | "science_budget" | "conditions";



export interface HudSlice {
    isSuitHudOpen: boolean;
    hudSheet: HudSheet;
    setSuitHudOpen: (isOpen: boolean) => void;
    setHudSheet: (sheet: HudSheet) => void;
}



export const createHudSlice: StateCreator<AriadneState, [], [], HudSlice> = (set) => ({
    isSuitHudOpen: false,
    hudSheet: "none",

    setSuitHudOpen: (isOpen) =>
        set((state) => {
            if (isOpen) {
                return { isSuitHudOpen: true, hudSheet: state.hudSheet };
            }
            return { isSuitHudOpen: false, hudSheet: "none" };
        }),

    setHudSheet: (sheet) => set({ hudSheet: sheet }),
});
