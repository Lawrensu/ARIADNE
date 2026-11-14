// HTML panel: one row per overlay (toggle, name, legend strip, "src"), and one opacity slider shown only
// while a layer is on (owner: Malissa, Stage 2; restyled for the DATA sheet, D-031). Width-fluid, no outer
// frame and no title (the sheet supplies both). Tap targets are at least 48 px.

import { useMemo, useState } from "react";

import type { OverlayLayerId } from "../state/layersSlice";
import { OVERLAY_LAYER_IDS } from "../state/layersSlice";
import { useAriadneStore } from "../state/store";
import { EstimateBadge } from "../theme/EstimateBadge";
import type { LayerLegend, LegendEntry, LegendGradientStop } from "./layerLegend";
import { legendFor, STRIPED_SWATCH_BACKGROUND } from "./layerLegend";
import { rgbToCssString } from "./layerPalette";



const TOGGLE_LABELS: Record<OverlayLayerId, string> = {
    no_go: "No-go cells",
    slope_degrees: "Slope",
    sky_view_factor: "Sky view",
    thermal_inertia: "Thermal inertia",
    mineralogy_class: "Minerals",
    viewshed_rover: "Rover radio view",
    rocks: "Rocks",
};

const SMALL_BUTTON_CLASS =
    "ariadne-tap min-w-12 border px-1 text-xs uppercase tracking-wider hover:border-ariadne-accent";



function Swatch({ entry }: { entry: LegendEntry }) {
    let background = rgbToCssString(entry.color);
    if (entry.is_striped) {
        background = STRIPED_SWATCH_BACKGROUND;
    }
    return <span className="inline-block h-3 w-4 shrink-0 border border-ariadne-border" style={{ background }} />;
}


function gradientCss(stops: LegendGradientStop[]): string {
    const parts = stops.map((stop) => `${rgbToCssString(stop.color)} ${Math.round(stop.position * 100)}%`);
    return `linear-gradient(to right, ${parts.join(", ")})`;
}


// The strip beside the name: a gradient bar for continuous layers, a row of swatches for categories.
function LegendStrip({ legend }: { legend: LayerLegend }) {
    if (legend.gradient_stops.length > 0) {
        return <span className="inline-block h-3 w-16 shrink-0 border border-ariadne-border" style={{ background: gradientCss(legend.gradient_stops) }} aria-hidden="true" />;
    }
    return (
        <span className="flex shrink-0 gap-0.5" aria-hidden="true">
            {legend.entries.slice(0, 4).map((entry) => (
                <Swatch key={entry.label} entry={entry} />
            ))}
        </span>
    );
}


