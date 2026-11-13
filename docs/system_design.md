# ARIADNE system design

Source of truth for: architecture, the local grid coordinate system, components, data flow, algorithms and folder layout.

If this file disagrees with docs/contracts.md or an accepted entry in docs/decisions.md, those win. Report the conflict.


## Goals

ARIADNE has three engineering goals: **light, accurate, hard to break**.

- **Light.** The app is a static site. All heavy computation (reprojection, slope, rock detection, return field) runs once, offline, in Python. The browser only loads the processed files, draws them, and does cheap runtime work (routing on a grid, a contour at a threshold). Payload and texture limits are in "Performance budget".
- **Accurate.** All georeferencing happens ONCE, in Python, onto a single local metric grid. The app never reprojects. Every displayed value carries provenance (dataset, product ID, resolution, timestamp, uncertainty), and model-derived values are labelled "est.". The walking-time function exists in Python and TypeScript and both must pass the same test vectors.
- **Hard to break.** One rendering stack (React Three Fiber only), one coordinate system, one set of data contracts with a validator. No live network dependency during the demo: the app replays recorded data on a simulation clock. Contract fields and string constants are deprecate-only (D-012).


## System overview

```
 raw NASA data (data/raw, git-ignored)
   HiRISE ortho + DTM, THEMIS TI, CRISM mineral maps,
   REMS + RAD (PDS), Curiosity raw images, DONKI, Mars24
        |
        v
 pipeline  (Python, uv, offline, run once)        <- Person A, Stage 1
   ingest -> grid -> terrain -> rocks -> sand -> sky-view
   -> traversal_penalty -> return_field -> shelters/viewshed
   -> environment timeline -> Knots -> export -> validate
        |
        v
 data/processed  (contract files, formats in docs/contracts.md)
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
- 1 cell = 1 m (`cell_size_m = 1`). Row 0 is the north edge; column 0 is the west edge.
- Cell (row, col) has its centre at `x = (col + 0.5) * cell_size_m`, `z = (row + 0.5) * cell_size_m`.
- Latitude/longitude appear only for display, computed from the georeferencing in `meta.json`.

Exact byte formats, array layouts, data types and dimensions live in docs/contracts.md, which is the source of truth for them. This document only fixes the coordinate convention.


## Pipeline (Stage 1, Person A)

Proposed layout (Person A may adjust, record in decisions.md):

```
pipeline/
  pyproject.toml            uv project
  run.py                    runs the full pipeline (script, so run.py)
  ariadne_pipeline/         package; absolute imports, e.g. from ariadne_pipeline.terrain import compute_slope
  validate/
    run.py                  contract validator
