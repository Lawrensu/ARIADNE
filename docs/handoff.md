# ARIADNE hand-off board

Current stage: Stage 1 merged into `dev`; waiting for Lawrence's sign-off, then Stage 2 (Malissa) starts

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
3. Stage 2: app shell, Labyrinth view, Planning Table, routing, Thread
   - Owner: Malissa (Part B)
   - Status: Not started
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
- [ ] Person B confirms the performance budget (≤ ~30 MB, texture ≤ 4096 × 4096).
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

- [ ] The app loads the real data with no console errors.
- [ ] Terrain matches the texture.
- [ ] Layer toggles work.
- [ ] A route computes between Knots.
- [ ] Walking-time test vectors pass in TypeScript.
- [ ] Cross-check: the TypeScript route time from each Knot to the rover matches `return_field.bin` at that Knot within 1%.
- [ ] The Thread draws and shrinks with simulation time.
- [ ] Data payload is within the budget.
- [ ] Log entry written in `docs/log/person_b.md`.
- [ ] Person B's branch pushed, merged into `dev` by Lawrence; integration check passed.
- [ ] Human sign-off.


## Stage 3 gate (Person C to demo)

- [ ] The Suit HUD shows at most 3 numbers at once.
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


## Next steps

1. Lawrence: sign off Stage 1 (tick the last Stage 1 gate box).
2. Malissa: update `dev-malissa` from `dev`, then paste the Stage 2 prompt below into her agent.
3. Letta: non-code prep for Stage 3 (scenario timeline, palette proposal, which Knot photos to show) until the Stage 2 gate passes; then paste the Stage 3 prompt below.


## Kickoff prompts

Paste the prompt into a fresh agent session opened in the repo root, on your own branch, after updating it from `dev`.


### Stage 2 prompt (Malissa)

```
You are Malissa's main coding agent on ARIADNE (NASA Space Apps 2026, "Interplanetary Survival Guide: Martian Map"). Malissa is Person B and owns Stage 2. You are the orchestrator: plan, build the shared foundations yourself, delegate the parallel parts to smaller sub-agents, then integrate and verify.

READ FIRST, in order, and follow strictly: AGENTS.md (all), docs/handoff.md (Stage 1 to Stage 2 hand-off notes, Stage 2 gate), docs/contracts.md (all; source of truth for every data file), docs/system_design.md (App, Algorithms, UX design principles), docs/development_conventions.md, README.md (Getting started), docs/log/person_b.md. Look at docs/images/stage1_overlay_check.png.

BEFORE CODING: confirm you are on dev-malissa, fetch, merge origin/dev into it, and check that data/processed/ exists with meta.json. If not, stop and tell Malissa.

PHASE 1, you do this yourself (shared foundations, so sub-agents never collide):
1. Scaffold app/ with Vite, React, TypeScript, @react-three/fiber, @react-three/drei, @react-three/postprocessing, three, zustand, tailwindcss, d3-contour, vitest. Pin exact versions. Add a predev/prebuild script that copies data/processed/ into app/public/data/ (git-ignore the copy).
2. app/src/data/contracts.ts: TypeScript types for meta.json, knots, rocks, shelters and the environment timeline, named exactly as in contracts.md.
3. app/src/data/loadProcessed.ts: load meta.json first, then each .bin as little-endian Float32Array or Uint8Array (width, height, cell_size_m from meta, never hard-coded), plus the JSON files; one typed object out.
4. app/src/state/store.ts: the Zustand store shape you own, with separate slice files (data, view, layers, route, sim) and a clear extension point for Letta's slices.
5. A minimal App that loads the data and shows loading and error states. Run it once and fix any console error.

PHASE 2, delegate to 4 sub-agents in parallel. Each owns only its folder, gets a full brief (goal, files it may touch, files it must not touch, docs to read, definition of done) and must write tests:
A. Routing, app/src/routing/: walkingTime.ts implementing contracts.md section 4 exactly, with a Vitest test of all 8 vectors (±1e-3 s); 8-connected grid graph, edge cost = walking time × max(penalty of both cells), no edge if either is +Infinity; A* between any two cells; D* Lite (or another incremental replanner) for rerouting when cells get blocked; fast and safe route options; run in a Web Worker. Cross-check test on the real data: A* time from each Knot to the rover equals return_field.bin at that Knot within 1%.
B. Scene, app/src/scene/: terrain mesh from the heightmap (decimate if needed for 60 fps), texture_hirise.jpg stretched exactly over the grid extent, Labyrinth view (perspective, orbit controls) and Planning Table (orthographic, top-down) on the same scene, Gale regional image (gale_context.jpg) on a plane with a clearly visible marker for patch_rect_px (only about 20 px), markers for Knots, rover and shelters. Local grid only: x east, z south, y up, metres; no lat/lon maths.
C. Layers, app/src/layers/: overlay textures from the grids with colour maps and legends: no-go (penalty +Infinity), slope, sky-view, thermal inertia (context, 100 m native), mineralogy (label "est., low confidence"), rover viewshed; rocks as instanced markers; one toggle panel. Every layer shows its source and "est." from meta.json layers[].
D. Thread and clock, app/src/thread/ and app/src/sim/clock.ts: contour of return_field at (remaining time minus reserve) with d3-contour (marching squares), drawn on the terrain; parameters from meta.json "parameters" (suit 8 h, planned 6 h, reserve 30 min); a minimal sim clock (play, pause, speed) that drives remaining time. Letta extends sim/ later, so keep it small and documented.

PHASE 3, you do this yourself: wire everything into the App (switch Planning Table and Labyrinth view, pick two Knots and show fast and safe routes with times, show the Thread shrinking as the clock runs). Then verify: vitest all green, tsc clean, production build works, total payload within the ~30 MB budget, no console errors on the real data. Replace the "App setup" placeholder in README.md Getting started with the real commands.

RULES: follow AGENTS.md (readable code, descriptive string constants, provenance and "est." on every number, stay in app/ plus that README section, never edit docs/contracts.md or docs/decisions.md without proposing first and asking Malissa). Never let two sub-agents edit the same file. Review and test every sub-agent result before accepting it.

COMMIT MESSAGE: when the gate passes, draft the commit message and show it to Malissa before committing. Format: a subject line "feat(app): Stage 2 <short summary>", then sections "What changed" (folders and features), "How it was verified" (exact commands and results: vitest counts, tsc, build, payload size, the Knot-to-rover cross-check numbers, browser check), "Stage 2 gate" (each box and its evidence), "Known issues and limits", "Notes for Letta (Stage 3)", "Notes for Lawrence (merge and integration check)". No Co-Authored-By or agent attribution lines. Lawrence uses this message to check the work in dev after he merges.

DONE WHEN every box in the Stage 2 gate in docs/handoff.md is ticked with evidence, you appended an entry to docs/log/person_b.md, added Stage 2 to Stage 3 hand-off notes in docs/handoff.md for Letta, Malissa approved the drafted commit message, you committed on dev-malissa and pushed, and told Malissa to notify Lawrence. Never merge into dev or main yourself; Lawrence merges. Ask Malissa before anything irreversible.
```


