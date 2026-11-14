// Status strip across the top of the app (owner: Letta, Stage 3): wordmark, view switch, replay
// badge, reset view, CRT toggle and the panel button. Kept short so the map gets the height.

import { useAriadneStore } from "../state/store";
import type { ViewMode } from "../state/viewSlice";
import type { ResetViewId } from "../state/viewResetSlice";



const VIEW_MODE_LABELS: Record<ViewMode, string> = {
    planning_table: "Planning Table",
    labyrinth_view: "Labyrinth view",
};

const VIEW_MODES: ViewMode[] = ["planning_table", "labyrinth_view"];



export function ViewSwitch() {
    const viewMode = useAriadneStore((state) => state.viewMode);
    const setViewMode = useAriadneStore((state) => state.setViewMode);

    return (
        <div className="flex border border-ariadne-border" role="group" aria-label="View">
            {VIEW_MODES.map((mode) => {
                const isActive = mode === viewMode;
                let className = "ariadne-tap px-2 text-xs uppercase tracking-wider ";
                if (isActive) {
                    className += "bg-ariadne-accent text-ariadne-background";
                } else {
                    className += "bg-ariadne-panel text-ariadne-muted hover:text-ariadne-text";
                }
                return (
                    <button
                        key={mode}
                        type="button"
                        className={className}
                        aria-pressed={isActive}
                        onClick={() => setViewMode(mode)}
                    >
                        {VIEW_MODE_LABELS[mode]}
                    </button>
                );
            })}
        </div>
    );
}



function ReplayBadge() {
    const processedData = useAriadneStore((state) => state.processedData);
    const sol = processedData === null ? null : processedData.environmentTimeline.replay_source.sol;

    let text = "REPLAY";
    if (sol !== null) {
        text = `REPLAY · REMS sol ${sol}`;
    }

    return (
        <span
            className="hidden border border-ariadne-border px-2 py-1 text-xs text-ariadne-muted sm:inline"
            title="Historical NASA data replayed on the simulation clock, not live data (D-014). The solar storm comes from a different sol than the weather."
        >
            {text}
        </span>
    );
}



export function StatusStrip() {
    const viewMode = useAriadneStore((state) => state.viewMode);
    const requestViewReset = useAriadneStore((state) => state.requestViewReset);
    const crtEffectsEnabled = useAriadneStore((state) => state.crtEffectsEnabled);
    const setCrtEffectsEnabled = useAriadneStore((state) => state.setCrtEffectsEnabled);
    const isPanelOpen = useAriadneStore((state) => state.isPanelOpen);
    const setPanelOpen = useAriadneStore((state) => state.setPanelOpen);

    function onResetViewClicked() {
        const resetId: ResetViewId = viewMode;
        requestViewReset(resetId);
    }

    return (
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-ariadne-border bg-ariadne-panel px-2 xl:px-4">
            <div className="ariadne-display ariadne-glow shrink-0 text-2xl leading-none text-ariadne-accent xl:text-3xl">ARIADNE</div>
            <span className="hidden text-xs text-ariadne-muted lg:inline">Gale Crater · boxwork and Gediz Vallis</span>

            <div className="ml-auto flex items-center gap-1">
                <ReplayBadge />
                <div className="hidden md:block">
                    <ViewSwitch />
                </div>
                <button
                    type="button"
                    className="ariadne-tap border border-ariadne-border px-2 text-xs uppercase tracking-wider text-ariadne-text hover:border-ariadne-accent"
                    onClick={onResetViewClicked}
                >
                    Reset view
                </button>
                <button
                    type="button"
                    className="ariadne-tap hidden border px-2 text-xs uppercase tracking-wider sm:inline-block"
                    style={{
                        borderColor: crtEffectsEnabled ? "var(--ariadne-accent)" : "var(--ariadne-grid-green)",
                        color: crtEffectsEnabled ? "var(--ariadne-accent)" : "var(--ariadne-muted)",
                    }}
                    aria-pressed={crtEffectsEnabled}
                    onClick={() => setCrtEffectsEnabled(!crtEffectsEnabled)}
                    title="Scanlines, grain and slight screen curvature. Off by default for legibility."
                >
                    CRT {crtEffectsEnabled ? "ON" : "OFF"}
                </button>
                <button
                    type="button"
                    className="ariadne-tap min-w-14 border border-ariadne-border px-2 text-xs uppercase tracking-wider text-ariadne-text hover:border-ariadne-accent md:hidden"
                    aria-expanded={isPanelOpen}
                    onClick={() => setPanelOpen(!isPanelOpen)}
                >
                    {isPanelOpen ? "Close" : "Menu"}
                </button>
            </div>
        </header>
    );
}
