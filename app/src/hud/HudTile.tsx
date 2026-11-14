// One big Suit HUD tile (owner: Letta, Stage 3, built by the HUD sub-agent).
// Value plus a StateBadge, so the state is always colour, shape and word, never colour alone.
// The 64 px minimum follows theme/tokens.css (--ariadne-tap-hud).

import type { CSSProperties } from "react";

import { EstimateBadge } from "../theme/EstimateBadge";
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
    style?: CSSProperties;
}



export function HudTile({ label, value, state, ariaLabel, isEstimate = false, detail, style }: HudTileProps) {
    return (
        <div
            role="group"
            aria-label={ariaLabel}
            className="flex min-h-16 min-w-0 flex-col justify-between gap-1 overflow-hidden border border-ariadne-border bg-ariadne-panel p-2"
            style={style}
        >
            <div className="flex min-w-0 items-center justify-between gap-1">
                <span className="min-w-0 truncate text-[length:var(--ariadne-text-xs)] uppercase tracking-widest text-ariadne-muted">
                    {label}
                </span>
                {isEstimate && <EstimateBadge />}
            </div>

            <div
                className="ariadne-display ariadne-glow min-w-0 whitespace-nowrap text-[length:clamp(1.25rem,7vw,1.75rem)] leading-none text-ariadne-data"
                title={value}
            >
                {value}
            </div>

            <div className="flex min-w-0 items-center gap-1">
                <StateBadge
                    state={state}
                    sizePx={14}
                    style={{ fontSize: "0.7rem", lineHeight: 1.1, padding: "2px 4px" }}
                />
                {detail !== undefined && (
                    <span className="min-w-0 truncate text-[length:var(--ariadne-text-xs)] text-ariadne-dim">{detail}</span>
                )}
            </div>
        </div>
    );
}
