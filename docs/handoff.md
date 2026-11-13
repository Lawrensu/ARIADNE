# ARIADNE hand-off board

Current stage: Stage 0, not started

Last updated: 2026-11-13

This is the live status board. The main agent of the stage owner updates it whenever stage status changes. A stage starts only when the previous stage's gate is passed and a human has signed off.


## Stages

1. Stage 0: patch, Knots, contracts
   - Owner: Whole team
   - Status: Not started
   - Gate passed: No
   - Signed off by: none yet
2. Stage 1: data and algorithms pipeline
   - Owner: Lawrence (Person A)
   - Status: Not started
   - Gate passed: No
   - Signed off by: none yet
3. Stage 2: app shell, Labyrinth view, Planning Table, routing, Thread
   - Owner: Person B
   - Status: Not started
   - Gate passed: No
   - Signed off by: none yet
4. Stage 3: Suit HUD, alerts, Knot cards, simulation, CRT polish, demo
   - Owner: Person C
   - Status: Not started
   - Gate passed: No
   - Signed off by: none yet


## Stage 0 checklist (whole team)

- [ ] Confirm the Marswalk patch in Mars Trek: a HiRISE DTM covers it (if only one target is covered, prefer the boxwork side); record the DTM product ID.
- [ ] Confirm the real distance between the boxwork and Gediz Vallis targets (if > ~3 km, staging point goes between them or two short walks).
- [ ] Confirm a flat area for the rover and set the staging point.
- [ ] Fix the patch bounds.
- [ ] Choose 4 to 5 Knots (lat/lon, science rationale, candidate Curiosity photos).
- [ ] Person A fixes Mars/suit walking parameters (`suit_speed_factor`, `gravity_adjustment`) and the slope cutoff (proposal 25°); confirm the max-of-two-penalties edge rule; record in `decisions.md`.
- [ ] Person A fills the walking-time test vectors in `contracts.md`.
- [ ] Decide the consumables model (O2 duration, reserve).
- [ ] Choose the REMS sol to replay and the DONKI event for the scenario.
- [ ] Decide how processed data is shared (Git LFS vs shared drive).
- [ ] Person B confirms the performance budget (≤ ~30 MB, texture ≤ 4096 × 4096).
- [ ] Person C proposes the exact colour palette values; the whole team approves.
- [ ] Settle the remaining small TBDs (open questions 14 to 21 in docs/decisions.md): Knot text writer, photo hosting, Gale image, `state/` ownership, shelter list, Mars24 location, `scenario.json` path, nearest-shelter and viewshed formats.
- [ ] Fill in the names of the Stage 2 and Stage 3 owners (Person B and Person C).
- [ ] Create `dev` from `main`, and each teammate creates their `dev-{firstname}` branch from `dev`.
- [ ] Finalise `contracts.md` and sign it off (human approval), bump it from DRAFT.
- [ ] Human sign-off for Stage 0.


## Stage 1 gate (Person A to Person B)

- [ ] `pipeline/validate/run.py` passes (run with `uv run`).
- [ ] QGIS overlay check: texture vs heightmap vs rocks are aligned.
- [ ] Knots are visually in the right place.
- [ ] Walking-time test vectors pass in Python.
- [ ] Data is shared via the chosen method (Git LFS or shared drive), and Person B can fetch it.
- [ ] Log entry written in `docs/log/person_a.md`.
- [ ] `dev-lawrence` merged into `dev`; integration check passed.
- [ ] Human sign-off.


## Stage 2 gate (Person B to Person C)

- [ ] The app loads the real data with no console errors.
- [ ] Terrain matches the texture.
- [ ] Layer toggles work.
- [ ] A route computes between Knots.
- [ ] Walking-time test vectors pass in TypeScript.
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

1. Data size conflicts with the payload budget.
   - One 2000 × 2000 float32 grid is 16 MB; the contract lists about 115 MB of layers against a ~30 MB budget.
   - Options and a recommendation are in `docs/stage_0_guide.md` ("Data size and sharing"). Decide at Stage 0.


## Hand-off notes from the previous stage

Template (the outgoing stage owner fills this in at the gate):

- From stage:
- Date:
- What is done:
- What is not done or only partly done:
- Things the next stage must know (surprises, workarounds):
- Contract changes during the stage (decision IDs):
- Where the data or build lives:

No hand-off notes yet.


## Next steps

1. Tonight: each person does their prep in `docs/stage_0_guide.md`.
2. Day 1 start: run the 60 minute Stage 0 session from the same guide.
3. Open questions are listed in `docs/decisions.md`.
