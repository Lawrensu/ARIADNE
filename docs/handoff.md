# ARIADNE hand-off board

Current stage: Stage 2 (with the science plan, contract v1.1.0) built on `dev-malissa` (gate evidence below); waiting for Lawrence to merge into `dev`, run the integration check and sign off, then Stage 3 (Letta) starts

Last updated: 2026-11-14

This is the live status board. The main agent of the stage owner updates it whenever stage status changes. A stage starts only when the previous stage's gate is passed and a human has signed off.


## Stages

1. Stage 0: patch, Knots, contracts
   - Owner: Whole team
   - Status: Done (decisions D-017 to D-025, contracts v1.0.0)
   - Gate passed: Yes
   - Signed off by: Lawrence, 2026-11-14
2. Stage 1: data and algorithms pipeline
   - Owner: Lawrence (Part A)
   - Status: Finished
   - Gate passed: Yes
   - Signed off by: Lawrence
3. Stage 2: app shell, Labyrinth view, Planning Table, routing, Thread, science plan
   - Owner: Malissa (Part B)
   - Status: Built and verified on `dev-malissa` (including the science plan, D-027); waiting for merge into `dev` and sign-off
   - Gate passed: No
   - Signed off by: none yet
4. Stage 3: Suit HUD, alerts, Knot cards, simulation, CRT polish, demo
   - Owner: Letta (Part C)
   - Status: Not started
   - Gate passed: No
   - Signed off by: none yet


## Stage 0 checklist (whole team)

- [x] Confirm the Marswalk patch in Mars Trek: a HiRISE DTM covers it (if only one target is covered, prefer the boxwork side); record the DTM product ID.
- [x] Confirm the real distance between the boxwork and Gediz Vallis targets (if > ~3 km, staging point goes between them or two short walks).
- [x] Confirm a flat area for the rover and set the staging point.
- [x] Fix the patch bounds.
- [x] Choose 4 to 5 Knots (lat/lon, science rationale, candidate Curiosity photos).
- [x] Person A fixes Mars/suit walking parameters (`suit_speed_factor`, `gravity_adjustment`) and the slope cutoff (proposal 25°); confirm the max-of-two-penalties edge rule; record in `decisions.md`.
- [x] Person A fills the walking-time test vectors in `contracts.md`.
- [x] Decide the consumables model (O2 duration, reserve).
- [x] Choose the REMS sol to replay and the DONKI event for the scenario.
- [x] Decide how processed data is shared (Git LFS vs shared drive).
- [x] Person B confirms the performance budget (≤ ~30 MB, texture ≤ 4096 × 4096): measured as gzip, 19.19 MB (D-028).
- [ ] Person C proposes the exact colour palette values; the whole team approves.
- [x] Settle the remaining small TBDs (open questions 14 to 21 in docs/decisions.md): Knot text writer, photo hosting, Gale image, `state/` ownership, shelter list, Mars24 location, `scenario.json` path, nearest-shelter and viewshed formats.
- [x] Fill in the names of the Stage 2 and Stage 3 owners: Malissa (Person B), Letta (Person C).
- [x] Create `dev` from `main`, and each teammate creates their `dev-{firstname}` branch from `dev`.
- [x] Finalise `contracts.md` and sign it off (human approval), bump it from DRAFT.
- [x] Human sign-off for Stage 0.


## Stage 1 gate (Person A to Person B)

