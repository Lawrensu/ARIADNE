# ARIADNE Stage 3 visual direction (proposal for Letta)

Date: 2026-11-14. Author: Letta's main agent. Status: awaiting Letta's approval before any UI build.

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
