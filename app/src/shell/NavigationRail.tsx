// Icon rail on tablet and desktop (owner: Letta, Stage 3). Each tab is 64 px tall, so it works with
// gloves and never needs a hover. Phone uses the bottom sheet tabs instead.

import { PANEL_TABS, PANEL_TAB_LABELS } from "../state/uiSlice";
import { useAriadneStore } from "../state/store";



const RAIL_LABELS: Record<string, string> = {
    plan: "PLAN",
    route: "ROUTE",
    layers: "LAYERS",
    time: "TIME",
};



export function NavigationRail() {
    const activePanel = useAriadneStore((state) => state.activePanel);
    const setActivePanel = useAriadneStore((state) => state.setActivePanel);
    const isPanelOpen = useAriadneStore((state) => state.isPanelOpen);
    const setPanelOpen = useAriadneStore((state) => state.setPanelOpen);

    return (
        <nav
            className="hidden w-[88px] shrink-0 flex-col border-r border-ariadne-border bg-ariadne-panel md:flex"
            aria-label="Control sections"
        >
            {PANEL_TABS.map((tab) => {
                const isActive = tab === activePanel;
                let className = "flex min-h-16 flex-col items-center justify-center border-b border-ariadne-border px-1 text-xs uppercase tracking-wider ";
                if (isActive) {
                    className += "bg-ariadne-accent text-ariadne-background";
                } else {
                    className += "text-ariadne-muted hover:text-ariadne-text";
                }
                return (
                    <button
                        key={tab}
                        type="button"
                        className={className}
                        aria-pressed={isActive}
                        title={PANEL_TAB_LABELS[tab]}
                        onClick={() => {
                            if (isActive && !isPanelOpen) {
                                setPanelOpen(true);
                            }
                            setActivePanel(tab);
                        }}
                    >
                        <span className="ariadne-display text-xl leading-none">{RAIL_LABELS[tab]}</span>
                    </button>
                );
            })}
        </nav>
    );
}
