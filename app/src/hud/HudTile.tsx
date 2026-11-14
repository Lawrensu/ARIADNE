// One big Suit HUD tile (owner: Letta, Stage 3, built by the HUD sub-agent).
// Label, a 40 px VT323 value and a StateBadge, so the state is always colour, shape and word,
// never colour alone. The whole tile is one 64 px+ button: tap it to see the provenance of the value.

import { useState } from "react";

import type { Provenance } from "../data/contracts";
import { EstimateBadge } from "../theme/EstimateBadge";
import { ProvenanceDialog } from "../theme/ProvenancePopover";
import { StateBadge } from "../theme/StateBadge";
import type { HudState } from "./hudMath";



export interface HudTileProps {
    label: string;
    value: string;
    state: HudState;
    ariaLabel: string;
    // Model-derived value: show the "est." badge beside the label.
    isEstimate?: boolean;
    // Short optional text after the state badge.
    detail?: string;
    // Where the number comes from. When given, tapping the tile opens the provenance dialog.
    provenance?: Provenance;
}



export function HudTile({ label, value, state, ariaLabel, isEstimate = false, detail, provenance }: HudTileProps) {
    const [isProvenanceOpen, setIsProvenanceOpen] = useState(false);

    // The tile is a size container (@container): label and value scale with the tile's own width
    // (cqi), not the window, so "+330 min" fits in each of the three tiles in the two-column desktop
    // layout as well as in a full-width phone tile.
    const tileClasses =
        "@container flex min-h-16 min-w-0 flex-col justify-between gap-1 border border-ariadne-border bg-ariadne-panel p-2 text-left";
    const tileContent = (
        <>
            <div className="flex min-w-0 items-center justify-between gap-1">
                <span className="ariadne-display min-w-0 truncate text-[length:clamp(1rem,9cqi,1.25rem)] leading-none text-ariadne-muted">
                    {label}
                </span>
                {isEstimate && <EstimateBadge />}
            </div>

            <div
                className="ariadne-display ariadne-glow min-w-0 whitespace-nowrap text-[length:clamp(1.75rem,21cqi,3.5rem)] leading-none text-ariadne-data"
                title={value}
            >
                {value}
            </div>

            <div className="flex min-w-0 items-center gap-1">
                <StateBadge state={state} sizePx={16} style={{ fontSize: "0.8rem", lineHeight: 1.1, padding: "2px 6px" }} />
                {detail !== undefined && (
                    <span className="min-w-0 truncate text-[length:var(--ariadne-text-xs)] text-ariadne-dim">{detail}</span>
                )}
            </div>
        </>
    );

    if (provenance === undefined) {
        return (
            <div role="group" aria-label={ariaLabel} className={tileClasses}>
                {tileContent}
            </div>
        );
    }

    return (
        <>
            <button
                type="button"
                aria-label={`${ariaLabel}. Show provenance.`}
                className={`${tileClasses} w-full hover:border-ariadne-accent`}
                onClick={() => setIsProvenanceOpen(true)}
            >
                {tileContent}
            </button>
            {isProvenanceOpen && (
                <ProvenanceDialog
                    title={label}
                    valueText={value}
                    provenance={provenance}
                    onClose={() => setIsProvenanceOpen(false)}
                />
            )}
        </>
    );
}
