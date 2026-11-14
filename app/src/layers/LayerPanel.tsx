// HTML panel: one toggle per overlay, an opacity slider, and a legend with provenance for each
// visible layer (owner: Malissa, Stage 2). Large tap targets for gloves (at least 48 px).

import { useMemo } from "react";

import type { OverlayLayerId } from "../state/layersSlice";
import { OVERLAY_LAYER_IDS } from "../state/layersSlice";
import { useAriadneStore } from "../state/store";
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



function EstimateBadge({ text }: { text: string }) {
    return (
        <span className="rounded border border-ariadne-accent px-1.5 py-0.5 text-xs font-bold uppercase text-ariadne-accent">
            {text}
        </span>
    );
}


function Swatch({ entry }: { entry: LegendEntry }) {
    let background = rgbToCssString(entry.color);
    if (entry.is_striped) {
        background = STRIPED_SWATCH_BACKGROUND;
    }
    return <span className="inline-block h-4 w-6 shrink-0 rounded-sm border border-ariadne-border" style={{ background }} />;
}


function gradientCss(stops: LegendGradientStop[]): string {
    const parts = stops.map((stop) => `${rgbToCssString(stop.color)} ${Math.round(stop.position * 100)}%`);
    return `linear-gradient(to right, ${parts.join(", ")})`;
}


function LegendBody({ legend }: { legend: LayerLegend }) {
    const hasGradient = legend.gradient_stops.length > 0;
    let lowLabel = "";
    let highLabel = "";
    if (hasGradient) {
        lowLabel = legend.gradient_stops[0].label;
        highLabel = legend.gradient_stops[legend.gradient_stops.length - 1].label;
    }

    return (
        <div className="mt-2 space-y-2 text-sm">
            {hasGradient && (
                <div>
                    <div className="h-3 w-full rounded-sm border border-ariadne-border" style={{ background: gradientCss(legend.gradient_stops) }} />
                    <div className="mt-1 flex justify-between text-ariadne-muted">
                        <span>{lowLabel}</span>
                        <span>{highLabel}</span>
                    </div>
                </div>
            )}
            {legend.entries.length > 0 && (
                <ul className="space-y-1">
                    {legend.entries.map((entry) => (
                        <li key={entry.label} className="flex items-center gap-2">
                            <Swatch entry={entry} />
                            <span>{entry.label}</span>
                        </li>
                    ))}
                </ul>
            )}
            <p className="text-ariadne-muted">Unit: {legend.unit}</p>
            <p>{legend.caveat}</p>
            <p className="text-xs text-ariadne-muted">
                Source: {legend.source_dataset}, {legend.product_id}, {formatResolution(legend.native_resolution_m)}.
            </p>
        </div>
    );
}


function formatResolution(resolutionM: number): string {
    if (resolutionM <= 0) {
        return "resolution not stated";
    }
    return `${resolutionM} m native`;
}


function LayerRow({ layerId, isVisible }: { layerId: OverlayLayerId; isVisible: boolean }) {
    const processedData = useAriadneStore((state) => state.processedData);
    const toggleOverlay = useAriadneStore((state) => state.toggleOverlay);

    const legend = useMemo(() => {
        if (!isVisible || processedData === null) {
            return null;
        }
        return legendFor(layerId, processedData);
    }, [isVisible, layerId, processedData]);

    let rowClass = "rounded border border-ariadne-border bg-ariadne-panel p-2";
    if (isVisible) {
        rowClass = "rounded border border-ariadne-accent bg-ariadne-panel p-2";
    }

    return (
        <li className={rowClass}>
            <button
                type="button"
                role="switch"
                aria-checked={isVisible}
                onClick={() => toggleOverlay(layerId)}
                className="flex min-h-12 w-full items-center justify-between gap-2 text-left text-base"
            >
                <span>{TOGGLE_LABELS[layerId]}</span>
                <span className="flex items-center gap-2">
                    {legend !== null && legend.badge_text !== null && <EstimateBadge text={legend.badge_text} />}
                    <span className="min-w-10 text-right font-bold">{isVisible ? "ON" : "OFF"}</span>
                </span>
            </button>
            {legend !== null && <LegendBody legend={legend} />}
        </li>
    );
}



export function LayerPanel() {
    const visibleOverlays = useAriadneStore((state) => state.visibleOverlays);
    const overlayOpacity = useAriadneStore((state) => state.overlayOpacity);
    const setOverlayOpacity = useAriadneStore((state) => state.setOverlayOpacity);

    return (
        <section aria-label="Map layers" className="w-80 max-w-full space-y-2 bg-ariadne-background p-2 text-ariadne-text">
            <h2 className="text-lg font-bold">Layers</h2>
            <label className="block min-h-12 rounded border border-ariadne-border bg-ariadne-panel p-2 text-sm">
                <span className="flex justify-between">
                    <span>Overlay opacity</span>
                    <span>{Math.round(overlayOpacity * 100)} %</span>
                </span>
                <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={overlayOpacity}
                    onChange={(event) => setOverlayOpacity(Number(event.target.value))}
                    className="mt-1 h-8 w-full accent-ariadne-accent"
                />
            </label>
            <ul className="space-y-2">
                {OVERLAY_LAYER_IDS.map((layerId) => (
                    <LayerRow key={layerId} layerId={layerId} isVisible={visibleOverlays[layerId]} />
                ))}
            </ul>
        </section>
    );
}
