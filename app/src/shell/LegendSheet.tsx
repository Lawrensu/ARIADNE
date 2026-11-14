// Map legend (owner: Lawrence, redesign D-031), opened from the control legend: what each marker
// glyph, line and layer colour means. Line colours come from the components that draw them, so the
// legend never drifts from the map. Layer swatches and provenance come from layers/layerLegend.ts.

import { useEffect } from "react";
import type { ReactNode } from "react";

import type { ProcessedData } from "../data/loadProcessed";
import { legendFor } from "../layers";
import type { LayerLegend } from "../layers";
import { STRIPED_SWATCH_BACKGROUND } from "../layers/layerLegend";
import { ROUTE_LINE_COLOURS } from "../planning/RouteLines";
import { SCIENCE_PLAN_LINE_COLOUR } from "../science/ui/SciencePlanLines";
import { OVERLAY_LAYER_IDS } from "../state/layersSlice";
import { useAriadneStore } from "../state/store";
import { THREAD_COLOR } from "../thread/ThreadLine";



type MarkerGlyphKind = "knot" | "rover" | "shelter" | "astronaut";

const MARKER_ROWS: { glyph: MarkerGlyphKind; label: string }[] = [
    { glyph: "knot", label: "Knot (science stop)" },
    { glyph: "rover", label: "Rover" },
    { glyph: "shelter", label: "Shelter" },
    { glyph: "astronaut", label: "You (simulated)" },
];

// Dash patterns follow visual_direction.md 6.3: one solid Thread, dashed science plan, and a distinct
// pattern per route option so they differ without colour.
const LINE_ROWS: { label: string; colour: string; dashArray: string | null; width: number }[] = [
    { label: "The Thread (safe return)", colour: THREAD_COLOR, dashArray: null, width: 4 },
    { label: "Science plan", colour: SCIENCE_PLAN_LINE_COLOUR, dashArray: "7 4", width: 3 },
    { label: "Route: fast", colour: ROUTE_LINE_COLOURS.fast, dashArray: null, width: 3 },
    { label: "Route: safe", colour: ROUTE_LINE_COLOURS.safe, dashArray: "10 5", width: 3 },
    { label: "Route: smooth", colour: ROUTE_LINE_COLOURS.smooth, dashArray: "2 4", width: 3 },
];



function MarkerGlyph({ glyph }: { glyph: MarkerGlyphKind }) {
    let shape: ReactNode;
    if (glyph === "knot") {
        shape = <polygon points="12,2 22,12 12,22 2,12" fill="none" stroke="currentColor" strokeWidth="2" />;
    } else if (glyph === "rover") {
        shape = <rect x="4" y="4" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" />;
    } else if (glyph === "shelter") {
        shape = <polygon points="12,3 22,21 2,21" fill="none" stroke="currentColor" strokeWidth="2" />;
    } else {
        shape = (
            <>
                <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
                <polygon points="12,5 16,14 12,12 8,14" fill="currentColor" />
            </>
        );
    }
    return (
        <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
            {shape}
        </svg>
    );
}


function LineSample({ colour, dashArray, width }: { colour: string; dashArray: string | null; width: number }) {
    return (
        <svg width="44" height="12" viewBox="0 0 44 12" aria-hidden="true" className="shrink-0">
            <line
                x1="1"
                y1="6"
                x2="43"
                y2="6"
                stroke={colour}
                strokeWidth={width}
                strokeDasharray={dashArray ?? undefined}
            />
        </svg>
    );
}



function rgbText(colour: [number, number, number] | number[]): string {
    return `rgb(${colour.join(",")})`;
}


