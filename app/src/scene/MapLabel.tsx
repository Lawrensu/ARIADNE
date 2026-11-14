// The one label style on the map (visual_direction.md 6.3): small uppercase IBM Plex Mono on a dark
// plate with a 1 px border, square corners. Labels never take pointer events, so a drag that starts
// on a label still pans the map. Render inside a drei <Html> element.

import type { CSSProperties, ReactNode } from "react";

import { LABEL_FONT_SIZE_PX, LABEL_PLATE_BACKGROUND, MAP_COLOURS } from "./mapStyle";



// "phosphor": markers and routes. "parchment": science plan data.
export type MapLabelTone = "phosphor" | "parchment";

// "normal": dark plate. "emphasis": filled plate with dark text (current objective or selection).
// "quiet": dimmer border, for secondary labels such as an unselected route.
export type MapLabelEmphasis = "normal" | "emphasis" | "quiet";



function toneColour(tone: MapLabelTone): string {
    if (tone === "parchment") {
        return MAP_COLOURS.parchment;
    }
    return MAP_COLOURS.phosphor_green;
}


export function mapLabelStyle(tone: MapLabelTone, emphasis: MapLabelEmphasis): CSSProperties {
    const accent = toneColour(tone);
    let background: string = LABEL_PLATE_BACKGROUND;
    let color: string = MAP_COLOURS.phosphor_white;
    let borderColor: string = accent;
    if (emphasis === "emphasis") {
        background = accent;
        color = MAP_COLOURS.screen_black;
    } else if (emphasis === "quiet") {
        borderColor = MAP_COLOURS.grid_green;
        color = MAP_COLOURS.muted_green;
    }
    return {
        display: "inline-block",
        whiteSpace: "nowrap",
        padding: "1px 5px",
        fontFamily: "var(--ariadne-font-mono)",
        fontSize: LABEL_FONT_SIZE_PX,
        fontWeight: 600,
        lineHeight: 1.35,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color,
        background,
        border: `1px solid ${borderColor}`,
        borderRadius: 0,
        pointerEvents: "none",
        userSelect: "none",
    };
}


export function MapLabel({
    children,
    tone = "phosphor",
    emphasis = "normal",
    style,
}: {
    children: ReactNode;
    tone?: MapLabelTone;
    emphasis?: MapLabelEmphasis;
    style?: CSSProperties;
}) {
    return <span style={{ ...mapLabelStyle(tone, emphasis), ...style }}>{children}</span>;
}