```

Ordered steps:

1. **Ingest.** Read HiRISE ortho + DTM, THEMIS TI, CRISM mineral maps, REMS, RAD, DONKI, Curiosity image metadata from `data/raw`. Record product IDs for provenance.
2. **Crop and reproject to the grid.** Cut the ~2 × 2 km patch and resample everything onto the 1 m local grid. This is the only georeferencing step.
3. **Terrain derivatives.** Slope and roughness from the DTM.
4. **Rock detection.** Shadow-based method on the 25 cm HiRISE image: rock height from shadow length and sun incidence angle (from image metadata). Reliably detects rocks of roughly 1.5 m and larger; smaller rocks are a statistical rock-abundance estimate, labelled "est.". Validate against Curiosity Navcam images.
5. **Sand / soft-ground proxy.** THEMIS thermal inertia as context (~100 m, coarse) plus hollow detection from the DTM.
6. **Sky-view factor.** Fraction of open sky per cell from the DTM; proxy for relative GCR exposure, labelled "est.".
7. **traversal_penalty.** Per-cell multiplier (>= 1; `Infinity` = impassable) combining rocks, soft ground, roughness and slope limits.
8. **Return field.** One Dijkstra outward from the staging point using the shared walking-time function and the penalty; result is `return_field` = seconds to walk back from every cell.
9. **Shelters and viewshed.** Shelter points (rover, habitat, terrain overhangs), nearest-shelter field via multi-source Dijkstra, and line-of-sight to the rover (comms dead zones). The nearest-shelter field and viewshed are proposed outputs, not yet in docs/contracts.md; Person A proposes their formats in docs/decisions.md before building them.
10. **Environment timeline.** REMS weather and RAD dose for the chosen sol, for replay; DONKI event for the scenario; Mars24 sun data.
11. **Knots to grid coordinates.** Convert the chosen science waypoints from lat/lon to (x, z) on the grid. Science text and photos are content added separately (see docs/contracts.md, `knots.json`).
12. **Export.** Write contract files to `data/processed`, including `meta.json` with provenance.
13. **Validate.** Run `pipeline/validate/run.py`; the gate to Stage 2 requires it to pass.


## App (Stages 2 and 3)

Proposed layout (Persons B and C may adjust, record in decisions.md):

```
app/src/
  scene/     terrain mesh from heightmap + texture; cameras: perspective (Labyrinth view),
             orthographic top-down (Planning Table); static Gale regional plane
  layers/    overlay toggles (slope, rocks, sky-view, thermal inertia, mineralogy, viewshed (once in contracts)...)
  routing/   A*, Theta*, D* Lite on the grid, using the shared walking-time function
  thread/    contour of return_field at the remaining-time threshold (marching squares)
  sim/       simulation clock with speed multiplier; scenario engine
  hud/       Suit HUD
  alerts/    alert model and rendering (what + action + distance/time + route)
  knots/     Knot cards with photos and provenance
  state/     Zustand store