// Continuous layers: a stepped swatch bar from low to high. Categorical layers: one chip per class.
function LayerSwatch({ legend }: { legend: LayerLegend }) {
    if (legend.gradient_stops.length > 0) {
        const first = legend.gradient_stops[0];
        const last = legend.gradient_stops[legend.gradient_stops.length - 1];
        return (
            <div className="flex flex-col gap-0.5">
                <div className="flex h-3 w-full border border-ariadne-border">
                    {legend.gradient_stops.map((stop) => (
                        <span key={`${stop.position}`} className="h-full flex-1" style={{ background: rgbText(stop.color) }} />
                    ))}
                </div>
                <div className="flex justify-between text-xs text-ariadne-dim">
                    <span>{first.label}</span>
                    <span>{last.label}</span>
                </div>
            </div>
        );
    }
    return (
        <ul className="flex flex-wrap gap-x-3 gap-y-1">
            {legend.entries.map((entry) => (
                <li key={entry.label} className="flex items-center gap-1 text-xs text-ariadne-muted">
                    <span
                        className="inline-block h-3 w-3 shrink-0 border border-ariadne-border"
                        style={{ background: entry.is_striped ? STRIPED_SWATCH_BACKGROUND : rgbText(entry.color) }}
                    />
                    {entry.label}
                </li>
            ))}
        </ul>
    );
}



function LegendSection({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="flex flex-col gap-2 border-t border-ariadne-border pt-3">
            <h3 className="text-xs uppercase tracking-widest text-ariadne-accent">{title}</h3>
            {children}
        </section>
    );
}



function LayerRows({ processedData }: { processedData: ProcessedData }) {
    const visibleOverlays = useAriadneStore((state) => state.visibleOverlays);

    return (
        <ul className="flex flex-col gap-3">
            {OVERLAY_LAYER_IDS.map((layerId) => {
                const legend = legendFor(layerId, processedData);
                const isVisible = visibleOverlays[layerId];
                return (
                    <li key={layerId} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-2 text-sm">
                            <span>
                                {legend.title}
                                {legend.unit.length > 0 && <span className="text-ariadne-dim"> ({legend.unit})</span>}
                                {legend.badge_text !== null && <span className="ml-1 text-xs text-ariadne-dim">{legend.badge_text}</span>}
                            </span>
                            <span className={`shrink-0 text-xs uppercase ${isVisible ? "text-ariadne-accent" : "text-ariadne-dim"}`}>
                                {isVisible ? "On" : "Off"}
                            </span>
                        </div>
                        <LayerSwatch legend={legend} />
                    </li>
                );
            })}
        </ul>
    );
}



export function LegendSheet() {
    const isMapLegendOpen = useAriadneStore((state) => state.isMapLegendOpen);
    const setMapLegendOpen = useAriadneStore((state) => state.setMapLegendOpen);
    const processedData = useAriadneStore((state) => state.processedData);

    useEffect(() => {
        if (!isMapLegendOpen) {
            return;
        }
        function onKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setMapLegendOpen(false);
            }
        }
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [isMapLegendOpen, setMapLegendOpen]);

    if (!isMapLegendOpen) {
        return null;
    }

    return (
        <div
            className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 sm:items-center sm:p-4"
            role="presentation"
            onClick={() => setMapLegendOpen(false)}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Map legend"
                className="ariadne-bracketed ariadne-scroll flex max-h-[85vh] w-full max-w-lg flex-col gap-3 overflow-y-auto border border-ariadne-accent bg-ariadne-panel p-3 text-ariadne-text"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-center justify-between gap-2">
                    <span className="ariadne-display text-2xl text-ariadne-accent">LEGEND</span>
                    <button
                        type="button"
                        className="ariadne-tap min-w-12 border border-ariadne-border px-3 text-xs uppercase tracking-wider hover:border-ariadne-accent"
                        onClick={() => setMapLegendOpen(false)}
                    >
                        Close
                    </button>
                </div>

                <LegendSection title="Markers">
                    <ul className="grid grid-cols-2 gap-2">
                        {MARKER_ROWS.map((row) => (
                            <li key={row.glyph} className="flex items-center gap-2 text-sm">
                                <MarkerGlyph glyph={row.glyph} />
                                {row.label}
                            </li>
                        ))}
                    </ul>
                </LegendSection>

                <LegendSection title="Lines">
                    <ul className="flex flex-col gap-2">
                        {LINE_ROWS.map((row) => (
                            <li key={row.label} className="flex items-center gap-3 text-sm">
                                <LineSample colour={row.colour} dashArray={row.dashArray} width={row.width} />
                                {row.label}
                            </li>
                        ))}
                    </ul>
                </LegendSection>

                {processedData !== null && (
                    <LegendSection title="Layers (turn on in DATA)">
                        <LayerRows processedData={processedData} />
                    </LegendSection>
                )}
            </div>
        </div>
    );
}
