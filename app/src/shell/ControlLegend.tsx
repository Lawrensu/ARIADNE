// Control legend along the bottom of the map (owner: Lawrence, redesign D-031, visual_direction.md
// 6.2): real buttons, not just hints. Zoom out and in, Center on me, Reset view, 2D/3D and Legend.
// Each button only calls a store action; the camera rig (src/scene/) reacts to the requests.
// 48 px targets; labels shorten on a phone so the row fits at 375 px.

import { useAriadneStore } from "../state/store";
import type { ViewMode } from "../state/viewSlice";



const BUTTON_LAYOUT_CLASS = "flex h-12 min-w-12 shrink-0 items-center justify-center border";
const BUTTON_IDLE_COLOUR_CLASS =
    "border-ariadne-border bg-ariadne-overlay text-ariadne-text hover:border-ariadne-accent active:bg-ariadne-accent active:text-ariadne-background";
// Filled phosphor: the one "on" state in the row (Center on me while the camera follows the astronaut).
const BUTTON_ACTIVE_COLOUR_CLASS = "border-ariadne-accent bg-ariadne-accent text-ariadne-background";
const BUTTON_FRAME_CLASS = `${BUTTON_LAYOUT_CLASS} ${BUTTON_IDLE_COLOUR_CLASS}`;
// px-1.5 on a phone so all six controls fit one row at 375 px; roomier from 640 px.
const BUTTON_TEXT_CLASS = "px-1.5 text-xs uppercase tracking-wider sm:px-3";
const BUTTON_CLASS = `${BUTTON_FRAME_CLASS} ${BUTTON_TEXT_CLASS}`;
const ACTIVE_BUTTON_CLASS = `${BUTTON_LAYOUT_CLASS} ${BUTTON_ACTIVE_COLOUR_CLASS} ${BUTTON_TEXT_CLASS}`;
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


// "Center on me" doubles as the follow indicator, like the recentre button of a navigation app:
// filled while the camera follows the astronaut ("Following" from 640 px, still "Center" on a phone
// so the row fits at 375 px); outlined when following is off or paused, and a tap resumes it.
function CenterOnMeButton() {
    const isFollowingAstronaut = useAriadneStore((state) => state.isFollowingAstronaut);
    const requestCenterOnAstronaut = useAriadneStore((state) => state.requestCenterOnAstronaut);

    if (isFollowingAstronaut) {
        return (
            <button
                type="button"
                className={ACTIVE_BUTTON_CLASS}
                aria-label="Center on me"
                aria-pressed={true}
                title="Following the astronaut"
                onClick={requestCenterOnAstronaut}
            >
                <span className="sm:hidden">Center</span>
                <span className="hidden sm:inline">Following</span>
            </button>
        );
    }
    return (
        <button
            type="button"
            className={BUTTON_CLASS}
            aria-label="Center on me"
            aria-pressed={false}
            onClick={requestCenterOnAstronaut}
        >
            Center<span className="hidden sm:inline">&nbsp;on me</span>
        </button>
    );
}



export function ControlLegend() {
    const viewMode = useAriadneStore((state) => state.viewMode);
    const requestZoomStep = useAriadneStore((state) => state.requestZoomStep);
    const requestViewReset = useAriadneStore((state) => state.requestViewReset);
    const isLayersPopoverOpen = useAriadneStore((state) => state.isLayersPopoverOpen);
    const setLayersPopoverOpen = useAriadneStore((state) => state.setLayersPopoverOpen);

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
                <CenterOnMeButton />
                {/* "view" is hidden on a phone. The space is a non-breaking one inside the span: a plain
                    trailing space after "Reset" is dropped because the button is a flex container. */}
                <button type="button" className={BUTTON_CLASS} aria-label="Reset view" onClick={() => requestViewReset(viewMode)}>
                    Reset<span className="hidden sm:inline">&nbsp;view</span>
                </button>
                <ViewModeButton />
                {/* LAYERS opens the floating layer list (toggles, colour keys, "Full key" for markers). */}
                <button
                    type="button"
                    className={isLayersPopoverOpen ? ACTIVE_BUTTON_CLASS : BUTTON_CLASS}
                    aria-pressed={isLayersPopoverOpen}
                    onClick={() => setLayersPopoverOpen(!isLayersPopoverOpen)}
                >
                    Layers
                </button>
            </div>
            {/* The hint matches the active camera: the 2D map cannot rotate; in 3D the left drag orbits. */}
            <p className="hidden text-xs text-ariadne-dim lg:block">
                {viewMode === "planning_table" ? "drag pan · wheel zoom" : "drag rotate · right-drag pan · wheel zoom"}
            </p>
        </div>
    );
}
