// Inspect slice: the "Here" data card and the LAYERS popover over the map (owner: Malissa).
// inspectedPosition is a point the user tapped on the terrain; null means the card shows the
// astronaut's own spot. Positions are local grid metres, never latitude and longitude (D-005).

import type { StateCreator } from "zustand";

import type { LocalPosition } from "../data/contracts";
import type { AriadneState } from "./store";



export interface InspectSlice {
    // The tapped terrain point, or null to show the astronaut's own position.
    inspectedPosition: LocalPosition | null;
    // True while the floating LAYERS popover is open.
    isLayersPopoverOpen: boolean;
    setInspectedPosition: (position: LocalPosition) => void;
    clearInspectedPosition: () => void;
    setLayersPopoverOpen: (isOpen: boolean) => void;
}



export const createInspectSlice: StateCreator<AriadneState, [], [], InspectSlice> = (set) => ({
    inspectedPosition: null,
    isLayersPopoverOpen: false,

    setInspectedPosition: (position) => set({ inspectedPosition: { x_m: position.x_m, z_m: position.z_m } }),

    clearInspectedPosition: () => set({ inspectedPosition: null }),

    setLayersPopoverOpen: (isOpen) => set({ isLayersPopoverOpen: isOpen }),
});
