# ARIADNE system design

Source of truth for: architecture, the local grid, components, data flow, algorithms, UX design principles and visual identity, and why ARIADNE is designed this way.

If this file disagrees with docs/contracts.md or an accepted entry in docs/decisions.md, those win. Report the conflict.


## Goals

ARIADNE has three engineering goals: **light, accurate, hard to break**.

- **Light.** The app is a static site. All heavy computation (reprojection, slope, rock detection, return field) runs once, offline, in Python. The browser only loads the processed files, draws them, and does cheap runtime work (routing on a grid, a contour at a threshold). Limits are in "Performance budget".
- **Accurate.** All georeferencing happens ONCE, in Python, onto a single local metric grid. The app never reprojects. Every displayed value carries provenance (dataset, product ID, resolution, timestamp, uncertainty), and model-derived values are labelled "est.". The walking-time function exists in Python and TypeScript and both must pass the same test vectors.
- **Hard to break.** One rendering stack (React Three Fiber only), one coordinate system, one set of data contracts with a validator. No network dependency during the demo: the app replays recorded data on a simulation clock. Contract fields and string constants are deprecate-only (D-012).


## Design rationale

The problem: Mars maps are built for planets, not for one walk. Mars Trek, the USGS global geologic map, JMARS and Google Earth work at regional or global scale. Rover tools (MMGIS, OnSight) serve ground teams for robots. Human EVA research tools have been tested on Earth analogs and the Moon. On a ~2 km Marswalk, 18% of the patch is steeper than 25°, and no tool we found ties real Mars terrain, radiation, weather and the oxygen left into one answer to "can I still get home?".

The gap: no tool we found combines real Mars terrain data, a suit-calibrated walking cost, consumables, and a continuously updated safe-return boundary for one astronaut on one walk, available offline in both a habitat view and a suit view.

What makes ARIADNE different, each point tied to the gap it closes:

