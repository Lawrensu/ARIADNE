# ARIADNE Stage 3 visual direction (proposal for Letta)

Date: 2026-11-14. Author: Letta's main agent. Status: approved as built (Lawrence for the team, 2026-11-14, D-030).

Mood: retro, classic, old school. A rugged field terminal bolted into a suit, not a game skin. ARIADNE keeps its own name, wordmark, icons and layout; no Pip-Boy, Iron Lung or Alien: Isolation logo, icon or exact layout is copied.


## 1. Palette

Two phosphor channels on a near-black tube: green is ARIADNE's own channel (structure, actions, go), warm parchment/amber is the data channel (measured values, headings), rust is stop. It blends the green terminal from the No, I'm Not A Human screenshot with the amber-on-black and cream type of Alien: Isolation and Iron Lung, and stays inside ARIADNE's ochre/rust family.

Core:
1. `screen_black` #050A06: page background, CRT tube off.
2. `panel_green` #0A140C: panels and sheets.
3. `panel_raised` #0F1F13: selected rows, chips.
4. `phosphor_green` #5CE87F: primary accent, active controls, The Thread line, GO. Contrast 12.6:1.
5. `signal_green_dim` #4CAF6E: secondary lines and icons. Contrast 7.3:1.
6. `grid_green` #3A7A50: hairlines and borders only. Contrast 3.9:1 (meets the 3:1 non-text minimum).
7. `phosphor_white` #EAF6E2: primary text. Contrast 17.8:1.
8. `parchment` #E9D8A6: data values and headings (the Iron Lung cream). Contrast 14.1:1.
9. `muted_green` #A9BFA4: secondary text. Contrast 10.1:1.
10. `dim_green` #7F947C: labels and provenance only. Contrast 6.1:1.

State colours, always paired with shape and word:
1. GO: #5CE87F, filled circle, "GO". Contrast 12.6:1.
2. CAUTION: #FFC857, triangle with exclamation, "CAUTION". Contrast 13.0:1.
3. NO-GO: #FF6B4A, octagon with cross, "NO-GO". Contrast 7.1:1.

All text colours are at least 4.5:1 on both #050A06 and #0A140C (WCAG AA). The three states also differ in shape and in the spelled-out word, so colour is never the only signal and the screen still reads in monochrome.


## 2. Typography (self-hosted, two families)

1. Display: VT323 (`@fontsource/vt323`). A 1980s terminal pixel face for the wordmark, section headings, HUD numerals and the Mars clock. Only at 20 px and up, where pixel edges stay crisp.
2. Text and data: IBM Plex Mono 400/600 (`@fontsource/ibm-plex-mono`). Highly readable monospace for body text, tables, provenance and buttons, including 14 px.
3. Fallback: `ui-monospace, "Cascadia Mono", Consolas, monospace`.
4. Both packages are bundled by Vite, imported in `main.tsx`. No Google Fonts, no font CDN, no network at run time. `font-display: swap` is not needed because the fonts are local files.

Type scale (CSS variables): 12 px label, 14 px body, 16 px body large, 20 px heading, 28 px HUD number, 40 px display.

Spacing scale: 4, 8, 12, 16, 24, 32 px. Tap targets: 64 px on the Suit HUD, at least 48 px on the Planning Table, 8 px minimum gap.


## 3. Layout sketches

Desktop, 1280 px and wider:
```
+------+----------------+--------------------------------------------+
| rail | panel 340 px   | status strip: ARIADNE  Mars 14:32  REPLAY  |
| 88px | Plan           | +----------------------------------------+
| Plan |  [Plan all]    | |                                        |
|Route | Route          | |            MAP (full size)             |
|Layer |  [Plan route]  | |         Gale inset bottom right        |
| Time | Layers         | |         Thread + routes + Knots        |
| HUD  |  toggles       | |                                        |
|      | Time           | |  bottom-left: [Suit HUD] [Reset view]  |
+------+----------------+--------------------------------------------+
```
Tablet, 768 to 1279 px: map fills the screen; a 64 px icon rail opens a 360 px overlay panel over the map (dismiss with the same tab or a close button); compact status strip; Gale inset hidden.

Phone, 375 px: map full bleed; 56 px top status bar (wordmark, Mars time, replay badge, menu); bottom sheet with four 64 px tabs (Plan, Route, Layers, Time), 48 percent screen height when open, handle to drag closed; 64 px HUD button bottom right; no horizontal scroll.

Sections, one main action each:
1. Plan: "Plan all Knots".
2. Route: "Plan route" (start, destination, fast/safe/smooth).
3. Layers: toggles, legend, provenance.
4. Time: clock, speed, "Advance 15 min", scenario replay.
5. Suit: opens the full-screen HUD.

Panels remember the last tab; opening a panel never resizes the map on phone or tablet. The map is always full size underneath.


## 4. Suit HUD elements

1. Compass tape across the top: cardinal ticks, current bearing, a marker for the next Knot and the sun azimuth; readable at arm's length.
2. Next Knot: name, distance, bearing, est. walk time.
3. Exactly three big numbers, 64 px tiles: distance to next Knot, Thread margin (minutes, plus the ring area on tap), O2 (hours and minutes left of the 8 h suit).
4. Science budget: one 64 px chip ("+27 min left") that opens the plan sheet with tasks and the drop suggestion.
5. State chip on every reading: shape plus word plus colour.
6. Alert stack: what happened, action, distance and time, 64 px [ROUTE].
7. Footer: [RESET VIEW] and [EXIT HUD], each 64 px.
8. Everything else (weather, dose, temperature, task list, provenance) one tap away in sheets.

