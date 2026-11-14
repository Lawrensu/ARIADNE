// Mode tab bar across the top (owner: Lawrence, redesign D-031, app/design/visual_direction.md 6.2).
// Gear (system menu), then MAP, PLAN, SUIT and DATA as large uppercase tabs, and a REPLAY badge on
// the right. The active tab is filled phosphor green and sits on the frame line below it, so the two
// read as one shape. This is the only way to move between modes (rule 6.1.2).

import { useCallback, useRef, useState } from "react";

import { useAriadneStore } from "../state/store";
import { MODE_TAB_LABELS, MODE_TABS, selectMode, useShownMode } from "./modes";
import { SystemMenu } from "./SystemMenu";
import { useDismiss } from "./useDismiss";



function GearIcon() {
    // Eight square teeth around a ring: drawn for ARIADNE, square corners like the rest of the frame.
    const teeth = [0, 45, 90, 135, 180, 225, 270, 315];
    return (
        <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
            {teeth.map((angle) => (
                <rect key={angle} x="10.5" y="1.5" width="3" height="4" fill="currentColor" transform={`rotate(${angle} 12 12)`} />
            ))}
            <circle cx="12" cy="12" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
            <rect x="10.5" y="10.5" width="3" height="3" fill="currentColor" />
        </svg>
    );
}



function GearButton() {
    const isSystemMenuOpen = useAriadneStore((state) => state.isSystemMenuOpen);
    const setSystemMenuOpen = useAriadneStore((state) => state.setSystemMenuOpen);

    let className =
        "flex h-full w-12 shrink-0 sm:w-14 items-center justify-center border-r border-ariadne-border focus-visible:outline focus-visible:outline-1 focus-visible:outline-ariadne-accent ";
    if (isSystemMenuOpen) {
        className += "bg-ariadne-accent text-ariadne-background";
    } else {
        className += "text-ariadne-accent hover:bg-ariadne-panel-raised";
    }

    return (
        <button
            type="button"
            className={className}
            aria-label="System menu"
            aria-expanded={isSystemMenuOpen}
            aria-haspopup="menu"
            data-system-menu-toggle=""
            onClick={() => setSystemMenuOpen(!isSystemMenuOpen)}
        >
            <GearIcon />
        </button>
    );
}



function ModeTabs() {
    const shownMode = useShownMode();

    return (
        <nav className="flex min-w-0 flex-1 items-end gap-0.5 px-1 sm:gap-1 sm:px-2" aria-label="Modes">
            {MODE_TABS.map((mode) => {
                const isActive = mode === shownMode;
                // -mb-px lets the tab cover the frame line, so the filled tab joins it (the notch).
                let className =
                    "ariadne-display -mb-px flex h-12 min-w-0 flex-1 items-center justify-center border border-b-0 px-0.5 text-xl leading-none sm:w-24 sm:flex-none sm:px-1 sm:text-2xl lg:w-28 lg:text-[1.75rem] ";
                if (isActive) {
                    className += "border-ariadne-accent bg-ariadne-accent text-ariadne-background";
                } else {
                    className += "border-transparent text-ariadne-muted hover:border-ariadne-border hover:text-ariadne-text";
                }
                return (
                    <button
                        key={mode}
                        type="button"
                        className={className}
                        aria-current={isActive ? "page" : undefined}
                        onClick={() => selectMode(mode)}
                    >
                        {MODE_TAB_LABELS[mode]}
                    </button>
                );
            })}
        </nav>
    );
}



function ReplayBadge() {
    const processedData = useAriadneStore((state) => state.processedData);
    const [isInfoOpen, setInfoOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const closeInfo = useCallback(() => setInfoOpen(false), []);
    useDismiss(containerRef, isInfoOpen, closeInfo);

    let solText = "unknown";
    if (processedData !== null) {
        solText = String(processedData.environmentTimeline.replay_source.sol);
    }

    return (
        <div ref={containerRef} className="relative flex shrink-0 items-center pr-1 sm:pr-2">
            <button
                type="button"
                className="flex h-12 items-center px-1"
                aria-expanded={isInfoOpen}
                aria-label="Replay: what this means"
                onClick={() => setInfoOpen(!isInfoOpen)}
            >
                <span className="border border-ariadne-data px-1.5 py-0.5 text-xs tracking-wider text-ariadne-data">REPLAY</span>
            </button>
            {isInfoOpen && (
                <div className="absolute right-1 top-full z-50 mt-1 w-[min(18rem,calc(100vw-1rem))] border border-ariadne-data bg-ariadne-panel p-3 text-sm">
                    <p>Real NASA data, replayed on the sim clock. Not live.</p>
                    <p className="mt-1 text-xs text-ariadne-muted">
                        Weather: REMS sol {solText}. Storm: RAD sol 4190, another date.
                    </p>
                </div>
            )}
        </div>
    );
}



export function TabBar() {
    const isSystemMenuOpen = useAriadneStore((state) => state.isSystemMenuOpen);

    return (
        <header className="relative z-50 flex h-[var(--ariadne-tab-bar-height)] shrink-0 items-stretch border-b border-ariadne-accent bg-ariadne-background">
            <GearButton />
            <ModeTabs />
            <span className="ariadne-display ariadne-glow hidden shrink-0 items-center px-2 text-2xl text-ariadne-accent lg:flex">
                ARIADNE
            </span>
            <ReplayBadge />
            {isSystemMenuOpen && <SystemMenu />}
        </header>
    );
}
