// Session sync slice (owner: Lawrence, D-032): two windows of the same browser (for example /tablet
// and /visor side by side) share one live walk through a BroadcastChannel (src/sync/sessionSync.ts).
// One window is the leader: it runs the clock, the scenario and the walk driver; the others mirror it.

import type { StateCreator } from "zustand";

import type { AriadneState } from "./store";



export interface SyncSlice {
    // A random id per window, used to tell our own messages from other windows' messages.
    sessionWindowId: string;
    // True when this window runs the clock, scenario events and task check-off (default: alone = leader).
    isSessionLeader: boolean;
    // Number of other windows heard from recently (0 = alone).
    connectedWindowCount: number;
    setSessionLeader: (isLeader: boolean) => void;
    setConnectedWindowCount: (count: number) => void;
}



function makeWindowId(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return `window_${Math.random().toString(36).slice(2)}`;
}



export const createSyncSlice: StateCreator<AriadneState, [], [], SyncSlice> = (set) => ({
    sessionWindowId: makeWindowId(),
    isSessionLeader: true,
    connectedWindowCount: 0,
    setSessionLeader: (isLeader) => set({ isSessionLeader: isLeader }),
    setConnectedWindowCount: (count) => set({ connectedWindowCount: Math.max(count, 0) }),
});
