// System menu behind the gear (owner: Lawrence, redesign D-031; walk and demo controls from the old
// WalkDemoPanel, D-030). One main action: "Run demo scenario". Start walk walks the current plan
// from now; Back to rover resets the walk. The astronaut position is simulated on the clock (Mars has
// no GPS) and the menu says so.

import { useCallback, useRef } from "react";

import { scenarioProgress, SOLAR_STORM_SCENARIO } from "../sim/scenarioEngine";
import { runDemoScenario, startWalkNow } from "../sim/walkDriver";
import { useAriadneStore } from "../state/store";
import type { WalkPhase } from "../state/walkSlice";
import { selectMode } from "./modes";
import { useDismiss } from "./useDismiss";



const PHASE_TEXT: Record<WalkPhase, string> = {
    at_rover: "At the rover",
    walking: "Walking",
    at_knot: "At a Knot",
    sheltering: "Sheltering",
};

const PRIMARY_BUTTON_CLASS =
    "ariadne-tap w-full border border-ariadne-accent bg-ariadne-accent px-3 text-sm font-bold uppercase tracking-wider text-ariadne-background hover:bg-ariadne-accent-dim";
const SECONDARY_BUTTON_CLASS =
    "ariadne-tap w-full border border-ariadne-border px-2 text-xs uppercase tracking-wider text-ariadne-text hover:border-ariadne-accent disabled:cursor-not-allowed disabled:opacity-50";



function ScenarioStatusLine() {
    const scenarioStatus = useAriadneStore((state) => state.scenarioStatus);
    const scenarioEventIndex = useAriadneStore((state) => state.scenarioEventIndex);
    const scenarioRunCount = useAriadneStore((state) => state.scenarioRunCount);
    const walkPhase = useAriadneStore((state) => state.walkPhase);
    const walkDetour = useAriadneStore((state) => state.walkDetour);

    const progress = scenarioProgress(SOLAR_STORM_SCENARIO, scenarioEventIndex);

    let scenarioText = "not started";
    if (scenarioStatus === "running") {
        scenarioText = `${progress.fired_count} of ${progress.total_count} events`;
    } else if (scenarioStatus === "complete") {
        scenarioText = `done, ${progress.total_count} events`;
    }
    if (scenarioRunCount > 1) {
        scenarioText += ` (run ${scenarioRunCount})`;
    }

    let walkText = PHASE_TEXT[walkPhase];
    if (walkDetour !== null && walkPhase === "walking") {
        walkText = `To ${walkDetour.target_label}`;
    }

    return (
        <dl className="grid grid-cols-[5.5rem_1fr] gap-x-2 gap-y-1 text-sm">
            <dt className="text-ariadne-dim">Scenario</dt>
            <dd className="text-ariadne-data">{scenarioText}</dd>
            <dt className="text-ariadne-dim">You</dt>
            <dd>
                <span className="text-ariadne-data">{walkText}</span>
                <span className="block text-xs text-ariadne-dim">position simulated</span>
            </dd>
        </dl>
    );
}



export function SystemMenu() {
    const sciencePlan = useAriadneStore((state) => state.sciencePlan);
    const walkStartedAtSimSeconds = useAriadneStore((state) => state.walkStartedAtSimSeconds);
    const resetWalk = useAriadneStore((state) => state.resetWalk);
    const crtEffectsEnabled = useAriadneStore((state) => state.crtEffectsEnabled);
    const setCrtEffectsEnabled = useAriadneStore((state) => state.setCrtEffectsEnabled);
    const setSystemMenuOpen = useAriadneStore((state) => state.setSystemMenuOpen);

    const menuRef = useRef<HTMLDivElement>(null);
    const closeMenu = useCallback(() => setSystemMenuOpen(false), [setSystemMenuOpen]);
    useDismiss(menuRef, true, closeMenu, "[data-system-menu-toggle]");

    function onRunDemoClicked() {
        // The demo plays on the map, so go there and get the menu out of the way.
        selectMode("map");
        void runDemoScenario();
    }

    function onStartWalkClicked() {
        startWalkNow();
        closeMenu();
    }

    function onBackToRoverClicked() {
        resetWalk();
        closeMenu();
    }

    let crtButtonClass = "ariadne-tap min-w-20 border px-3 text-xs uppercase tracking-wider ";
    if (crtEffectsEnabled) {
        crtButtonClass += "border-ariadne-accent bg-ariadne-accent text-ariadne-background";
    } else {
        crtButtonClass += "border-ariadne-border text-ariadne-muted hover:border-ariadne-accent";
    }

    return (
        <div
            ref={menuRef}
            role="menu"
            aria-label="System"
            className="ariadne-bracketed absolute left-1 top-full z-50 mt-1 flex w-[min(21rem,calc(100vw-0.5rem))] flex-col gap-3 border border-ariadne-accent bg-ariadne-panel p-3 text-ariadne-text sm:left-2"
        >
            <div className="flex items-center justify-between gap-2">
                <span className="ariadne-display text-2xl text-ariadne-accent">SYSTEM</span>
                <button
                    type="button"
                    className="ariadne-tap min-w-12 border border-ariadne-border px-3 text-xs uppercase tracking-wider hover:border-ariadne-accent"
                    onClick={closeMenu}
                >
                    Close
                </button>
            </div>

            <div className="flex flex-col gap-1">
                <button type="button" role="menuitem" className={PRIMARY_BUTTON_CLASS} onClick={onRunDemoClicked}>
                    Run demo scenario
                </button>
                <p className="text-xs text-ariadne-dim">All Knots, solar storm on the way, reroute.</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
                <button
                    type="button"
                    role="menuitem"
                    className={SECONDARY_BUTTON_CLASS}
                    disabled={sciencePlan === null}
                    title={sciencePlan === null ? "Plan a walk first (PLAN)." : undefined}
                    onClick={onStartWalkClicked}
                >
                    Start walk
                </button>
                <button
                    type="button"
                    role="menuitem"
                    className={SECONDARY_BUTTON_CLASS}
                    disabled={walkStartedAtSimSeconds === null}
                    onClick={onBackToRoverClicked}
                >
                    Back to rover
                </button>
            </div>

            <ScenarioStatusLine />

            <div className="flex items-center justify-between gap-2 border-t border-ariadne-border pt-3">
                <span className="text-sm">CRT effects</span>
                <button
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={crtEffectsEnabled}
                    className={crtButtonClass}
                    onClick={() => setCrtEffectsEnabled(!crtEffectsEnabled)}
                >
                    {crtEffectsEnabled ? "On" : "Off"}
                </button>
            </div>

            <p className="border-t border-ariadne-border pt-2 text-xs text-ariadne-dim">
                ARIADNE. Public NASA data: HiRISE, MSL REMS and RAD, CRISM, THEMIS. Replayed, not live.
            </p>
        </div>
    );
}
