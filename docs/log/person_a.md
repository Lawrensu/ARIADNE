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
