// View reset slice (owner: Letta, Stage 3): one button in the status strip asks the active
// camera rig to return to its start framing. The counter makes repeated taps trigger again.

import type { StateCreator } from "zustand";

import type { AriadneState } from "./store";



export type ResetViewId = "planning_table" | "labyrinth_view";



export interface ViewResetSlice {
    // Increments on every request; the camera rig watches it together with lastResetView.
    viewResetRequestId: number;
    lastResetView: ResetViewId | null;
    requestViewReset: (view: ResetViewId) => void;
}



export const createViewResetSlice: StateCreator<AriadneState, [], [], ViewResetSlice> = (set) => ({
    viewResetRequestId: 0,
    lastResetView: null,

    requestViewReset: (view) =>
        set((state) => ({ viewResetRequestId: state.viewResetRequestId + 1, lastResetView: view })),
});