- [x] `pipeline/validate/run.py` passes (run with `uv run`): all 46 checks, 2026-11-14.
- [x] Overlay check: texture vs heightmap vs rocks aligned (rendered overlay `docs/images/stage1_overlay_check.png`, no-go zones sit on the scarps in the photo).
- [x] Knots are visually in the right place (on Curiosity's stops, none needed snapping).
- [x] Walking-time test vectors pass in Python (`uv run pytest`: 63 tests pass).
- [x] `data/processed/` committed on `dev-lawrence` (D-022), and Person B can pull it.
- [x] Log entry written in `docs/log/person_a.md`.
- [x] `dev-lawrence` merged into `dev`; integration check passed on `dev` (validator 46 of 46, 63 tests, binaries stored as binary).
- [ ] Human sign-off.


## Stage 2 gate (Person B to Person C)

Evidence re-verified on 2026-11-14 after merging contract v1.1.0 and adding the science plan.

- [x] The app loads the real data (contract 1.1.0) with no console errors (production build via `npm run preview`: no errors after loading, the full science plan, routing, rerouting, all 7 layer toggles and both views; only 3 "THREE.Clock deprecated" warnings from inside R3F).
- [x] Terrain matches the texture (Planning Table screenshot matches `docs/images/stage1_overlay_check.png`: no-go stripes sit on the scarps of the photo, rover upper middle, Knots on Curiosity's stops).
- [x] Layer toggles work (no-go, slope, sky view, thermal inertia, minerals, rover radio view, rocks; each with legend, source, product ID and "est." badge from `meta.json` layers[]).
- [x] A route computes between Knots (in the browser through the routing Web Worker, for example rover to Boxwork hollow: fast est. 35 min over 1.3 km, safe est. 36 min over 1.4 km; D* Lite reroute around a blocked passage).
- [x] Science plan (D-027): "Plan all Knots" (Boxwork first view, Boxwork ridge, Boxwork hollow, Channel west edge, Sulfur stones, all 10 tasks) shows each leg with its carried load and load factor, task time est. 2 h 54 min, walking est. 2 h 09 min, total est. 5 h 03 min against the 5 h 30 min limit, science budget est. 27 min left, GO, on screen in dev and in the production preview. A zig-zag order shows NO-GO (est. 87 min over) with a drop-task suggestion. Load factor test vectors: 3 of 3 pass (`app/src/science/loadFactor.test.ts`).
- [x] Walking-time test vectors pass in TypeScript (`npm test`: all 8 rows of contracts.md 4.5 within 1e-3 s).
- [x] Cross-check: the TypeScript route time from each Knot to the rover matches `return_field.bin` at that Knot within 1% (largest relative difference 5.6e-6, `app/src/routing/realData.test.ts`).
- [x] The Thread draws and shrinks with simulation time and scales with the carried load (contracts.md 4.6: return_field x load_factor against planned time minus elapsed minus reserve). Test: with 30 min left the area is 2.08, 1.91, 1.84 and 1.66 km² for 0, 10, 14 and 25 kg (`app/src/thread/threadLoad.test.ts`). On screen at 5 h elapsed: est. 1.9 km² with 10 kg, 1.8 km² with 14 kg; at v1.0.0 it shrank from 3.0 km² to nothing as time ran out.
- [x] Data payload is within the budget: production build is 19.19 MB gzip (31.50 MB raw); the budget counts gzip (D-028).
- [x] Log entry written in `docs/log/person_b.md`.
- [ ] Person B's branch pushed, merged into `dev` by Lawrence; integration check passed.
- [ ] Human sign-off.


## Stage 3 gate (Person C to demo)

- [ ] The Suit HUD shows at most 3 numbers at once, and the science budget is reachable in one tap.
- [ ] Tasks can be checked off at a Knot; samples taken add to the carried load and the Thread updates.
- [ ] Every number has provenance.
- [ ] Alerts come with actions.
- [ ] The scenario runs end-to-end, identically twice.
- [ ] Demo recorded.
- [ ] Log entry written in `docs/log/person_c.md`.
- [ ] Person C's branch pushed, merged into `dev` by Lawrence; integration check passed.
- [ ] `dev` merged into `main` for the demo.
- [ ] Human sign-off.


## Known issues

1. Resolved: data size. Export grid is 2 m (D-021); `data/processed/` is 33 MB raw, about 14 to 24 MB compressed.
2. Mineralogy is weak: the two CRISM scenes agree on only 890 cells (866 sulfate, 24 clay). Show it as an optional "est., low confidence" layer; never use it for routing.
3. Rocks are shadow-based estimates (4,269 kept at confidence 0.6 or more). Some may be terrain edges; none of Curiosity's 203 stops falls on a rock-blocked cell.
4. The Gale regional image's patch rectangle is only about 20 × 19 px; draw a marker so it is visible.
5. Environment estimates: UV level (our thresholds), dust tau 0.5 (unsourced), dose equivalent via Q = 3.05. All flagged `is_estimate` in provenance.
6. App payload: 31.50 MB raw, 19.19 MB gzip. `roughness_m.bin` is not shipped to the app (not displayed). Needs Malissa's confirmation that gzip transfer size is the budget measure.
7. The Thread at the start of a walk: following contracts.md 4.6, the time left is the planned 6 h minus elapsed minus the 30 min reserve (no longer the 8 h suit). 5 h 30 min covers every reachable cell (the farthest is about 1 h away even with load), so the Thread equals the edge of the reachable area until about 4.5 h have passed, and is gone at 5 h 30 min although the clock runs on to the 8 h suit limit (O2 readout).
8. The "safe" route uses estimated weights (slope squared, penalty, comms dead zones; `app/src/routing/routingGrid.ts`). On short routes it is often close to "fast" (for example 969 s vs 956 s).
9. Theta* any-angle smoothing (system_design.md, Algorithms 2) is not built; routes follow 8-connected cell centres.
10. Dev server only: after many hot reloads Vite can re-optimise dependencies and leave React unresponsive until a full page reload. Not seen in the production build.
11. Science plan interpretations (planner, `app/src/science/sciencePlan.ts`): the walk back is timed as `return_field` x load factor (its A* path is only drawn); a "caution" plan (under 15 min left) suggests the drop that gets back to "go"; unreachable Knots are skipped and reported (no drop suggestion can fix them); plan legs avoid blocked cells but the walk back time from `return_field` does not.
12. Rule 4 of contracts.md 4.6 (drop the next task during the walk) is read as: drop when time left is less than the walk to the next Knot with the current load plus the task plus the walk back from there with its sample. The literal "margin < next task + walk back" would count the walk back twice. `checkNextTaskDuringWalk` implements it for Stage 3.
13. The planner times a plan from the start of the walk; tasks marked done (carried load now) change the Thread but not the plan's own load sequence.
14. Narrow screens: the Gale inset is hidden below 1280 px wide so it does not cover the map.


## Hand-off notes from the previous stage

Template (the outgoing stage owner fills this in at the gate):

- From stage:
- Date:
- What is done:
- What is not done or only partly done:
- Things the next stage must know (surprises, workarounds):
- Contract changes during the stage (decision IDs):
- Where the data or build lives:

Stage 1 to Stage 2 (Lawrence to Malissa):
- From stage: Stage 1, data and algorithms pipeline.
- Date: 2026-11-14.
- What is done: every file in `docs/contracts.md` section 2 except `scenario.json` (Stage 3). Validator 46 of 46 pass; 63 tests pass.
- What is not done: nothing required. `build_spe_profile()` in `pipeline/ariadne_pipeline/environment.py` gives the real May 2024 solar storm dose curve for Letta's scenario (reference data, not a contract file).
- Things to know:
  - Grid is 1,013 × 934 cells at 2 m; staging point (rover) is row 233, col 387 (x 775, z 467 m). Read sizes from `meta.json`, never hard-code.
  - 18% of cells are too steep (no-go); 79.4% of cells are reachable from the rover.
  - All 5 Knots are 11 to 26 minutes' walk from the rover.
  - Shelters: the rover plus 5 terrain overhangs (sky-view factor 0.65 to 0.69, mild shielding only).
  - `knots.json` photos are NASA URLs; per D-024 the app copies them in with credits so the demo works offline.
  - Your TypeScript walking function must pass the 8 test vectors in `docs/contracts.md` 4.5.
- Contract changes during the stage: none after v1.0.0 sign-off.
- Where the data lives: `data/processed/` on `dev-lawrence` (committed, D-022). Overlay preview: `docs/images/stage1_overlay_check.png`.

Change after the Stage 1 hand-off (science plan, D-027, contract v1.1.0):
- `knots.json` now has `science_tasks` per Knot (2 each, 174 minutes and 4.0 kg in total, all "est.").
- `meta.json` parameters add `base_carried_load_kg` (10) and `load_time_factor_per_kg` (0.01).
- New contract section 4.6: load factor, science plan rule and load factor test vectors.
- Stage 2 and Stage 3 gates have new science plan boxes. Malissa's follow-up prompt is in Lawrence's chat; her agent merges `origin/dev` and adds the planner.

Stage 2 to Stage 3 (Malissa to Letta):
- From stage: Stage 2, app shell, Planning Table, Labyrinth view, layers, routing, the Thread, science plan (contract v1.1.0, D-027).
- Date: 2026-11-14.
- What is done: the React + Vite + TypeScript + R3F app in `app/` loads the real data (contract 1.1.0), draws the textured terrain in the Planning Table (orthographic, north up) and the Labyrinth view (perspective, orbit), the Gale Crater inset with the patch marker, markers for Knots, rover and shelters, 7 toggleable layers with legends and provenance, fast and safe routes between the rover and any Knot (A* in a Web Worker, D* Lite reroute), the science plan (ordered Knots and tasks, legs timed with the carried load, science budget, go / caution / no-go, drop-task suggestion, plan drawn on the map), the Thread (d3-contour of `return_field` x load factor in a Web Worker) and a minimal simulation clock. 120 Vitest tests pass; tsc clean; production build works.
- What is not done or only partly done: Theta* smoothing; final palette and CRT look (placeholders in `app/src/index.css` and the per-folder colour constants); Suit HUD, alerts, Knot cards, scenario, environment replay, Mars24 (all Stage 3).
- Things to know:
  - Run from `app/`: `npm ci`, `npm run dev`, `npm test`, `npm run build`, `npm run payload` (README "App setup"). `dev`, `build` and `test` copy `data/processed/` into `app/public/data/` first.
  - Store: `app/src/state/store.ts` (D-024). Add your slices as separate files following the EXTENSION POINT comment there; never rename existing fields.
  - Routing for alerts: `planRoute(start, end)` and `rerouteAroundBlockedCells(currentPosition, cellIndices)` in `app/src/planning/routingService.ts` update the store (`routePlans`, `routeStatus`). `RouteEndpoint` and `RoutePlan` are in `app/src/state/routeSlice.ts`; shelters can be passed with `endpoint_kind: "shelter"`.
  - Clock: `app/src/sim/clock.ts` (`useSimClockDriver`, `computeConsumablesState`, `SIM_SPEED_PRESETS`) and `app/src/sim/SimClockControls.tsx`. The store fields are in `app/src/state/simSlice.ts`. Extend `sim/` with the scenario engine and the replay; keep `simElapsedSeconds` as the single clock.
  - The Thread follows contracts.md 4.6: time left = planned 6 h minus elapsed minus the 30 min reserve, compared with `return_field` x load factor. `computeConsumablesState` in `app/src/sim/clock.ts` keeps all its old fields (`thread_threshold_s` now means this time left; `suit_remaining_s` is the 8 h suit for O2). `computeThreadInfo(processedData, simElapsedSeconds, completedTaskIds)` in `app/src/thread/threadInfo.ts` gives the time left, carried load, load factor, area and provenance line for the HUD's "Thread margin".
  - Science plan for the HUD (Stage 3 gate): the plan is in the store (`sciencePlan`, `sciencePlanStops`, types in `app/src/state/scienceSlice.ts`); recompute with `recomputeSciencePlan()` (`app/src/science/sciencePlanService.ts`). Check off tasks with `setTaskCompleted(taskId, true)`: `completedTaskIds` sets the carried load, and the Thread updates by itself. Load helpers: `app/src/science/loadFactor.ts`. For the "drop task X" warning during the walk use `checkNextTaskDuringWalk` in `app/src/science/sciencePlan.ts` (see known issue 12). The Planning Table's "Done" toggles only simulate check-off.
  - Development only: `window.__ariadneStore` exposes the store in the dev server (not in production builds), useful to rehearse the demo, for example `window.__ariadneStore.getState().setSimElapsedSeconds(5 * 3600)`.
  - Drawing on the terrain: use `useTerrain()` and `<DrapedOverlay>` from `app/src/terrain/TerrainContext.tsx` and `sampleTerrainSceneY` from `app/src/terrain/terrainFrame.ts`. Never use lat/lon in the app.
  - Marker labels use drei `<Html>` (no network font). The marker label overlay sits above the canvas, so give HUD panels `z-50` or higher.
  - The clock uses `requestAnimationFrame`, so it pauses in a hidden browser tab (expected).
- Contract changes during the stage: none by Stage 2; the app follows Lawrence's v1.1.0 (D-027), merged from `dev`.
- Where the data or build lives: `app/` on `dev-malissa`; the build goes to `app/dist/` (git-ignored).

Stage 2 notes for Lawrence and his agents (merge, integration, pipeline):
1. Merge and integration check
   - `dev-malissa` holds three commits on top of `dev`: `44cea1f` (Stage 2 core), `e858c6e` (merge of `origin/dev` with contract v1.1.0) and `8e0693c` (science plan). It already contains every `dev` commit up to `6fe0c8e`, so merging into `dev` should be a fast-forward or conflict-free.
   - From `app/`: `npm ci` (Node 20 or newer; `package-lock.json` is committed, never `npm install` during the check), `npm test` (expect 16 files, 120 tests), `npm run typecheck`, `npm run build`, `npm run payload` (expect 31.50 MB raw, 19.19 MB gzip), `npm run preview` and open http://localhost:4173.
   - Browser check: Science plan, "Plan all Knots" gives GO, total est. 5 h 03 min, est. 27 min left; Rover to Boxwork hollow gives fast est. 35 min; switch to the Labyrinth view; toggle layers. The console should show no errors (3 "THREE.Clock deprecated" warnings come from inside R3F and are harmless).
   - Git may warn "LF will be replaced by CRLF" on Windows; the repo keeps LF, nothing to fix.
2. Decisions waiting for Lawrence (Part B did not edit contracts.md or decisions.md)
   - Payload budget: 31.50 MB raw (about 5% over 30 MB) and 19.19 MB gzip. Decide which measure counts, then tick the Stage 2 payload box and the Stage 0 box "Person B confirms the performance budget".
   - contracts.md 4.6 rule 4: read literally ("margin below the next task plus its walk back"), the walk back is counted twice, because the margin already subtracts the walk back from the current position. The app implements: drop the next task when time left is less than the walk to the next Knot with the current load plus the task plus the walk back from there with its sample (`checkNextTaskDuringWalk`). Consider a decisions.md entry that clarifies the wording.
   - The Thread now follows contracts.md 4.6 (planned 6 h minus elapsed minus 30 min reserve) instead of the 8 h suit used before v1.1.0. system_design.md (Design rationale 1, Algorithms 4) says "remaining consumable time"; it could name the planned time explicitly so nobody reads it as the 8 h suit.
   - system_design.md lists Theta* for any-angle smoothing; it is not built (routes follow 8-connected cell centres). Either keep it as stretch or remove it from the design.
   - The Stage 1 gate box "Human sign-off" is still unticked although the Stages list says Stage 1 was signed off.
3. What the app expects from the pipeline (changes here break the app or its tests)
   - The app reads grids by `layer_id` in `meta.json` layers[]: `heightmap`, `slope_degrees`, `traversal_penalty`, `return_field`, `sky_view_factor`, `thermal_inertia`, `mineralogy_class`, `viewshed_rover`. Byte sizes are checked against `grid.width` x `grid.height`. Renaming any of these breaks loading.
   - The loader accepts `contract_version` 1.x only; a 2.0.0 is rejected with a clear error until the app is updated.
   - Load parameters and `science_tasks` are read from `meta.json` and `knots.json`; if missing, the app falls back to the contract values (10 kg, 0.01 per kg) and empty task lists.
   - Only the files listed in `app/scripts/copyProcessedData.mjs` are shipped (all contract files except `roughness_m.bin`). A new processed file the app should use must be added there.
   - `npm test` reads `data/processed/` directly: after re-running the pipeline, run it again. The Knot-to-rover cross-check (`app/src/routing/realData.test.ts`, within 1%) and the science plan real-data test print their numbers with `npx vitest run src/routing/realData.test.ts src/science/sciencePlanRealData.test.ts --reporter=verbose`.
   - The TypeScript walking function (`app/src/routing/walkingTime.ts`) and load factor (`app/src/science/loadFactor.ts`) mirror the Python ones and pass the same vectors (contracts.md 4.5 and 4.6). Any change to the formula or vectors needs both sides updated in the same change.
4. Things that look odd but are intended
   - `app/public/data/` and `app/dist/` are git-ignored; `npm run dev`, `build` and `test` refresh the copy automatically.
   - vitest is 4.1.12, not 3.x: 3.x had npm audit advisories (tinypool, @vitest/mocker).
   - `window.__ariadneStore` exists only in the dev server (not in production builds) for debugging and demo rehearsal.
   - Dev server only: after many hot reloads Vite can re-optimise dependencies and leave React unresponsive; a full page reload fixes it. Never seen in the production build.
   - The routing worker and the Thread worker each hold a copy of the grids they need (a few MB each), so the main thread never blocks on routing or contours.
   - `.claude/` is git-ignored (local agent tool settings).


Lawrence's integration changes on top of Stage 2 (2026-11-14, D-028):
- Theta* any-angle routing added as the "smooth" route option: `app/src/routing/thetaStar.ts` (+ tests), small edits in `routePlans.ts`, `routingSession.ts`, `state/routeSlice.ts` (`RouteOptionId` gains `"smooth"`), `RoutePlannerPanel.tsx`, `RouteLines.tsx` (green line). Fast stays the default; fast, safe, D* Lite, science plan and the cross-check numbers are unchanged.
- Contract v1.1.1 (wording only): Thread uses the planned time left; drop-task rule as Malissa built it. `app/src/science/loadFactor.test.ts` now accepts any contract 1.1 or later.
- Integration check on `dev` after the merge: validator 47 of 47, pipeline tests 68, app tests 133, typecheck clean, build works, payload 19.19 MB gzip, browser: Plan all Knots GO 5 h 03 min with 27 min left; Rover to Boxwork hollow fast 35 min, safe 36 min, smooth 31 min; Labyrinth view; no console errors.


## Next steps

1. Letta: update `dev-letta` from `dev`, add her design inspiration to the Stage 3 prompt Lawrence sent her, and start her agent.
2. Lawrence: when Letta pushes, merge `dev-letta` into `dev`, run the integration check from her commit message and hand-off notes, then merge `dev` into `main` for the demo.