### Stage 3 prompt (Letta)

Use after Stage 2 is merged into `dev`.

```
You are Letta's main coding agent on ARIADNE (NASA Space Apps 2026, "Interplanetary Survival Guide: Martian Map"). Letta is Person C and owns Stage 3. You are the orchestrator: plan, delegate parallel parts to smaller sub-agents with full briefs, integrate and verify.

READ FIRST, in order, and follow strictly: AGENTS.md (all), docs/handoff.md (Stage 2 to Stage 3 hand-off notes, Stage 3 gate), docs/contracts.md (3.12 knots, 3.14 environment timeline, 3.15 scenario), docs/system_design.md (UX design principles: your main spec; App and Simulation sections), docs/development_conventions.md, README.md (problem, Getting started, Space Apps submission), docs/log/person_c.md, and Malissa's code in app/.

BEFORE CODING: confirm you are on dev-letta, fetch, merge origin/dev into it, and check the app runs and its tests pass. If Stage 2 is not in dev, stop and tell Letta.

BUILD, inside app/ only, adding your own Zustand slices in separate files (never change Malissa's store shape):
1. Suit HUD: compass bar, next Knot, at most 3 numbers (distance to next Knot, Thread margin, O2), go / caution / no-go with shape and text, glove-sized targets; everything else on tap.
2. Provenance: tap any number to see dataset, product ID, resolution, timestamp, uncertainty and an "est." badge.
3. Alerts: what happened, action, distance and time, one-tap [ROUTE] to the nearest shelter using Malissa's router. An alert without an action is a bug.
4. Knot cards: copy the photos from knots.json URLs into app/public/knots/ once, with credits; show science text and measurements.
5. Simulation: extend app/src/sim/ to replay environment_timeline.json ("replaying REMS sol 4760") and run app/src/sim/scenario.json (contracts.md 3.15). Build the solar storm from the real curve in data/reference/spe_profile_sol4190.json and say in the UI that weather and storm come from different dates. The scenario must run identically twice.
6. Mars local time and sun position with the Mars24 algorithm in TypeScript, with tests.
7. CRT look: scanlines, ochre/rust monochrome, pixel font (e.g. VT323), slight curvature, all reducible; ARIADNE's own identity, never a Pip-Boy copy. Propose the exact palette to Letta and record it in docs/decisions.md as proposed.
8. Demo: a scripted walk from the rover to a Knot with the storm alert and reroute; help Letta record it and use README's problem section for the pitch.

Delegate in parallel where folders do not overlap (for example HUD, Knot cards, Mars24, scenario engine), review and test every result.

COMMIT MESSAGE: when the gate passes, draft the commit message and show it to Letta before committing. Format: a subject line "feat(app): Stage 3 <short summary>", then sections "What changed", "How it was verified" (exact commands and results), "Stage 3 gate" (each box and its evidence), "Known issues and limits", "Demo and pitch status", "Notes for Lawrence (merge and integration check)". No Co-Authored-By or agent attribution lines.

DONE WHEN every box in the Stage 3 gate in docs/handoff.md is ticked with evidence, you appended an entry to docs/log/person_c.md, Letta approved the drafted commit message, you committed on dev-letta and pushed, and told Letta to notify Lawrence. Never merge into dev or main yourself; Lawrence merges. Ask Letta before anything irreversible.
```
