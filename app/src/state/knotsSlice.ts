// Knot card slice (owner: Letta, Stage 3, built by the Knots sub-agent): which Knot card is open.
// The photos are copied into app/public/knots/ with credits, so the demo never needs the network.

import type { StateCreator } from "zustand";

import type { AriadneState } from "./store";



export interface KnotsSlice {
    selectedKnotId: string | null;
    isKnotCardOpen: boolean;
    setSelectedKnot: (knotId: string | null) => void;
    setKnotCardOpen: (isOpen: boolean) => void;
}



export const createKnotsSlice: StateCreator<AriadneState, [], [], KnotsSlice> = (set) => ({
    selectedKnotId: null,
    isKnotCardOpen: false,

    setSelectedKnot: (knotId) => set({ selectedKnotId: knotId, isKnotCardOpen: knotId !== null }),
    setKnotCardOpen: (isOpen) => set({ isKnotCardOpen: isOpen }),
});
