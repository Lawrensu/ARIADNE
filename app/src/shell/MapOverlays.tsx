// Everything that floats over the map (owner: Lawrence, redesign D-031, visual_direction.md 6.2):
// the objective card top left, the newest alert top right, the control legend at the bottom and
// the PLAN or DATA sheet. Nothing here resizes the map; in SUIT mode the HUD covers it instead.
//
// From 1024 px the left column holds the objective card and, below it, the open sheet. Narrower,
// the objective and the alert stack at the top (one column on a phone) and the sheet is a bottom sheet.
//
// Data on the map (Malissa's follow-up): the Here card (data at the astronaut's spot or a tapped point)
// sits bottom left above the controls, the LAYERS popover bottom right. The DATA sheet is slimmer
// than PLAN on desktop, and while a sheet is docked the follow camera keeps the astronaut in the middle
// of the part of the map that is still visible.

import { useLayoutEffect, useRef } from "react";

import { AlertStack } from "../alerts/AlertStack";
import { useAriadneStore } from "../state/store";
import { ControlLegend } from "./ControlLegend";
import { HereCard } from "./HereCard";
import { LayersPopover } from "./LayersPopover";
import { ModeSheet } from "./ModeSheet";
import { useShownMode } from "./modes";
import { ObjectiveCard } from "./ObjectiveCard";
import { useViewport } from "./useViewport";



// The docked column is slimmer for DATA (layers and lists) than for PLAN (the step flow).
const DATA_SHEET_WIDTH = "20rem";
const PLAN_SHEET_WIDTH = "var(--ariadne-sheet-width)";
// Just above the control legend (48 px buttons plus margins; plus the hint line from 1024 px).
const ABOVE_CONTROLS_CLASS = "bottom-[4.25rem] lg:bottom-[5.5rem]";



// Measures how far the docked column reaches into the map and tells the follow camera to keep the
// astronaut half that distance right of centre (the middle of the free area). 0 when nothing is docked.
function useDockedColumnFollowOffset(isDockedSheetOpen: boolean) {
    const columnRef = useRef<HTMLDivElement | null>(null);

    useLayoutEffect(() => {
        const setOffset = useAriadneStore.getState().setFollowScreenOffsetXPx;
        const column = columnRef.current;
        if (!isDockedSheetOpen || column === null) {
            setOffset(0);
            return;
        }
        const container = column.parentElement;
        function update() {
            if (column === null || container === null) {
                return;
            }
            const reachPx = column.getBoundingClientRect().right - container.getBoundingClientRect().left;
            setOffset(Math.max(0, Math.round(reachPx / 2)));
        }
        update();
        const observer = new ResizeObserver(update);
        observer.observe(column);
        return () => {
            observer.disconnect();
            setOffset(0);
        };
    }, [isDockedSheetOpen]);

    return columnRef;
}



export function MapOverlays() {
    const shownMode = useShownMode();
    const { isPhone, isSheetDocked } = useViewport();
    const isLayersPopoverOpen = useAriadneStore((state) => state.isLayersPopoverOpen);

    const isSuit = shownMode === "suit";
    const isSheetOpen = shownMode === "plan" || shownMode === "data";
    const columnRef = useDockedColumnFollowOffset(!isSuit && isSheetDocked && isSheetOpen);

    if (isSuit) {
        return null;
    }

    if (isSheetDocked) {
        let columnWidth = PLAN_SHEET_WIDTH;
        if (shownMode === "data") {
            columnWidth = DATA_SHEET_WIDTH;
        }
        // Beside an open sheet the Here card moves right of the column.
        let hereCardLeft = "0.75rem";
        if (isSheetOpen) {
            hereCardLeft = `calc(${columnWidth} + 1.5rem)`;
        }
        return (
            <>
                {/* Ends above the control legend (48 px buttons, hint line, margins). */}
                <div
                    ref={columnRef}
                    className="pointer-events-none absolute bottom-[5rem] left-3 top-3 z-30 flex max-w-[calc(100%-1.5rem)] flex-col gap-2"
                    style={{ width: columnWidth }}
                >
                    <div className="pointer-events-auto shrink-0">
                        {/* Remounts when the sheet opens or closes, so it starts collapsed beside a sheet. */}
                        <ObjectiveCard key={isSheetOpen ? "beside_sheet" : "alone"} isCollapsible={isSheetOpen} />
                    </div>
                    {isSheetOpen && <ModeSheet isDocked />}
                </div>
                <div className="absolute right-3 top-3 z-30 w-[var(--ariadne-overlay-card-width)] max-w-[calc(100%-var(--ariadne-sheet-width)-2.5rem)]">
                    <AlertStack variant="map" />
                </div>
                <div className={`pointer-events-none absolute z-30 w-[19rem] ${ABOVE_CONTROLS_CLASS}`} style={{ left: hereCardLeft }}>
                    <HereCard />
                </div>
                <ControlLegend />
                <LayersPopover />
            </>
        );
    }

    // Phone and tablet: the Here card hides under an open bottom sheet, and on a phone also while the
    // full-width LAYERS popover is open.
    let isHereCardShown = !isSheetOpen;
    if (isPhone && isLayersPopoverOpen) {
        isHereCardShown = false;
    }

    return (
        <>
            <div className="pointer-events-none absolute inset-x-2 top-2 z-30 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="pointer-events-auto w-full sm:w-[var(--ariadne-overlay-card-width)] sm:max-w-[calc(50%-0.25rem)]">
                    {/* One line on a phone, and on a tablet while the bottom sheet is open (as on desktop). */}
                    <ObjectiveCard
                        key={isSheetOpen ? "beside_sheet" : "alone"}
                        isCollapsible={isPhone || isSheetOpen}
                    />
                </div>
                <div className="pointer-events-auto w-full sm:w-[var(--ariadne-overlay-card-width)] sm:max-w-[calc(50%-0.25rem)]">
                    <AlertStack variant="map" />
                </div>
            </div>
            {isHereCardShown && (
                <div className={`pointer-events-none absolute inset-x-2 z-30 sm:left-3 sm:right-auto sm:w-[19rem] ${ABOVE_CONTROLS_CLASS}`}>
                    <HereCard />
                </div>
            )}
            <ControlLegend />
            <LayersPopover />
            {isSheetOpen && <ModeSheet isDocked={false} />}
        </>
    );
}
