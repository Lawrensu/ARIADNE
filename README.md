# ARIADNE

**Astronaut Route Intelligence And Data for Navigation & Exploration** (crew shorthand: "Ari")

A map and suit display for one astronaut on one Marswalk: real NASA data, a planned route, and a guaranteed way home.

Built for the NASA hackathon challenge "Interplanetary Survival Guide: Martian Map" (14 to 15 November 2026) by Team Stuff


## The problem

Existing Mars maps, such as NASA's Mars Trek and the USGS geologic maps, are regional or global. They are made for scientists studying a planet, not for the hyper-local patch of ground one astronaut covers on one Marswalk.

An astronaut on a surface excursion needs different answers:
- Can I walk there?
- How long will it take?
- Can I still get back with the oxygen I have left?
- What are the radiation and weather doing right now?

ARIADNE answers these for a single ~2 × 2 km patch, with astronaut safety first.


## The idea

In Greek myth, Ariadne gave Theseus a thread so he could find his way out of the labyrinth. Our Marswalk site, the boxwork ridges of Gale Crater, is a natural labyrinth: networks of low intersecting ridges with sandy hollows between them. The core feature of ARIADNE is a thread of our own, a guaranteed way home.

> The boxwork is a labyrinth. Every labyrinth needs a thread.


## Site and scenario

- **Region:** Gale Crater (~154 km), shown on the Planning Table as a static regional context image.
- **Marswalk patch:** a ~2 × 2 km area where Curiosity's boxwork region on lower Mount Sharp meets the western edge of the Gediz Vallis channel. Exact bounds: TBD (Stage 0, whole team).
- **Scenario:** a pressurised rover drives the crew from the habitat to a staging point at the edge of the patch, then the crew walks in a pair. The Thread is computed relative to the staging point (the rover).

Stage 0 checks the patch against Mars Trek:
- HiRISE DTM (digital terrain model, a height map) coverage.
- The real distance between the two targets.
- A flat area for the rover to park.


## Features

- **Planning Table:** the habitat/rover display. A big map with all layers, used to plan the route.
- **Suit HUD:** the minimal in-suit display: compass bar, next Knot, Thread margin, O2, alerts. At most about 3 numbers at once.
- **Labyrinth view:** the 3D terrain view of the Marswalk site.
- **The Thread:** the safe-return ring. The boundary of everywhere the astronaut can reach and still walk back to the staging point with the remaining consumables minus a reserve. It shrinks as they walk.
- **Knots:** science waypoints along the route, with photos and science notes.
- **Route planning with rerouting:** fast and safe route options, and fast replanning when a hazard changes.
- **Conditions panel:** local time, sun position and time to sunset, weather, radiation dose budget.
- **Actionable alerts:** every alert comes with an action, for example "Solar storm: shelter at Knot B, 340 m, 6 min. [ROUTE]".

Every displayed value is traceable (dataset, product ID, resolution, timestamp, uncertainty). Model-derived values are labelled "est.".


## Data layers

Must:
1. HiRISE orthoimage
   - Data type: optical
   - Source: Mars Trek tiles / HiRISE ortho product
2. HiRISE DTM, slope, roughness
   - Data type: topographic
   - Source: HiRISE DTMs (University of Arizona)
3. Radiation
   - Data type: radiation
   - Source: Curiosity RAD (PDS)
4. Weather
   - Data type: atmospheric
   - Source: Curiosity REMS (PDS)
5. Ground photos
   - Data type: optical (surface)
   - Source: Curiosity raw images, PDS Analyst's Notebook

Should:
1. Mineralogy
   - Data type: spectral
   - Source: CRISM ready-made mineral maps
2. Thermal inertia
   - Data type: thermal
   - Source: THEMIS global mosaic (context only)

Should (upgraded from stretch):
1. Rock detection
   - Data type: derived optical
   - Source: HiRISE, shadow-based method

Stretch:
1. Model forecast
   - Data type: atmospheric
   - Source: Mars Climate Database (LMD)

