// "Here" data card over the map (owner: Malissa, D-031 follow-up chosen by Malissa): the data at the
// astronaut's simulated spot, or at a point the user tapped on the terrain, while the map stays in
// view. Values come from shell/pointData.ts (local grid only); tap a value for its provenance.
// Four key rows always show (walkable, slope, radio, walk back); the rest sit behind "More".
// On a phone the card starts as one line and expands on tap. Hidden in SUIT mode by MapOverlays.

import { useMemo, useState } from "react";

import { loadFactor, carriedLoadKg, loadParametersFromMeta } from "../science/loadFactor";
import { computeConsumablesState } from "../sim/clock";
import { cellFromPosition, cellIndex } from "../data/grid";
import type { LocalPosition } from "../data/contracts";
import { useAriadneStore } from "../state/store";
import { EstimateBadge } from "../theme/EstimateBadge";
import { ProvenanceButton } from "../theme/ProvenancePopover";
import type { PointDataRow, PointDataRowId, PointDataTone } from "./pointData";
import { ESTIMATE_BADGE, findRow, pointDataAt } from "./pointData";
import { useMediaQuery, useViewport } from "./useViewport";



const KEY_ROW_IDS: PointDataRowId[] = ["walkable", "slope", "radio_to_rover", "walk_back"];
const MORE_ROW_IDS: PointDataRowId[] = ["sky_view", "elevation", "thermal_inertia", "mineral"];
const SHORT_SCREEN_MEDIA_QUERY = "(max-height: 760px)";
// The walk back changes with the load and the clock; refresh it once per simulated minute.
const SIM_REFRESH_SECONDS = 60;

const TONE_CLASSES: Record<PointDataTone, string> = {
    go: "text-ariadne-accent",
    caution: "text-ariadne-caution",
    no_go: "text-ariadne-no-go",
    neutral: "text-ariadne-data",
};

const CARD_CLASS = "pointer-events-auto border border-ariadne-border bg-ariadne-panel text-ariadne-text";
const SMALL_BUTTON_CLASS =
    "flex h-12 min-w-12 shrink-0 items-center justify-center px-2 text-xs uppercase tracking-wider text-ariadne-muted hover:text-ariadne-accent";



// ProvenanceButton already shows "est." when the source layer is an estimate, so the row adds its own
// badge only when it says more (for example "est., low confidence") or the source is not flagged.
function extraBadgeText(row: PointDataRow): string | null {
    if (row.badge_text === null) {
        return null;
    }
    if (row.badge_text === ESTIMATE_BADGE && row.provenance.is_estimate) {
        return null;
    }
    return row.badge_text;
}


function DataRow({ row }: { row: PointDataRow }) {
    const badge = extraBadgeText(row);
    return (
        <li className="flex min-w-0 items-center justify-between gap-2 border-t border-ariadne-border pl-2">
            <span className="shrink-0 text-xs uppercase tracking-wider text-ariadne-dim">{row.label}</span>
            <span className="flex min-w-0 items-center gap-1">
                <ProvenanceButton
                    label={row.label}
                    value={row.value_text}
                    provenance={row.provenance}
                    className={`text-sm font-bold ${TONE_CLASSES[row.tone]}`}
                />
                {badge !== null && <EstimateBadge label={badge} />}
            </span>
        </li>
    );
}


function rowsFor(ids: PointDataRowId[], rows: PointDataRow[]): PointDataRow[] {
    const picked: PointDataRow[] = [];
    for (const id of ids) {
        const row = rows.find((candidate) => candidate.row_id === id);
        if (row !== undefined) {
            picked.push(row);
        }
    }
    return picked;
}


// One-line phone summary: "slope 8° · in view".
function summaryText(rows: PointDataRow[]): string {
    const parts: string[] = [];
    const walkable = rows.find((row) => row.row_id === "walkable");
    if (walkable !== undefined && walkable.tone === "no_go") {
        parts.push(walkable.value_text);
    }
    const slope = rows.find((row) => row.row_id === "slope");
    if (slope !== undefined) {
        parts.push(`slope ${slope.value_text}`);
    }
    const radio = rows.find((row) => row.row_id === "radio_to_rover");
    if (radio !== undefined) {
        parts.push(`radio ${radio.value_text}`);
    }
    return parts.join(" · ");
}



