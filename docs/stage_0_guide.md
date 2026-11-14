# Stage 0 guide

Working guide for Stage 0: what to prep tonight, how to run the first team session, and the proposals to argue about. Results are recorded in `docs/decisions.md`, `docs/contracts.md` and `docs/handoff.md`; this file is not a source of truth for any decision.

Everything marked "Proposal" is a starting point, not a decision. Everything marked "verify" must be checked before it is used.


## Goal

Stage 0 is done when:
1. Every item in the Stage 0 checklist in `docs/handoff.md` is ticked.
2. `docs/contracts.md` is signed off (DRAFT removed, version confirmed).
3. Person A can start Stage 1 without asking anyone a question.

Target: prep tonight, then a 60 minute team session at the start of Day 1.


## Tonight: prep per person (no code)

Person A, Lawrence (data):
1. Open Mars Trek, turn on Curiosity's traverse and the HiRISE DTM footprints, and find a DTM (digital terrain model, a height map) that covers the boxwork area.
   - Tip: start from the HiRISE boxwork release on uahirise.org and follow its DTM link.
   - Lead: HiRISE stereo pair ESP_019988_1750 / ESP_019698_1750 covers the lower northwest mound; check whether it reaches the boxwork (verify).
2. Note the DTM product ID, its matching orthoimage, and the download size.
3. Measure the real distance between the boxwork and the western edge of Gediz Vallis.
4. Look for a flat spot (slope under ~5°) for the rover to park.
5. Draft the walking model numbers (see "Walking model" below).
6. Fallback if no HiRISE DTM covers the patch: a CTX DTM at about 6 to 20 m. This is a big accuracy loss; flag it to the team.

Person B (app):
1. Read "Data size and sharing" below and come with a recommendation. This is the biggest open risk.
2. Look at how React Three Fiber terrain examples build a mesh from a heightmap, and estimate a mesh resolution that runs smoothly.
3. Check free Git LFS quotas against our data size (verify).

Person C (content and UX):
1. Pick 4 to 5 Knot candidates. For each: name, approximate lat/lon, one paragraph of science rationale, 1 to 3 Curiosity raw images (sol, camera, URL).
   - Ideas: a boxwork ridge top (clay minerals), a boxwork hollow (carbonates), a sulfur stone site in Gediz Vallis, a viewpoint over the ridge network.
2. Pick 2 or 3 candidate REMS sols from when Curiosity was in the boxwork region, and check the data is released on PDS (verify).
3. Find the solar particle event for the scenario on NASA DONKI. Lead: the May 2024 solar storm that Curiosity's RAD recorded at the surface (verify).
4. Make a small mood board and a first ochre palette proposal (go, caution, no-go must stay distinguishable).

Everyone:
1. Read `AGENTS.md` and `docs/handoff.md`.
2. Write down one sentence on the problem we solve. We compare them in the pitch session later.


## Prep results: Lawrence (Person A)

Done 2026-11-13 from Curiosity's waypoint file and the HiRISE DTM index. Proposals for the team session, not decisions yet. Source details are in `docs/data_sources.md` (3.1, 3.2, 3.14).


### Key Curiosity stops (anchors)

1. Sulfur stone field, Gediz Vallis channel: sol 4210, lat -4.78572, lon 137.40886, elevation -3688 m.
2. Leaving the sulfur field: sol 4332, lat -4.78474, lon 137.40610.
3. Western edge of the channel: sol 4389, lat -4.78339, lon 137.39898.
4. First view of the boxwork: sol 4527, lat -4.79721, lon 137.38751.
5. First boxwork site: sol 4541, lat -4.79782, lon 137.38593.
6. Main boxwork, top of the 11 m ramp: sol 4602, lat -4.80437, lon 137.37962, elevation -3631 m.
7. Inside the boxwork: sol 4687, lat -4.80784, lon 137.38104.
8. Late boxwork: sol 4839, lat -4.80991, lon 137.38186, elevation -3599 m.

Notes:
- Sulfur sols come from NASA (crystals sol 4208 to 4209, Mammoth Lakes drill about sol 4220). Boxwork sols come from the Curiosity blog (first view sol 4527, main boxwork sol 4602 to 4603).
- Rover positions are the last stop on or before each sol.


### 1. HiRISE terrain model

