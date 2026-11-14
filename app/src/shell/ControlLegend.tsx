// Control legend along the bottom of the map (owner: Lawrence, redesign D-031, visual_direction.md
// 6.2): real buttons, not just hints. Zoom out and in, Center on me, Reset view, 2D/3D and Legend.
// Each button only calls a store action; the camera rig (src/scene/) reacts to the requests.
// 48 px targets; labels shorten on a phone so the row fits at 375 px.

import { useAriadneStore } from "../state/store";
import type { ViewMode } from "../state/viewSlice";



const BUTTON_FRAME_CLASS =
    "flex h-12 min-w-12 shrink-0 items-center justify-center border border-ariadne-border bg-ariadne-overlay text-ariadne-text hover:border-ariadne-accent active:bg-ariadne-accent active:text-ariadne-background";
const BUTTON_CLASS = `${BUTTON_FRAME_CLASS} px-2 text-xs uppercase tracking-wider sm:px-3`;
// The zoom glyphs use the display face at HUD size so they read with a glance.
const ZOOM_BUTTON_CLASS = `${BUTTON_FRAME_CLASS} ariadne-display text-[length:var(--ariadne-text-hud)] leading-none`;



function ViewModeButton() {
    const viewMode = useAriadneStore((state) => state.viewMode);
    const setViewMode = useAriadneStore((state) => state.setViewMode);

    let nextMode: ViewMode = "labyrinth_view";
    let nextLabel = "3D";
    if (viewMode === "labyrinth_view") {
        nextMode = "planning_table";
        nextLabel = "2D";
    }
    const is2d = viewMode === "planning_table";

    return (
        <button
            type="button"
            className={`${BUTTON_CLASS} gap-1`}
            aria-label={`Switch to the ${nextLabel} view`}
            onClick={() => setViewMode(nextMode)}
        >
            <span className={is2d ? "font-bold text-ariadne-accent" : "text-ariadne-dim"}>2D</span>
            <span className="text-ariadne-dim" aria-hidden="true">
                /
            </span>
            <span className={is2d ? "text-ariadne-dim" : "font-bold text-ariadne-accent"}>3D</span>
        </button>
    );
}



export function ControlLegend() {
    const viewMode = useAriadneStore((state) => state.viewMode);
    const requestZoomStep = useAriadneStore((state) => state.requestZoomStep);
    const requestCenterOnAstronaut = useAriadneStore((state) => state.requestCenterOnAstronaut);
    const requestViewReset = useAriadneStore((state) => state.requestViewReset);
    const setMapLegendOpen = useAriadneStore((state) => state.setMapLegendOpen);

    return (
        <div className="pointer-events-none absolute inset-x-2 bottom-2 z-30 flex flex-col items-center gap-1">
            <div className="pointer-events-auto flex max-w-full flex-wrap items-stretch justify-center gap-1 sm:gap-2" role="toolbar" aria-label="Map controls">
                <div className="flex">
                    <button
                        type="button"
                        className={ZOOM_BUTTON_CLASS}
                        aria-label="Zoom out"
                        onClick={() => requestZoomStep(-1)}
                    >
                        −
                    </button>
                    <button
                        type="button"
                        className={`${ZOOM_BUTTON_CLASS} -ml-px`}
                        aria-label="Zoom in"
                        onClick={() => requestZoomStep(1)}
                    >
                        +
                    </button>
                </div>
                <button type="button" className={BUTTON_CLASS} aria-label="Center on me" onClick={requestCenterOnAstronaut}>
                    Center<span className="hidden sm:inline">&nbsp;on me</span>
                </button>
                {/* The text reads "Reset view" in the DOM at every width; "view" is hidden on a phone. */}
                <button type="button" className={BUTTON_CLASS} onClick={() => requestViewReset(viewMode)}>
                    Reset <span className="hidden sm:inline">view</span>
                </button>
                <ViewModeButton />
                <button type="button" className={BUTTON_CLASS} onClick={() => setMapLegendOpen(true)}>
                    Legend
                </button>
            </div>
            <p className="hidden text-xs text-ariadne-dim lg:block">drag pan · right-drag rotate · wheel zoom</p>
        </div>
    );
}
