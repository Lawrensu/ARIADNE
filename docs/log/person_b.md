# Person B log (Malissa)

Stage owned and role: Stage 2, app shell, Labyrinth view (3D), Planning Table, layer switching, runtime routing, Thread rendering.

Instructions:

- Append entries at the bottom, newest last.
- The main agent writes an entry at the end of every session.
- Never rewrite old entries.


## Entry template

```
### YYYY-MM-DD HH:MM | <tool/agent> | <short title>

- Changed:
- Verified (how):
- Broken or open:
- Next step:
- Delegated to sub-agents (what, and how the result was checked):
```


## Entries


### 2026-11-14 11:20 | Claude Code (Opus 5.5, main agent) | Stage 2 app: Planning Table, Labyrinth view, layers, routing, the Thread

- Changed:
  - New `app/` (Vite 7, React 19, TypeScript 5.9, three 0.187, R3F 9, drei 10, postprocessing 3, zustand 5, tailwindcss 4, d3-contour 4, vitest 4.1.12; exact versions pinned, `package-lock.json` committed). vitest is on 4.1.12 instead of 3 because 3.x had npm audit advisories (tinypool, @vitest/mocker).
  - Foundations by the main agent: `src/data/` (contract types, loader for meta.json, grids and JSON), `src/state/` (store with data, view, layers, route and sim slices plus an extension point for Letta), `src/terrain/` (shared terrain frame, geometry, draped overlays), `src/planning/` (route panel, route lines, routing service, blocked-cell overlay), `src/App.tsx`, `scripts/` (copy of processed data, payload report).
  - Sub-agent folders: `src/routing/`, `src/scene/`, `src/layers/`, `src/thread/` with `src/sim/clock.ts` and `SimClockControls.tsx`.
  - Main agent changes to sub-agent work: Thread contour moved into a Web Worker and drawn as one line-segments object, threshold capped at the largest finite return time, rings under 2,000 m² not drawn; safe route weights raised (slope squared x 4, penalty x 1, no comms x 1); grids loaded in parallel.
  - README "App setup" filled in; `docs/handoff.md` Stage 2 gate and hand-off notes.
- Verified (how):
  - `npm test`: 11 files, 77 tests pass, including the 8 walking-time vectors and the Knot-to-rover cross-check (largest relative difference 5.6e-6 against `return_field.bin`).
  - `npm run typecheck`: clean. `npm run build`: works. `npm run payload`: 31.47 MB raw, 19.18 MB gzip.
  - Browser (built-in browser pane): dev server and production preview; terrain vs texture vs no-go matches the Stage 1 overlay image; routes, D* Lite reroute, 7 layer toggles, both views, Gale inset; Thread from 3.0 km² to 0.8 km² at 7 h 14 min to nothing at 8 h; production console empty.
