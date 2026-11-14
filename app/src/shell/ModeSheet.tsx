// Mode sheets for PLAN and DATA (owner: Lawrence, redesign D-031, visual_direction.md 6.2). On a
// wide screen (1024 px and up) the sheet is a card floating over the map on the left; on phone and
// tablet it is a bottom sheet with a drag handle and a close button. The map never resizes.
// Closing a sheet returns to MAP. The panels inside are composed here, not edited: this file only
// adds the section headers and the frame.

import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";

import { MarsClock } from "../alerts/MarsClock";
import { patchCentreEastLongitudeDeg } from "../alerts/mars24";
import { KnotList } from "../knots/KnotList";
import { LayerPanel } from "../layers";
import { RoutePlannerPanel } from "../planning/RoutePlannerPanel";
import { GaleContextInset } from "../scene/GaleContextInset";
import { SciencePlanPanel } from "../science/ui/SciencePlanPanel";
import { useAriadneStore } from "../state/store";
import { selectMode, useShownMode } from "./modes";



// Dragging the handle down further than this closes the bottom sheet.
const CLOSE_DRAG_THRESHOLD_PX = 96;



function HelpToggle({ text }: { text: string }) {
    const [isOpen, setOpen] = useState(false);
    return (
        <>
            <button
                type="button"
                className="flex h-12 w-12 shrink-0 items-center justify-center text-ariadne-dim hover:text-ariadne-accent"
                aria-expanded={isOpen}
                aria-label={isOpen ? "Hide help" : "Show help"}
                onClick={() => setOpen(!isOpen)}
            >
                <span className="flex h-6 w-6 items-center justify-center border border-current text-xs">?</span>
            </button>
            {isOpen && <p className="basis-full pb-2 text-xs text-ariadne-muted">{text}</p>}
        </>
    );
}



function SheetSection({ title, help, children }: { title: string; help?: string; children: ReactNode }) {
    return (
        <section className="flex flex-col border-b border-ariadne-border px-3 pb-3 last:border-b-0">
            <div className="flex min-h-12 flex-wrap items-center justify-between">
                <h2 className="text-xs uppercase tracking-widest text-ariadne-accent">{title}</h2>
                {help !== undefined && <HelpToggle text={help} />}
            </div>
            {children}
        </section>
    );
}


// A section folded by default, for secondary tools.
function FoldedSection({ title, children }: { title: string; children: ReactNode }) {
    const [isOpen, setOpen] = useState(false);
    return (
        <section className="flex flex-col border-b border-ariadne-border last:border-b-0">
            <button
                type="button"
                className="flex min-h-12 w-full items-center justify-between gap-2 px-3 text-left text-xs uppercase tracking-widest text-ariadne-accent hover:bg-ariadne-panel-raised"
                aria-expanded={isOpen}
                onClick={() => setOpen(!isOpen)}
            >
                <span>{title}</span>
                <span aria-hidden="true">{isOpen ? "▴" : "▾"}</span>
            </button>
            {isOpen && <div className="px-3 pb-3">{children}</div>}
        </section>
    );
}



function PlanSheetContent() {
    return (
        <>
            <SheetSection title="Science plan">
                <SciencePlanPanel />
            </SheetSection>
            <FoldedSection title="Route between two places">
                <RoutePlannerPanel />
            </FoldedSection>
        </>
    );
}



function MarsTimeSection() {
    const processedData = useAriadneStore((state) => state.processedData);
    const simElapsedSeconds = useAriadneStore((state) => state.simElapsedSeconds);
    if (processedData === null) {
        return null;
    }
    const sol = processedData.environmentTimeline.replay_source.sol;
    return (
        <SheetSection
            title="Mars time"
            help={`Real Curiosity REMS sol ${sol} weather and RAD dose, replayed on the sim clock, not live (D-014). The storm comes from sol 4190, a different date (D-025).`}
        >
            <MarsClock
                simElapsedSeconds={simElapsedSeconds}
                environmentTimeline={processedData.environmentTimeline}
                eastLongitudeDeg={patchCentreEastLongitudeDeg(processedData.meta)}
            />
        </SheetSection>
    );
}


function DataSheetContent() {
    return (
        <>
            <SheetSection title="Layers">
                <LayerPanel />
            </SheetSection>
            <SheetSection title="Knots">
                <KnotList />
            </SheetSection>
            <MarsTimeSection />
            <SheetSection title="Gale context">
                <GaleContextInset />
            </SheetSection>
        </>
    );
}



function CloseButton({ title }: { title: string }) {
    return (
        <button
            type="button"
            className="ariadne-tap min-w-12 shrink-0 border border-ariadne-border px-3 text-xs uppercase tracking-wider hover:border-ariadne-accent"
            aria-label={`Close ${title}, back to the map`}
            onClick={() => selectMode("map")}
        >
            Close
        </button>
    );
}



function DockedSheet({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section
            className="ariadne-bracketed pointer-events-auto flex min-h-0 flex-1 flex-col border border-ariadne-accent bg-ariadne-overlay"
            aria-label={title}
        >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-ariadne-border py-1 pl-3 pr-1">
                <span className="ariadne-display text-2xl leading-none text-ariadne-accent">{title}</span>
                <CloseButton title={title} />
            </div>
            <div className="ariadne-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden">{children}</div>
        </section>
    );
}



function BottomSheet({ title, children }: { title: string; children: ReactNode }) {
    const [dragOffsetPx, setDragOffsetPx] = useState(0);
    const dragStartY = useRef<number | null>(null);

    function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
        dragStartY.current = event.clientY;
        event.currentTarget.setPointerCapture(event.pointerId);
    }

    function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
        if (dragStartY.current === null) {
            return;
        }
        setDragOffsetPx(Math.max(0, event.clientY - dragStartY.current));
    }

    function onPointerEnd() {
        if (dragStartY.current === null) {
            return;
        }
        dragStartY.current = null;
        if (dragOffsetPx > CLOSE_DRAG_THRESHOLD_PX) {
            selectMode("map");
        }
        setDragOffsetPx(0);
    }

    return (
        <section
            className="absolute inset-x-0 bottom-0 z-40 flex h-[var(--ariadne-sheet-phone-height)] max-h-full flex-col border-t border-ariadne-accent bg-ariadne-panel"
            style={{ transform: `translateY(${dragOffsetPx}px)` }}
            aria-label={title}
        >
            <div className="flex shrink-0 items-stretch border-b border-ariadne-border">
                <div
                    className="flex min-h-14 min-w-0 flex-1 cursor-grab touch-none select-none flex-col justify-center gap-1 pl-3"
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerEnd}
                    onPointerCancel={onPointerEnd}
                    aria-label="Drag down to close"
                >
                    <span className="mx-auto h-1 w-12 bg-ariadne-border" aria-hidden="true" />
                    <span className="ariadne-display text-2xl leading-none text-ariadne-accent">{title}</span>
                </div>
                <div className="flex items-center pr-1">
                    <CloseButton title={title} />
                </div>
            </div>
            <div className="ariadne-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden">{children}</div>
        </section>
    );
}



export function ModeSheet({ isDocked }: { isDocked: boolean }) {
    const shownMode = useShownMode();

    let title: string;
    let content: ReactNode;
    if (shownMode === "plan") {
        title = "PLAN";
        content = <PlanSheetContent />;
    } else if (shownMode === "data") {
        title = "DATA";
        content = <DataSheetContent />;
    } else {
        return null;
    }

    if (isDocked) {
        return <DockedSheet title={title}>{content}</DockedSheet>;
    }
    return <BottomSheet title={title}>{content}</BottomSheet>;
}