Support:
1. Space weather events
   - Data type: radiation
   - Source: NASA DONKI
2. Mars time and sun position
   - Data type: n/a
   - Source: Mars24 algorithm (NASA GISS)

Optional:
1. Relay orbiter passes
   - Data type: n/a
   - Source: SPICE / SpiceyPy

Full detail per dataset (product IDs, URLs, licences, processing, status) lives in `docs/data_sources.md`.


## "Real-time" means replay

No one is on Mars, so ARIADNE replays real historical data on a simulation clock with a speed multiplier

Replay has two parts:
- Real historical data, for example one real sol of REMS weather
- A scripted scenario, such as a solar particle event alert mid-walk that reroutes to shelter

The app and the pitch say this openly, for example "replaying REMS sol NNNN" (sol and event: TBD, Stage 0)


## Scope

In scope:
- One ~2 × 2 km patch, Gale Crater regional context image
- Planning Table, Suit HUD, Labyrinth view, The Thread, Knots, route planning with rerouting
- All Must and Should layers, plus rock detection (shadow-based, offline in Python)
- Replay of real historical data on a simulation clock, with a scripted scenario

Out of scope:
- Voice assistant
- Any real-time or live Mars data
- Other sites or a global map
- Mapping libraries (MapLibre, Leaflet, OpenLayers, Cesium, deck.gl) and game engines (Unity)

Stretch:
- Mars Climate Database model forecast for a future mission date
- Relay orbiter pass windows (SPICE)
- SAM-based rock detection


## Tech stack

- Pipeline (Person A): Python run with `uv`, GDAL/rasterio, numpy, richdem, scikit-image; QGIS for visual checks
- App (Persons B and C): React, Vite, TypeScript, Zustand, Tailwind
- 3D and 2D rendering: React Three Fiber (Three.js) only, with `@react-three/postprocessing` for the CRT look. The 2D map is the same scene with a top-down orthographic camera
- Hosting: static (Netlify)
- Georeferencing is done once in Python; the app works only in a local metre grid


## Team Stuff

Roles:
1. Lawrence Lian Anak Matius Ding (Team Leader)
   - Stage 1: data and algorithms pipeline.
2. {insert name}
   - Stage 2: app shell, Labyrinth view, Planning Table, runtime routing, Thread rendering.
3. {insert name} 
   - Stage 3: Suit HUD, alerts, Knot cards, simulation clock and scenario engine, CRT polish, demo and pitch.


## Workflow

Work runs in sequential stages (0, 1, 2, 3) with gated hand-offs. A stage starts only when the previous stage's gate is passed.

The gate means:
- Contract validator passes.
- Visual check done.
- Handoff checklist ticked.
- Human sign-off.

Branches: `main` is production, `dev` is integration, and each teammate works on their own `dev-{firstname}` branch (for example `dev-lawrence`). Lawrence merges finished branches into `dev`, checks everything works together, then merges `dev` into `main`.

Each teammate uses an agentic coding tool (Claude Code, opencode, or similar) whose main agent can delegate to smaller sub-agents. All the rules for agents and humans are in [AGENTS.md](AGENTS.md).


## Repository map

- `README.md`: this page.
- `AGENTS.md`: entry point for every coding agent, with the full directory map, doc ownership and protocols. See [AGENTS.md](AGENTS.md).
- `docs/`: design, contracts, data sources, decisions, handoff and per-person logs.
- `pipeline/`: Python data pipeline (Person A), placeholder for now.
- `app/`: React + React Three Fiber app (Persons B and C), placeholder for now.
- `data/`: `raw/` (git-ignored downloads) and `processed/` (pipeline outputs).


## Credits and data

ARIADNE uses data and tools from NASA/JPL (Mars Trek, Curiosity RAD and REMS via the Planetary Data System, DONKI), the USGS, and the University of Arizona HiRISE team (HiRISE images and DTMs).

Terms:
- All data is used according to the terms of its provider.
- Licences and attributions are tracked per dataset in `docs/data_sources.md`.
- ARIADNE is a hackathon project and is not an official NASA product.