Result: found, and it covers the whole route.
1. Primary: `DTEEC_009149_1750_009294_1750_U01` (1.01 m, 391 MB), with orthoimage `PSP_009149_1750_RED_A_01_ORTHO` (0.25 m, 388 MB).
2. Backup: `DTEEC_019698_1750_019988_1750_U01` (1.01 m, 543 MB). Also covers every stop; useful as a cross-check.

Notes:
- Both footprints contain all 8 anchors above.
- Downloaded and checked 2026-11-14 (primary DTM and orthoimage, about 780 MB, in `data/raw/hirise/`).

Download checks:
1. No gaps: 0% no-data inside the patch, in both the DTM and the orthoimage.
2. Real pixel sizes: DTM 1.0117 m, orthoimage 0.2529 m. Same projection (equirectangular, Mars sphere R 3,396,190 m).
3. Slopes are trustworthy: DTM slope at 205 Curiosity stops (median 8.8°) matches the rover's own measured tilt (median 8.4°). Smoothing barely changes them, so they are real terrain, not noise.
4. Absolute elevation differs from Curiosity's waypoint elevations by +18 m in the north (sulfur area) down to +1 m at the boxwork. It is a smooth drift (a ~0.5° tilt of the height reference), not a horizontal shift. Slopes and relative heights are unaffected; the app only needs relative heights.
5. The terrain is steep: median slope 11.7°, and 18% of the patch is above 25°. The route planner will have real no-go zones (good for the demo).


### 2. Distance between the two targets

Result: about 2 km. Both targets fit in one ~2 × 2 km patch, so no split is needed.
1. Sulfur field to main boxwork (straight line): 2,046 m.
2. Western channel edge to main boxwork: 1,686 m.
3. Sulfur field to late boxwork: 2,140 m.
4. Curiosity drove about 3.5 km between them (sol 4210 to 4602), because it followed a winding route.

Patch proposal (anchors plus 150 m margin):
- North -4.7809, South -4.8124, West 137.3771, East 137.4114.
- Size: 2,024 m east-west × 1,869 m north-south.
- Elevation on the route: -3734 m to -3598 m (about 136 m of relief).


### 3. Rover staging point

Method: search the DTM for the flattest 20 m radius areas within 1.4 km of both targets, then prefer spots next to Curiosity's route (proven drivable). Only about 3% of that area has a 20 m mean slope under 5°.

Proposal:
1. Staging point: lat -4.78877, lon 137.39023, elevation about -3709 m.
   - Mean slope 3.4° within 20 m (max 6.0°).
   - 1,120 m to the sulfur field and 1,118 m to the main boxwork: exactly halfway, so two walks of about 1.1 km each.
   - About 70 m from Curiosity's sol 4464 stop, so the rover approach follows Curiosity's own route.

Rejected:
1. Curiosity stops checked on the DTM (mean slope within 20 m): sol 4464 14.2°, sol 4473 29.4°, sol 4417 10.1°, sol 4544 6.4°. Rover tilt only shows the ground under the rover, not the area around it.
2. Flatter DTM spots (lat -4.80181, lon 137.39748 at 3.1°, and similar) sit on high ground about 230 m above the route, far from Curiosity's path.

Notes:
- About 1.1 km from the rover is well inside the 2 km Artemis III excursion radius.


### 4. Walking numbers

