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