// What the strip means: low and high labels, or the category names. Shown only while the layer is on.
function LegendKey({ legend }: { legend: LayerLegend }) {
    const hasGradient = legend.gradient_stops.length > 0;
    let lowLabel = "";
    let highLabel = "";
    if (hasGradient) {
        lowLabel = legend.gradient_stops[0].label;
        highLabel = legend.gradient_stops[legend.gradient_stops.length - 1].label;
    }

    return (
        <div className="space-y-1 text-xs text-ariadne-muted">
            {hasGradient && (
                <div className="flex justify-between gap-2">
                    <span>{lowLabel}</span>
                    <span>{highLabel}</span>
                </div>
            )}
            {legend.entries.length > 0 && (
                <ul className="flex flex-wrap gap-x-3 gap-y-1">
                    {legend.entries.map((entry) => (
                        <li key={entry.label} className="flex items-center gap-1">
                            <Swatch entry={entry} />
                            <span>{entry.label}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}


function formatResolution(resolutionM: number): string {
    if (resolutionM <= 0) {
        return "resolution not stated";
    }
    return `${resolutionM} m native`;
}


// Behind the "src" button: unit, caveat, dataset, product and resolution of the layer.
function LegendSource({ legend }: { legend: LayerLegend }) {
    return (
        <div className="space-y-1 border-l border-ariadne-border pl-2 text-xs text-ariadne-muted">
            <p>Unit: {legend.unit}</p>
            <p className="text-ariadne-text">{legend.caveat}</p>
            <p>
                {legend.source_dataset}, {legend.product_id}, {formatResolution(legend.native_resolution_m)}.
            </p>
        </div>
    );
}


function LayerRow({ layerId, isVisible }: { layerId: OverlayLayerId; isVisible: boolean }) {
    const processedData = useAriadneStore((state) => state.processedData);
    const toggleOverlay = useAriadneStore((state) => state.toggleOverlay);
    const [isSourceOpen, setIsSourceOpen] = useState(false);

    // The legend is built for every layer so the strip is always visible beside the name.
    const legend = useMemo(() => {
        if (processedData === null) {
            return null;
        }
        return legendFor(layerId, processedData);
    }, [layerId, processedData]);

    let rowClass = "border border-ariadne-border bg-ariadne-panel";
    if (isVisible) {
        rowClass = "border border-ariadne-accent bg-ariadne-panel";
    }

    let boxClass = "flex h-5 w-5 items-center justify-center border-2 ";
    if (isVisible) {
        boxClass += "border-ariadne-accent bg-ariadne-accent text-ariadne-background";
    } else {
        boxClass += "border-ariadne-dim";
    }

    let sourceClass = `${SMALL_BUTTON_CLASS} `;
    if (isSourceOpen) {
        sourceClass += "border-ariadne-accent text-ariadne-accent";
    } else {
        sourceClass += "border-transparent text-ariadne-muted";
    }

    const layerName = TOGGLE_LABELS[layerId];

    return (
        <li className={rowClass}>
            <div className="flex items-center">
                <button
                    type="button"
                    role="switch"
                    aria-checked={isVisible}
                    aria-label={layerName}
                    onClick={() => toggleOverlay(layerId)}
                    className="ariadne-tap flex min-w-0 flex-1 items-center gap-3 px-3 text-left text-sm"
                >
                    <span className={boxClass} aria-hidden="true">
                        {isVisible ? "✓" : ""}
                    </span>
                    <span className="min-w-0 truncate">{layerName}</span>
                    {isVisible && legend !== null && legend.badge_text !== null && <EstimateBadge label={legend.badge_text} />}
                </button>
                {legend !== null && <LegendStrip legend={legend} />}
                <button
                    type="button"
                    className={sourceClass}
                    aria-expanded={isSourceOpen}
                    aria-label={`Source of ${layerName}`}
                    onClick={() => setIsSourceOpen(!isSourceOpen)}
                >
                    src
                </button>
            </div>
            {legend !== null && (isVisible || isSourceOpen) && (
                <div className="space-y-2 px-3 pb-2">
                    {isVisible && <LegendKey legend={legend} />}
                    {isSourceOpen && <LegendSource legend={legend} />}
                </div>
            )}
        </li>
    );
}



export function LayerPanel() {
    const visibleOverlays = useAriadneStore((state) => state.visibleOverlays);
    const overlayOpacity = useAriadneStore((state) => state.overlayOpacity);
    const setOverlayOpacity = useAriadneStore((state) => state.setOverlayOpacity);

    // One opacity for all overlays, so the slider only matters (and only shows) while a layer is on.
    const isAnyLayerOn = OVERLAY_LAYER_IDS.some((layerId) => visibleOverlays[layerId]);

    return (
        <section aria-label="Map layers" className="w-full space-y-1 text-ariadne-text">
            <ul className="space-y-1">
                {OVERLAY_LAYER_IDS.map((layerId) => (
                    <LayerRow key={layerId} layerId={layerId} isVisible={visibleOverlays[layerId]} />
                ))}
            </ul>
            {isAnyLayerOn && (
                <label className="ariadne-tap flex items-center gap-3 border border-ariadne-border px-3 text-xs uppercase tracking-widest text-ariadne-muted">
                    <span>Opacity</span>
                    <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={overlayOpacity}
                        onChange={(event) => setOverlayOpacity(Number(event.target.value))}
                        className="h-8 min-w-0 flex-1 accent-ariadne-accent"
                        aria-label="Overlay opacity"
                    />
                    <span className="w-10 text-right tabular-nums text-ariadne-data">{Math.round(overlayOpacity * 100)}%</span>
                </label>
            )}
        </section>
    );
}