1. **The Thread.** Gap: Apollo walkback limits were computed by ground teams and recalculated manually during each EVA ([Apollo 11 Lunar Surface Journal](https://www.nasa.gov/wp-content/uploads/static/history/alsj/a11/a11.gaits.html)). The Thread is a live safe-return boundary: the planned Marswalk time left (6 h minus elapsed minus a 30 minute reserve), scaled by the carried load and recalculated as the crew walks, with alerts that always include an action.
2. **Local walking cost.** Gap: Minerva (xGDS, SEXTANT, Playbook) authors report time estimates too inaccurate to use, a constant walking speed in xGDS, no terrain traversability, and poor fit for replanning during an EVA ([Marquez 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC6442304), [xGDS](https://software.nasa.gov/software/ARC-17174-1)). ARIADNE uses Tobler walking time from the 1 m HiRISE DTM, rocks and roughness in the penalty, peak speed capped at Apollo's ~1.0 m/s, no-go above 25°.
3. **One patch, many datasets.** Gap: portals such as [Mars Trek](https://trek.nasa.gov/mars/jpl/config/textAbout.html) and [JMARS](https://jmars.mars.asu.edu/what-jmars) are global and built for scientists, with no walking time or consumables. ARIADNE shows HiRISE terrain, REMS weather, RAD radiation, CRISM minerals, THEMIS thermal inertia and a solar particle event in one view.
4. **Real ground photos at Knots.** Gap: orbiter maps show no point of view. Curiosity photos at five science waypoints tell the astronaut what to expect.
5. **Provenance and "est." on every number.** Gap: none of the tools above show dataset, resolution and uncertainty at the point of use.
6. **Two views, offline.** Gap: [MMGIS](https://github.com/NASA-AMMOS/MMGIS) and [OnSight](https://software.nasa.gov/software/NPO-50830-1) need servers and ground teams. ARIADNE is a Planning Table for the habitat and a minimal Suit HUD, from one local grid and a static app.

Evidence it works:

- DTM slope matches Curiosity's measured tilt at 205 stops (median 8.8° vs 8.4°), so slope rules are trustworthy (D-019).
- All 5 Knots are 11 to 26 minutes' walk from the rover, and 79.4% of the patch is reachable from it.
- Walking speed is anchored to Apollo's maximum nominal suited speed (~1.0 m/s). Consumables follow Artemis 8 hour EVA planning (D-020).
- Built only from public NASA data, checked by a validator (46 of 46 checks) and 63 tests.

Honest limits:

- ARIADNE replays real historical data on a simulation clock; nothing is live (D-014).
- Walking times and doses are estimates; the gravity adjustment is 1.0 because the evidence is thin.
- It is not field tested, and only one ~2 × 2 km patch is covered.


## System overview

```
 raw NASA data (data/raw, git-ignored)
   HiRISE ortho + DTM, THEMIS TI, CRISM mineral maps,
   REMS + RAD (PDS), Viking MDIM regional mosaic
        |
        v
 pipeline  (Python, uv, offline, run once)        <- Person A, Stage 1
   settings -> grid -> walking -> terrain -> rocks -> penalty
   -> return_field -> sky_view (viewshed, shelters) -> surface
   -> knots -> environment -> regional -> export -> validate
        |
        v
 data/processed  (contract files, formats in docs/contracts.md, committed to git, D-022)
        |
        v
 app  (React + Vite + TypeScript + R3F, static hosting)
   scene | layers | routing | thread | sim | hud | alerts | knots | state
        |
        +--> Planning Table   (orthographic top-down camera, all layers, plan route)
        +--> Suit HUD         (minimal: compass bar, next Knot, alerts)
        +--> Labyrinth view   (perspective 3D terrain of the patch)
        +--> Gale regional context (static image on a plane)
```

Data flows one way: pipeline to processed files to app. The app never writes back and never reads raw data.


## Local grid coordinate system

The app uses one coordinate system, the local grid. Everything handed to the app is in metres on this grid.

Rules:

- Origin: the north-west corner of the patch.
- +x = east, +z = south, +y = up (Three.js is y-up).
- 1 cell = `cell_size_m` metres, read from `meta.json` (2.0 in v1.0.0, D-021). Never hard-code it. Row 0 is the north edge; column 0 is the west edge.
- Cell (row, col) has its centre at `x = (col + 0.5) * cell_size_m`, `z = (row + 0.5) * cell_size_m`.
- Latitude/longitude appear only for display, from the georeferencing in `meta.json`.

Real size: the patch is about 2,024 m × 1,869 m (D-017), a grid of 1,013 × 934 cells at 2 m, with the rover (staging point) at row 233, col 387 (D-018). Read sizes from `meta.json`.

Exact byte formats, array layouts, data types and dimensions live in docs/contracts.md, which is the source of truth for them. This document only fixes the coordinate convention.


## Pipeline (Stage 1, Person A)

Built layout:

```
pipeline/
  pyproject.toml            uv project
  run.py                    runs the full pipeline (script)
  ariadne_pipeline/         package; absolute imports, e.g. from ariadne_pipeline.terrain import slope_degrees
  content/
    knots_content.json      Knot science text and photo credits (D-023)
  tests/                    pytest suite (63 tests)
  validate/
    run.py                  contract validator (46 checks)
```

`run.py` first checks the walking test vectors, then runs these steps in order. Module names are in `ariadne_pipeline/`.

1. **settings.** Every fixed value in one place (patch bounds, staging point, walking and penalty parameters, Knot positions, product IDs), each citing its decision.
2. **grid.** The 1 m compute grid and the 2 m export grid, and the lat/lon to grid conversion. This is the only georeferencing step: everything is cropped and resampled onto the grid here (D-021).
3. **walking.** The shared walking-time function and its test vectors (contracts.md section 4).
4. **terrain.** Reads the HiRISE DTM at 1 m, fills small gaps, then derives the 2 m heightmap, slope (central differences on the 2 m heightmap) and roughness (computed at 1 m, maximum per 2 m cell), plus a soft-sand proxy (cells below the smoothed surface with low roughness).
5. **rocks.** Shadow-based detection on the 25 cm HiRISE orthoimage: diameter from shadow width, height from shadow length and sun incidence (from the image label). `run.py` keeps detections with confidence 0.6 or more; lower ones were mostly steep terrain edges. Reliable down to about 1.5 m; smaller rocks are not listed individually and are covered statistically by the penalty ("est.").
6. **penalty.** `traversal_penalty` from slope, roughness, rocks (1.5 m or larger, plus 0.5 m clearance) and soft sand. Rules in contracts.md 3.5.
7. **return_field.** One Dijkstra on the reversed walking graph from the staging point, 8-connected, using the shared walking-time function and the penalty. Result: seconds to walk back from every cell.
8. **sky_view.** Sky-view factor (16 directions, horizon up to 400 m), the rover viewshed (helmet 1.8 m to antenna 3 m), the rover shelter and terrain-overhang shelters (sky-view under 0.75, passable, reachable).
9. **surface.** THEMIS thermal inertia resampled to the grid, and CRISM mineral classes from ready-made summary parameters. A mineral class is kept only where two CRISM scenes agree; carbonate, seen in one scene only, is dropped. Both layers are context, not walk-level detail.
10. **knots.** Knot positions from `settings.KNOTS` (Curiosity stops), snapped to reachable ground if needed; text and photo credits from `pipeline/content/knots_content.json`; measurements read from the terrain layers with provenance.
11. **environment.** One real REMS sol (4760) and RAD dose rate, binned to 96 samples with Mars local time, for replay. A solar particle event profile from RAD (May 2024 storm, sol 4190) for the scenario (D-025).
12. **regional.** The Gale regional image from the Viking MDIM mosaic (200 km across, 2000 px, north up) and the patch rectangle in pixels. Uses an offline cache of the source crop in `data/raw/regional`, so runs need no network.
13. **export.** Writes the contract files to `data/processed` and `meta.json` with the layer registry, parameters and sources.
14. **validate.** `pipeline/validate/run.py`. The gate to Stage 2 requires it to pass.

Run from `pipeline/`: `uv run python run.py`, then `uv run python validate/run.py`.


## App (Stages 2 and 3)

Proposed layout (Persons B and C may adjust, record in decisions.md):

```
app/src/
  scene/     terrain mesh from heightmap + texture; cameras: perspective (Labyrinth view),
             orthographic top-down (Planning Table); static Gale regional plane
  layers/    overlay toggles (slope, rocks, sky-view, thermal inertia, mineralogy, viewshed...)
  routing/   A*, Theta*, D* Lite on the grid, using the shared walking-time function
  science/   science plan: ordered Knots and tasks, load factor, science budget (D-027)
  thread/    contour of return_field at the remaining-time threshold (marching squares)
  sim/       simulation clock with speed multiplier; scenario engine; scenario.json
  hud/       Suit HUD
  alerts/    alert model and rendering (what + action + distance/time + route)
  knots/     Knot cards with photos and provenance
  state/     Zustand store
```

Ownership (D-024):

- **Malissa (Person B, Stage 2):** app shell, `scene/`, `layers/`, `routing/`, `thread/`, `science/` (the planner logic), Planning Table, Labyrinth view, and the shape of the `state/` store.
- **Letta (Person C, Stage 3):** `hud/`, `alerts/`, `knots/`, `sim/` (clock and scenario engine), the science budget on the Suit HUD and task check-off at Knots, CRT look polish, demo and pitch. She adds store slices in separate files under `state/`.
- The scenario lives at `app/src/sim/scenario.json` (contracts.md 3.15). The Mars24 sun and time calculation runs in the app.
- Knot photos are copied into the app with credits, so the demo never needs the network.


## Algorithms

Problems and the algorithm used for each:

1. Walking cost
   - Algorithm: Tobler's hiking function with a suit speed factor of 0.6, gravity adjustment 1.0 and a 25° step limit.
   - Runs in: pipeline and app (same function in both).
   - Notes:
     - Earth Tobler: `speed_kmh = 6 * exp(-3.5 * abs(S + 0.05))`, S = dh/dx.
     - Direction-dependent (uphill differs from downhill), so edge cost = `walking_time_seconds(horizontal_distance_m, elevation_change_m)` times the maximum of the two cells' penalties (D-019).
     - Exact definition and test vectors are in docs/contracts.md section 4.
2. Routing
   - Algorithm: A* on the 8-connected 2 m grid (fast and safe options); Theta* any-angle search (the "smooth" option, D-028).
   - Runs in: app.
   - Notes: several weightings give fast and safe route options. Theta* walks each straight segment through every cell it crosses with the contract edge cost, so it never crosses a no-go cell or a step steeper than 25°; it is 2 to 10% faster than A* to the Knots. The Thread and science plan legs stay on the 8-connected model, which is the conservative side.
3. Rerouting
   - Algorithm: D* Lite.
   - Runs in: app.
   - Notes: fast replanning when hazards change; powers the solar storm reroute demo.
4. The Thread
   - Algorithm: one Dijkstra from the staging point (precomputed) gives `return_field`; the live ring is the contour of `return_field × load_factor` at the planned time left (6 h minus elapsed minus the 30 minute reserve, D-028). The 8 h suit capability is shown separately as O2.
   - Runs in: pipeline (field), app (contour).
   - Notes:
     - Marching squares (d3-contour or equivalent), cheap to update every tick.
     - Consumables (D-020): suit capability 8 h, planned Marswalk 6 h, 30 minute reserve never planned against, one shared Thread for the pair.
5. Terrain radiation shielding
   - Algorithm: sky-view factor from the DTM.
   - Runs in: pipeline.
   - Notes: fraction of open sky approximates relative GCR exposure. Labelled "est.". Not a spatial dose map (D-015).
6. Nearest shelter
   - Algorithm: D* Lite from the astronaut to shelter points (rover plus terrain overhangs, from `shelters.json`).
   - Runs in: app.
   - Notes: no nearest-shelter field is exported (D-024); no habitat in the patch.
7. Comms line-of-sight
   - Algorithm: viewshed on the 2 m DTM from the rover antenna.
   - Runs in: pipeline (`viewshed_rover.bin`).
   - Notes: shows comms dead zones, "est.".
8. Lighting
   - Algorithm: Mars24 sun position gives hillshade, real-time shadows in 3D, and time to sunset.
   - Runs in: app.
9. Rock detection
   - Algorithm: shadow-based; height from shadow length and sun incidence from image metadata.
   - Runs in: pipeline.
   - Notes: about 1.5 m and larger; smaller is statistical, "est.". SAM is stretch only (D-007).
10. Science plan (D-027)
   - Algorithm: multi-stop route (A* legs between the rover and the chosen Knots, in the chosen order), each leg timed with the load carried at that point (`load_factor = 1 + 0.01 × kg`, 10 kg tool kit, samples added after each task), plus task durations and the walk back.
   - Runs in: app (task content from `knots.json`, load values from `meta.json` parameters).
   - Notes:
     - Feasible only if total plan time fits the 6 hour Marswalk minus the 30 minute reserve (contracts.md 4.6).
     - The Thread scales with load: `return_field × load_factor`, exact because the factor is uniform.
     - When the margin gets tight, the planner suggests dropping the next task instead of cutting the walk back.


## UX design principles

1. **At most about 3 numbers at once on the Suit HUD.** Distance to next Knot, Thread margin, O2. Everything else is on demand.
   In practice: the Suit HUD shows "Knot B 210 m", "Thread +14 min", "O2 4 h 10"; wind, dose and temperature appear only when tapped.
2. **Go / caution / no-go on every reading.** No interpretation needed.
   In practice: the dose rate shows "CAUTION" with its icon beside the number, not just a number.
3. **Designed for gloves and helmets.** Large tap targets. Voice is out of scope for now (D-006).
   In practice: the [ROUTE] button on an alert is large enough to hit with a gloved finger.
4. **Provenance on every number.** Tap to see dataset, timestamp, uncertainty.
   In practice: tapping "slope 12°" shows the HiRISE DTM product ID, 1 m resolution and the slope uncertainty.
5. **Never fake precision.** Model estimates are labelled "est.".
   In practice: rock abundance below the detection limit reads "est. 8 %", never "8.0 %".
6. **Alerts always come with an action.**
   In practice: not "Solar storm detected" but "Solar storm: shelter at Knot B, 340 m, 6 min. [ROUTE]".


### Feature vocabulary

Use these names consistently in code, UI and docs.

- **The Thread:** the safe-return ring. The boundary of everywhere the astronaut can reach and still walk back to the staging point within the planned Marswalk time minus a reserve, with the load they carry. It shrinks as they walk.
- **Knots:** science waypoints along the route, each with science tasks (imaging, samples, measurements).
- **Science budget:** science time still available after the walk back and the reserve; shrinks with every step and every sample carried.
- **Labyrinth view:** the 3D terrain view of the Marswalk site.
- **Planning Table:** the habitat/rover display: big map, all layers, plan the route.
- **Suit HUD:** the minimal in-suit display: compass bar, next Knot, Thread margin, O2, alerts.
- **Staging point:** where the pressurised rover parks at the edge of the patch; the Thread is computed relative to it.
- **Ari:** crew shorthand for ARIADNE.


### Two views

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


### Colour states

Three states apply to every reading: **go**, **caution**, **no-go** (string values `"go"`, `"caution"`, `"no_go"`).

Person C proposes the exact colour values; the whole team approves. Constraints:

- The theme is monochrome ochre/rust, so the three states must remain distinguishable within that range (and in monochrome).
- Pair colour with shape, icon and text so state is never conveyed by colour alone. Proposal: go = filled circle + "GO"; caution = triangle + "CAUTION"; no-go = cross or octagon + "NO-GO". Final icons TBD (Person C).


### Visual identity

A retro CRT terminal HUD, inspired by the genre: scanlines, monochrome ochre/rust palette, pixel font (for example VT323), slight screen curvature. Implemented with `@react-three/postprocessing`.

ARIADNE has its own identity. Do not copy the look, name or iconography of Fallout's Pip-Boy.

Person C proposes the exact palette values; the whole team approves. Font and effect strengths are TBD (Person C). Effects must not reduce legibility; keep a way to reduce or disable scanlines and curvature.


### Provenance pattern

Tap any number to see: dataset, product ID, resolution, timestamp and uncertainty. Model-derived values carry an "est." badge, both beside the number and in the provenance view. Replayed data states itself: for example "replaying REMS sol 4760". See "Data provenance flow" for where the data comes from.


### Alert anatomy

Every alert has four parts:

1. **What happened.** "Solar storm".
2. **Action.** "Shelter at Knot B".
3. **Distance and time.** "340 m, 6 min".
4. **One-tap route.** "[ROUTE]" starts the reroute.

Example: "Solar storm: shelter at Knot B, 340 m, 6 min. [ROUTE]". An alert without an action is a bug. Severity uses the go / caution / no-go states. These parts map to `display_message` and `recommended_action` in `scenario.json`.


### Glove-friendly sizing and accessibility

- Large tap targets everywhere, especially on the Suit HUD. Proposed minimum: 48 px logical (about 10 mm) on the Planning Table and 64 px on the Suit HUD, with generous spacing. Final minimum TBD (Person C).
- No tiny controls, no hover-only interactions, no precision gestures; tap, not drag, wherever possible.
- Never rely on colour alone: pair it with shape, icon or text.
- Text and key icons keep strong contrast against the dark CRT background; aim for WCAG AA (4.5:1) or better (minimum TBD, Person C).
- CRT effects (scanlines, curvature, flicker) must not obscure text; make them reducible.
- Plain, short wording; state units and uncertainty explicitly.


## Simulation and "real-time"

No one is on Mars, so the app does not claim live data. It replays real historical data on a simulation clock with a speed multiplier (D-014, D-025).

- **Replay.** REMS sol 4760 and RAD dose rate drive the environment readings over the sim clock.
- **Scenario.** A scripted event runs on the same clock: a solar particle event alert mid-walk (the May 2024 storm RAD measured). The alert fires, D* Lite reroutes to the nearest shelter, and the Thread updates.
- **Honesty.** The UI and pitch state the sources openly, including that the weather sol and the storm come from different dates.


## Data provenance flow

Every displayed number must be traceable: dataset, product ID, resolution, timestamp, uncertainty; model-derived values labelled "est.".

1. The pipeline records provenance as it ingests and derives data, with an `is_estimate` flag where applicable.
2. Dataset-level provenance goes into `meta.json`; per-record provenance (per Knot measurement, rock, timeline sample) goes in per-record fields. Field names are in docs/contracts.md.
3. The app loads provenance with the data and keeps it attached through the Zustand store.
4. In the UI, tapping any number opens its provenance (see "Provenance pattern").

Derived values (for example Thread margin) list the datasets they derive from.


## Performance budget

- Export grid 2 m (1,013 × 934 cells). `data/processed/` is about 33 MB raw (14 to 24 MB compressed), every file under 4 MB. Target at most about 30 MB (Person B confirms).
- Texture at most 4096 × 4096 (about 0.5 m per pixel).
- Decimate the terrain mesh if the frame rate needs it.
- Do heavy work in Python, not in the browser. Compute at 1 m, export at 2 m (D-021).


## Out of scope and rejected options

- **Cesium:** a globe engine; unnecessary for a 2 km patch and a second coordinate system.
- **MapLibre / Leaflet / OpenLayers:** a second rendering stack; the 2D view is the same R3F scene with an orthographic camera.
- **deck.gl:** another rendering stack, no benefit over R3F here.
- **Unity / Unreal:** heavy, not web-static, does not fit the 48 h budget.
- **Voice assistant:** out of scope (D-006).
- **SAM (Segment Anything) for rocks:** stretch only (D-007).
- **Raw CRISM processing:** only ready-made mineral maps are used.


## Known limitations

Each limitation is stated once here; "Honest limits" above covers replay, estimates and field testing.

- A 1 m DTM smooths the 1 to 2 m boxwork ridges: they appear but flattened.
- THEMIS thermal inertia is about 100 m per pixel (10 to 30 pixels across the patch) and CRISM about 18 m: context, not walk-level information. CRISM classes are weak candidate signatures; only classes both scenes agree on are kept.
- Radiation is a point time-series from Curiosity RAD, not a spatial field; terrain shielding (sky-view factor) is an estimate.
- Rock detection has a lower size limit (about 1.5 m) and some detections may be terrain edges.
- The Mars gravity correction is 1.0 and the slope cutoff of 25° is an estimate, so times and no-go zones are labelled "est.".
- The colour palette, final icons and exact tap sizes are still open (Person C).
