// Chooser at "/" (owner: Lawrence, D-031 follow-up): pick the tablet app or the helmet visor. Two
// large cards side by side on desktop, stacked on phone. Square corners, 1 px phosphor lines, 64 px
// or taller targets (glove-friendly), no paragraphs (visual_direction.md 6.1). On a PC, SIDE BY SIDE
// turns this tab into the tablet and opens the visor on the right half of the screen (section 7).

import { useState } from "react";

import { TABLET_PATH, VISOR_PATH } from "./appRoutes";
import { openSideBySide, SIDE_BY_SIDE_BLOCKED } from "./sideBySide";



const CARD_CLASS =
    "flex min-h-16 flex-1 flex-col gap-3 border border-ariadne-border p-5 hover:border-ariadne-accent hover:bg-ariadne-panel focus-visible:outline focus-visible:outline-1 focus-visible:outline-ariadne-accent sm:p-6";

const SIDE_BY_SIDE_CLASS =
    "flex h-16 w-full items-center justify-between gap-4 border border-ariadne-accent bg-ariadne-accent px-5 text-ariadne-background hover:bg-ariadne-accent-dim focus-visible:outline focus-visible:outline-1 focus-visible:outline-ariadne-accent";



export function ChooserPage() {
    const [sideBySideBlocked, setSideBySideBlocked] = useState(false);

    function handleSideBySide() {
        const result = openSideBySide();
        setSideBySideBlocked(result === SIDE_BY_SIDE_BLOCKED);
    }

    return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-6 overflow-y-auto bg-ariadne-background p-4 text-ariadne-text">
            <div className="flex flex-col items-center gap-1">
                <div className="ariadne-display ariadne-glow text-5xl text-ariadne-accent sm:text-6xl">ARIADNE</div>
                <div className="text-xs text-ariadne-muted">Best viewed on a PC or monitor</div>
            </div>
            <div className="ariadne-display text-2xl text-ariadne-muted">Pick a display</div>
            <div className="hidden w-full max-w-3xl flex-col gap-2 md:flex">
                <button type="button" className={SIDE_BY_SIDE_CLASS} onClick={handleSideBySide}>
                    <span className="ariadne-display text-3xl">SIDE BY SIDE</span>
                    <span className="text-sm">Tablet here, visor in a window on the right</span>
                </button>
                {sideBySideBlocked ? (
                    <div className="text-xs text-ariadne-caution">
                        Your browser blocked the visor window. Allow pop-ups for this site, or open VISOR yourself.
                    </div>
                ) : null}
                <div className="text-center text-xs text-ariadne-dim">
                    Tip: snap this tab to the left half (Windows: Win + Left arrow, macOS: drag to the left edge).
                </div>
            </div>
            <nav className="flex w-full max-w-3xl flex-col gap-4 sm:flex-row" aria-label="Displays">
                <a href={TABLET_PATH} className={CARD_CLASS}>
                    <span className="ariadne-display text-4xl text-ariadne-accent">TABLET</span>
                    <span className="text-sm text-ariadne-muted">Plan and navigate the Marswalk</span>
                    <span className="ariadne-display mt-auto text-xl text-ariadne-accent">OPEN &gt;</span>
                </a>
                <a href={VISOR_PATH} className={CARD_CLASS}>
                    <span className="ariadne-display text-4xl text-ariadne-accent">VISOR</span>
                    <span className="text-sm text-ariadne-muted">Helmet heads-up display while walking</span>
                    <span className="ariadne-display mt-auto text-xl text-ariadne-accent">OPEN &gt;</span>
                </a>
            </nav>
            <div className="text-center text-xs text-ariadne-dim">Open both in two windows: they stay in sync.</div>
        </div>
    );
}
