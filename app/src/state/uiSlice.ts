// UI slice (owner: Letta, Stage 3; mode tabs added in the interface redesign, D-031): which mode tab
// is active, the system menu and map legend overlays, and the CRT effect toggle. Added next to
// Malissa's slices; no existing field is renamed or removed (D-012).
//
// The mode shown on screen is: isSuitHudOpen (hudSlice) ? "suit" : activeMode. The SUIT tab opens
// the Suit HUD; MAP, PLAN and DATA close it and set activeMode.

import type { StateCreator } from "zustand";

import type { AriadneState } from "./store";



// "map": the map with the objective card, alerts and control legend.
// "plan": the map plus the plan sheet (science plan, route between two places).
// "data": the map plus the data sheet (layers, Knots, Mars time, Gale context).
export type AppMode = "map" | "plan" | "data";

// What the tab bar shows: the three map modes plus "suit" (the Suit HUD is open).
export type ShownMode = AppMode | "suit";



// Deprecated (D-031): the four-tab side panel was replaced by the mode tabs. Kept for old readers.
export type PanelTab = "plan" | "route" | "layers" | "time";

// Deprecated (D-031): see PanelTab.
export const PANEL_TABS: PanelTab[] = ["plan", "route", "layers", "time"];

// Deprecated (D-031): see PanelTab.
export const PANEL_TAB_LABELS: Record<PanelTab, string> = {
    plan: "Plan",
    route: "Route",
    layers: "Layers",
    time: "Time",
};



export interface UiSlice {
    // Deprecated (D-031): the side panel drawer no longer exists. Nothing reads it.
    isPanelOpen: boolean;
    // Deprecated (D-031): replaced by activeMode. Nothing reads it.
    activePanel: PanelTab;
    // Off by default: scanlines, curvature and grain are decoration, never needed to read a number.
    crtEffectsEnabled: boolean;
    // The map mode chosen with the MAP, PLAN and DATA tabs (D-031). "map" by default.
    activeMode: AppMode;
    // The gear menu in the tab bar (demo, walk, CRT, credits).
    isSystemMenuOpen: boolean;
    // The marker, line and layer legend opened from the control legend.
    isMapLegendOpen: boolean;
    // Deprecated (D-031): see isPanelOpen.
    setPanelOpen: (isOpen: boolean) => void;
    // Deprecated (D-031): see activePanel.
    setActivePanel: (panel: PanelTab) => void;
    setCrtEffectsEnabled: (isEnabled: boolean) => void;
    setActiveMode: (mode: AppMode) => void;
    setSystemMenuOpen: (isOpen: boolean) => void;
    setMapLegendOpen: (isOpen: boolean) => void;
}



export const createUiSlice: StateCreator<AriadneState, [], [], UiSlice> = (set) => ({
    isPanelOpen: false,
    activePanel: "plan",
    crtEffectsEnabled: false,
    activeMode: "map",
    isSystemMenuOpen: false,
    isMapLegendOpen: false,

    setPanelOpen: (isOpen) => set({ isPanelOpen: isOpen }),
    setActivePanel: (panel) => set({ activePanel: panel, isPanelOpen: true }),
    setCrtEffectsEnabled: (isEnabled) => set({ crtEffectsEnabled: isEnabled }),
    setActiveMode: (mode) => set({ activeMode: mode }),
    setSystemMenuOpen: (isOpen) => set({ isSystemMenuOpen: isOpen }),
    setMapLegendOpen: (isOpen) => set({ isMapLegendOpen: isOpen }),
});
