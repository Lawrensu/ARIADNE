# ARIADNE

**Astronaut Route Intelligence And Data for Navigation & Exploration** (crew shorthand: "Ari")

A map and suit display for one astronaut on one Marswalk: real NASA data, a planned route, and a guaranteed way home.

> The boxwork is a labyrinth. Every labyrinth needs a thread.

Built by Team Stuff for the NASA hackathon challenge "Interplanetary Survival Guide: Martian Map" (14 to 15 November 2026).


## The problem

Mars maps are built for planets, not for one walk. NASA's Mars Trek and the USGS global geologic map work at regional or global scale, and the tools that plan human spacewalks have been tested on Earth analogs and the Moon, not on a real Mars patch. On a ~2 km Marswalk (the Artemis III excursion radius) in Gale Crater, 18% of the ground is steeper than 25°, and no tool ties real Mars terrain, radiation, weather and the oxygen left into one answer to "can I still get home?". Apollo recalculated walkback limits during each EVA; nothing today does that continuously on a display for the crew.


## Existing solutions and the gap

- Map portals (planet scale, for scientists): Mars Trek, the USGS global geologic map (1:20,000,000), JMARS. Gap: global scale, no walking time, no consumables, no suit view. [Mars Trek](https://trek.nasa.gov/mars/jpl/config/textAbout.html), [USGS](https://www.usgs.gov/publications/digital-global-geologic-map-mars-chronostratigraphic-ages-topographic-and-crater), [JMARS](https://jmars.mars.asu.edu/what-jmars)
- Rover mission tools (robots, ground teams): MMGIS and OnSight. Gap: team platforms for robotic missions, with no human metabolic cost or return logic, and OnSight is limited to federal staff and contractors. [MMGIS](https://github.com/NASA-AMMOS/MMGIS), [OnSight](https://software.nasa.gov/software/NPO-50830-1)
- Human EVA tools: Minerva (xGDS, SEXTANT, Playbook), used in BASALT analog EVAs. Gap: its authors report unusable time estimates, a constant walking speed, no terrain traversability, and poor fit for replanning during an EVA. [Marquez 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC6442304), [xGDS](https://software.nasa.gov/software/ARC-17174-1)
- LunaNet: a proposed Moon communications and navigation network. Gap: it tells you where you are, not which ground is safe. [NTRS](https://ntrs.nasa.gov/citations/20200001555)

The gap: no tool we found combines real Mars terrain data, a suit-calibrated walking cost, live consumables, and a continuously updated safe-return boundary for one astronaut on one walk, offline, in both a habitat view and a suit view.

For the full differentiation and the evidence that ARIADNE would work, see [docs/system_design.md](docs/system_design.md#design-rationale).


## The idea

In Greek myth, Ariadne gave Theseus a thread so he could find his way out of the labyrinth. Our Marswalk site, the boxwork ridges of Gale Crater, is a natural labyrinth: networks of low intersecting ridges with sandy hollows between them. The core feature of ARIADNE is a thread of our own, a guaranteed way home.

Pitch opener: every Mars map today is made for scientists studying a planet. Nobody has built one for the astronaut standing on it, asking "can I still get home?". ARIADNE gives one astronaut one Marswalk and a thread that always leads back.


## Site and scenario

- **Region:** Gale Crater (~154 km), shown on the Planning Table as a static regional context image.
- **Marswalk patch:** a ~2 × 2 km area where Curiosity's boxwork region on lower Mount Sharp meets the western edge of the Gediz Vallis channel. Bounds (planetocentric, east-positive): north -4.7809, south -4.8124, west 137.3771, east 137.4114, about 2,024 m east-west × 1,869 m north-south (see [D-017](docs/decisions.md)).
- **Scenario:** a pressurised rover drives the crew from the habitat to a staging point in the patch, then the crew walks in a pair. The Thread is computed relative to the staging point (the rover).
- **Staging point:** lat -4.78877, lon 137.39023, one of the flattest spots in the patch and about halfway between the two targets, the Gediz Vallis sulfur field and the boxwork (about 1.1 km to each, about 2.0 km apart; see [D-018](docs/decisions.md)).
- **"Real-time" means replay:** no one is on Mars, so ARIADNE replays real historical data on a simulation clock with a speed multiplier, plus a scripted scenario, and says so openly. The weather is REMS sol 4760 (26 December 2025 UTC). The scripted event is the May 2024 solar storm that Curiosity's RAD measured on sol 4190, so the two come from different dates (see [D-025](docs/decisions.md)).


## Features

- **Planning Table:** the habitat/rover display. A big map with all layers, used to plan the route.
- **Suit HUD:** the minimal in-suit display: compass bar, next Knot, Thread margin, O2, alerts. At most about 3 numbers at once.
- **Labyrinth view:** the 3D terrain view of the Marswalk site.
- **The Thread:** the safe-return ring. The boundary of everywhere the astronaut can reach and still walk back to the staging point with the remaining consumables minus a reserve. It shrinks as they walk.
- **Knots:** science waypoints along the route, with real Curiosity photos and science notes.
- **Route planning with rerouting:** fast and safe route options, and fast replanning when a hazard changes.
- **Conditions panel:** local time, sun position and time to sunset, weather, radiation dose budget.
- **Actionable alerts:** every alert comes with an action, for example "Solar storm: shelter at Knot B, 340 m, 6 min. [ROUTE]".
- **Provenance:** every displayed value is traceable (dataset, product ID, resolution, timestamp, uncertainty). Model-derived values are labelled "est.".

Out of scope: voice assistant, live Mars data, other sites or a global map, mapping libraries and game engines. Stretch: Mars Climate Database forecast, relay orbiter passes (SPICE), SAM-based rock detection.


## Data layers

- Core: HiRISE orthoimage and DTM (slope, roughness), Curiosity RAD radiation, Curiosity REMS weather, Curiosity ground photos.
- Added: CRISM mineralogy, THEMIS thermal inertia (context only, coarse), shadow-based rock detection from HiRISE (offline, estimates).
- Support: NASA DONKI space weather events, Mars24 time and sun position (NASA GISS).
- Stretch: Mars Climate Database forecast (LMD), SPICE relay passes.

Product IDs, URLs, resolutions, licences, processing and status for every dataset are in [docs/data_sources.md](docs/data_sources.md).


## Getting started

Windows, macOS and Linux all work. Commands are for a bash-like shell (on Windows use Git Bash or PowerShell).

Who needs what:
- Everyone: install git and clone the repo. Update your `dev-{firstname}` branch from `dev` before starting.
- Malissa (Stage 2) and Letta (Stage 3): you only need `data/processed/`. It is committed to git (D-022), so a normal `git pull` gets it. No Python, no `uv` and no raw data needed.
- Lawrence (Stage 1 pipeline): you need `uv` and the raw data (about 1.1 GB, see "Raw data").


### Pipeline setup

Install `uv` (the Python package and project manager) from https://docs.astral.sh/uv/getting-started/installation/ then go to the pipeline folder:

```bash
cd pipeline
```

Install Python (3.11 or newer; `uv` fetches one if missing) and all dependencies, creating `pipeline/.venv`:

```bash
uv sync
```

Run every later command from `pipeline/` unless stated otherwise.


### Raw data

Raw data is git-ignored and only needed to run the pipeline. Put each file at the path below (relative to the repo root). Full provenance is in [docs/data_sources.md](docs/data_sources.md).

- HiRISE DTM, `data/raw/hirise/DTEEC_009149_1750_009294_1750_U01.IMG` (~390 MB), plus its label `DTEEC_009149_1750_009294_1750_U01.LBL` in the same folder: https://hirise-pds.lpl.arizona.edu/PDS/DTM/PSP/ORB_009100_009199/PSP_009149_1750_PSP_009294_1750/DTEEC_009149_1750_009294_1750_U01.IMG
- HiRISE orthoimage, `data/raw/hirise/PSP_009149_1750_RED_A_01_ORTHO.JP2` (~388 MB): https://hirise-pds.lpl.arizona.edu/PDS/DTM/PSP/ORB_009100_009199/PSP_009149_1750_PSP_009294_1750/PSP_009149_1750_RED_A_01_ORTHO.JP2
- THEMIS thermal inertia, Gale crop of the 100 m mosaic, `data/raw/themis/THEMIS_TI_Mosaic_Quant_30S120E_100mpp_gale_crop.tif` (small). Source mosaic: https://astrogeology.usgs.gov/search/map/themis_thermal_inertia_mosaic_quantitative_30s120e_100mpp (the crop is cut from it around Gale Crater).
- CRISM MTRDR summary parameters (SR), each as `.img`, `.hdr`, `.lbl` and `.xml` (~130 MB per `.img`), in `data/raw/crism/`: `frt0000b6f1_07_sr165j_mtr3.*` (observation FRT0000B6F1, primary) and `frt000058a3_07_sr165j_mtr3.*` (observation FRT000058A3, cross-check). Source: https://pds-geosciences.wustl.edu/mro/mro-m-crism-5-rdr-mptargeted-v1/mrocr_4001/mtrdr/
- Curiosity RAD and REMS files, in `data/raw/msl_environment/` (`rad/`, `rad_spe_sol4190/`, `rems/`), for the environment timeline. Sources: PDS Geosciences Node (RAD) https://pds-geosciences.wustl.edu/ and PDS Atmospheres Node (REMS) https://pds-atmospheres.nmsu.edu/
- Gale regional image: nothing to download. It is read over HTTP at run time from the USGS Viking MDIM 2.1 mosaic (https://planetarymaps.usgs.gov/mosaic/Mars_Viking_MDIM21_ClrMosaic_global_232m.tif), so the run needs internet.

HiRISE files are large and the server can drop the connection. Resume an interrupted download with `curl -C -`, for example for the orthoimage:

```bash
curl -C - -L -o data/raw/hirise/PSP_009149_1750_RED_A_01_ORTHO.JP2 "https://hirise-pds.lpl.arizona.edu/PDS/DTM/PSP/ORB_009100_009199/PSP_009149_1750_PSP_009294_1750/PSP_009149_1750_RED_A_01_ORTHO.JP2"
```

There is no fetch script yet; download by hand.


### Run the pipeline

From `pipeline/`:

```bash
uv run python run.py
```

It first checks the walking-time test vectors, then runs each step and prints a timestamped line per step. It takes a few minutes; the Gale image is read over the network. It writes to `data/processed/` (formats in [docs/contracts.md](docs/contracts.md), section 2):
- `meta.json`
- `heightmap.bin`, `slope_degrees.bin`, `roughness_m.bin`, `traversal_penalty.bin`, `return_field.bin`, `sky_view_factor.bin`, `thermal_inertia.bin` (float32 grids)
- `mineralogy_class.bin`, `viewshed_rover.bin` (uint8 grids)
- `texture_hirise.jpg`, `gale_context.jpg`
- `rocks.json`, `knots.json`, `shelters.json`, `environment_timeline.json`

Processed files are committed to git (D-022), so commit them on your branch when the output changes.


### Run the validator

From `pipeline/`:

```bash
uv run python validate/run.py
```

It prints one line per check, starting with `PASS` or `FAIL` and the reason, then a final `SUMMARY:` line. The exit code is 0 only if every check passes (the Stage 1 gate needs this). Optional: `--processed-dir PATH` checks another folder. On an empty or partial `data/processed/` it fails, which is expected.


### Run the tests

From `pipeline/`:

```bash
uv run pytest
```

Add `-q` for short output. pytest is configured in `pipeline/pyproject.toml`. No raw data or network is needed: the tests use small synthetic inputs. They cover the 8 walking-time test vectors (contracts.md 4.5), the validator, the Gale regional crop, rock detection, sky-view and shelters, and the CRISM mineralogy classes.


### App setup

App setup: added by Malissa in Stage 2.


### Troubleshooting

- `ModuleNotFoundError: No module named 'ariadne_pipeline'`: you are not in `pipeline/`. Run `cd pipeline` first and use `uv run ...`.
- `uv: command not found`: install `uv` and open a new terminal so it is on your PATH.
- `run.py` stops early with a missing file error: a raw input is not at the exact path listed in "Raw data". A HiRISE file that is too small means the download dropped; resume it with `curl -C -`.
- The regional (Gale) step fails or hangs: it needs internet to read the USGS mosaic. Check your connection and run again.
- The validator prints many `FAIL ... missing file` lines: `data/processed/` is empty or partial. Run the pipeline, or `git pull` to get the committed files.


## Team and workflow

Roles:
- Lawrence Lian Anak Matius Ding (Team Leader, Person A): Stage 1, data and algorithms pipeline. Branch `dev-lawrence`.
- Malissa (Person B): Stage 2, app shell, Labyrinth view, Planning Table, runtime routing, Thread rendering. Branch `dev-malissa`.
- Letta (Person C): Stage 3, Suit HUD, alerts, Knot cards, simulation clock and scenario engine, CRT polish, demo and pitch. Branch `dev-letta`.

Work runs in sequential stages (0, 1, 2, 3). A stage starts only when the previous gate is passed: contract validator passes, visual check done, handoff checklist ticked, human sign-off.

Branch flow:
- `main` is production and `dev` is integration. Only Lawrence merges into them.
- Update your `dev-{firstname}` branch from `dev` before starting.
- Work and commit only on your own branch.
- When your gate passes, push your branch and tell Lawrence.
- Lawrence merges into `dev`, runs the integration check, then merges `dev` into `main`.

Each teammate uses an agentic coding tool whose main agent can delegate to sub-agents. All rules for agents and humans are in [AGENTS.md](AGENTS.md).


## Status

Current stage, gate checklists, known issues and next steps: [docs/handoff.md](docs/handoff.md).


## Space Apps submission

Prerequisite: every team member must be added to the team on spaceappchallenge.org before submitting. Deadline: 14 November 2026, 12 pm. Check the form for a character limit; use the short version if needed.

Tagline:

> ARIADNE: the Marswalk map with a thread that always leads the astronaut home.

Short version:

> ARIADNE is a map and suit display for one astronaut on one Marswalk in Gale Crater. It layers real NASA data, plans a route, and draws The Thread: the boundary within which the astronaut can still walk back to the rover. It replays historical data and gives estimates.

Main version (high-level summary):

> For the challenge "Interplanetary Survival Guide: Martian Map", we are building ARIADNE (Astronaut Route Intelligence And Data for Navigation & Exploration, "Ari").
>
> The problem: Mars maps such as Mars Trek and the USGS geologic maps are regional or global. They are not made for the small patch of ground one astronaut covers on one Marswalk.
>
> Our solution is a map and suit display for a single ~2 × 2 km patch in Gale Crater. It joins the Gediz Vallis sulfur stones with the boxwork ridges that Curiosity studied in 2024 to 2025. A planning table shows every layer and a planned route. A 3D Labyrinth view shows the terrain. A minimal suit display shows the next waypoint, oxygen and alerts. Science waypoints ("Knots") carry real Curiosity photos. Every alert comes with an action, such as rerouting to shelter.
>
> Safety comes first. The Thread is the boundary of everywhere the astronaut can reach and still walk back to the rover with a reserve. It shrinks as they walk.
>
> We layer HiRISE terrain and imagery, Curiosity REMS weather and RAD radiation, CRISM minerals, THEMIS thermal inertia, Curiosity ground photos and DONKI space weather.
>
> Honest limits: ARIADNE replays real historical data and does not use live data. Walking times are estimates, labelled "est.". It is being built during the hackathon.


## Documentation map

- [AGENTS.md](AGENTS.md): the single instruction file for every agent and human (read order, directory map, ownership, git workflow, rules).
- [CLAUDE.md](CLAUDE.md): only imports `AGENTS.md` for Claude Code.
- [docs/system_design.md](docs/system_design.md): architecture, local grid, components, algorithms, UX principles, visual identity, design rationale.
- [docs/contracts.md](docs/contracts.md): exact file formats between stages, walking-time formula, test vectors.
- [docs/data_sources.md](docs/data_sources.md): every dataset with product ID, URL, resolution, licence and status.
- [docs/decisions.md](docs/decisions.md): append-only decision log.
- [docs/handoff.md](docs/handoff.md): current stage, gate checklists, known issues, next steps, and the Stage 2 and 3 kickoff prompts.
- [docs/development_conventions.md](docs/development_conventions.md): code, doc and git conventions.
- [docs/log/person_a.md](docs/log/person_a.md): session log for Lawrence (Person A).
- [docs/log/person_b.md](docs/log/person_b.md): session log for Malissa (Person B).
- [docs/log/person_c.md](docs/log/person_c.md): session log for Letta (Person C).
- [docs/images/stage1_overlay_check.png](docs/images/stage1_overlay_check.png): Stage 1 output preview (no-go zones, rocks, Knots, rover, Thread contours on the HiRISE photo).


## Repository map

- `AGENTS.md`, `CLAUDE.md`: agent instructions (full directory map in [AGENTS.md](AGENTS.md)).
- `docs/`: design, contracts, data sources, decisions, handoff and per-person logs.
- `pipeline/`: Python data pipeline (Person A), Stage 1 code and tests. Python via `uv`, GDAL/rasterio, numpy, richdem, scikit-image.
- `app/`: React, Vite, TypeScript, Zustand, Tailwind and React Three Fiber (Persons B and C), placeholder for now. Static hosting (Netlify). The app works only in a local metre grid.
- `data/`: `raw/` (git-ignored downloads) and `processed/` (pipeline outputs, committed).


## Credits and data

ARIADNE uses data and tools from NASA/JPL (Mars Trek, Curiosity RAD and REMS via the Planetary Data System, DONKI), the USGS, and the University of Arizona HiRISE team (HiRISE images and DTMs).

- All data is used according to the terms of its provider.
- Licences and attributions are tracked per dataset in [docs/data_sources.md](docs/data_sources.md).
- ARIADNE is a hackathon project and is not an official NASA product.