- Broken or open:
  - Payload is 5% over 30 MB raw (within budget as gzip); Malissa to confirm the measure.
  - Theta* not built. Safe route close to fast on short routes. Thread only shrinks late in the walk (by design of D-020).
  - Dev server only: React can stop updating after Vite dependency re-optimisation during many hot reloads; a full reload fixes it.
  - Not committed: `.claude/launch.json` (local preview config for the agent's browser).
- Next step: Malissa approves the commit message, commit and push `dev-malissa`, notify Lawrence to merge and run the integration check.
- Delegated to sub-agents (what, and how the result was checked):
  - Routing (main model): walking time, grid graph, A*, D* Lite, fast and safe plans, Web Worker. Checked by rerunning its 30 tests, reading the walking function and edge rules against contracts.md 4, and routing in the browser.
  - Scene (Sonnet): terrain, cameras, markers, Gale inset. Checked by its 10 tests and screenshots of both views against the Stage 1 overlay image.
  - Layers (Sonnet): overlay colour maps, legends, rocks, panel. Checked by its 11 tests (no-go 173,465 cells, 18.33%) and toggling every layer in the browser.
  - Thread and clock (Sonnet): d3-contour Thread, clock, controls. Checked by its 13 tests and running the clock in the browser; performance issues fixed by the main agent (see Changed).


### 2026-11-14 12:05 | Claude Code (Opus 5.5, main agent) | Checkpoint, merge of contract v1.1.0, science plan

- Changed:
  - Checkpoint commit of the Stage 2 core (44cea1f, approved by Malissa, not pushed), then merged `origin/dev` (contract v1.1.0, D-027) into `dev-malissa` (e858c6e). Conflict in `docs/handoff.md` resolved keeping both sides (Lawrence's new gate boxes and notes plus Stage 2 evidence).
  - Main agent: `Knot.science_tasks` and the load parameters in `app/src/data/contracts.ts`, loader default for older data, `app/src/science/loadFactor.ts` with the 3 load factor vectors, science slice `app/src/state/scienceSlice.ts` in the store, shared routing client getter, App wiring (Science plan panel and plan lines), Gale inset hidden below 1280 px, dev-only `window.__ariadneStore`.
  - Sub-agents: planner logic and fast multi-leg routing in the worker (`app/src/science/sciencePlan.ts`, `sciencePlanService.ts`, routing additions), Planning Table UI (`app/src/science/ui/`), Thread scaling with load and the contracts.md 4.6 threshold (`app/src/thread/`, `app/src/sim/clock.ts`).
  - Docs: `docs/handoff.md` gate evidence, known issues 6 to 14, Stage 2 to Stage 3 notes; README test line.
- Verified (how):
  - `npm test`: 16 files, 120 tests pass (8 walking-time vectors, 3 load factor vectors, Knot-to-rover cross-check largest relative difference 5.6e-6). `npm run typecheck`: clean. `npm run build`: works. `npm run payload`: 31.50 MB raw, 19.19 MB gzip.
  - Browser (dev and production preview): "Plan all Knots" gives GO, total est. 5 h 03 min against 5 h 30 min, 27 min left; a zig-zag order gives NO-GO, 87 min over, with a drop suggestion; Thread at 5 h elapsed est. 1.9 km² with 10 kg and 1.8 km² with 14 kg; production console has no errors (3 THREE.Clock deprecation warnings).
- Broken or open:
  - Payload box waits for Malissa's choice of measure (raw 31.50 MB vs gzip 19.19 MB).
  - The Thread threshold now follows contracts.md 4.6 (planned 6 h), not the 8 h suit; system_design.md still says "remaining consumable time", which reads the same but could be made explicit.
  - Planner interpretations recorded as known issues 11 to 13.
- Next step: Malissa approves the final commit message; commit, push `dev-malissa`, notify Lawrence.
- Delegated to sub-agents (what, and how the result was checked):
  - Planner logic (main model): checked by its 23 tests, reading the load handling against contracts.md 4.6, and the plan on screen through the real worker.
  - Planning Table UI (Sonnet): checked by its 9 tests and using the panel in the browser (add, order, tasks, Done toggles, GO and NO-GO, drop suggestion).
  - Thread scaling (Sonnet): checked by its 18 thread and clock tests (area against load) and on screen at 5 h elapsed with 10 and 14 kg.


### 2026-11-14 17:30 | Claude Code (Opus 5.5, main agent) | Finish the D-031 interface redesign

- Changed:
  - `dev-malissa` was already at Lawrence's work in progress `e2ed345` (merging `origin/dev-lawrence` reported "Already up to date", no conflicts).
  - Camera (`app/src/scene/CameraRig.tsx`): the zoom buttons (1.5x per tap, within the existing limits) and "Center on me" (the simulated astronaut, or the rover before a walk; the 2D map also zooms in to at least 4x the fit) now work in both views. Each camera only reacts to requests made after it mounted, so a 2D/3D switch no longer replays an old reset.
  - Suit HUD: shelter walk countdown while rerouted ("IN 26 MIN est.", rounded up, "ARRIVED" on arrival) from the new `remainingDetourWalkSeconds` and `formatCountdownMinutes` in `app/src/hud/hudMath.ts` (2 tests); the objective card uses the same countdown. HUD tiles scale label and value to the tile width (container query), so "+330 min" and "THREAD MARGIN" fit in the two-column desktop layout.
  - Shell: "Reset view" text and accessible name fixed (the space was dropped in the flex button); control hint matches the camera (2D "drag pan · wheel zoom", 3D "drag rotate · right-drag pan · wheel zoom"); all six controls fit one row at 375 px; the speed button shows at every width (the only speed control in the redesign); the status bar fits play, time, speed, O2 and Thread with state words at 375 px; the objective card collapses beside the bottom sheet on tablet as on desktop.
  - Shared "?" toggle `app/src/theme/InfoToggle.tsx` (sub-agent) now used by KnotCard, RoutePlannerPanel, SciencePlanPanel, MarsClock and ModeSheet.
  - `app/scripts/browserCheck.mjs` updated for the redesign: tab bar and status bar layout probe, `redesign_` screenshot names, zoom button and "Center on me" checks, Reset found by its accessible name.
  - Screenshots: `docs/images/stage3/redesign_phone.png`, `redesign_tablet.png`, `redesign_desktop.png`, `redesign_desktop_after_panning_check.png`.
- Verified (how):
  - Baseline before any change: `npm ci`, `npm test` 240 passed (24 files), typecheck clean, build works.
  - After: `npm test` 242 passed (24 files), `npm run typecheck` clean, `npm run build` works, `npm run payload` 39.08 MB raw, 26.68 MB gzip.
  - `npm run browser-check` (headless Chrome on the dev server): scroll width equals the window at 375, 768 and 1280 px; drag pans right, down, left and up and Reset view returns exactly (0 px); Zoom in grows the spacing of two Knot labels from 216 to 323 px and Zoom out returns it to 216 px; Center on me puts the rover 24 px from the map centre; no console errors.
  - Browser pane: every tab (MAP, PLAN, SUIT, DATA), sheets open and close (desktop left card, tablet and phone bottom sheet), gear menu, Legend, 2D and 3D with zoom and centre at 1280 px.
  - Demo from the gear menu on the production preview at 300x, twice: walk starts T+0:00; Boxwork first view tasks done at 0:57 (objective moves to Knot 2); Boxwork ridge tasks done at 1:49; storm alert 1:52; reroute "Shelter: rover" 1:53; "Sheltered in the rover" 2:20 (run 1) and 2:21 (run 2, the minute is sampling at 300x). Same sequence both runs, no console errors. HUD during reroute: "SHELTER: ROVER, NE 29°, 1.1 km, IN 26 MIN est.", then 23 min two sim minutes later.
- Broken or open:
  - At 375 px, near the end of the 8 h suit (both O2 and Thread in CAUTION) the Thread state word is clipped by about 15 px; fine through the planned walk and the demo.
  - Seen once in the dev server only: React "unmount a root while rendering" and a removeChild error right after a hot reload of the HUD while SUIT was open; not reproducible by tab switching or resizing, not in the production build.
  - The Browser pane stops animation frames when hidden, so the demo needs a visible window; the headless check does not run the scenario.
  - Stage 3 gate boxes not ticked (Lawrence's).
- Next step: Malissa approves the commit message; commit and push `dev-malissa`; Lawrence merges and runs the integration check.
- Delegated to sub-agents (what, and how the result was checked):
  - Shared "?" toggle (Sonnet): read the new component, typecheck and 242 tests pass, toggles seen in the PLAN and DATA sheets.


### 2026-11-14 18:15 | Claude Code (Opus 5.5, main agent) | Walk fix, follow camera, 3D astronaut, data on map, PLAN steps (IN PROGRESS, handed off at the usage limit)

- Changed (uncommitted on top of `e2ed345`, together with the D-031 finish in the entry above):
  - Walk bug (Malissa: "after reaching a Knot and ticking the checklist the astronaut stops"): the walk waited for the planned task time even when every task was ticked early. Now `earlyDepartureShiftSeconds` (`app/src/sim/walkTimeline.ts`, tests) and `shiftWalkStart` (`app/src/state/walkSlice.ts`) move the frozen plan's start earlier so the astronaut leaves at once; no change without early ticks (scripted demo identical).
  - Follow camera like a navigation app (sub-agent + main agent): `app/src/scene/followCamera.ts` (tests), `useFollowAstronaut` in `app/src/scene/CameraRig.tsx`, follow fields in `app/src/state/cameraSlice.ts`; drag pauses, resumes after 5 s, "Center on me" resumes at once and shows "Following"; with a docked sheet the astronaut is kept in the visible part (`followScreenOffsetXPx`).
  - 3D astronaut figure (sub-agent): `app/src/scene/AstronautFigure.tsx`, `astronautFigureMath.ts` (tests), mounted in `AstronautMarker.tsx` for the 3D view only (2D keeps the glyph).
  - PLAN as 3 steps PICK, CHECK, GO with START WALK (sub-agent): `app/src/science/ui/SciencePlanPanel.tsx`, `planSteps.ts` (tests); "Done" toggles removed from PLAN; in PLAN a Knot tapped on the map joins the plan (`App.tsx`).
  - Data on the map (Malissa chose all three): LAYERS button (replaces Legend; popover has "Full key") `app/src/shell/LayersPopover.tsx`; Here card `app/src/shell/HereCard.tsx` with `pointData.ts` (tests) and `app/src/state/inspectSlice.ts`; terrain tap shows a point (`TerrainMesh.tsx`); slim DATA sheet on desktop (`MapOverlays.tsx`).
  - `app/scripts/browserCheck.mjs`: also checks the follow camera and runs the demo twice, comparing milestone times.
- Verified (how): `npx tsc -p tsconfig.json` clean; `npx vitest run` 292 passed (before the last HereCard edit); dev browser: PLAN steps and START WALK, early departure at Knot 1 (walk start shifted, astronaut walks on), follow centred, Here card; headless `npm run browser-check`: no horizontal scroll at 375/768/1280, panning, zoom, Center on me, follow (pauses on drag, resumes by 6.5 s), demo twice: storm 6705/6702 s, sheltered 8443/8442 s, tasks within 6 s, 0 console errors.
- Broken or open (where to continue):
  1. Re-run `npx tsc -p tsconfig.json`, `npm test`, `npm run build`, `npm run payload` after the last edits (HereCard short-screen compact mode).
  2. Done at 18:20: `npm run browser-check` exit 0 (tsc clean, no horizontal scroll, panning, zoom, Center on me, follow passed, demo twice repeatable: storm 6701/6707 s, reroute 6760/6760 s, sheltered 8441/8445 s, 0 console errors). Still to do: look at the new screenshots `docs/images/stage3/redesign_desktop_plan.png`, `redesign_desktop_layers.png`, `redesign_desktop_3d_astronaut.png` (3D figure not yet seen by a human or agent); check the LAYERS popover, terrain tap (POINT card) and the Here card at 375/768/1280.
  3. Known limits: a reroute path arrives from the routing worker about 1 s real later, so at 300x the astronaut jumps back a little when the detour starts; after an alert [ROUTE] to a Knot the astronaut stays there (the plan does not resume); at 375 px near the end of the 8 h suit the Thread state word clips by about 15 px.
  4. Nothing committed for the D-031 finish or these follow-ups. Draft commit message: scratchpad `d031_commit_message.txt` (needs the follow-ups added). Stage 3 gate boxes not ticked.
- Next step: Lawrence's agents continue from the branch (see the hand-off prompt Malissa sends).
- Delegated to sub-agents (what, and how the result was checked): follow camera (tests, headless follow check), 3D figure (tests; visual check pending), PLAN steps (tests, browser walk-through), data on map (stopped by a network error; finished by the main agent; pointData tests).
