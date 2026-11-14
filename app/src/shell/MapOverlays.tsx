// Everything that floats over the map (owner: Lawrence, redesign D-031, visual_direction.md 6.2):
// the objective card top left, the newest alert top right, the control legend at the bottom and
// the PLAN or DATA sheet. Nothing here resizes the map; in SUIT mode the HUD covers it instead.
//
// From 1024 px the left column holds the objective card and, below it, the open sheet. Narrower,
// the objective and the alert stack at the top (one column on a phone) and the sheet is a bottom sheet.

import { AlertStack } from "../alerts/AlertStack";
import { ControlLegend } from "./ControlLegend";
import { ModeSheet } from "./ModeSheet";
import { useShownMode } from "./modes";
import { ObjectiveCard } from "./ObjectiveCard";
import { useViewport } from "./useViewport";



export function MapOverlays() {
    const shownMode = useShownMode();
    const { isPhone, isSheetDocked } = useViewport();

    if (shownMode === "suit") {
        return null;
    }

    const isSheetOpen = shownMode === "plan" || shownMode === "data";

    if (isSheetDocked) {
        return (
            <>
                {/* Ends above the control legend (48 px buttons, hint line, margins). */}
                <div className="pointer-events-none absolute bottom-[5rem] left-3 top-3 z-30 flex w-[var(--ariadne-sheet-width)] max-w-[calc(100%-1.5rem)] flex-col gap-2">
                    <div className="pointer-events-auto shrink-0">
                        {/* Remounts when the sheet opens or closes, so it starts collapsed beside a sheet. */}
                        <ObjectiveCard key={isSheetOpen ? "beside_sheet" : "alone"} isCollapsible={isSheetOpen} />
                    </div>
                    {isSheetOpen && <ModeSheet isDocked />}
                </div>
                <div className="absolute right-3 top-3 z-30 w-[var(--ariadne-overlay-card-width)] max-w-[calc(100%-var(--ariadne-sheet-width)-2.5rem)]">
                    <AlertStack variant="map" />
                </div>
                <ControlLegend />
            </>
        );
    }

    return (
        <>
            <div className="pointer-events-none absolute inset-x-2 top-2 z-30 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="pointer-events-auto w-full sm:w-[var(--ariadne-overlay-card-width)] sm:max-w-[calc(50%-0.25rem)]">
                    <ObjectiveCard isCollapsible={isPhone} />
                </div>
                <div className="pointer-events-auto w-full sm:w-[var(--ariadne-overlay-card-width)] sm:max-w-[calc(50%-0.25rem)]">
                    <AlertStack variant="map" />
                </div>
            </div>
            <ControlLegend />
            {isSheetOpen && <ModeSheet isDocked={false} />}
        </>
    );
}
