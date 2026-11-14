# ARIADNE data sources

Every dataset the project uses, with where it comes from and how it is processed. All URLs, product IDs, resolutions and licences are unverified until checked at Stage 0 or Stage 1; "verify" means a person or agent must open the link and confirm. Where a field is not yet known it says `TBD`.

Every displayed value must be traceable to dataset, product ID, resolution, timestamp and uncertainty (see `docs/contracts.md`, section 1.5). Model-derived values are labelled "est.".


## 1. Index of links

1. Mars Trek
   - URL: https://trek.nasa.gov/mars/
   - Status: verify
2. HiRISE DTMs
   - URL: https://www.uahirise.org/dtm/
   - Status: verify
3. PDS Analyst's Notebook
   - URL: https://an.rsl.wustl.edu/
   - Status: verify
4. Curiosity raw images
   - URL: https://science.nasa.gov/mission/msl-curiosity/raw-images/
   - Status: verify
5. PDS Geosciences Node
   - URL: https://pds-geosciences.wustl.edu/
   - Status: verify
6. PDS Atmospheres Node (REMS)
   - URL: https://pds-atmospheres.nmsu.edu/
   - Status: verify
7. NASA DONKI
   - URL: https://kauai.ccmc.gsfc.nasa.gov/DONKI/
   - Status: verify
8. Mars Climate Database
   - URL: https://www-mars.lmd.jussieu.fr/
   - Status: verify
9. Mars24
   - URL: https://www.giss.nasa.gov/tools/mars24/
   - Status: verify
10. USGS Astrogeology
    - URL: https://astrogeology.usgs.gov/
    - Status: verify
11. NAIF SPICE
    - URL: https://naif.jpl.nasa.gov/naif/
    - Status: verify


## 2. Science background for the site

Reading, not data. Used for Knot rationale and the pitch.

1. Boxwork (Curiosity "martian spiderwebs")
   - URL: https://www.jpl.nasa.gov/news/nasas-curiosity-rover-sees-martian-spiderwebs-up-close/
   - Status: verify
2. Sulfur stones in Gediz Vallis
   - URL: https://www.jpl.nasa.gov/news/nasas-curiosity-mars-rover-takes-a-last-look-at-mysterious-sulfur/
   - Status: verify


## 3. Datasets

Tier is the data-layer priority from README.md: Must, Should, Stretch, Support, Optional.


### 3.1 HiRISE orthoimage (Must)

- Data type: Optical
- Used for: Base texture of the Labyrinth view and Planning Table; input to rock detection
- Source: Mars Trek tiles https://trek.nasa.gov/mars/ or HiRISE ortho product via https://www.uahirise.org/dtm/ (verify)
- Product ID: candidate `PSP_009149_1750_RED_A_01_ORTHO` (0.25 m, 388 MB JP2), the orthoimage matching the candidate DTM in 3.2. Backup: `ESP_019698_1750_RED_A_01_ORTHO` (0.25 m, 462 MB)
- Download URL: https://hirise-pds.lpl.arizona.edu/PDS/DTM/PSP/ORB_009100_009199/PSP_009149_1750_PSP_009294_1750/PSP_009149_1750_RED_A_01_ORTHO.JP2
- Resolution: 25 to 50 cm
- Licence and credit: TBD (expected: NASA/JPL/University of Arizona; verify)
- Processing: Download, crop to the patch, reproject to the local grid, resample to at most 4096 × 4096, export `texture_hirise.jpg`; record sun azimuth and incidence in `meta.json`
- Status: Downloaded 2026-11-14 to `data/raw/hirise/`. Real pixel size 0.2529 m; no no-data in the patch. Team confirms at Stage 0


### 3.2 HiRISE DTM: slope and roughness (Must)

DTM = digital terrain model, a height map.