CRT look: scanlines, 1.5 percent barrel curvature, grain, vignette, one toggle "CRT effects" in the status strip, off by default so the demo is legible; when on, effects sit above the map but below text (text stays crisp), intensity capped so contrast stays above 4.5:1.


## 5. What changes in the app

1. New `app/src/theme/tokens.css` with the variables above, and Tailwind `@theme` aliases so existing `ariadne-*` classes keep working.
2. New `app/src/theme/` components: `StateBadge` (shape plus word plus colour), `CrtOverlay`, `ProvenancePopover`.
3. `App.tsx` restructured into rail plus tabbed panel plus status strip, with the existing Planning Table, Labyrinth view and panels kept inside; the store shape is unchanged (new slices only in new files).
4. Fonts imported in `main.tsx` from the two @fontsource packages.
5. No contract files, pipeline outputs or routing/Thread/science numbers change.


## 6. Interface redesign (D-031, 2026-11-14)

Lawrence's direction: inspired by a retro field-terminal map (one monochrome phosphor map, a mode tab bar across the top, a status bar across the bottom) and a 3D game map menu (bright walkable floors, an objective card with a checklist, a control legend along the bottom). Take the ideas, never the look: no game names, logos, icons, fonts or exact layouts. Goal: intuitive for an astronaut in gloves, nothing that reads as generated filler.

### 6.1 Rules for every screen

1. The map is the screen. It is always full size; everything else is a thin bar or a card floating over it.
2. One way to get anywhere: the mode tabs. No side rail, no "CONSOLE" panel, no second row of tabs.
3. Words are short labels, not paragraphs. At most one help line under a control; longer explanations go behind a small "?" (or the provenance popover).
4. One accent colour for "you can act on this" (phosphor green). Parchment only for data values. Caution and no-go colours only for hazards and alerts, always with shape and word.
5. Square corners, 1 px phosphor lines, no drop shadows, no gradients, no rounded "cards" look. Thin bracket corners or a top tab notch are the decoration.
6. Glove targets: 48 px minimum everywhere, 64 px in SUIT mode.
7. Phone 375, tablet 768, desktop 1280+: no horizontal scroll; the same structure at every width.

### 6.2 Layout

```
+----------------------------------------------------------+
| [gear]   MAP   PLAN   SUIT   DATA              REPLAY    |  tab bar, 56 px
+----------------------------------------------------------+
| OBJECTIVE card (top left)              ALERT (top right) |
|                                                          |
|                  full-screen map                         |
|                                                          |
| mode sheet (PLAN, DATA): left card on desktop,           |
| bottom sheet on phone and tablet, map stays visible      |
|                                                          |
| [-] [+]  [CENTER ON ME]  [RESET]  [2D/3D]  [LEGEND]      |  control legend, over the map
+----------------------------------------------------------+
| SOL 4760 LMST 13:20 | T+1:52 [>] 60x | O2 6:07 | THREAD +38 min |  status bar, 48 px
+----------------------------------------------------------+
```

- Tab bar: gear (system menu: Run demo scenario, Start walk, Back to rover, CRT effects on/off, credits), then MAP, PLAN, SUIT, DATA as large uppercase VT323 tabs; the active tab is filled phosphor green with a notch joining it to the frame line below; a REPLAY badge on the right.
- MAP (default): map, objective card, alert card, control legend, status bar.
- PLAN: MAP plus the plan sheet: science plan (one main action "Plan all Knots"), then "Route between two places" folded below.
- SUIT: the Suit HUD fills the area between the tab bar and the status bar (not a separate full-screen overlay). Leaving SUIT returns to the map.
- DATA: MAP plus the data sheet: Layers (toggles with legend swatches), Knots (list opening Knot cards), Mars time, Gale context image.
- Objective card: "OBJECTIVE" header, the next Knot (or "Shelter: rover" while rerouted, or "Plan a walk" with a PLAN button when there is no plan), its tasks as a checklist with check boxes, and distance plus est. walk time. Collapses to one line on phone.
- Control legend: buttons, not just hints: zoom out, zoom in, Center on me, Reset view, 2D/3D switch, Legend (opens the marker and layer legend). On desktop a quiet hint line: "drag pan, right-drag rotate, wheel zoom".
- Status bar: replayed sol and LMST, sim clock T+h:mm with play/pause and speed, O2 left, Thread margin, each with its state colour and "est." where it is an estimate.

### 6.3 Map look ("phosphor hologram")

- Terrain: the real HiRISE relief rendered in phosphor green shades on near-black (luminance of the orthoimage mapped onto a green ramp), so it stays real data but reads as one display.
- Walkable ground is lit (brighter green); no-go ground (traversal penalty no-go, slope over 25 degrees) is dark with a fine diagonal hatch, so the safe floor reads at a glance.
- A faint square grid (100 m) over the terrain gives scale.
- Lines: the Thread is the brightest line (solid, glowing); the science plan is parchment dashed; routes use phosphor green with distinct dash patterns and labels for fast, safe and smooth.
- Markers are glyphs: diamond Knot, square rover, triangle shelter, circle-with-arrow you. Labels show only for Knots, the rover, the current objective and a hovered or selected marker; shelters show their label on hover or when an alert targets them.
- Default view: flat, north-up 2D. 3D is one tap away.