export function HereCard() {
    const processedData = useAriadneStore((state) => state.processedData);
    const astronautPosition = useAriadneStore((state) => state.astronautPosition);
    const inspectedPosition = useAriadneStore((state) => state.inspectedPosition);
    const clearInspectedPosition = useAriadneStore((state) => state.clearInspectedPosition);
    const completedTaskIds = useAriadneStore((state) => state.completedTaskIds);
    const simMinute = useAriadneStore((state) => Math.floor(state.simElapsedSeconds / SIM_REFRESH_SECONDS));
    const { isPhone } = useViewport();
    // On a phone or a short screen (laptop at 640 to 760 px tall) the card starts as one line, so it
    // never covers the objective card's checklist; a tap expands it.
    const isShortScreen = useMediaQuery(SHORT_SCREEN_MEDIA_QUERY);
    const isCompact = isPhone || isShortScreen;
    const [isExpandedOnPhone, setExpandedOnPhone] = useState(false);
    const [isShowingMore, setShowingMore] = useState(false);

    let position: LocalPosition | null = inspectedPosition;
    if (position === null && processedData !== null) {
        position = astronautPosition ?? processedData.meta.staging_point;
    }

    // Recompute only when the 2 m cell, the load or the simulated minute changes, not every frame.
    let cellKey = -1;
    if (processedData !== null && position !== null) {
        cellKey = cellIndex(processedData.meta.grid, cellFromPosition(processedData.meta.grid, position));
    }
    const pointData = useMemo(() => {
        if (processedData === null || position === null) {
            return null;
        }
        const parameters = loadParametersFromMeta(processedData.meta.parameters);
        const factor = loadFactor(carriedLoadKg(processedData.knots, completedTaskIds, parameters), parameters);
        const timeLeft = computeConsumablesState(simMinute * SIM_REFRESH_SECONDS, processedData.meta.parameters).planned_time_left_s;
        return pointDataAt(processedData, position, factor, timeLeft);
        // position is represented by cellKey on purpose: the data is per 2 m cell.
    }, [processedData, cellKey, completedTaskIds, simMinute]);

    if (pointData === null) {
        return null;
    }

    const isPoint = inspectedPosition !== null;
    let title = "HERE (sim.)";
    if (isPoint) {
        title = "POINT";
    }

    const closeButton = isPoint && (
        <button type="button" className={SMALL_BUTTON_CLASS} aria-label="Close point data, back to my position" onClick={clearInspectedPosition}>
            ✕
        </button>
    );

    if (pointData.state === "outside_patch") {
        return (
            <section className={`${CARD_CLASS} flex items-center justify-between pl-2`} aria-label="Point data">
                <span className="text-xs uppercase tracking-wider text-ariadne-dim">{title}: outside the patch</span>
                {closeButton}
            </section>
        );
    }

    if (isCompact && !isExpandedOnPhone) {
        return (
            <section className={`${CARD_CLASS} flex min-w-0 items-center`} aria-label="Point data">
                <button
                    type="button"
                    className="flex h-12 min-w-0 flex-1 items-center gap-2 px-2 text-left"
                    aria-expanded={false}
                    onClick={() => setExpandedOnPhone(true)}
                >
                    <span className="shrink-0 text-xs uppercase tracking-wider text-ariadne-accent">{title}</span>
                    <span className="min-w-0 truncate text-xs text-ariadne-data">{summaryText(pointData.rows)}</span>
                    <span className="ml-auto shrink-0 text-ariadne-accent" aria-hidden="true">
                        ▴
                    </span>
                </button>
                {closeButton}
            </section>
        );
    }

    const keyRows = rowsFor(KEY_ROW_IDS, pointData.rows);
    const moreRows = rowsFor(MORE_ROW_IDS, pointData.rows);
    const walkBack = findRow(pointData, "walk_back");

    return (
        <section className={CARD_CLASS} aria-label="Point data">
            <div className="flex items-center justify-between pl-2">
                <span className="text-xs uppercase tracking-widest text-ariadne-accent">{title}</span>
                <span className="flex">
                    {isCompact && (
                        <button type="button" className={SMALL_BUTTON_CLASS} aria-expanded={true} onClick={() => setExpandedOnPhone(false)}>
                            Less
                        </button>
                    )}
                    {closeButton}
                </span>
            </div>
            <ul>
                {keyRows.map((row) => (
                    <DataRow key={row.row_id} row={row} />
                ))}
                {isShowingMore &&
                    moreRows.map((row) => (
                        <DataRow key={row.row_id} row={row} />
                    ))}
            </ul>
            <div className="flex items-center justify-between border-t border-ariadne-border pl-2">
                <span className="min-w-0 truncate text-xs text-ariadne-dim">
                    {walkBack?.note ?? (isPoint ? "Tapped point" : "Simulated position")}
                </span>
                <button type="button" className={SMALL_BUTTON_CLASS} aria-expanded={isShowingMore} onClick={() => setShowingMore(!isShowingMore)}>
                    {isShowingMore ? "Less" : "More"}
                </button>
            </div>
        </section>
    );
}
