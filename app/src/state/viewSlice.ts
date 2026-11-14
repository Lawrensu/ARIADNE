// View slice: which camera and which context panels are shown (owner: Malissa, Stage 2).

import type { StateCreator } from "zustand";

import type { AriadneState } from "./store";



// "planning_table": orthographic top-down camera (habitat display).
// "labyrinth_view": perspective 3D camera with orbit controls.
export type ViewMode = "planning_table" | "labyrinth_view";


export interface ViewSlice {
    viewMode: ViewMode;
    isGaleContextVisible: boolean;
    setViewMode: (viewMode: ViewMode) => void;
    setGaleContextVisible: (isVisible: boolean) => void;
}



export const createViewSlice: StateCreator<AriadneState, [], [], ViewSlice> = (set) => ({
    viewMode: "planning_table",
    isGaleContextVisible: true,
    setViewMode: (viewMode) => set({ viewMode }),
    setGaleContextVisible: (isVisible) => set({ isGaleContextVisible: isVisible }),
});