- Data type: Topographic
- Used for: Heightmap, slope, roughness, traversal penalty, return field, sky-view factor, 3D terrain
- Source: https://www.uahirise.org/dtm/ (verify)
- Product ID: candidate `DTEEC_009149_1750_009294_1750_U01` ("Gale Crater filled channel and fan deposit", 1.01 m, 391 MB). Backup: `DTEEC_019698_1750_019988_1750_U01` ("Lower northwest portion of mound", 1.01 m, 543 MB)
- Download URL: https://hirise-pds.lpl.arizona.edu/PDS/DTM/PSP/ORB_009100_009199/PSP_009149_1750_PSP_009294_1750/DTEEC_009149_1750_009294_1750_U01.IMG
- Coverage check: both DTM footprints contain all 9 Curiosity stops from the sulfur field (sol 4210) to the late boxwork (sol 4839), tested against the footprint corners in the HiRISE DTM index (https://hirise-pds.lpl.arizona.edu/PDS/INDEX/DTMCUMINDEX.TAB). Gaps inside the footprint are only visible after download
- Resolution: 1 m (1 to 2 m ridges are near the limit: they appear smoothed)
- Licence and credit: TBD (verify)
- Processing: Download, crop, reproject to the local grid, fill small gaps, compute slope and roughness, export `heightmap.bin`, `slope_degrees.bin`, `roughness_m.bin`
- Status: Downloaded 2026-11-14 to `data/raw/hirise/`. Real pixel size 1.0117 m; no gaps in the patch; slopes match Curiosity's measured tilt; absolute elevation is 1 to 18 m above Curiosity's waypoint elevations (smooth drift). Team confirms at Stage 0


### 3.3 Radiation: Curiosity RAD (Must)

- Data type: Radiation
- Used for: Dose-rate time series in the replay and dose budget; terrain shielding is derived separately (sky-view factor). No spatial radiation heatmap (D-015)
- Source: PDS Geosciences Node https://pds-geosciences.wustl.edu/ (verify)
- Product ID: TBD
- Resolution: Point time series
- Licence and credit: TBD (verify)
- Processing: Select the replay sol (TBD, Stage 0), extract dose rate, convert to µSv/h, align with the REMS time base, write into `environment_timeline.json`. Cross-check against the published ~0.6 to 0.7 mSv/day surface dose-equivalent
- Status: To verify at Stage 0


### 3.4 Weather: Curiosity REMS (Must)

- Data type: Atmospheric
- Used for: Air and ground temperature, pressure, UV, dust opacity; replayed as "live"
- Source: PDS Atmospheres Node https://pds-atmospheres.nmsu.edu/ (verify)
- Product ID: TBD
- Resolution: Point time series
- Licence and credit: TBD (verify)
- Processing: Select the replay sol (TBD, Stage 0), extract fields, convert units, compute local mean solar time (Mars24), write into `environment_timeline.json`
- Status: To verify at Stage 0


### 3.5 Ground photos: Curiosity raw images (Must)

- Data type: Optical (surface)
- Used for: Photos attached to Knots
- Source: https://science.nasa.gov/mission/msl-curiosity/raw-images/ (verify; has a JSON API) and PDS Analyst's Notebook https://an.rsl.wustl.edu/ for traverse and rover positions
- Product ID: TBD per photo (image ID and sol)
- Resolution: Points (individual images)
- Licence and credit: TBD (expected: NASA/JPL-Caltech; verify)
- Processing: Choose candidate images per Knot, record URL, sol, camera, caption, credit in `knots.json`. Hotlink or copy: TBD (Stage 0, whole team)
- Status: To verify at Stage 0


### 3.6 Mineralogy: CRISM (Should)

- Data type: Spectral
- Used for: Mineral class layer and Knot science rationale
- Source: Ready-made mineral maps via Mars Trek https://trek.nasa.gov/mars/ or published products (verify). Raw CRISM is never processed
- Product ID: TBD
- Resolution: ~18 m
- Licence and credit: TBD (verify)
- Processing: Download map, crop, reproject, resample to the grid, map classes to `class_id`, export `mineralogy_class.bin`, list classes in `meta.json`
- Status: To verify at Stage 0


### 3.7 Thermal inertia: THEMIS (Should)

- Data type: Thermal
- Used for: Context layer (surface material character)
- Source: THEMIS global thermal inertia mosaic via Mars Trek https://trek.nasa.gov/mars/ or USGS Astrogeology https://astrogeology.usgs.gov/ (verify)
- Product ID: TBD
- Resolution: ~100 m: only 10 to 30 pixels across the patch, context not walk-level
- Licence and credit: TBD (verify)
- Processing: Crop, reproject, resample to the grid, export `thermal_inertia.bin`, state the native resolution in `meta.json`
- Status: To verify at Stage 0


### 3.8 Rock detection (Should, upgraded from stretch)

- Data type: Derived optical
- Used for: `rocks.json`, rock-based impassable cells in the traversal penalty
- Source: Method: Golombek et al., rock hazard for the MSL and InSight landing sites (reference to look up, TBD). Input: the HiRISE orthoimage above
- Product ID: Same as the HiRISE orthoimage
- Resolution: Detects rocks ≳ 1.5 m on 25 cm images. Smaller rocks: statistical rock-abundance estimate, labelled "est."
- Licence and credit: Method credit TBD; output is derived from HiRISE
- Processing: Shadow-based detection offline in Python (D-007), estimate diameter and height, validate against Curiosity Navcam images, export `rocks.json`. SAM-based detection is a stretch only
- Status: To verify at Stage 1


### 3.9 Model forecast: Mars Climate Database (Stretch)

- Data type: Atmospheric
- Used for: Predicted conditions for a future mission date (stretch)
- Source: https://www-mars.lmd.jussieu.fr/ (verify)
- Product ID: TBD (model version)
- Resolution: Model grid, TBD
- Licence and credit: TBD (verify)
- Processing: TBD. Output is always labelled "est."
- Status: TBD (stretch, not started)


### 3.10 Space weather: NASA DONKI (Support)

- Data type: Radiation
- Used for: Real flare, CME and SEP history to ground the scenario alert
- Source: https://kauai.ccmc.gsfc.nasa.gov/DONKI/ (verify)
- Product ID: TBD (event ID, TBD at Stage 0)
- Resolution: Events
- Licence and credit: TBD (verify)
- Processing: Choose one real event for the scenario (TBD, Stage 0); cite it in `scenario.json`
- Status: To verify at Stage 0


### 3.11 Mars time and sun position: Mars24 (Support)

- Data type: Algorithm
- Used for: Local solar time, sun elevation, time to sunset, hillshade and shadows
- Source: https://www.giss.nasa.gov/tools/mars24/ (verify)
- Product ID: Not applicable
- Resolution: Not applicable
- Licence and credit: NASA GISS (verify)
- Processing: Implement the published algorithm; cross-check against the Mars24 tool for sample dates
- Status: To verify at Stage 0


### 3.12 Relay orbiter passes: SPICE (Optional)

- Data type: Ephemeris
- Used for: Communication windows (MRO, MAVEN)
- Source: NAIF SPICE https://naif.jpl.nasa.gov/naif/ (verify), SpiceyPy
- Product ID: TBD (kernel set)
- Resolution: Not applicable
- Licence and credit: TBD (verify)
- Processing: TBD. Optional; only if time allows
- Status: TBD (optional, not started)


### 3.13 Gale regional context image

- Data type: Optical (regional context)
- Used for: Static regional image of Gale Crater (~154 km) on the Planning Table, shown on a plane in the same R3F scene
- Source: e.g. a CTX mosaic via Mars Trek https://trek.nasa.gov/mars/ (verify)
- Product ID: TBD
- Resolution: CTX is about 6 m per pixel (verify)
- Licence and credit: TBD (verify)
- Processing: Download or export a regional crop, resize, mark the patch location; delivered as a static image (file name and location TBD, Stage 0)
- Status: To verify at Stage 0


### 3.14 Curiosity traverse waypoints (Support)

- Data type: Positions (rover localisation)
- Used for: Patch bounds, staging point candidates, Knot positions, matching ground photos to places by sol
- Source: MSL waypoints GeoJSON used by NASA's Curiosity location map: https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json (verify licence)
- Product ID: `MSL_waypoints.json` (downloaded 2026-11-13, 1388 stops, last sol 5070)
- Resolution: Points. Fields include sol, lat, lon (planetocentric, east-positive), `elev_geoid`, rover `tilt`, odometry
- Licence and credit: NASA/JPL-Caltech (verify)
- Processing: Pick stops by sol; rover `tilt` at a stop is used as a first check of how flat the ground is
- Status: In use for Stage 0 prep


## 4. Resolution reality check

Native resolution and approximate pixels across a 2 km patch:

1. HiRISE orthoimage
   - Native resolution: 0.25 to 0.5 m
   - Pixels across: 4000 to 8000
2. HiRISE DTM
   - Native resolution: 1 m
   - Pixels across: 2000
3. CRISM mineral maps
   - Native resolution: ~18 m
   - Pixels across: ~110
4. THEMIS thermal inertia
   - Native resolution: ~100 m
   - Pixels across: ~20
5. REMS, RAD
   - Native resolution: Point time series
   - Pixels across: Not spatial
6. Curiosity photos
   - Native resolution: Points
   - Pixels across: Not spatial

What this means for the 2 × 2 km patch:

- Only the orthoimage and the DTM resolve walk-level detail. Routing, the Thread and the 3D terrain depend on the DTM.
- 1 to 2 m boxwork ridges are near the limit of a 1 m DTM, so ridges appear but are smoothed. Rock detection on the 25 cm images adds the finer hazards.
- CRISM at ~18 m gives about 110 pixels across the patch: good for "which areas are clay or carbonate", not for placing a foot. Present it as context.
- THEMIS at ~100 m gives 10 to 30 pixels across the patch. It is context only and must never drive a walk-level decision. The UI says so.
- Anything resampled to the 1 m grid does not gain real resolution. The layer registry keeps `native_resolution_m` so the UI can show it.


## 5. How to add a dataset

- [ ] Find the dataset and its product ID. Record the source URL, native resolution and licence or credit in this file.
- [ ] Add a section for it in section 3 of this file with all fields above.
- [ ] Download to `data/raw/` (git-ignored). Never commit raw data.
- [ ] Decide the processing steps and write them here before coding.
- [ ] If it produces a new file or layer, propose the contract change in `docs/decisions.md` and get human approval. Then update `docs/contracts.md` (bump `contract_version`).
- [ ] Add it to the `sources` list and the `layers` registry in `meta.json`, with provenance.
- [ ] Check alignment visually in QGIS against the texture and heightmap.
- [ ] Make sure every UI value from it can show dataset, product ID, resolution, timestamp and uncertainty, and is labelled "est." if model-derived.
- [ ] Update the validator so it checks the new file.
- [ ] Set the status in this file and add a log entry in your `docs/log/` file.
