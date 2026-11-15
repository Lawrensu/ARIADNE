# Getting started

How to run ARIADNE, try the demo, test it and start developing on it. Project overview: [README.md](../README.md).


## What ARIADNE is

ARIADNE (Astronaut Route Intelligence And Data for Navigation & Exploration, "Ari") is a map and suit display for one astronaut on one ~2 × 2 km Marswalk patch in Gale Crater. It layers real NASA data and gives safe routes, a science plan, and a live boundary (the Thread) showing how far the astronaut can go and still get home. Read the [README](../README.md) for the full story.

Windows, macOS and Linux all work. Commands are for a bash-like shell (on Windows use Git Bash or PowerShell).


## What you need

- Git, to clone the repository.
- Node.js 20.19 or newer (22.12 or newer also works; 24 LTS recommended) and npm, which comes with Node. Download from https://nodejs.org/.
- A modern browser with WebGL (current Chrome, Edge, Firefox or Safari).
- Optional, only to rebuild the data: `uv` (https://docs.astral.sh/uv/getting-started/installation/) and Python 3.11 or newer (`uv` fetches Python if it is missing).

The processed data the app reads is committed in `data/processed/`. To run the app you only need Node and npm. The Python pipeline is only needed to rebuild that data.


## Quick start

Clone the repository and go to the app folder:

```bash
git clone https://github.com/Lawrensu/ARIADNE.git
```

```bash
cd ARIADNE/app
```

Install the exact pinned dependencies (creates `app/node_modules`):

```bash
npm ci
```

Start the app with hot reload. This first copies the files the app reads from `data/processed/` into `app/public/data/` (git-ignored):

```bash
npm run dev
```

Then open one of the three addresses:

- http://localhost:5173/ : the chooser, with a card for each display.
- http://localhost:5173/tablet : the planning and navigation app (Planning Table and 3D Labyrinth view).
- http://localhost:5173/visor : the first-person helmet visor display.

An unknown address falls back to the chooser. Run every later app command from `app/`.


## Try the demo

The demo replays a Marswalk with the May 2024 solar storm that Curiosity measured. Both displays show the same walk.

1. Run `npm run dev` (or `npm run build` then `npm run preview`, then use port 4173).
2. Open `/tablet` and `/visor` side by side, in two windows of the same browser. The two windows stay in sync, and the one you last acted in leads. Nothing leaves your browser.
3. Start the walk: open the gear menu on the tablet and choose "Run demo scenario", or use the DEMO button on the visor and then RUN DEMO.
4. Set the clock speed to 300x so the walk takes a few minutes instead of hours.

What to expect (all values are estimates, "est."):

- The plan covers all five Knots (science stops) and says GO, with 5 h 03 min planned and 27 min of science budget left.
- A space weather watch appears at about T+1:22, with a countdown to the storm on both displays.
- The solar storm alert appears at about T+1:52, on the walk to the third Knot (Boxwork hollow). The pressurised rover drives out along the route back while the astronaut walks towards it.
- They meet and the astronaut is "Aboard the rover: sheltered" at about T+2:02.

Keep both windows visible. A hidden window's clock pauses, so the walk stalls until you bring it back.


## Run the tests and checks

From `app/`:

- `npm test` runs the unit tests (walking-time vectors, routing, the Knot-to-rover cross-check on the real data, the science plan, layers, the Thread, the clock). It proves the logic and the data agree.

```bash
npm test
```

- `npm run typecheck` runs the TypeScript compiler without building. It proves the code type-checks.

```bash
npm run typecheck
```

- `npm run build` type-checks and builds the static site into `app/dist/`. It proves the production build works.

```bash
npm run build
```

- `npm run payload` (after a build) prints the size of `app/dist/`, raw and gzip, against the ~30 MB budget.

```bash
npm run payload
```

- `npm run preview` serves the production build at http://localhost:4173 so you can check it as it will be deployed.

```bash
npm run preview
```

- `npm run browser-check` drives headless Chrome against the running dev server: it loads the app at phone, tablet and desktop widths, checks there is no horizontal scroll, pans and zooms the map, runs the demo scenario twice and collects console errors. It needs Chrome installed and the dev server running (`npm run dev` in another terminal). Set `CHROME_PATH` to your Chrome executable and `APP_URL` to the page to test (default http://localhost:5173/tablet). Screenshots are saved to `docs/images/stage3/`.

```bash
npm run browser-check
```

For the pipeline's own checks (the validator and pytest) see "Rebuild the data with the pipeline".


## Project layout

- `app/`: the React + Vite + TypeScript + React Three Fiber app (the three pages, routing, the Thread, the demo).
- `pipeline/`: the Python (uv) pipeline that turns NASA Mars data into the local-grid files the app reads.
- `data/processed/`: pipeline outputs, committed to git; the app reads these. `data/raw/` holds downloaded source data (git-ignored). `data/reference/` holds reference data such as the real May 2024 solar storm dose curve.
- `docs/`: architecture, data formats, datasets, decisions and conventions.

The app uses one local grid only. All georeferencing is done once, in Python.


## Rebuild the data with the pipeline

Optional. Only needed if you change the pipeline or want to regenerate `data/processed/` from the NASA sources.

Install `uv`, then from the repository root go to the pipeline folder:

```bash
cd pipeline
```

Install Python dependencies, creating `pipeline/.venv`:

```bash
uv sync
```

Run every pipeline command from `pipeline/`.

Raw data is git-ignored and not in the repository. Download it by hand (about 1.1 GB in total; there is no fetch script) and put each file at the path below, relative to the repository root. Full provenance is in [data_sources.md](data_sources.md).

- HiRISE terrain model, `data/raw/hirise/DTEEC_009149_1750_009294_1750_U01.IMG` (~390 MB), plus its label `DTEEC_009149_1750_009294_1750_U01.LBL` in the same folder: https://hirise-pds.lpl.arizona.edu/PDS/DTM/PSP/ORB_009100_009199/PSP_009149_1750_PSP_009294_1750/DTEEC_009149_1750_009294_1750_U01.IMG
- HiRISE orthoimage, `data/raw/hirise/PSP_009149_1750_RED_A_01_ORTHO.JP2` (~388 MB): https://hirise-pds.lpl.arizona.edu/PDS/DTM/PSP/ORB_009100_009199/PSP_009149_1750_PSP_009294_1750/PSP_009149_1750_RED_A_01_ORTHO.JP2
- THEMIS thermal inertia, Gale crop of the 100 m mosaic, `data/raw/themis/THEMIS_TI_Mosaic_Quant_30S120E_100mpp_gale_crop.tif` (small). Source mosaic: https://astrogeology.usgs.gov/search/map/themis_thermal_inertia_mosaic_quantitative_30s120e_100mpp (the crop is cut from it around Gale Crater).
- CRISM MTRDR summary parameters, each as `.img`, `.hdr`, `.lbl` and `.xml` (~130 MB per `.img`), in `data/raw/crism/`: `frt0000b6f1_07_sr165j_mtr3.*` (primary) and `frt000058a3_07_sr165j_mtr3.*` (cross-check). Source: https://pds-geosciences.wustl.edu/mro/mro-m-crism-5-rdr-mptargeted-v1/mrocr_4001/mtrdr/
- Curiosity RAD and REMS files, in `data/raw/msl_environment/` (`rad/`, `rad_spe_sol4190/`, `rems/`). Sources: RAD from the PDS Planetary Plasma Interactions node https://pds-ppi.igpp.ucla.edu/, REMS from the PDS Atmospheres Node https://pds-atmospheres.nmsu.edu/
- Gale regional image: nothing to download by hand. The first run reads it over HTTP from the USGS Viking MDIM 2.1 mosaic and caches the crop in `data/raw/regional/gale_mdim21_crop.tif`. The first run needs internet; later runs work offline.

HiRISE files are large and the server can drop the connection. Resume an interrupted download with `curl -C -`, for example for the orthoimage:

```bash
curl -C - -L -o data/raw/hirise/PSP_009149_1750_RED_A_01_ORTHO.JP2 "https://hirise-pds.lpl.arizona.edu/PDS/DTM/PSP/ORB_009100_009199/PSP_009149_1750_PSP_009294_1750/PSP_009149_1750_RED_A_01_ORTHO.JP2"
```

Run the pipeline. It first checks the walking-time test vectors, then runs each step and prints a timestamped line per step. It takes a few minutes. It writes to `data/processed/` (formats in [contracts.md](contracts.md), section 2):

```bash
uv run python run.py
```

Check the output against the contract. The validator prints one `PASS` or `FAIL` line per check and a final `SUMMARY:` line. The exit code is 0 only if every check passes. Use `--processed-dir PATH` to check another folder. On an empty or partial `data/processed/` it fails, which is expected.

```bash
uv run python validate/run.py
```

Run the pipeline tests. They need no raw data and no network: they use small synthetic inputs (walking-time vectors, the validator, rock detection, sky view and shelters, CRISM mineralogy classes). Add `-q` for short output.

```bash
uv run pytest
```

After rebuilding, run `npm test` in `app/` again, because the app tests read the real processed data.


## Build and deploy

The app is a static site. Build it from `app/`:

```bash
npm run build
```

Upload or serve the contents of `app/dist/`. Any static host works, as long as every path falls back to `index.html`, so that `/tablet` and `/visor` load on a direct visit or a refresh. `app/vercel.json` already does this for Vercel (it rewrites every path to `index.html`), and `npm run preview` does the same locally.

`roughness_m.bin` is not copied into the app: it is not displayed, and leaving it out keeps the payload inside the budget. To ship another processed file, add it to `app/scripts/copyProcessedData.mjs`.


## Troubleshooting

- `copy-data: ... meta.json not found` when starting the app: `data/processed/` is missing or incomplete. Make sure you cloned the whole repository, or rebuild the data with the pipeline.
- The app shows "Could not load the Marswalk data": run `npm run copy-data` from `app/` and reload the page.
- `npm ci` fails with an engine or syntax error: your Node is too old. Install Node 20.19 or newer.
- The demo clock does not move, or one window shows a blank or frozen clock: the window is hidden or in a background tab, and its clock pauses. Bring it to the front. Keep both windows visible side by side.
- The two windows do not stay in sync: open both in the same browser and profile (a private window does not share with a normal one).
- Port in use: `npm run dev` picks the next free port and prints the address it chose, so open that address. To free the default port, stop the other process. Preview uses 4173 the same way.
- `npm run browser-check` cannot find Chrome: install Chrome, or set `CHROME_PATH` to its executable. Start the dev server first, and set `APP_URL` if it runs on another port.
- `ModuleNotFoundError: No module named 'ariadne_pipeline'`: you are not in `pipeline/`. Run `cd pipeline` first and use `uv run ...`.
- `uv: command not found`: install `uv` and open a new terminal so it is on your PATH.
- `run.py` stops early with a missing file error: a raw input is not at the exact path listed above. A HiRISE file that is too small means the download dropped; resume it with `curl -C -`.
- The regional (Gale) step fails or hangs on the first run: it needs internet to read the USGS mosaic. Check your connection and run again. Once `data/raw/regional/gale_mdim21_crop.tif` exists, no network is needed.
- The validator prints many `FAIL ... missing file` lines: `data/processed/` is empty or partial. Run the pipeline, or restore the committed files with git.


## Where to go next

- [docs/system_design.md](system_design.md): architecture, algorithms, UX principles.
- [docs/contracts.md](contracts.md): exact file formats between the pipeline and the app.
- [docs/data_sources.md](data_sources.md): every dataset, with product ID, resolution and licence.
- [docs/development_conventions.md](development_conventions.md): code, doc and git conventions.
- [AGENTS.md](../AGENTS.md): the instruction file for coding agents working in this repository.
- [LICENSE](../LICENSE): the MIT License for the ARIADNE code. Data credits are in the [README](../README.md#license-and-data-credits).
