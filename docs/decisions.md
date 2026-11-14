# ARIADNE decision log

Append-only. Newest entries at the bottom.

Rules:

- Never edit an accepted entry. To change a decision, add a new entry that supersedes it and set the old entry's status to `superseded` (the status line is the only thing that may change in an old entry).
- Statuses: `proposed` | `accepted` | `superseded` | `rejected`.
- A human approves every entry before it becomes `accepted`. Agents may only add entries as `proposed`.
- When a decision is accepted, every affected doc is updated in the same change.
- Source-of-truth precedence when docs disagree: `contracts.md` > `decisions.md` (latest accepted entry) > `system_design.md` > `development_conventions.md` > `README.md`.


## Entry template

```
### D-NNN: <short title>

- Date: YYYY-MM-DD
- Status: proposed | accepted | superseded | rejected
- Decision: <what was decided>
- Why: <reasons>
- Alternatives considered: <what else, and why not>
- Affects docs: <list of files>
```


## Decisions

### D-001: Project name ARIADNE

- Date: 2026-11-13
- Status: accepted
- Decision: The project is called ARIADNE, short for Astronaut Route Intelligence And Data for Navigation & Exploration. Crew shorthand is "Ari".
- Why: In Greek myth Ariadne gave Theseus a thread to find his way out of the labyrinth. The boxwork ridges are a natural labyrinth and the core feature is a guaranteed way home, so the name carries the story and the pitch hook ("The boxwork is a labyrinth. Every labyrinth needs a thread.").
- Alternatives considered: CAIRN (runner-up). Rejected in favour of the stronger story link.
- Affects docs: README.md, AGENTS.md, docs/design_principles.md


### D-002: Site Gale Crater, boxwork / Gediz Vallis western edge

- Date: 2026-11-13
- Status: accepted
- Decision: The region is Gale Crater (~154 km), shown on the Planning Table as a static regional context image. The Marswalk patch is a ~2 × 2 km area at the edge where the boxwork region on lower Mount Sharp meets the western edge of Gediz Vallis channel. Exact bounds are TBD at Stage 0.
- Why: Real Curiosity data exists for both the boxwork (ridges, clay in ridges, carbonates in hollows) and the channel (first pure sulfur on Mars). The boxwork is a natural labyrinth, which suits the Thread. Stage 0 must still confirm that a HiRISE DTM covers the patch, the real distance between the two targets, and a flat parking area for the rover.
- Alternatives considered: A single-target site (boxwork only, if only one target has DTM coverage; the boxwork side is preferred in that case). If the targets are more than ~3 km apart, the staging point goes between them or the walk becomes two short walks.
- Affects docs: README.md, docs/system_design.md, docs/data_sources.md, docs/contracts.md


### D-003: Scenario, pressurised rover to a staging point, then walking EVA in pairs

