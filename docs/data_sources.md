# ARIADNE data sources

Every dataset the project uses, with where it comes from and how it is processed. Section 3 records what the Stage 1 pipeline actually uses (checked 2026-11-14). The index of links in section 1 and the background links in section 2 are still unverified: "verify" means a person or agent must open the link and confirm.

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

Tier is the data-layer priority from README.md: Must, Should, Stretch, Support, Optional. Status "In use, Stage 1, 2026-11-14" means the Stage 1 pipeline reads the dataset today.


### 3.1 HiRISE orthoimage (Must)

- Data type: Optical
- Used for: Base texture of the Labyrinth view and Planning Table; input to rock detection
- Source: HiRISE ortho product, PDS archive of the University of Arizona
- Product ID: `PSP_009149_1750_RED_A_01_ORTHO` (388 MB JP2), the orthoimage matching the DTM in 3.2. Backup not needed: `ESP_019698_1750_RED_A_01_ORTHO`
- Download URL: https://hirise-pds.lpl.arizona.edu/PDS/DTM/PSP/ORB_009100_009199/PSP_009149_1750_PSP_009294_1750/PSP_009149_1750_RED_A_01_ORTHO.JP2
- Resolution: 0.2529 m per pixel (real pixel size); no no-data in the patch
- Licence and credit: NASA/JPL/University of Arizona (public NASA data)
- Processing: Crop to the patch (D-017), reproject to the local grid, resample to at most 4096 × 4096 (about 0.5 m per pixel, D-021), export `texture_hirise.jpg`; sun azimuth and incidence recorded in `meta.json`
- Status: In use, Stage 1, 2026-11-14


### 3.2 HiRISE DTM: slope and roughness (Must)

DTM = digital terrain model, a height map.

