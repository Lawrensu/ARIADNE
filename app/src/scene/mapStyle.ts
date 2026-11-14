// Shared look of everything drawn on the phosphor map (visual_direction.md 6.3, D-031): line colours,
// line casing, label plate. Plain constants, no React. The values are the theme/tokens.css palette,
// repeated here because WebGL lines need literal colours, not CSS variables.



export const MAP_COLOURS = {
    screen_black: "#050a06",
    panel_green: "#0a140c",
    phosphor_green: "#5ce87f",
    signal_green: "#4caf6e",
    grid_green: "#3a7a50",
    phosphor_white: "#eaf6e2",
    parchment: "#e9d8a6",
    muted_green: "#a9bfa4",
    caution: "#ffc857",
    no_go: "#ff6b4a",
} as const;



// Every line on the map sits on a dark casing (a wider near-black line underneath), so a green line
// stays readable on green terrain. Extra width in screen pixels (half on each side of the line).
// Lines are drawn fully opaque but flagged transparent, so they render after the draped overlays in
// renderOrder. Lines are not see-through on purpose: a path is hundreds of short segments, and a
// half-transparent line would show bright beads where the segments overlap.
export const LINE_CASING_COLOUR = MAP_COLOURS.screen_black;
export const LINE_CASING_EXTRA_WIDTH_PX = 3;
export const LINE_CASING_OPACITY = 1;


// Glow: a second, much wider, low-opacity line under the Thread. It is the one see-through line; a
// stencil test lets each pixel be drawn once, so the overlapping segments do not add up.
export const GLOW_EXTRA_WIDTH_PX = 9;
export const GLOW_OPACITY = 0.3;
export const GLOW_STENCIL_REF = 1;


// Draw order of map lines (higher on top). Overlays use 1..15, markers are DOM above the canvas.
export const LINE_RENDER_ORDER = {
    thread_glow: 20,
    thread_casing: 21,
    thread_core: 22,
    route_casing: 28,
    route_line: 30,
    science_plan_casing: 32,
    science_plan_line: 33,
    walk_trail: 35,
} as const;



// Label plate: small uppercase IBM Plex Mono on a dark plate with a 1 px border, square corners.
export const LABEL_FONT_SIZE_PX = 11;
export const LABEL_PLATE_BACKGROUND = "rgba(5, 10, 6, 0.88)";