Proposal:
1. `suit_speed_factor` = 0.6. Peak speed is then exactly 1.0 m/s (Tobler's peak 6 km/h × 0.6), which matches the Apollo maximum nominal suited speed (~2.2 mph). Flat ground is 0.84 m/s (~3 km/h).
2. `gravity_adjustment` = 1.0 (no adjustment in v0.1.0; evidence is thin; walking times shown as "est.").
3. `max_walkable_slope_deg` = 25.
4. New rule to agree: `walking_time_seconds` returns `+Infinity` when the edge slope is steeper than `max_walkable_slope_deg`. This keeps Python and TypeScript identical even where the cell slope layer is smoothed.

Formula (proposed for contracts.md section 4.4):

```
S = elevation_change_m / horizontal_distance_m
if atan(|S|) in degrees > max_walkable_slope_deg: return +Infinity
speed_kmh = 6 * exp(-3.5 * |S + 0.05|) * suit_speed_factor * gravity_adjustment
walking_time_seconds = horizontal_distance_m / (speed_kmh / 3.6)
```

Test vectors with these values (for contracts.md section 4.5, tolerance ±1e-3 s):

```
horizontal_distance_m   elevation_change_m   expected_seconds
1.0                      0.0                 1.1912   (flat ground anchor)
1.0                      0.1                 1.6905
1.0                     -0.1                 1.1912
1.0                      0.5                 +Infinity (26.6° > 25°)
1.0                     -0.5                 +Infinity (26.6° > 25°)
1.4142135623730951       0.0                 1.6847   (diagonal, flat)
10.0                     2.0                 23.9888
10.0                    -2.0                 16.9046
```

Notes:
- 1 m at -0.1 equals flat ground. That is how Tobler works (it peaks on a gentle downhill), not a bug.
- Sanity check: sulfur field to main boxwork in a straight line on flat ground takes about 41 minutes. Real routes through the ridges will be longer.


### 5. Measured data size (for the session with Person B)

Measured on the real patch (2,010 × 1,845 cells at 1 m):
1. At 1 m, one float32 layer is 14.8 MB raw. Heightmap compresses to 10.4 MB (gzip) or 7.2 MB (brotli); slope only to 13.3 MB or 11.9 MB.
2. At 1 m, all 8 layers: about 108 MB raw, 52 to 96 MB compressed. Over the ~30 MB budget even with compression.
3. At 2 m (1,005 × 922 cells), all 8 layers: about 27 MB raw, 14 to 24 MB compressed. Fits the budget.
4. Orthoimage: the patch is 8,038 × 7,382 px at full 0.25 m; a 4,096 px texture means about 0.5 m per pixel.

Recommendation: the pipeline computes everything at 1 m (accuracy), and exports the app layers at 2 m (fits the budget). If Person B wants 1 m detail in the Labyrinth view, load only the heightmap at 1 m (7 to 10 MB compressed) and keep the other layers at 2 m.


### Still to do before the session

- [x] Download the primary DTM and orthoimage, check gaps and the staging slope.
- [x] Measure compressed layer sizes for the data size decision.
- [ ] Walk Person B through the data size recommendation.


## Team session agenda (60 minutes)

1. Patch and staging point (10 min, Person A presents)
   - Decide: patch bounds, staging point, DTM product ID.
2. Knots (10 min, Person C presents)
   - Decide: 4 to 5 Knots and who writes their text.
3. Walking model and consumables (15 min, Person A proposes)
   - Decide: parameters, slope cutoff, edge rule, EVA duration, reserve.
4. Data size and sharing (10 min, Person B proposes)
   - Decide: grid resolution, loading strategy, Git LFS or shared drive.
5. Replay sol and scenario event (5 min, Person C)
6. Small open questions 14 to 21 (5 min, quick calls)
7. Sign off (5 min)
   - Record decisions as D-017 onwards, fill test vectors, remove DRAFT from contracts, tick the handoff checklist, fill in real names.


## Decisions to make, with proposals


### 1. Patch and staging point

Criteria:
1. HiRISE DTM coverage (if only one target is covered, prefer the boxwork side).
2. Boxwork ridges inside the patch; Gediz Vallis edge if the distance allows.
3. Curiosity's traverse runs through it (ground photos).
4. Flat rover parking spot at the edge.

Notes:
- If the two targets are more than ~3 km apart, put the staging point between them or plan two short walks.


### 2. Walking model

Reference points:
- Apollo treated about 2.2 mph (~1.0 m/s) as the maximum nominal suited walking speed (NASA ICES 2026 presentation).
- A pressurised suit adds roughly 14 ml/min/kg of oxygen use over unsuited walking (same source).
- Evidence on how reduced gravity changes walking speed is thin.

Proposal:
1. `suit_speed_factor` = 0.6, so flat ground gives about 3 km/h (~0.84 m/s), under the Apollo cap.
2. `gravity_adjustment` = 1.0 (no adjustment) in v0.1.0, because the evidence is thin. The UI labels walking times "est.".
3. `max_walkable_slope_deg` = 25.
4. Edge rule: max of the two cells' penalties (as proposed in contracts.md).

After deciding, Person A computes the 8 test vectors in `docs/contracts.md` section 4.5.


### 3. Consumables and the Thread

Reference points:
- Artemis suits are planned for EVAs of up to 8 hours, with a 6 ± 2 hour target (NASA planning material, verify).
- With a pressurised rover, the walkback distance is limited by what a fully recharged suit can walk back (NASA EVA concept of operations).
- Artemis III planning mentions excursions of up to a 2 km radius from the lander. Our ~2 × 2 km patch fits this scale.
- Apollo recalculated the walkback limit during each EVA from real consumption.

Proposal:
1. Suit capability 8 h; planned Marswalk 6 h.
2. Reserve 30 min of consumables, never used for planning.
3. The Thread uses one shared value for the pair (the crew always walks together).
4. The demo shows the Thread being recalculated as time passes, like Apollo did.


### 4. Data size and sharing (biggest risk)

The problem:
- One 2000 × 2000 float32 grid is 16 MB. The contract lists 7 float32 grids plus a uint8 grid and the texture, about 115 MB raw.
- The proposed app budget is ~30 MB.

Options:
1. Lazy loading: load only `heightmap`, `traversal_penalty` and `return_field` at start (48 MB raw, less after the host's gzip/brotli compression); load other layers when toggled.
2. Coarser grid for the app: 2 m cells (1000 × 1000 = 4 MB per layer). The pipeline can still compute at 1 m internally. Loses some ridge detail.
3. Smaller patch: ~1.5 × 1.5 km (9 MB per layer).
4. Smaller data types (for example uint16 with a scale factor). This is a contract change and adds error risk.

Recommendation: measured on the real DTM (see "Prep results: Lawrence", section 5). 1 m is over budget even compressed; 2 m fits. Use option 2 (compute at 1 m, export at 2 m), optionally with a 1 m heightmap only. Avoid option 4.

Sharing:
- Proposal: a shared drive folder named by `contract_version` (for example `processed_v0.1.0`), because free Git LFS quotas are small (verify).


### 5. Replay sol and scenario event

Proposal:
1. Weather: one real REMS sol from Curiosity's boxwork period.
2. Event: a real solar particle event from DONKI (lead: May 2024).
3. Say openly that the scenario combines a real weather sol with a real event from a different date.


### 6. Small open questions (14 to 21 in decisions.md)

Proposals for quick calls:
1. Knot text and photos (14): Person C writes them during prep.
2. Photos (15): copy into the app with credits, so the demo never depends on the network.
3. Gale regional image (16): Person A exports a CTX or HRSC mosaic from Mars Trek, at most 4096 px.
4. `app/src/state/` (17): Person B owns the store shape; Person C adds slices in separate files.
5. Shelters (18): rover plus 1 or 2 terrain overhangs. No habitat inside the patch (it is far away).
6. Mars24 (19): runs in the app; the algorithm is small.
7. `scenario.json` path (20): `app/src/sim/scenario.json`.
8. Nearest-shelter field and viewshed (21): float32 seconds grid and uint8 0/1 grid; Person A drafts the contract entries.


## Outputs to record

Checklist:
- [ ] Decisions D-017 onwards in `docs/decisions.md`, one per decision above.
- [ ] `docs/contracts.md` updated (parameters, test vectors, any format changes) and DRAFT removed.
- [ ] `docs/data_sources.md` updated with real product IDs.
- [ ] `docs/handoff.md` Stage 0 checklist ticked, real names filled in, Stage 1 marked as started.
- [ ] Each person's main agent writes a log entry.


## Parking lot (later)

- Pitch: problem first, then build momentum. Compare everyone's one-sentence problem statement.


## Sources

1. HiRISE lower northwest Mount Sharp stereo pair: https://hirise.lpl.arizona.edu/ESP_019988_1750
2. Gale Crater CTX DTMs (fallback): https://figshare.com/articles/Gale_Crater_Stereo_CTX_DTMs_Orthoimages/6584984
3. EVA Ops 101 for Artemis 3: https://ntrs.nasa.gov/api/citations/20240005248/downloads/EVA%20Ops%20101%20for%20Artemis%203%20External%20Teams.pdf
4. NASA EVA lunar surface concept of operations: https://www.nasa.gov/wp-content/uploads/2020/01/topic_1-_eva_lunar_surface_concept_of_operations.pdf
5. Mars Mass ICES 2026 presentation (suited walking speed, suit oxygen cost): https://ntrs.nasa.gov/api/citations/20260005410/downloads/Mars_Mass_ICES2026_Presentation_Final.pdf
6. Kluis et al. 2022, slope based EVA velocity model: https://bhp.engr.tamu.edu/wp-content/uploads/sites/212/2022/02/Kluis-et-al.-2022-A-METHODOLOGY-FOR-ANALYZING-AND-IMPROVING-EVA-PERFORMANCE.pdf
7. EVA walk-back limit calculation: https://ttu-ir.tdl.org/handle/2346/74208
