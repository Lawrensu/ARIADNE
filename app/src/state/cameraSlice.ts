// Camera request slice (owner: Lawrence, redesign D-031): buttons outside the 3D scene ask the
// camera rig to do something. Each request bumps a counter, so repeated taps trigger again; the
// camera rig in src/scene/CameraRig.tsx watches the counters. Reset view stays in viewResetSlice.ts.

import type { StateCreator } from "zustand";

import type { AriadneState } from "./store";



export interface CameraSlice {
    // Increments on every "Center on me": the camera moves to the astronaut (or the rover).
    centerOnAstronautRequestId: number;
    // Increments on every zoom button tap; zoomStepDirection says which way (+1 in, -1 out).
    zoomStepRequestId: number;
    zoomStepDirection: number;
    requestCenterOnAstronaut: () => void;
    requestZoomStep: (direction: number) => void;
}



export const createCameraSlice: StateCreator<AriadneState, [], [], CameraSlice> = (set) => ({
    centerOnAstronautRequestId: 0,
    zoomStepRequestId: 0,
    zoomStepDirection: 1,

    requestCenterOnAstronaut: () =>
        set((state) => ({ centerOnAstronautRequestId: state.centerOnAstronautRequestId + 1 })),

    requestZoomStep: (direction) =>
        set((state) => {
            let normalizedDirection = 1;
            if (direction < 0) {
                normalizedDirection = -1;
            }
            return { zoomStepRequestId: state.zoomStepRequestId + 1, zoomStepDirection: normalizedDirection };
        }),
});
