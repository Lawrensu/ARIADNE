# Suit HUD components

Stage 3 full-screen Suit HUD (owner: Letta). Local grid only, no latitude or longitude in the UI.
State is always colour, shape and word through `theme/StateBadge`. Tap targets are 64 px on the HUD
(`ariadne-tap-hud`). Colours come only from `theme/tokens.css`.


## Exports

1. `SuitHud({ alertSlot })` from `SuitHud.tsx`
   - Fixed inset-0 overlay, rendered only when `isSuitHudOpen` is true (from `state/hudSlice.ts`).
   - `alertSlot?: ReactNode`: the main agent passes the AlertStack here. The HUD does not import
     `app/src/alerts/`.
   - Contains the header, compass tape, next Knot block, exactly three 64 px readings, the science
     budget chip, the labelled ALERTS area, the footer and the on-demand sheets.
2. `HudLauncher()` from `SuitHud.tsx`
   - A 64 px "SUIT HUD" button for the map corner. Calls `setSuitHudOpen(true)`.
3. `CompassTape({ headingDeg, nextKnotBearingDeg, sunAzimuthDeg })` from `CompassTape.tsx`
   - Cardinal ticks, current heading, a marker for the next Knot and a marker for the sun.
   - Bearings are degrees clockwise from north. Pass `null` for a marker that is not known.
4. `HudTile({ label, value, state, ariaLabel, isEstimate?, detail?, style? })` from `HudTile.tsx`
   - One big reading with a `StateBadge`. `value` is already formatted text.
   - `isEstimate` adds the "est." badge. `detail` is short optional text after the badge.
5. Pure helpers from `hudMath.ts`
   - `bearingDegrees`, `normalizeBearing`, `bearingWord`.
   - `formatDistanceMetres`, `formatDurationHm`, `formatMinutesEstimate`, `formatSignedMinutes`,
     `formatScienceBudgetChip`, `formatMeasurement`.
   - `threadMarginState`, `o2State`, `nearestEnvironmentSample`.
   - `selectNextKnot`, `computeHudNumbers`, `emptyHudNumbers`.


## What the main agent wires

- Mount `<SuitHud alertSlot={<AlertStack />} />` once, high in the app, and mount `HudLauncher`
  where the map corner control belongs. Both read the store directly; no props beyond `alertSlot`.
- The HUD opens from `HudLauncher` or any other caller of `setSuitHudOpen(true)`.
- The footer RESET VIEW calls `requestViewReset(viewMode)`. The footer and header EXIT HUD call
  `setSuitHudOpen(false)`.
- The science budget chip opens `hudSheet === "science_budget"`. The CONDITIONS chip opens
  `hudSheet === "conditions"`. Closing a sheet sets `hudSheet` back to `"none"`.


## Data and fallbacks

- Readings come from `processedData`, `astronautPosition`, `astronautHeadingDeg`,
  `simElapsedSeconds`, `sciencePlan` and `completedTaskIds`, each through a separate Zustand
  selector.
- Missing position falls back to `meta.staging_point`. Missing pipeline data shows "unknown" and
  no-go badges instead of NaN.
- The next Knot is the first science plan stop that still has tasks to do, else the nearest Knot.
  Its distance and walk time come from the plan's `walk_to_knot` leg when that leg exists, else
  from the straight-line distance and the walking model times the current load factor, marked "est.".
- Thread margin is `computeThreadInfo(...).time_left_s` minus `return_field[current cell]` times
  the current load factor. O2 is the 8 h suit capability remaining from `computeConsumablesState`.
- The conditions sheet shows the environment timeline sample nearest the simulation time and says
  openly that the weather sol and the May 2024 storm come from different dates (D-025).


## Tests

`npx vitest run src/hud` covers the bearing maths (north 0, east 90, south 180, west 270, wrap at
359 and 0), the format helpers, the Thread margin and O2 thresholds, the environment sample lookup,
the next Knot selection and the three HUD numbers.
