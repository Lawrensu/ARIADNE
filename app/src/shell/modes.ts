// Mode switching for the tab bar (owner: Lawrence, redesign D-031). One way to get anywhere: the
// mode tabs. The shown mode is "suit" while the Suit HUD is open, else the chosen map mode. The VISOR
// tab is a link to the visor page in its own window, not a map mode (routes/appRoutes.ts).

import type { AppMode, ShownMode } from "../state/uiSlice";
import { useAriadneStore } from "../state/store";



export const VISOR_TAB = "visor";

export type TabId = AppMode | typeof VISOR_TAB;

export const MODE_TABS: TabId[] = ["map", "plan", VISOR_TAB, "data"];

export const MODE_TAB_LABELS: Record<TabId, string> = {
    map: "MAP",
    plan: "PLAN",
    visor: "VISOR",
    data: "DATA",
};

export const VISOR_HREF = "/visor";



export function useShownMode(): ShownMode {
    const isSuitHudOpen = useAriadneStore((state) => state.isSuitHudOpen);
    const activeMode = useAriadneStore((state) => state.activeMode);
    if (isSuitHudOpen) {
        return "suit";
    }
    return activeMode;
}



// MAP, PLAN and DATA close the Suit HUD first, then set the map mode.
export function selectMode(mode: AppMode): void {
    const state = useAriadneStore.getState();
    state.setSystemMenuOpen(false);
    state.setSuitHudOpen(false);
    state.setActiveMode(mode);
}