- Data type: Topographic
- Used for: Heightmap, slope, roughness, traversal penalty, return field, sky-view factor, 3D terrain
- Source: HiRISE DTMs, https://www.uahirise.org/dtm/
- Product ID: `DTEEC_009149_1750_009294_1750_U01` ("Gale Crater filled channel and fan deposit", 391 MB). Backup not needed: `DTEEC_019698_1750_019988_1750_U01`
- Download URL: https://hirise-pds.lpl.arizona.edu/PDS/DTM/PSP/ORB_009100_009199/PSP_009149_1750_PSP_009294_1750/DTEEC_009149_1750_009294_1750_U01.IMG
- Coverage check: the footprint contains all 9 Curiosity stops from the sulfur field (sol 4210) to the late boxwork (sol 4839), tested against the HiRISE DTM index (https://hirise-pds.lpl.arizona.edu/PDS/INDEX/DTMCUMINDEX.TAB)
- Resolution: 1.0117 m per pixel (real pixel size); 1 to 2 m ridges are near the limit and appear smoothed
- Licence and credit: NASA/JPL/University of Arizona (public NASA data)
- Processing: Crop, reproject to the local grid, compute slope and roughness at 1 m, export at 2 m (D-021): `heightmap.bin`, `slope_degrees.bin`, `roughness_m.bin`. No gaps in the patch, so no gap filling was needed
- Status: In use, Stage 1, 2026-11-14. Slope matches Curiosity's measured tilt (median 8.8° vs 8.4°). Absolute elevation drifts 1 to 18 m against Curiosity's waypoint elevations (not a shift; slopes are unaffected)


### 3.3 Radiation: Curiosity RAD (Must)

- Data type: Radiation
- Used for: Dose-rate time series in the replay and dose budget; the solar particle event profile for the scenario (with 3.10). Terrain shielding is derived separately (sky-view factor). No spatial radiation heatmap (D-015)
- Source: PDS Planetary Plasma Interactions (PPI) Node at UCLA, dataset `MSL-M-RAD-3-RDR-V1.0` (volume `MSLRAD_1001`). RAD is not served from the Geosciences Node
- Product ID, replay sol: `RAD_RDR_2025_360_10_42_4760_V00` (sol 4760, 87 observations of 481 to 961 s)
- URL: https://pds-ppi.igpp.ucla.edu/data/MSL-M-RAD-3-RDR-V1.0/DATA/SOL_04710_04843/RAD_RDR_2025_360_10_42_4760_V00.TXT
- Product ID, solar particle event: `RAD_RDR_2024_140_18_30_4190_V00` (sol 4190, 20 May 2024)
- URL: https://pds-ppi.igpp.ucla.edu/data/MSL-M-RAD-3-RDR-V1.0/DATA/SOL_04134_04257/RAD_RDR_2024_140_18_30_4190_V00.TXT
- Resolution: Point time series, one value per observation
- Licence and credit: Public NASA PDS data, no use restrictions found. NASA/JPL-Caltech, MSL RAD (SwRI, DLR), via the NASA PDS PPI Node
- Processing: Take the E detector (plastic scintillator, tissue-like) field `DOSIMETRY_TOTAL_DOSE_E`, an absorbed dose rate in µGy/h. Dose equivalent (est.) = absorbed dose × Q, with Q = 3.05 ± 0.26, the mean surface quality factor measured by RAD (Hassler et al. 2014, Science 343, 1244797). Align by local mean solar time (`START_OBS_MARS`) with REMS and write into `environment_timeline.json`. For the solar particle event, build the profile from the real sol 4190 observations (see 3.10)
- Status: In use, Stage 1, 2026-11-14. Sol 4760 gives about 6.2 µGy/h absorbed, about 19 µSv/h dose equivalent (est.), or 0.15 mGy/day, below the 2012 to 2013 mean of 0.21 mGy/day (0.64 mSv/day); not investigated. For solar particle protons the true Q is probably lower than 3.05, so event dose equivalents are an upper bound


### 3.4 Weather: Curiosity REMS (Must)

- Data type: Atmospheric
- Used for: Air and ground temperature, pressure, UV; replayed as "live"
- Source: PDS Atmospheres Node, dataset `MSL-M-REMS-5-MODRDR-V1.0`, release 0042, producer Centro de Astrobiologia
- Product ID: `RME_820012645RMD47600000000_______P1` (sol 4760, 26 to 27 December 2025 UTC, 36055 rows at 1 Hz bursts)
- URL: https://atmos.nmsu.edu/PDS/data/mslrem_1001/DATA/SOL_04710_04843/SOL04760/RME_820012645RMD47600000000_______P1.TAB
- Why sol 4760: inside the boxwork period (sols 4527 to 4839), released on PDS, and the best coverage of the candidates checked (sol 4770 has more gaps). Sols 4750 to 4762 are the last before solar conjunction, and REMS and RAD kept running
- Resolution: Point time series, hourly means of the 1 Hz bursts (24 local-time hours)
- Licence and credit: Public NASA PDS data, no use restrictions found. NASA/JPL-Caltech, MSL REMS (CAB, Spain), via the NASA PDS Atmospheres Node
- Processing: Hourly means by local mean solar time (LMST). Air temperature from `AMBIENT_TEMP` (K minus 273.15), ground temperature from `BRIGHTNESS_TEMP` (K minus 273.15), pressure from `PRESSURE` (Pa), UV from `UV_ABC` (W/m²). The value -999 means no data. Air temperature is itself an estimate from the boom sensors. Hours with gaps are interpolated and flagged `is_estimate` (air, ground and pressure present in 23 of 24 hours, UV in 19 of 24). UV is noisy (rover or arm shadow), so it is smoothed. `uv_index_level` and dust opacity are not in the product (see "Known data caveats")
- Status: In use, Stage 1, 2026-11-14


### 3.5 Ground photos: Curiosity raw images (Must)

- Data type: Optical (surface)
- Used for: Photos attached to Knots
- Source: NASA Curiosity raw image API https://mars.nasa.gov/api/v1/raw_image_items/ , images served under https://mars.nasa.gov/msl-raw-images/ ; stop positions and sols from the waypoints in 3.14
- Product ID: One per photo (image ID and sol), recorded in `knots.json`. Navcam Left B and Right B images, for example `NLB_771231076EDR_F1072496NCAM00260M_` (sol 4210)
- Resolution: Points (individual images)
- Licence and credit: NASA/JPL-Caltech
- Processing: Pick images per Knot near the stop's sol, record URL, sol, camera, caption and credit in `knots.json`. The app copies the photos in with their credits so the demo works offline (D-024). Captions are written by us from the image content
- Status: In use, Stage 1, 2026-11-14


### 3.6 Mineralogy: CRISM (Should)

- Data type: Spectral
- Used for: Mineral class layer and Knot science rationale. Context only, low confidence, never for routing
- Source: MRO CRISM targeted-observation MTRDR summary parameters, PDS Geosciences Node https://pds-geosciences.wustl.edu/mro/mro-m-crism-5-rdr-mptargeted-v1/mrocr_4001/mtrdr/ (not Mars Trek). Raw CRISM spectra are never processed
- Product ID: `FRT0000B6F1_07_SR165J_MTR3` (observed 2008-07-09) and `FRT000058A3_07_SR165J_MTR3` (observed 2007-04-22), the SR (surface reflectance) products. A third product covering the patch at 36 m, `HRL0000BABA_07_SR182J_MTR3`, was not downloaded
- Resolution: 18 m per pixel (about 110 across the patch)
- Licence and credit: NASA PDS open data, no restrictions. NASA/JPL/JHUAPL MRO CRISM team. Summary parameters: Viviano-Beck et al. (2014), JGR Planets 119, doi:10.1002/2014JE004627, DOI 10.17189/1519470
- Processing: Read six summary parameters (`D2300`, `BD2290` for clay; `SINDEX2`, `BD2100_2` for sulfate; `BD860_2` for hematite; `BD2500_2` for carbonate). A pixel fires when its scene-relative robust z-score (median and MAD over the whole observation) is at least 3 and the raw value is positive. These thresholds are ours (est.) and not validated. Classify each observation, resample by nearest neighbour onto the 2 m grid, and keep a class only where both observations agree. Carbonate is dropped (one scene only, artefact-prone bands). Export `mineralogy_class.bin`
- Status: In use, Stage 1, 2026-11-14. The signal is weak and the two scenes agree on very few cells (see "Known data caveats")


### 3.7 Thermal inertia: THEMIS (Should)

- Data type: Thermal
- Used for: Context layer (surface material character)
- Source: THEMIS global thermal inertia mosaic, quantitative 32-bit, tile 30S120E, USGS Astropedia: https://astrogeology.usgs.gov/search/map/themis_thermal_inertia_mosaic_quantitative_30s120e_100mpp . The full file is a 2.53 GB ISIS3 `.cub` on S3 (https://asc-astropedia.s3.us-west-2.amazonaws.com/Mars/Odyssey/THEMIS-Global-Thermal-Inertia-Mosaic/Quantitative-32-Bit/THEMIS_TI_Mosaic_Quant_30S120E_100mpp.cub) and is not downloaded whole
- Product ID: `THEMIS_TI_Mosaic_Quant_30S120E_100mpp`
- Resolution: 100 m per pixel: 342 valid pixels inside the patch (about 10 to 30 across), context not walk-level. Absolute accuracy about 20 percent (Fergason et al. 2006). In the patch: min 318, max 450, mean 392 J m-2 K-1 s-1/2
- Licence and credit: Public domain (USGS Astropedia), please cite: Fergason, Christensen and Kieffer (2006), JGR 111, E12004, doi:10.1029/2006JE002735; Edwards et al. (2011), JGR 116, E10009; Mars Odyssey THEMIS, ASU/USGS
- Processing: Read the patch window by HTTP range request and save a 139 × 137 pixel GeoTIFF crop (patch plus 0.1 degree margin, 67 KB) at `data/raw/themis/THEMIS_TI_Mosaic_Quant_30S120E_100mpp_gale_crop.tif`; reproject and bilinearly smooth onto the 2 m grid; export `thermal_inertia.bin`; native resolution stated in `meta.json`
- Status: In use, Stage 1, 2026-11-14


### 3.8 Rock detection (Should, upgraded from stretch)

- Data type: Derived optical
- Used for: `rocks.json`, rock-based impassable cells in the traversal penalty
- Source: Method: shadow geometry, after Golombek et al. rock hazard work for the MSL and InSight landing sites (exact reference not yet looked up). Input: the HiRISE orthoimage in 3.1
- Product ID: Same as the HiRISE orthoimage, `PSP_009149_1750_RED_A_01_ORTHO`
- Resolution: 0.25 m input pixels. Detected rocks are at least 1.0 m across; rocks of 1.5 m or more block cells (`ROCK_IMPASSABLE_DIAMETER_M`). Smaller rocks are not detected
- Licence and credit: Output is derived from HiRISE (NASA/JPL/University of Arizona); method credit as above
- Processing: Offline in Python (D-007). Find shadows as pixels darker than the local median, take the shadow width across the sun direction as diameter and the shadow length with the sun incidence as height, and reject shapes that are not rock-like (elongation above 6, low fill ratio). Each rock gets a confidence from 0 to 1 (shadow contrast, compactness, aspect ratio). `run.py` keeps only rocks with confidence of at least 0.6 (`MINIMUM_ROCK_CONFIDENCE`). Every rock is labelled est. with the note "est. from shadow geometry, about +/-0.5 m in size, assumes flat ground". SAM-based detection is a stretch only
- Status: In use, Stage 1, 2026-11-14


### 3.9 Model forecast: Mars Climate Database (Stretch)

- Data type: Atmospheric
- Used for: Predicted conditions for a future mission date (stretch)
- Source: https://www-mars.lmd.jussieu.fr/
- Product ID: Not applicable (model not run)
- Resolution: Not applicable
- Licence and credit: Not applicable
- Processing: None. Output would always be labelled "est."
- Status: Not used. Stretch only, never started; the replay uses real REMS data instead


### 3.10 Space weather: NASA DONKI (Support)

- Data type: Radiation
- Used for: Grounding the scenario's solar particle event alert in a real event (the 20 May 2024 storm, MSL sol 4190)
- Source: NASA DONKI https://kauai.ccmc.gsfc.nasa.gov/DONKI/ (queried through api.nasa.gov); event page https://ccmc.gsfc.nasa.gov/DONKI/view/CME/31034/-1
- Product ID: CME `2024-05-20T05:36:00-CME-001` (start 2024-05-20 05:36 UTC, fast halo CME from a backsided active region, leading edge about 1927 km/s). The ID marks the CME, not the particle arrival time. DONKI has no solar energetic particle ID for this event (its SEP list is Earth-centric) and no queryable flare entry
- Resolution: Events
- Licence and credit: Public NASA data, NASA CCMC DONKI. Event facts from NASA/JPL news: https://www.jpl.nasa.gov/news/nasa-watches-mars-light-up-during-epic-solar-storm/
- Processing: The scenario's dose-rate profile is not from DONKI but from the real RAD sol 4190 observations (3.3): baseline about 5.5 µGy/h, onset 05:21 UTC, peak about 351 µGy/h (plastic detector) at 06:15 UTC, about 40 minutes from onset to peak, half of peak about 2 hours later. Peak dose equivalent about 1070 µSv/h (est., upper bound, Q = 3.05). The DONKI CME ID is cited in `scenario.json`
- Status: In use, Stage 1, 2026-11-14. The UI must say the replayed weather (sol 4760) and the event (sol 4190) come from different dates (D-025)


### 3.11 Mars time and sun position: Mars24 (Support)

- Data type: Algorithm
- Used for: Local solar time, sun elevation, time to sunset, hillshade and shadows
- Source: https://www.giss.nasa.gov/tools/mars24/
- Product ID: Not applicable
- Resolution: Not applicable
- Licence and credit: NASA GISS
- Processing: Implement the published algorithm in the app and cross-check against the Mars24 tool for sample dates (D-024)
- Status: Not used in Stage 1. It runs in the app (Stages 2 and 3)


### 3.12 Relay orbiter passes: SPICE (Optional)

- Data type: Ephemeris
- Used for: Communication windows (MRO, MAVEN)
- Source: NAIF SPICE https://naif.jpl.nasa.gov/naif/ , SpiceyPy
- Product ID: Not applicable (no kernels chosen)
- Resolution: Not applicable
- Licence and credit: Not applicable
- Processing: None
- Status: Not used. Optional, not started


### 3.13 Gale regional context image

- Data type: Optical (regional context)
- Used for: Static regional image of Gale Crater on the Planning Table, shown on a plane in the same R3F scene; the patch is marked from `patch_rect_px`
- Source: USGS Astrogeology, Viking MDIM 2.1 Colorized Global Mosaic: https://planetarymaps.usgs.gov/mosaic/Mars_Viking_MDIM21_ClrMosaic_global_232m.tif (a CTX mosaic was the earlier idea and is not used)
- Product ID: `Mars_Viking_MDIM21_ClrMosaic_global_232m`
- Resolution: 232 m per pixel. The export covers a 200 km square centred on lat -5.4, lon 137.8 at 2000 × 2000 px (100 m per pixel), so it is upsampled and gains no real detail
- Licence and credit: NASA/JPL/USGS Astrogeology Science Center (public domain)
- Processing: Read the needed window over HTTP at run time (`/vsicurl/`, nothing downloaded), reproject to the local CRS with cubic resampling, write `gale_context.jpg` (JPEG quality 88). The patch rectangle is not drawn into the image
- Status: In use, Stage 1, 2026-11-14


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

Native resolution and approximate pixels across the patch (about 2,024 m × 1,869 m, D-017). The app grids are exported at 2 m (`cell_size_m` 2.0, D-021), so the app sees about 1000 cells across.

1. HiRISE orthoimage
   - Native resolution: 0.25 m (texture exported at about 0.5 m, at most 4096 px)
   - Pixels across: about 8000 native, at most 4096 exported
2. HiRISE DTM
   - Native resolution: 1 m (computed at 1 m, exported at 2 m)
   - Pixels across: about 2000 native, about 1000 exported
3. CRISM mineral maps
   - Native resolution: ~18 m
   - Pixels across: ~110
4. THEMIS thermal inertia
   - Native resolution: ~100 m
   - Pixels across: ~20
5. Gale regional image (Viking MDIM 2.1)
   - Native resolution: 232 m (exported at 100 m per pixel, upsampled)
   - Pixels across the patch: about 20
6. REMS, RAD
   - Native resolution: Point time series
   - Pixels across: Not spatial
7. Curiosity photos
   - Native resolution: Points
   - Pixels across: Not spatial

What this means for the 2 × 2 km patch:

- Only the orthoimage and the DTM resolve walk-level detail. Routing, the Thread and the 3D terrain depend on the DTM.
- 1 to 2 m boxwork ridges are near the limit of a 1 m DTM, so ridges appear but are smoothed. Rock detection on the 25 cm images adds the finer hazards.
- CRISM at ~18 m gives about 110 pixels across the patch: good for "which areas show clay or sulfate signals", not for placing a foot. Present it as context.
- THEMIS at ~100 m gives 10 to 30 pixels across the patch. It is context only and must never drive a walk-level decision. The UI says so.
- Anything resampled to the 2 m export grid does not gain real resolution. The layer registry keeps `native_resolution_m` so the UI can show it.


## 5. Known data caveats

Say these openly in the UI, the pitch and the docs. Each is a limit of the data or of our method, not a bug.

- Dust opacity (tau) is not in REMS or RAD. The value 0.5 (range 0.3 to 0.8) is our own baseline guess for Gale at about Ls 195 to 200 on sol 4760, not sourced. It is always labelled est. and should be replaced if Mastcam tau values are found.
- UV level thresholds are ours. REMS gives `UV_ABC` in W/m² and no UV index, so `uv_index_level` is derived: below 1 low, 1 to 3 moderate, 3 to 6 high, 6 to 9 very_high, 9 or more extreme. Labelled est.
- Dose equivalent is an estimate: RAD gives absorbed dose rate (µGy/h), and we multiply by the mean surface quality factor Q = 3.05 ± 0.26 to get µSv/h. For solar particle protons the true Q is probably lower, so event values are upper bounds.
- The solar particle event dose disagrees with NASA's figure. NASA reported 8,100 µGy for an astronaut next to Curiosity during the May 2024 storm, but the RAD sol 4190 totals are only about 1.3 to 1.6 mGy for the whole sol (peak about 351 µGy/h). The cause is unresolved (a multi-sol total or another quantity). The scenario uses the real RAD profile, and the 8,100 µGy is cited only as "NASA reported".
- The replayed weather (sol 4760, December 2025) and the solar particle event (sol 4190, May 2024) come from different dates (D-025).
- The CRISM signal is weak. Summary parameters sit near zero in the patch, and the two scenes disagree: `FRT000058A3` finds nothing, `FRT0000B6F1` flags 659 sulfate and 42 clay native pixels. A class is kept only where both agree, which leaves very few cells. Carbonate is dropped. Treat the layer as a weak candidate signature, never for routing.
- Rocks are shadow-based estimates from one image with one sun angle. Size is about ±0.5 m and assumes flat ground, small rocks are missed, and only detections with confidence of at least 0.6 are kept.
- The DTM elevation drifts 1 to 18 m against Curiosity's waypoint elevations (a smooth drift, not a shift). Slopes are unaffected and match Curiosity's tilt, so routing is not affected, but absolute elevations should not be quoted as exact.
- REMS hours with gaps (UV at 8 to 9 and 13 to 14 local time, and part of hour 22) are interpolated and flagged `is_estimate`. REMS air temperature is estimated from the boom sensors.
- The Gale regional image is 232 m per pixel data stretched to 100 m per pixel. It is context, not detail.


## 6. How to add a dataset

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