- Date: 2026-11-13
- Status: accepted
- Decision: A pressurised rover drives the crew from the habitat to a staging point at the edge of the patch. The crew, in pairs, then walks. The Thread is computed relative to the staging point (the rover).
- Why: It gives a single, fixed reference for the return field and a physical place of safety, and keeps the walk to a few kilometres. Walking in pairs matches safety practice.
- Alternatives considered: Place the habitat on flat ground right next to the boxwork so the walk starts from home (rejected: the rover leg adds a stronger story and matches the challenge's suggestion of rovers carrying crew). Walk from the habitat with no rover (rejected: tens of km, too far to walk).
- Affects docs: README.md, docs/system_design.md, docs/contracts.md


### D-004: Rendering, React Three Fiber only

- Date: 2026-11-13
- Status: accepted
- Decision: One rendering stack: React Three Fiber (Three.js) with `@react-three/postprocessing` for the CRT look. The Planning Table 2D map is the same scene with a top-down orthographic camera. The Gale regional view is a static image on a plane. No MapLibre, Leaflet, OpenLayers, Cesium, deck.gl or Unity.
- Why: Goal is light, accurate, hard to break. One stack avoids keeping two coordinate systems, two render loops and two layer systems in sync, and keeps the payload small.
- Alternatives considered: MapLibre or Leaflet for the 2D map (a second renderer and projection to reconcile), Cesium (heavy, Earth-centred), deck.gl (extra layer system), Unity (does not fit static web hosting and the team's skills).
- Affects docs: docs/system_design.md, AGENTS.md


### D-005: One local grid; all georeferencing done once in Python

- Date: 2026-11-13
- Status: accepted
- Decision: Everything handed to the app is in metres on a local grid: origin at the patch's north-west corner, +x east, +z south, +y up, 1 cell = 1 m. All georeferencing is done once in Python. Latitude and longitude appear in the app only for display, taken from `meta.json`.
- Why: Georeferencing in two languages is the largest source of alignment bugs. Doing it once, in the pipeline, keeps the app simple and makes visual checks in QGIS decisive.
- Alternatives considered: Passing geographic coordinates to the app and projecting at runtime (duplicate logic, drift risk).
- Affects docs: AGENTS.md, docs/contracts.md, docs/system_design.md


### D-006: Voice assistant out of scope

- Date: 2026-11-13
- Status: accepted
- Decision: No voice assistant or voice control for now.
- Why: Time is about 48 hours with three people. The Suit HUD is designed for gloves and helmets through large tap targets instead.
- Alternatives considered: Voice control for the Suit HUD (could be revisited after the demo is complete).
- Affects docs: README.md, docs/design_principles.md


### D-007: Rock detection in scope, shadow-based, offline in Python

- Date: 2026-11-13
- Status: accepted
- Decision: Rock detection is in scope. The method is shadow-based detection on the HiRISE orthoimage (after Golombek et al., used for MSL and InSight landing-site rock hazard), run offline in Python. Segment-Anything-style detection is a stretch only.
- Why: Rocks are a real hazard for a route map, and 1 m DTM misses them. The shadow-based method is established, explainable, needs no model weights and runs offline. It detects rocks of about 1.5 m and larger; smaller rocks are a statistical estimate labelled "est.".
- Alternatives considered: Skipping rock detection (weaker safety story), a SAM-based approach (heavier, less explainable; stretch only).
- Affects docs: docs/system_design.md, docs/contracts.md, docs/data_sources.md


### D-008: Cost model, heightmap plus traversal penalty, shared walking-time function

- Date: 2026-11-13
- Status: accepted
- Decision: Walking cost is Tobler's hiking function adapted for Mars gravity and a suit penalty, with slope and roughness limits. Because the cost depends on direction (uphill differs from downhill), it cannot be one scalar per cell. The pipeline exports a heightmap and a per-cell `traversal_penalty` multiplier (≥ 1, `Infinity` = impassable). Edge cost = walking time(dh, horizontal distance) × penalty. The same walking-time function exists in Python and TypeScript, defined exactly in `contracts.md` with test vectors both must pass. Mars and suit parameters are decided by Person A at Stage 0.
- Why: Direction-dependent cost cannot be baked into a scalar layer. A shared function with test vectors prevents the Python return field and the TypeScript router from disagreeing.
- Alternatives considered: A single scalar cost layer (wrong for uphill versus downhill), implementing the function only in the app (the return field is computed in Python), exporting precomputed costs per direction (large payload).
- Affects docs: docs/contracts.md, docs/system_design.md


### D-009: The Thread, precomputed return field plus live contour

- Date: 2026-11-13
- Status: accepted
- Decision: The Thread is the boundary of everywhere the astronaut can reach and still walk back to the staging point with remaining consumables minus a reserve. One Dijkstra outward from the staging point is precomputed in Python as `return_field` (seconds to walk back from every cell). The live ring is the contour of `return_field` at (remaining consumable time − reserve), drawn with marching squares. It shrinks as the astronaut walks.
- Why: A single precomputation makes the live update a cheap contour, so it can update every frame. It also makes the guarantee explainable.
- Alternatives considered: Running a search from the astronaut's position every update (expensive and not a guarantee relative to the rover), a simple circle of radius (not terrain-aware).
- Affects docs: docs/contracts.md, docs/system_design.md, README.md


### D-010: Sequential stages 0 to 3 with gated hand-offs

- Date: 2026-11-13
- Status: accepted
- Decision: Work runs in sequential stages: Stage 0 whole team, Stage 1 Person A (data and algorithms pipeline), Stage 2 Person B (app shell, Labyrinth view, Planning Table, routing, Thread rendering), Stage 3 Person C (Suit HUD, alerts, Knot cards, simulation clock, scenario engine, CRT polish, demo and pitch). A stage starts only when the previous gate is passed: contract validator passes, visual check, `handoff.md` checklist ticked, human sign-off. While waiting, the next person does non-code prep only.
- Why: Each stage depends on the previous stage's data and contracts. Gates catch misalignment early, before the next person builds on it.
- Alternatives considered: Fully parallel work against mocked data (risk of contract drift), shared ownership of all stages (unclear responsibility).
- Affects docs: AGENTS.md, docs/handoff.md, README.md


### D-011: AGENTS.md is the single agent instructions file

- Date: 2026-11-13
- Status: accepted
- Decision: `AGENTS.md` is the single instructions file for every agent. `CLAUDE.md` contains only `@AGENTS.md` (Claude Code import). Instructions are never placed only in `CLAUDE.md`.
- Why: The team uses different agentic tools. Claude Code reads CLAUDE.md; opencode, Codex, Cursor and most others read AGENTS.md. One file means no drift.
- Alternatives considered: Separate instruction files per tool (drift), CLAUDE.md as the main file (other tools would miss it).
- Affects docs: AGENTS.md, CLAUDE.md, docs/development_conventions.md


### D-012: Contract fields and string constants are deprecate-only

- Date: 2026-11-13
- Status: accepted
- Decision: Once a string constant or a contract field is in use, it is not renamed or removed, only deprecated. Exceptions need a full team review, recorded in this log.
- Why: Renaming or removing a field in use silently breaks the other stage's code. Deprecating keeps old consumers working.
- Alternatives considered: Free renaming with version bumps only (breaks consumers without notice).
- Affects docs: docs/contracts.md, docs/development_conventions.md, AGENTS.md


### D-013: Main agents may delegate to sub-agents

- Date: 2026-11-13
- Status: accepted
- Decision: Each teammate's main agent is an orchestrator and may delegate to sub-agents (Claude Code subagents, opencode subagents or equivalent) under the rules in `AGENTS.md`: the main agent plans and reviews every result; sub-agents start with no context so every brief names files, docs and a definition of done; parallel sub-agents never edit the same file; cheaper models for mechanical tasks; only the main agent edits `contracts.md` (proposal only), `decisions.md`, `handoff.md` and its person's log; the main agent verifies output before reporting it done.
- Why: Speeds up a 48-hour build while keeping one accountable reviewer. It keeps each main agent's context small.
- Alternatives considered: No delegation (slower), unrestricted delegation (conflicting edits, unverified output).
- Affects docs: AGENTS.md, docs/development_conventions.md


### D-014: Replay real historical data on a simulation clock, and say so

- Date: 2026-11-13
- Status: accepted
- Decision: No one is on Mars, so the app replays real historical data (for example a real sol of REMS weather) on a simulation clock with a speed multiplier, plus a scripted scenario (for example a solar particle event alert mid-walk that reroutes to shelter). The UI and the pitch say this openly ("replaying REMS sol NNNN").
- Why: It keeps every number real and traceable, and honesty is a design principle (never fake precision).
- Alternatives considered: Synthetic live data (not real, harder to defend), model forecast only (Mars Climate Database, kept as a stretch).
- Affects docs: docs/contracts.md, docs/system_design.md, docs/design_principles.md, README.md


### D-015: Radiation, dose budget over time, SPE events and terrain shielding; no spatial heatmap

- Date: 2026-11-13
- Status: accepted
- Decision: Radiation is shown as a dose budget over time, solar particle event alerts, and terrain shielding via sky-view factor (labelled "est."). There is no spatial radiation heatmap.
- Why: RAD is a point measurement and surface dose varies mainly in time (published ~0.6 to 0.7 mSv/day surface dose-equivalent). A painted spatial heatmap would fake precision.
- Alternatives considered: A radiation heatmap across the patch (not supported by the data; rejected).
- Affects docs: docs/contracts.md, docs/system_design.md, docs/design_principles.md, docs/data_sources.md


### D-016: Git branching, `main` / `dev` / `dev-{firstname}`, Lawrence integrates

- Date: 2026-11-13
- Status: accepted
- Decision: `main` is production. `dev` is integration. Each teammate works on a personal branch `dev-{firstname}` (for example `dev-lawrence`). When a stage's gate passes, the teammate pushes their branch; Lawrence pulls it into `dev`, his agent merges and runs the integration check, and Lawrence merges `dev` into `main` when stable. Commit messages carry no agent attribution lines.
- Why: One integrator and one integration branch keep the sequential hand-offs safe; `main` stays demo-ready at all times.
- Alternatives considered: Feature branches named `{feature-name}-{developer-name}` merged by anyone (replaced: more branches and no single owner of integration).
- Affects docs: AGENTS.md, README.md, docs/development_conventions.md, docs/handoff.md


### D-017: Marswalk patch bounds

- Date: 2026-11-14
- Status: accepted (Stage 0, Lawrence)
- Decision: The patch is North -4.7809, South -4.8124, West 137.3771, East 137.4114 (planetocentric, east-positive), about 2,024 m east-west × 1,869 m north-south.
- Why: It is the smallest box that holds both science targets with a 150 m margin: the Gediz Vallis sulfur field (Curiosity sol 4210) and the boxwork (sols 4527 to 4839). The two targets are only ~2.0 km apart, so one patch covers both. HiRISE DTM `DTEEC_009149_1750_009294_1750_U01` covers it with no gaps, and Curiosity's photos exist along the whole route.
- Alternatives considered: Boxwork only (loses the sulfur story); two separate patches (twice the data, no shared Thread).
- Affects docs: docs/contracts.md, docs/stage_0_guide.md, docs/data_sources.md


### D-018: Rover staging point

- Date: 2026-11-14
- Status: accepted (Stage 0, Lawrence)
- Decision: The pressurised rover parks at lat -4.78877, lon 137.39023 (elevation about -3709 m).
- Why: It is one of the flattest spots in the patch (mean slope 3.4° within 20 m, max 6.0°), it is almost exactly halfway (1,120 m to the sulfur field, 1,118 m to the boxwork, so two walks of ~1.1 km, inside the Artemis III 2 km excursion radius), and it is ~70 m from Curiosity's sol 4464 stop, so the rover approach follows a route a rover has already driven.
- Alternatives considered: Curiosity stops at sols 4464, 4473, 4417, 4544 (20 m mean slopes of 14.2°, 29.4°, 10.1°, 6.4°: too steep around the rover); flatter spots on high ground ~230 m above the route (far from Curiosity's path).
- Affects docs: docs/contracts.md, docs/stage_0_guide.md


### D-019: Walking model and penalty rules

- Date: 2026-11-14
- Status: accepted (Stage 0, Lawrence)
- Decision: Tobler's hiking function with `suit_speed_factor` 0.6, `gravity_adjustment` 1.0, `max_walkable_slope_deg` 25; `walking_time_seconds` returns `+Infinity` for steeper steps; edge cost uses the max of the two cells' penalties; penalty rules as in contracts.md 3.5.
- Why: 0.6 makes the peak speed exactly 1.0 m/s, matching Apollo's ~2.2 mph maximum nominal suited speed, and flat ground 0.84 m/s (~3 km/h). Evidence for a Mars gravity correction is thin, so it stays 1.0 and times are labelled "est.". The edge slope rule keeps Python and TypeScript identical even where slope layers are smoothed. Max of two penalties is conservative: a step is as hard as its harder end. The DTM shows slope matches Curiosity's measured tilt (median 8.8° vs 8.4°), so slope-based rules are trustworthy.
- Alternatives considered: A Mars gravity speed-up (not well supported); mean of penalties (lets routes clip hazards); path length along the slope (small difference, more complex).
- Affects docs: docs/contracts.md, docs/system_design.md


### D-020: Consumables model for the Thread

- Date: 2026-11-14
- Status: accepted (Stage 0, Lawrence)
- Decision: Suit capability 8 hours, planned Marswalk 6 hours, 30 minute reserve never used for planning. One shared Thread for the pair. The Thread is recalculated as time passes.
- Why: Artemis planning gives EVAs of up to 8 hours with a 6 ± 2 hour target. With a pressurised rover, walkback is limited by what a fully recharged suit can walk back. Apollo recalculated walkback limits during each EVA from real consumption, which is what the live Thread shows.
- Alternatives considered: Percentage reserve (harder to explain); separate Threads per crew member (the crew always walks together).
- Affects docs: docs/contracts.md, docs/design_principles.md


### D-021: Compute at 1 m, export at 2 m

- Date: 2026-11-14
- Status: accepted (Stage 0, Lawrence)
- Decision: The pipeline computes terrain at ~1 m and exports all app grids at `cell_size_m` 2.0. The orthoimage texture stays at most 4096 px (~0.5 m per pixel).
- Why: Measured on the real patch, 8 layers at 1 m are 52 to 96 MB compressed, far over the ~30 MB app budget. At 2 m they are 14 to 24 MB. Computing at 1 m first keeps rock and roughness detail in the penalty.
- Alternatives considered: Lazy loading at 1 m (still too large); uint16 quantisation (contract change, error risk); smaller patch (loses a target).
- Affects docs: docs/contracts.md, docs/system_design.md, docs/stage_0_guide.md


### D-022: Commit processed data to git

- Date: 2026-11-14
- Status: accepted (Stage 0, Lawrence)
- Decision: `data/processed/` is committed to git on the normal branches. `data/raw/` stays git-ignored.
- Why: At 2 m the processed set is about 27 MB raw with every file under 4 MB, so teammates just pull. No extra tools (Git LFS) or manual downloads, which is the least error-prone hand-off.
- Alternatives considered: Shared drive (manual, easy to get out of sync); Git LFS (every teammate must install it; small free quotas).
- Affects docs: AGENTS.md, docs/development_conventions.md, docs/contracts.md


### D-023: Knots chosen by Lawrence

- Date: 2026-11-14
- Status: accepted (Stage 0, Lawrence)
- Decision: Five Knots at Curiosity stops: `knot_sulfur_stones` (sol 4210), `knot_channel_west_edge` (sol 4389), `knot_boxwork_first_view` (sol 4527), `knot_boxwork_ridge` (sol 4602), `knot_boxwork_hollow` (sol 4653). Lawrence's pipeline writes their text and photos; Person C may improve the text later.
- Why: Each is a place Curiosity actually studied, so real photos and science exist. Together they tell the story: first pure sulfur on Mars, flood deposits, then groundwater boxwork (clay ridges, carbonate hollows). Picking them in Stage 1 keeps Person C free for the UI.
- Alternatives considered: Person C picks them (delays Stage 1 output).
- Affects docs: docs/contracts.md


### D-024: Small Stage 0 calls (open questions 14 to 21)

- Date: 2026-11-14
- Status: accepted (Stage 0, Lawrence)
- Decision:
  1. Knot text and photos: Lawrence (Stage 1).
  2. Photos: the app copies them in with credits, so the demo never needs the network.
  3. Gale regional image: Lawrence exports it (`gale_context.jpg`).
  4. `app/src/state/`: Person B owns the store shape; Person C adds slices in separate files.
  5. Shelters: rover plus terrain overhangs; no habitat in the patch.
  6. Mars24 sun and time: runs in the app.
  7. `scenario.json`: `app/src/sim/scenario.json`.
  8. Viewshed: `viewshed_rover.bin`, uint8. A nearest-shelter field is not exported; the app routes to shelters with D* Lite.
- Why: Each choice is the simplest that works offline and keeps one owner per file.
- Alternatives considered: Listed in docs/stage_0_guide.md.
- Affects docs: docs/contracts.md, docs/system_design.md


### D-025: Replay sources

- Date: 2026-11-14
- Status: accepted (Stage 0, Lawrence)
- Decision: Weather replay is one real REMS sol from Curiosity's boxwork period (sol recorded in docs/data_sources.md once confirmed released on PDS). The scenario's solar particle event is the May 2024 storm that Curiosity's RAD measured at the surface. The UI says openly that they come from different dates.
- Why: Both are real measurements from this exact region of Mars, and the May 2024 event is the strongest one Curiosity has recorded, which makes the demo honest and dramatic.
- Alternatives considered: Synthetic weather (not real); a weaker event (less clear demo).
- Affects docs: docs/contracts.md, docs/data_sources.md


### D-026: Fewer docs, merged by topic

- Date: 2026-11-14
- Status: accepted (Lawrence)
- Decision: The repo keeps 8 docs plus logs: README.md, AGENTS.md, CLAUDE.md, docs/system_design.md, docs/contracts.md, docs/data_sources.md, docs/decisions.md, docs/handoff.md, docs/development_conventions.md. Merged and removed: problem_statement.md, getting_started.md and high_level_summary.md into README.md; design_principles.md and the design rationale into docs/system_design.md; kickoff_prompts.md into docs/handoff.md; stage_0_guide.md removed (its results are in D-017 to D-025 and docs/data_sources.md).
- Why: Too many overlapping docs made the repo harder to read for people and agents. One place per topic keeps it concise and avoids contradictions.
- Alternatives considered: Keeping every doc with cross-links (redundant).
- Affects docs: all. Older entries that name removed files now mean their new home (design principles: docs/system_design.md; Stage 0 guide: D-017 to D-025 and docs/data_sources.md).


### D-027: Science plan: tasks at Knots, carried load, science budget

- Date: 2026-11-14
- Status: accepted (Lawrence)
- Decision: Each Knot carries science tasks (type, duration, sample mass, equipment). Carried load slows walking by `1 + 0.01 × kg` with a 10 kg tool kit (estimates). The app plans an ordered route through Knots and tasks, checks it against the 6 hour Marswalk minus the 30 minute reserve, and the Thread scales with the current load. Contract v1.1.0 (additive).
- Why: The challenge asks for a route that lets suited astronauts carrying equipment reach their science objectives while avoiding obstacles. Safety alone is not the mission: the crew must balance discovery against getting home, and see that balance on the map.
- Alternatives considered: Safety only (misses the science objective); recomputing return_field per load in the pipeline (unnecessary, the load factor is uniform so scaling is exact); a metabolic load model such as Pandolf (better physics, too complex to validate in 48 hours).
- Affects docs: docs/contracts.md, docs/system_design.md, docs/handoff.md, README.md


### D-028: Stage 2 integration calls: payload measure, drop-task wording, Theta*

- Date: 2026-11-14
- Status: accepted (Lawrence)
- Decision:
  1. The ~30 MB payload budget is measured as transferred (gzip): the Stage 2 build is 19.19 MB gzip (31.50 MB raw), within budget.
  2. Contract 4.6 is clarified (v1.1.1, wording only): the Thread uses the planned Marswalk time left (6 h minus elapsed minus the 30 minute reserve), while the 8 h suit capability is shown as O2. Drop the next task when the planned time left is less than the walk to the next Knot with the current load, plus the task, plus the walk back from there with its sample. This matches what Malissa built (`checkNextTaskDuringWalk`).
  3. Theta* any-angle routing is built by Lawrence during the Stage 2 integration, as an extra route option next to fast and safe.
- Why: Static hosts serve the data compressed, so gzip is what the crew device downloads. The old rule 4 counted the walk back twice. Theta* was in the design and gives smoother, shorter paths on open ground.
- Alternatives considered: Raw size (would force dropping a layer for a 5% overrun); keeping the ambiguous wording; leaving Theta* as a stretch goal.
- Affects docs: docs/contracts.md, docs/system_design.md, docs/handoff.md, README.md


### D-029: Stage 3 UX requirements: responsive, easy navigation, self-hosted fonts

- Date: 2026-11-14
- Status: accepted (Lawrence)
- Decision:
  1. The app is responsive: phone (375 px), tablet (768 px) and desktop (1280 px and wider), no horizontal scroll; on narrow screens the side panel becomes a drawer or bottom sheet and the map stays full size.
  2. Navigation is simple: grouped sections, one main action per panel, a reset-view button, and the Planning Table pans in every direction (MapControls with `screenSpacePanning`).
  3. Fonts are self-hosted with the build (for example through `@fontsource` packages), at most two families, chosen for a space console or retro terminal feel inspired by real spacecraft displays and games like Fallout or Iron Lung, without copying any game's look, name or icons.
  4. Letta sets the visual direction with her own design inspiration, given to her agent.
- Why: The Stage 2 interface works but is hard to read and navigate, zoomed-in maps could not be dragged up or down, and a demo must look good on any screen. Self-hosted fonts work offline and look the same everywhere.
- Alternatives considered: Desktop only (judges may open it on a phone); fonts from a CDN (breaks offline, D-024 spirit).
- Affects docs: docs/system_design.md, docs/handoff.md


### D-030: Lawrence finishes Stage 3; rover is the storm shelter; simulated "you are here" walk

- Date: 2026-11-14
- Status: accepted (Lawrence)
- Decision:
  1. Letta's agent (opencode, DeepSeek) hit its usage limit after pushing work in progress (`ba5515a` on `dev-letta`). Lawrence's agent merged it into `dev-lawrence` and finishes Stage 3 there.
  2. The visual direction in `app/design/visual_direction.md` is approved as built: phosphor green and parchment on near-black, VT323 for display and IBM Plex Mono for text, both self-hosted.
  3. The demo storm sends the astronaut to the pressurised rover (`shelter_rover`), not a terrain overhang. Overhangs stay on the map as est. fallbacks.
  4. The demo shows a simulated "you are here": the astronaut walks a frozen copy of the science plan on the simulation clock (each leg in its planned time at constant speed, a stay at each Knot for the planned task durations), tasks are checked off when their planned time ends, a breadcrumb trail shows where they walked, and a reroute walks the routed path to its target with the current load factor. The position is labelled "sim." everywhere; Mars has no GPS.
  5. The scenario fires the storm at 6700 s, on the walk from Boxwork ridge to Boxwork hollow, after the first samples are carried, and reroutes to the rover at 6760 s; the astronaut is in the rover at est. 140.7 min.
- Why: Overhangs only block part of the sky (sky-view 0.65 to 0.69, est.), while the rover is pressurised and shielded, so it is the honest shelter for a solar particle event. A moving position makes the HUD numbers and the Thread change live, which is the core of the demo; timing it from the plan keeps it consistent with the numbers shown and deterministic.
- Alternatives considered: overhang shelter as Letta's agent built it (weak protection); a fixed position per scenario step (the HUD would not change between steps); a scripted position list (would drift from the plan's numbers).
- Affects docs: docs/system_design.md, docs/handoff.md, README.md (demo already says the rover), app/design/visual_direction.md

### D-031: Interface redesign: mode tabs, phosphor-hologram map, flat default view

- Date: 2026-11-14
- Status: accepted (Lawrence)
- Decision:
  1. One navigation: a top tab bar with MAP, PLAN, SUIT and DATA plus a gear menu (demo, walk, CRT, credits). The left rail and the "CONSOLE" side panel with its second row of tabs are removed.
  2. The map is always full screen. Over it: an objective card with the next Knot's task checklist (top left), the newest alert (top right) and a control legend with real buttons (zoom, Center on me, Reset view, 2D/3D, Legend). A status bar at the bottom shows sol and LMST, the sim clock, O2 and the Thread margin.
  3. PLAN and DATA open as a sheet over the map (left card on desktop, bottom sheet on phone and tablet); SUIT shows the Suit HUD between the two bars.
  4. The terrain is drawn as a phosphor hologram: the real HiRISE relief in green shades, walkable ground lit, no-go ground dark and hatched, a 100 m grid.
  5. The app opens on the flat north-up map; 3D is one tap away.
  6. Short labels instead of paragraphs, square corners, 1 px lines, 48 px targets (64 px in SUIT). Inspired by a retro field-terminal map and a 3D game map menu without copying their look, names or icons. Spec: `app/design/visual_direction.md` section 6.
- Why: The Stage 3 interface duplicated navigation, used long explanatory text and many boxed panels, and felt generic; an astronaut needs to find where to go, what to do and whether they can get home at a glance.
- Alternatives considered: map with a single drawer and no tabs; keeping the grey orthoimage with green overlays; opening in 3D (slower on phones, harder to plan on).
- Affects docs: app/design/visual_direction.md, docs/system_design.md, docs/handoff.md, README.md (screenshots later)

## Open questions (Stage 0)

Status 2026-11-14: questions 1 to 10 and 12 to 21 are resolved by D-017 to D-025. Question 11 (colour palette) stays with Person C.

1. Exact patch bounds and staging point
   - Owner: Stage 0, whole team
   - Notes: Confirm in Mars Trek: DTM coverage, distance between boxwork and Gediz Vallis targets (if > ~3 km, staging point goes between them or two short walks), a flat area for the rover.
2. Knots: choose 4 to 5 (lat/lon, science rationale, candidate Curiosity photos)
   - Owner: Stage 0, whole team
   - Notes: Who writes the science text: TBD.
3. HiRISE DTM product ID
   - Owner: Stage 0, whole team (Person A to verify)
   - Notes: Must cover the patch.
4. Mars and suit walking parameters (`suit_speed_factor`, `gravity_adjustment`) and slope cutoff (proposal: impassable above 25°)
   - Owner: Person A
   - Notes: Recorded as a decision; fills the contracts.md test vectors.
5. Confirm edge cost uses max of the two cells' penalties
   - Owner: Person A
   - Notes: Proposed in contracts.md.
6. Consumables model (O2 duration, reserve)
   - Owner: Stage 0, whole team
   - Notes: Drives the Thread.
7. Processed-data sharing (Git LFS vs shared drive)
   - Owner: Stage 0, whole team
   - Notes: Payload budget ≤ ~30 MB proposed.
8. Performance budget (≤ ~30 MB, texture ≤ 4096 × 4096)
   - Owner: Person B
   - Notes: Proposed, to confirm.
9. REMS sol to replay
   - Owner: Stage 0, whole team
   - Notes: Person A extracts it.
10. DONKI event for the scenario
    - Owner: Stage 0, whole team
    - Notes: Person C uses it in `scenario.json`.
11. Exact colour palette values (ochre/rust)
    - Owner: Person C proposes, whole team approves
    - Notes: See the UX design principles in docs/system_design.md.
12. Real names for Persons A, B and C
    - Owner: Stage 0, whole team
    - Notes: Placeholders until then.
13. Sign-off of contracts.md v0.1.0
    - Owner: Stage 0, whole team
    - Notes: Human approval.
14. Who writes the Knot science text and picks the photos
    - Owner: Stage 0, whole team
    - Notes: TBD.
15. Photos: hotlink NASA URLs or copy into the app
    - Owner: Person C
    - Notes: See data_sources.md.
16. Gale regional context image: file name and location
    - Owner: Person A
    - Notes: TBD.
17. Ownership of conflicts in `app/src/state/`
    - Owner: Stage 0, whole team
    - Notes: TBD.
18. Which shelters exist in the patch, and whether a habitat entry is included
    - Owner: Stage 0, whole team
    - Notes: TBD.
19. Where the Mars24 sun calculation runs (app or pipeline tables)
    - Owner: Person B and Person C
    - Notes: TBD.
20. Exact path of `scenario.json` in `app/`
    - Owner: Person C
    - Notes: TBD.
21. Formats for the nearest-shelter field and viewshed outputs
    - Owner: Person A
    - Notes: Proposed in system_design.md, not yet in contracts.md.
