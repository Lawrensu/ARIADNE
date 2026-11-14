// Go / caution / no-go badges (owner: Letta, Stage 3).
// State is always carried by three things: colour, shape and the spelled-out word, so it survives a
// monochrome screen, colour blindness and the CRT effect (system_design.md, Colour states).

import type { CSSProperties } from "react";



export type HazardState = "go" | "caution" | "no_go";



export const HAZARD_STATE_LABELS: Record<HazardState, string> = {
    go: "GO",
    caution: "CAUTION",
    no_go: "NO-GO",
};



// CSS variable per state, defined in theme/tokens.css.
export function hazardStateColour(state: HazardState): string {
    if (state === "go") {
        return "var(--ariadne-go)";
    }
    if (state === "caution") {
        return "var(--ariadne-caution)";
    }
    return "var(--ariadne-no-go)";
}



const SHAPE_SIZE_PX = 22;



// Filled circle = go, triangle = caution, octagon with a cross = no-go.
export function StateShape({ state, sizePx = SHAPE_SIZE_PX }: { state: HazardState; sizePx?: number }) {
    if (state === "go") {
        return (
            <svg width={sizePx} height={sizePx} viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="9" fill="currentColor" />
            </svg>
        );
    }
    if (state === "caution") {
        return (
            <svg width={sizePx} height={sizePx} viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
                <polygon points="12,2 23,22 1,22" fill="currentColor" />
                <path d="M12 9 V15" stroke="var(--ariadne-screen-black)" strokeWidth="2.4" strokeLinecap="round" />
                <circle cx="12" cy="18.2" r="1.3" fill="var(--ariadne-screen-black)" />
            </svg>
        );
    }
    return (
        <svg width={sizePx} height={sizePx} viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
            <polygon points="8,2 16,2 22,8 22,16 16,22 8,22 2,16 2,8" fill="currentColor" />
            <path d="M8 8 L16 16 M16 8 L8 16" stroke="var(--ariadne-screen-black)" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
    );
}



export interface StateBadgeProps {
    state: HazardState;
    // Optional extra word after the state, for example "GO, 27 min left".
    detail?: string;
    sizePx?: number;
    style?: CSSProperties;
}



export function StateBadge({ state, detail, sizePx = SHAPE_SIZE_PX, style }: StateBadgeProps) {
    const colour = hazardStateColour(state);
    const label = HAZARD_STATE_LABELS[state];
    return (
        <span
            className="inline-flex items-center gap-1.5 border px-2 py-1 text-sm font-bold uppercase tracking-wider"
            style={{ color: colour, borderColor: colour, background: "rgba(5, 10, 6, 0.72)", ...style }}
            aria-label={detail === undefined ? label : `${label}, ${detail}`}
        >
            <StateShape state={state} sizePx={sizePx} />
            <span>{label}</span>
            {detail !== undefined && <span className="font-normal normal-case tracking-normal text-ariadne-text">{detail}</span>}
        </span>
    );
}
