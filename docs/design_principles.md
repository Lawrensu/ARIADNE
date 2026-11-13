# ARIADNE design principles

Source of truth for: UX principles, feature vocabulary, the two-view concept, colour states and visual identity.

If this file disagrees with docs/contracts.md or an accepted entry in docs/decisions.md, those win. Report the conflict.


## UX principles

1. **At most about 3 numbers at once on the Suit HUD.** Distance to next Knot, Thread margin, O2. Everything else is on demand.
   In practice: the Suit HUD shows "Knot B 210 m", "Thread +14 min", "O2 4 h 10"; wind, dose and temperature appear only when tapped.
2. **Go / caution / no-go on every reading.** No interpretation needed.
   In practice: the dose rate shows "CAUTION" with its icon beside the number, not just a number.
3. **Designed for gloves and helmets.** Large tap targets. Voice is out of scope for now.
   In practice: the [ROUTE] button on an alert is large enough to hit with a gloved finger.
4. **Provenance on every number.** Tap to see dataset, timestamp, uncertainty.
   In practice: tapping "slope 12°" shows the HiRISE DTM product ID, 1 m resolution and the slope uncertainty.
5. **Never fake precision.** Model estimates are labelled "est.".
   In practice: rock abundance below the detection limit reads "est. 8 %", never "8.0 %".
6. **Alerts always come with an action.**
   In practice: not "Solar storm detected" but "Solar storm: shelter at Knot B, 340 m, 6 min. [ROUTE]".


## Feature vocabulary

Use these names consistently in code, UI and docs.

- **The Thread:** the safe-return ring. The boundary of everywhere the astronaut can reach and still walk back to the staging point with the remaining consumables minus a reserve. It shrinks as they walk.
- **Knots:** science waypoints along the route.
- **Labyrinth view:** the 3D terrain view of the Marswalk site.
- **Planning Table:** the habitat/rover display: big map, all layers, plan the route.
- **Suit HUD:** the minimal in-suit display: compass bar, next Knot, Thread margin, O2, alerts.
- **Staging point:** where the pressurised rover parks at the edge of the patch; the Thread is computed relative to it.
- **Ari:** crew shorthand for ARIADNE.


## Two views

1. Planning Table
   - Where: habitat or rover display (tablet or large screen).
   - Shows: big map (top-down orthographic or Labyrinth 3D), all layers, route planning, Knot cards, Gale regional context.
   - Hides: nothing by default; layers are toggled.
   - Purpose: plan the route before and during the EVA.
2. Suit HUD
   - Where: inside the helmet / on the suit.
   - Shows: compass bar, next Knot, Thread margin, O2, alerts.
   - Hides: everything else; extra data only on demand by tap.
   - Purpose: stay safe and oriented while walking.

The Labyrinth view (3D terrain) is available on the Planning Table. Whether the Suit HUD also offers a 3D view is TBD (Person C).


## Colour states

Three states apply to every reading: **go**, **caution**, **no-go** (string values `"go"`, `"caution"`, `"no_go"`).

Person C proposes the exact colour values; the whole team approves. Constraints:

- The theme is monochrome ochre/rust, so the three states must remain distinguishable within that range (and in monochrome).
- Pair colour with shape, icon and text so state is never conveyed by colour alone. Proposal: go = filled circle + "GO"; caution = triangle + "CAUTION"; no-go = cross or octagon + "NO-GO". Final icons TBD (Person C).


## Visual identity

A retro CRT terminal HUD, inspired by the genre: scanlines, monochrome ochre/rust palette, pixel font (for example VT323), slight screen curvature. Implemented with `@react-three/postprocessing`.

ARIADNE has its own identity. Do not copy the look, name or iconography of Fallout's Pip-Boy.

Person C proposes the exact palette values; the whole team approves. Font and effect strengths are TBD (Person C). Effects must not reduce legibility; keep a way to reduce or disable scanlines and curvature.


## Provenance pattern

Tap any number to see: dataset, product ID, resolution, timestamp and uncertainty. Model-derived values carry an "est." badge, and that badge appears both beside the number and in the provenance view. The source of this data in the app is described in docs/system_design.md ("Data provenance flow").

Replayed data states itself: for example "replaying REMS sol NNNN".


## Alert anatomy

Every alert has four parts:

1. **What happened.** "Solar storm".
2. **Action.** "Shelter at Knot B".
3. **Distance and time.** "340 m, 6 min".
4. **One-tap route.** "[ROUTE]" starts the reroute.

Example: "Solar storm: shelter at Knot B, 340 m, 6 min. [ROUTE]". An alert without an action is a bug. Alert severity uses the go / caution / no-go states.


## Glove-friendly sizing

Large tap targets everywhere, especially on the Suit HUD. Proposed minimum: 48 px logical (about 10 mm) on the Planning Table and 64 px on the Suit HUD, with generous spacing between targets. Final minimum is TBD (Person C).

No tiny controls, no hover-only interactions, no precision gestures; tap, not drag, wherever possible.


## Accessibility notes

- Never rely on colour alone: pair it with shape, icon or text.
- Contrast: text and key icons must keep strong contrast against the dark CRT background in the ochre theme. Minimum ratio TBD (Person C); aim for WCAG AA (4.5:1) or better.
- CRT effects (scanlines, curvature, flicker) must not obscure text; make them reducible.
- Use plain, short wording; state units and uncertainty explicitly.
