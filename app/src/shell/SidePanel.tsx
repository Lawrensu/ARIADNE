// The side panel (owner: Letta, Stage 3): four tabs with one main action each. It is a static
// column on desktop, an overlay drawer on tablet and a bottom sheet on phone (D-029), so the map
// always keeps its full size underneath.

import type { ReactNode } from "react";

import { LayerPanel } from "../layers";
import { RoutePlannerPanel } from "../planning/RoutePlannerPanel";
import { SciencePlanPanel } from "../science/ui/SciencePlanPanel";
import { SimClockControls } from "../sim/SimClockControls";
import { PANEL_TABS, PANEL_TAB_LABELS } from "../state/uiSlice";
import { useAriadneStore } from "../state/store";
import { ThreadSummary } from "./ThreadSummary";
import { ViewSwitch } from "./StatusStrip";
import { useViewport } from "./useViewport";



function PanelSection({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="flex flex-col gap-2 border-b border-ariadne-border p-3 last:border-b-0">
            <h2 className="ariadne-display text-xl leading-none text-ariadne-data">{title}</h2>
            {children}
        </section>
    );
}



function TimePanel() {
    const processedData = useAriadneStore((state) => state.processedData);
    const sol = processedData === null ? null : processedData.environmentTimeline.replay_source.sol;

    return (
        <div className="flex flex-col">
            <PanelSection title="Simulation clock">
                <SimClockControls />
            </PanelSection>
            <PanelSection title="The Thread">
                <ThreadSummary />
            </PanelSection>
            <p className="p-3 text-xs text-ariadne-dim">
                {sol === null
                    ? "Historical data replayed on the simulation clock, not live."
                    : `Replaying real Curiosity REMS sol ${sol} and RAD dose rate on the simulation clock, not live data (D-014). The solar storm in the scenario comes from sol 4190, a different date (D-025).`}
            </p>
        </div>
    );
}



function PanelContent() {
    const activePanel = useAriadneStore((state) => state.activePanel);

    if (activePanel === "plan") {
        return (
            <PanelSection title="Science plan">
                <SciencePlanPanel />
            </PanelSection>
        );
    }
    if (activePanel === "route") {
        return (
            <PanelSection title="Route">
                <RoutePlannerPanel />
            </PanelSection>
        );
    }
    if (activePanel === "layers") {
        return (
            <PanelSection title="Map layers">
                <LayerPanel />
            </PanelSection>
        );
    }
    return <TimePanel />;
}



export function SidePanel() {
    const isPanelOpen = useAriadneStore((state) => state.isPanelOpen);
    const setPanelOpen = useAriadneStore((state) => state.setPanelOpen);
    const activePanel = useAriadneStore((state) => state.activePanel);
    const setActivePanel = useAriadneStore((state) => state.setActivePanel);
    const { isPhone, isDesktop } = useViewport();

    let positionClasses = "flex flex-col bg-ariadne-background ";
    if (isDesktop) {
        positionClasses += "relative h-full w-[340px] shrink-0 border-r border-ariadne-border";
    } else if (isPhone) {
        let visibleClasses = "translate-y-full pointer-events-none";
        if (isPanelOpen) {
            visibleClasses = "translate-y-0";
        }
        positionClasses += `fixed inset-x-0 bottom-0 z-40 h-[48vh] border-t-2 border-ariadne-accent transition-transform ${visibleClasses}`;
    } else {
        let visibleClasses = "-translate-x-full pointer-events-none";
        if (isPanelOpen) {
            visibleClasses = "translate-x-0";
        }
        positionClasses += `absolute inset-y-0 left-[88px] z-40 w-[360px] border-r-2 border-ariadne-accent transition-transform ${visibleClasses}`;
    }

    return (
        <aside className={positionClasses} aria-label="Controls">
            {isPhone && (
                <button
                    type="button"
                    className="flex h-10 w-full shrink-0 items-center justify-center border-b border-ariadne-border"
                    onClick={() => setPanelOpen(!isPanelOpen)}
                    aria-label={isPanelOpen ? "Close controls" : "Open controls"}
                >
                    <span className="h-1 w-12 bg-ariadne-grid" />
                </button>
            )}

            <div className="flex shrink-0 items-center justify-between border-b border-ariadne-border px-3 py-2">
                <span className="ariadne-display text-2xl leading-none text-ariadne-accent">CONSOLE</span>
                {!isDesktop && (
                    <button
                        type="button"
                        className="ariadne-tap border border-ariadne-border px-3 text-xs uppercase tracking-wider hover:border-ariadne-accent"
                        onClick={() => setPanelOpen(false)}
                    >
                        Close
                    </button>
                )}
            </div>

            <div className="shrink-0 border-b border-ariadne-border p-2 md:hidden">
                <ViewSwitch />
            </div>

            <nav className="grid shrink-0 grid-cols-4 border-b border-ariadne-border" aria-label="Control sections">
                {PANEL_TABS.map((tab) => {
                    const isActive = tab === activePanel;
                    let className = "ariadne-tap border-r border-ariadne-border px-1 text-xs uppercase tracking-wider last:border-r-0 ";
                    if (isActive) {
                        className += "bg-ariadne-accent text-ariadne-background";
                    } else {
                        className += "bg-ariadne-panel text-ariadne-muted hover:text-ariadne-text";
                    }
                    return (
                        <button
                            key={tab}
                            type="button"
                            className={className}
                            aria-pressed={isActive}
                            onClick={() => setActivePanel(tab)}
                        >
                            {PANEL_TAB_LABELS[tab]}
                        </button>
                    );
                })}
            </nav>

            <div className="ariadne-scroll min-h-0 flex-1 overflow-y-auto">
                <PanelContent />
            </div>
        </aside>
    );
}
