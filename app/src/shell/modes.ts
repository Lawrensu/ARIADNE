// Mode switching for the tab bar (owner: Lawrence, redesign D-031). One way to get anywhere: the
// mode tabs. The shown mode is "suit" while the Suit HUD is open, else the chosen map mode.

import type { AppMode, ShownMode } from "../state/uiSlice";
import { useAriadneStore } from "../state/store";



export const MODE_TABS: ShownMode[] = ["map", "plan", "suit", "data"];

export const MODE_TAB_LABELS: Record<ShownMode, string> = {
    map: "MAP",
    plan: "PLAN",
    suit: "SUIT",
    data: "DATA",
};



export function useShownMode(): ShownMode {
    const isSuitHudOpen = useAriadneStore((state) => state.isSuitHudOpen);
    const activeMode = useAriadneStore((state) => state.activeMode);
    if (isSuitHudOpen) {
        return "suit";
    }
    return activeMode;
}



// SUIT opens the Suit HUD; MAP, PLAN and DATA close it first, then set the map mode.
export function selectMode(mode: ShownMode): void {
    const state = useAriadneStore.getState();
    state.setSystemMenuOpen(false);
    if (mode === "suit") {
        state.setSuitHudOpen(true);
        return;
    }
    const mapMode: AppMode = mode;
    state.setSuitHudOpen(false);
    state.setActiveMode(mapMode);
}