```

Ownership (per the stage plan):

- **Person B (Stage 2):** app shell, `scene/`, `layers/`, `routing/`, `thread/`, Planning Table, Labyrinth view.
- **Person C (Stage 3):** `hud/`, `alerts/`, `knots/`, `sim/` (clock and scenario engine), CRT look polish, demo and pitch.
- `state/` is shared: Person B creates it; Person C adds to it. Who owns conflicts there is TBD (Stage 0, whole team).


## Algorithms

Problems and the algorithm used for each:

1. Walking cost
   - Algorithm: Tobler's hiking function adapted to 0.38 g plus a suit penalty; slope and roughness limits.
   - Runs in: pipeline and app (same function in both).
   - Notes:
     - Earth Tobler: `speed_kmh = 6 * exp(-3.5 * abs(S + 0.05))`, S = dh/dx.
     - It is direction-dependent (uphill differs from downhill), so cost is not one scalar per cell. The pipeline exports heightmap + per-cell `traversal_penalty`, and edge cost = `walking_time_seconds(horizontal_distance_m, elevation_change_m) * penalty`. How the two cells' penalties combine is defined in docs/contracts.md.
     - Mars/suit parameters and slope cutoff (proposal: impassable above 25°) TBD by Person A at Stage 0.
     - Exact definition and test vectors are in docs/contracts.md.
2. Routing
   - Algorithm: A* for a single route; Theta* for any-angle smoothing.
   - Runs in: app.
   - Notes: several weightings give fast and safe route options.
3. Rerouting
   - Algorithm: D* Lite.
   - Runs in: app.
   - Notes: fast replanning when hazards change; powers the solar-storm reroute demo.
4. The Thread
   - Algorithm: one Dijkstra from the staging point (precomputed) gives `return_field`; the live ring is the contour of `return_field` at (remaining consumable time minus reserve).
   - Runs in: pipeline (field), app (contour).
   - Notes:
     - Marching squares (d3-contour or equivalent).
     - Cheap to update every tick.
     - Consumables model (O2 duration, reserve) TBD, Stage 0.
5. Terrain radiation shielding
   - Algorithm: sky-view factor from the DTM.
   - Runs in: pipeline.
   - Notes: fraction of open sky approximates relative GCR exposure. Labelled "est.". Not a spatial dose map (D-015).
6. Nearest shelter
   - Algorithm: multi-source Dijkstra from shelter points.
   - Runs in: pipeline (field), app (route via D* Lite).
   - Notes: shelters are rover, habitat, terrain overhangs. Not yet in contracts.md.
7. Comms line-of-sight
   - Algorithm: viewshed on the DTM from the rover.
   - Runs in: pipeline.
   - Notes: shows comms dead zones. Not yet in contracts.md.
8. Lighting
   - Algorithm: Mars24 sun position gives hillshade and real-time shadows in 3D, and time to sunset.
   - Runs in: app (sun from Mars24 algorithm; pipeline may precompute tables).
   - Notes: where Mars24 runs is TBD (Person B and Person C).
9. Rock detection
   - Algorithm: shadow-based; height from shadow length and sun incidence from image metadata.
   - Runs in: pipeline.
   - Notes: detects about 1.5 m and larger; smaller = statistical estimate, "est.". SAM is stretch only (D-007).


## Simulation and "real-time"

No one is on Mars, so the app does not claim live data. It replays real historical data on a simulation clock with a speed multiplier (D-014).

- **Replay.** A real REMS sol (sol number TBD, Stage 0) plus RAD dose rate drive the environment readings over the sim clock.
- **Scenario.** A scripted event runs on the same clock, for example a solar particle event alert mid-walk (DONKI event TBD, Stage 0): the alert fires, D* Lite reroutes to the nearest shelter, and the Thread updates.
- **Honesty.** The UI and pitch state the source openly, for example "replaying REMS sol NNNN".


## Data provenance flow

Every displayed number must be traceable: dataset, product ID, resolution, timestamp, uncertainty; model-derived values labelled "est.".

Steps:

1. The pipeline records provenance as it ingests and derives data: source dataset, product ID, resolution, acquisition or processing timestamp, uncertainty, and an `is_estimate` flag where applicable.
2. Dataset-level provenance goes into `meta.json`; per-record provenance (for example per Knot, per timeline sample, per rock-abundance estimate) goes in per-record fields. Exact field names are in docs/contracts.md.
3. The app loads provenance with the data and keeps it attached through the Zustand store.
4. In the UI, tapping any number opens its provenance (dataset, product ID, resolution, timestamp, uncertainty) with an "est." badge when estimated. See docs/design_principles.md for the pattern.

Derived values (for example Thread margin) list the datasets they derive from.


## Performance budget

Proposed, Person B confirms.

- Total data payload for the patch: at most about 30 MB.
- Texture: at most 4096 × 4096.
- Decimate the terrain mesh if the frame rate needs it.
- Do heavy work in Python, not in the browser.


## Out of scope and rejected options

- **Cesium:** a globe engine; unnecessary for a 2 km patch and a second coordinate system.
- **MapLibre / Leaflet / OpenLayers:** a second rendering stack; the 2D view is the same R3F scene with an orthographic camera.
- **deck.gl:** another rendering stack, no benefit over R3F here.
- **Unity / Unreal:** heavy, not web-static, does not fit the 48 h budget.
- **Voice assistant:** out of scope (D-006).
- **SAM (Segment Anything) for rocks:** stretch only (D-007); the shadow-based method is the plan.
- **Raw CRISM processing:** only ready-made mineral maps are used.


## Known limitations

- A 1 m DTM smooths the 1 to 2 m boxwork ridges: they appear but flattened. Rock detection on the 25 cm image covers finer detail.
- THEMIS thermal inertia is about 100 m per pixel, so only 10 to 30 pixels cross the patch: context, not walk-level information.
- Radiation is a point time-series from Curiosity RAD, not a spatial field; terrain shielding (sky-view factor) is an estimate.
- Rock detection has a lower size limit (about 1.5 m); smaller rocks are statistical.
- Mars/suit walking parameters, slope cutoff and consumables model are TBD until Stage 0.
