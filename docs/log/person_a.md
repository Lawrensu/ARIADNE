# Person A log (Lawrence)

Stage owned and role: Stage 1, data and algorithms pipeline (Python, uv): ingest, derive layers, traversal penalty, return field, export, validator.

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

### 2026-11-13 evening | Claude Code | Stage 0 prep: DTM, distance, staging point, walking numbers

- Changed: added "Prep results: Lawrence (Person A)" to `docs/stage_0_guide.md`; candidate DTM and orthoimage product IDs in `docs/data_sources.md` 3.1 and 3.2; new dataset 3.14 (Curiosity traverse waypoints).
- Verified (how): DTM coverage by point-in-polygon test of 8 Curiosity stops against footprint corners in the HiRISE DTM index; file sizes by HTTP HEAD; distances by great-circle math on waypoint lat/lon (Mars radius 3389.5 km); test vectors computed with the proposed formula in Python.
- Broken or open: nothing downloaded yet (~780 MB); gaps inside the DTM and the staging slope are unchecked; all values are proposals until the Stage 0 session.
- Next step: download the primary DTM and orthoimage, check gaps and staging slope, measure compressed layer sizes with Person B.
- Delegated to sub-agents: none.


### 2026-11-14 early | Claude Code | DTM download and checks, staging point revised

- Changed: `docs/stage_0_guide.md` prep results (download checks, new staging point, measured data size); `docs/data_sources.md` 3.1 and 3.2 status; `docs/handoff.md` known issue 1 with measured sizes.
- Verified (how): DTM and orthoimage byte sizes match the archive; no-data, slope and compression measured on the real patch; DTM slope at 205 Curiosity stops compared with rover tilt (8.8° vs 8.4° median); alignment checked by comparing DTM and waypoint elevations along the route and a shift search.
- Broken or open: absolute elevation drifts 1 to 18 m against Curiosity's waypoints (not a shift, slopes unaffected); staging point and data resolution need team sign-off.
- Next step: Stage 0 session; walk Person B through the 2 m export recommendation.
- Delegated to sub-agents: analysis script (`analyze_patch.py`, kept outside the repo) written and run by a sub-agent; checked by reviewing its synthetic test and re-checking the suspicious slope and alignment numbers with a separate script.


### 2026-11-14 10:10 | Claude Code | Stage 0 sign-off and Stage 1 pipeline built

- Changed: contracts signed v1.0.0 (2 m grid, walking numbers, penalty rules, viewshed, regional image); decisions D-017 to D-025; full pipeline in `pipeline/` (settings, grid, walking, terrain, rocks, penalty, return_field, sky_view, surface, knots, environment, regional, export, `run.py`, `validate/run.py`, tests); Knot content in `pipeline/content/knots_content.json`; `data/processed/` generated (33 MB); hand-off notes in `docs/handoff.md`; overlay preview `docs/images/stage1_overlay_check.png`.
- Verified (how): `uv run python validate/run.py` 46 of 46 pass; `uv run pytest` 63 pass; visual overlay of no-go zones, rocks, Knots, rover and Thread contours on the HiRISE texture; rock detections checked against Curiosity's route (with confidence 0.6 or more, 0 of 203 stops fall on a rock-blocked cell); CRISM classes kept only where both scenes agree (scene agreement on detections was only 1.3%).
- Broken or open: mineralogy is weak (890 agreed cells); environment UV level, dust tau and dose equivalent are estimates; the regional image cache must be built once with network (`data/raw/regional/`), later runs are offline.
- Next step: commit and push `dev-lawrence`, merge into `dev`, integration check, sign off Stage 1, brief Malissa.
- Delegated to sub-agents: research (REMS/RAD/SPE, THEMIS/CRISM, Knot photos), modules (rocks, sky_view, validator, regional, surface, environment), docs (high-level summary, getting started, data sources refresh, problem statement). Each result checked by running its tests, the validator and real-data numbers; two outputs corrected by the main agent (CRISM agreement rule, UV upper envelope) and one weak spot fixed (regional image now cached offline).


### 2026-11-14 11:30 | Claude Code | Science plan (D-027, contract v1.1.0), docs consolidated

- Changed: contract v1.1.0 (science_tasks on Knots, carried-load parameters, section 4.6 load factor and science plan rule, validator check 11); D-026 (docs merged to 8 plus logs) and D-027 (science plan); load factor in `walking.py`; science tasks passed through `knots.py`; Knot task content in `pipeline/content/knots_content.json`; README summary rewritten as a story with the science balance; system_design, handoff gates and README features updated.
- Verified (how): pipeline rerun; `uv run python validate/run.py` 47 of 47 pass; `uv run pytest` 68 pass; knots.json has 2 tasks per Knot (174 min, 4.0 kg).
- Broken or open: task durations and masses are estimates anchored to Apollo 16 station times; load factor 0.01 per kg is an estimate.
- Next step: merge into dev; Malissa's agent adds the science planner to her Stage 2 work before committing.
- Delegated to sub-agents: science task content (checked: valid JSON, totals, sources), validator v1.1.0 (checked: tests pass, full validator run on real data).
