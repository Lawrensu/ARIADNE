# ARIADNE decision log

Append-only. Newest entries at the bottom.

Rules:

- Never edit an accepted entry. To change a decision, add a new entry that supersedes it and set the old entry's status to `superseded` (the status line is the only thing that may change in an old entry).
- Statuses: `proposed` | `accepted` | `superseded` | `rejected`.
- A human approves every entry before it becomes `accepted`. Agents may only add entries as `proposed`.
- When a decision is accepted, every affected doc is updated in the same change.
- Source-of-truth precedence when docs disagree: `contracts.md` > `decisions.md` (latest accepted entry) > `system_design.md` > `development_conventions.md` > `design_principles.md` > `README.md`.


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


## Open questions (Stage 0)

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
    - Notes: See design_principles.md.
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
