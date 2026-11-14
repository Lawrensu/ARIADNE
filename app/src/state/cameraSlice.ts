// Camera request slice (owner: Lawrence, redesign D-031): buttons outside the 3D scene ask the
// camera rig to do something. Each request bumps a counter, so repeated taps trigger again; the
// camera rig in src/scene/CameraRig.tsx watches the counters. Reset view stays in viewResetSlice.ts.
//
// Follow mode (navigation style): during a walk the camera follows the astronaut. Touching the map
// pauses it; the camera rig resumes it after FOLLOW_RESUME_DELAY_SECONDS (src/scene/followCamera.ts)
// and "Center on me" resumes it at once. The follow fields live here so the control legend can show
// the state and both cameras (2D and 3D) share it across a view switch.

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

    // True while the camera rig is following the astronaut this frame (written by the camera rig).
    isFollowingAstronaut: boolean;
    // True after the user dragged, zoomed or rotated the map, or tapped Reset view, during a walk.
    followPausedByUser: boolean;
    // Real time (performance.now() in seconds) of the last map interaction that paused following.
    lastMapInteractionAtRealSeconds: number | null;
    // The user touched the map (or reset the view) at `atRealSeconds`: following waits.
    pauseFollowingAstronaut: (atRealSeconds: number) => void;
    // Following may run again (resume delay passed, a new walk started).
    resumeFollowingAstronaut: () => void;
    setIsFollowingAstronaut: (isFollowing: boolean) => void;

    // Screen pixels to the right of the map centre where the followed astronaut should sit (0 = centre).
    // Set by the map overlays while a sheet is docked over the left of the map, so the astronaut stays
    // in the visible part of the map.
    followScreenOffsetXPx: number;
    setFollowScreenOffsetXPx: (offsetPx: number) => void;
}



export const createCameraSlice: StateCreator<AriadneState, [], [], CameraSlice> = (set, get) => ({
    centerOnAstronautRequestId: 0,
    zoomStepRequestId: 0,
    zoomStepDirection: 1,
    isFollowingAstronaut: false,
    followPausedByUser: false,
    lastMapInteractionAtRealSeconds: null,
    followScreenOffsetXPx: 0,

    setFollowScreenOffsetXPx: (offsetPx) => {
        if (get().followScreenOffsetXPx === offsetPx) {
            return;
        }
        set({ followScreenOffsetXPx: offsetPx });
    },

    // "Center on me" also resumes following straight away (it is the navigation "recentre" button).
    requestCenterOnAstronaut: () =>
        set((state) => ({
            centerOnAstronautRequestId: state.centerOnAstronautRequestId + 1,
            followPausedByUser: false,
        })),

    requestZoomStep: (direction) =>
        set((state) => {
            let normalizedDirection = 1;
            if (direction < 0) {
                normalizedDirection = -1;
            }
            return { zoomStepRequestId: state.zoomStepRequestId + 1, zoomStepDirection: normalizedDirection };
        }),

    pauseFollowingAstronaut: (atRealSeconds) =>
        set({ followPausedByUser: true, lastMapInteractionAtRealSeconds: atRealSeconds }),

    resumeFollowingAstronaut: () => set({ followPausedByUser: false }),

    // Called every frame by the camera rig, so it only writes (and wakes subscribers) on a change.
    setIsFollowingAstronaut: (isFollowing) => {
        if (get().isFollowingAstronaut === isFollowing) {
            return;
        }
        set({ isFollowingAstronaut: isFollowing });
    },
});
