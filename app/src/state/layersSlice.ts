// Layers slice: which overlays are drawn on the terrain (owner: Malissa, Stage 2).
// Overlay ids are descriptive strings; the ones backed by a grid match meta.json layer_id.

import type { StateCreator } from "zustand";

import type { AriadneState } from "./store";



// "no_go": cells where traversal_penalty is +Infinity (derived from the traversal_penalty layer).
// "rocks": rocks.json drawn as instanced markers.
// The others are meta.json layer_ids drawn with a colour map.
export type OverlayLayerId =
    | "no_go"
    | "slope_degrees"
    | "sky_view_factor"
    | "thermal_inertia"
    | "mineralogy_class"
    | "viewshed_rover"
    | "rocks";


export const OVERLAY_LAYER_IDS: OverlayLayerId[] = [
    "no_go",
    "slope_degrees",
    "sky_view_factor",
    "thermal_inertia",
    "mineralogy_class",
    "viewshed_rover",
    "rocks",
];


export interface LayersSlice {
    visibleOverlays: Record<OverlayLayerId, boolean>;
    overlayOpacity: number;
    setOverlayVisible: (layerId: OverlayLayerId, isVisible: boolean) => void;
    toggleOverlay: (layerId: OverlayLayerId) => void;
    setOverlayOpacity: (opacity: number) => void;
}



export const createLayersSlice: StateCreator<AriadneState, [], [], LayersSlice> = (set) => ({
    visibleOverlays: {
        no_go: true,
        slope_degrees: false,
        sky_view_factor: false,
        thermal_inertia: false,
        mineralogy_class: false,
        viewshed_rover: false,
        rocks: false,
    },
    overlayOpacity: 0.55,

    setOverlayVisible: (layerId, isVisible) =>
        set((state) => ({ visibleOverlays: { ...state.visibleOverlays, [layerId]: isVisible } })),

    toggleOverlay: (layerId) =>
        set((state) => ({
            visibleOverlays: { ...state.visibleOverlays, [layerId]: !state.visibleOverlays[layerId] },
        })),

    setOverlayOpacity: (opacity) => set({ overlayOpacity: Math.min(Math.max(opacity, 0), 1) }),
});
