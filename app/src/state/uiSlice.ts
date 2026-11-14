// UI slice (owner: Letta, Stage 3): which panel tab is open, whether the panel drawer is open,
// and the CRT effect toggle. Added next to Malissa's slices; no existing field is renamed (D-012).

import type { StateCreator } from "zustand";

import type { AriadneState } from "./store";



// One main action per tab: Plan = "Plan all Knots", Route = "Plan route",
// Layers = layer toggles, Time = clock and scenario.
export type PanelTab = "plan" | "route" | "layers" | "time";

export const PANEL_TABS: PanelTab[] = ["plan", "route", "layers", "time"];

export const PANEL_TAB_LABELS: Record<PanelTab, string> = {
    plan: "Plan",
    route: "Route",
    layers: "Layers",
    time: "Time",
};



export interface UiSlice {
    isPanelOpen: boolean;
    activePanel: PanelTab;
    // Off by default: scanlines, curvature and grain are decoration, never needed to read a number.
    crtEffectsEnabled: boolean;
    setPanelOpen: (isOpen: boolean) => void;
    setActivePanel: (panel: PanelTab) => void;
    setCrtEffectsEnabled: (isEnabled: boolean) => void;
}



export const createUiSlice: StateCreator<AriadneState, [], [], UiSlice> = (set) => ({
    // Closed on a phone so the map opens full bleed (D-029); open on tablet and desktop, where the
    // panel is a static column or a side drawer.
    isPanelOpen: typeof window === "undefined" ? true : window.innerWidth >= 768,
    activePanel: "plan",
    crtEffectsEnabled: false,

    setPanelOpen: (isOpen) => set({ isPanelOpen: isOpen }),
    setActivePanel: (panel) => set({ activePanel: panel, isPanelOpen: true }),
    setCrtEffectsEnabled: (isEnabled) => set({ crtEffectsEnabled: isEnabled }),
});
