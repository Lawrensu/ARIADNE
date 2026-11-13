# ARIADNE data contracts

Status: DRAFT v0.1.0. Must be signed off at Stage 0 (whole team, human approval).

This file is the source of truth for every file passed between stages. When another document disagrees with it, this file wins.

Rules for changing it:

- Fields and string constants are deprecate-only. Once a field or constant is in use it is never renamed or removed, only marked deprecated (see decision D-012).
- Every change is proposed as an entry in `docs/decisions.md` and approved by a human before this file is edited.
- `contract_version` (semver) in `data/processed/meta.json` is bumped on every change to this file. The validator checks that it matches the version in this document.
- Only the main agent edits this file, and only after human approval.


## 1. Common rules

### 1.1 The local grid

All grids share one local grid. It is the only coordinate system the app sees.

- Origin: the north-west corner of the patch.
- +x = east, +z = south, +y = up (Three.js y-up).
- 1 cell = 1 m (`cell_size_m` in `meta.json`; 1.0 in v0.1.0).
- Row 0 is the north edge. Storage is row-major: index = `row * width + col`.
- The centre of cell (row, col) is at `x = (col + 0.5) * cell_size_m`, `z = (row + 0.5) * cell_size_m`.
- Positions in JSON files are `x_m`, `z_m` in this local grid. Latitude and longitude appear only for display.


### 1.2 Binary grids

- Raw little-endian, no header, `width × height` values, row-major.
- `width` and `height` come from `meta.json`. They are never hard-coded.
- float32 no-data is `NaN`.
- Impassable is `+Infinity` where a layer states it (`traversal_penalty.bin`, `return_field.bin`).
- Where a layer does not state that `NaN` or `+Infinity` is allowed, neither may appear.


### 1.3 Units

- Lengths in metres, times in seconds, temperatures in °C, pressure in Pa, dose rate in µSv/h, angles in degrees.


### 1.4 Identifiers and enums

- All identifiers and enum values are descriptive lowercase snake_case strings, for example `"no_go"`, `"slope_degrees"`, `"solar_particle_event_alert"`.
- No integer codes except the mineralogy `class_id`, which is mapped to a name in `meta.json`.


### 1.5 Provenance

Every record that shows data in the UI carries a provenance object.

Fields:

- `source_dataset` (string, always): dataset name, for example `"HiRISE DTM"`.
- `product_id` (string, always): product or file identifier, for example a HiRISE DTM ID.
- `resolution_m` (number, where spatial): native resolution in metres.
- `timestamp` (string, ISO 8601 UTC, where temporal): acquisition or measurement time.
- `is_estimate` (boolean, always): `true` for model-derived or inferred values (shown as "est.").
- `uncertainty` (number or string, where known): unit given alongside, or a short text.

Example:

```json
{
  "source_dataset": "Curiosity REMS",
  "product_id": "TBD",
  "timestamp": "2026-01-01T00:00:00Z",
  "is_estimate": false,
  "uncertainty": "TBD"
}
```


## 2. Files in data/processed/

Files:

1. `meta.json`
   - Producer: Stage 1 (Person A)
   - Consumer: Stage 2, Stage 3, validator
   - Format: JSON
   - Description: grid definition, georeferencing, layer registry, sources, contract version.
2. `heightmap.bin`
   - Producer: Stage 1
   - Consumer: Stage 2
   - Format: float32 grid
   - Description: elevation in metres above the Mars areoid.
3. `slope_degrees.bin`
   - Producer: Stage 1
   - Consumer: Stage 2
   - Format: float32 grid
   - Description: slope in degrees (0 to 90).
4. `roughness_m.bin`
   - Producer: Stage 1
   - Consumer: Stage 2
   - Format: float32 grid
   - Description: local surface roughness in metres.
5. `traversal_penalty.bin`
   - Producer: Stage 1
   - Consumer: Stage 2
   - Format: float32 grid
   - Description: cost multiplier ≥ 1, `+Infinity` = impassable.
6. `return_field.bin`
   - Producer: Stage 1
   - Consumer: Stage 2, Stage 3
   - Format: float32 grid
   - Description: seconds to walk back to the staging point, `+Infinity` = unreachable.
7. `sky_view_factor.bin`
   - Producer: Stage 1
   - Consumer: Stage 2, Stage 3
   - Format: float32 grid
   - Description: open-sky fraction 0 to 1 (est.), proxy for relative GCR exposure.
8. `thermal_inertia.bin`
   - Producer: Stage 1
   - Consumer: Stage 2
   - Format: float32 grid
   - Description: THEMIS thermal inertia resampled to the grid (native ~100 m).
9. `mineralogy_class.bin`
   - Producer: Stage 1
   - Consumer: Stage 2
   - Format: uint8 grid
   - Description: CRISM-derived mineral class, 0 = no data.
10. `texture_hirise.jpg`
    - Producer: Stage 1
    - Consumer: Stage 2
    - Format: JPEG
    - Description: HiRISE orthoimage covering the grid extent exactly.
11. `rocks.json`
    - Producer: Stage 1
    - Consumer: Stage 2
    - Format: JSON
    - Description: detected rocks (shadow-based).
12. `knots.json`
    - Producer: Stage 1 (coordinates), Stage 3 (content)
    - Consumer: Stage 2, Stage 3
    - Format: JSON
    - Description: science waypoints.
13. `shelters.json`
    - Producer: Stage 1
    - Consumer: Stage 2, Stage 3
    - Format: JSON
    - Description: shelter candidates (rover, habitat, terrain overhangs).
14. `environment_timeline.json`
    - Producer: Stage 1
    - Consumer: Stage 3
    - Format: JSON
    - Description: replayed REMS/RAD samples with Mars local time.
15. `app/.../scenario.json`
    - Producer: Stage 3
    - Consumer: Stage 3
    - Format: JSON
    - Description: scripted scenario. Lives in `app/`, not in `data/processed/` (see 3.15).

Note:

- Who fills in the human-written content of `knots.json` (science text, photos) is decided at Stage 0 (whole team). The file format is fixed here regardless.


## 3. File specifications

### 3.1 meta.json

Single JSON object. All fields are required unless marked optional.

Fields:

- `contract_version` (string, semver): must equal the version at the top of this document.
- `generated_at_utc` (string, ISO 8601): when the pipeline produced the files.
- `pipeline_commit` (string): Git commit hash of the pipeline that produced them.
- `grid` (object): `{ "width": int, "height": int, "cell_size_m": number }`.
- `origin_northwest` (object): `{ "latitude_deg": number, "longitude_deg": number }`, planetocentric, east-positive, of the NW corner.
- `crs` (string): `"IAU_2015:49900"`.
- `elevation_reference` (string): `"mars_areoid"`.
- `bounds` (object): `{ "width_m": number, "height_m": number, "south_east": { "latitude_deg": number, "longitude_deg": number } }`.
- `staging_point` (object): `{ "x_m": number, "z_m": number }`, the rover parking spot. `return_field` is 0 here.
- `texture` (object): `{ "file": "texture_hirise.jpg", "width_px": int, "height_px": int }`. The image covers the grid extent exactly, with no padding or offset.
- `sun` (object): sun geometry of the HiRISE image: `{ "sun_azimuth_deg": number, "sun_incidence_deg": number }`.
- `layers` (array): layer registry, see below.
- `mineralogy_classes` (object): map of `class_id` (as string key, because JSON keys are strings) to mineral name. `"0"` is `"no_data"`.
- `sources` (array): datasets used: `[{ "source_dataset", "product_id", "url", "licence_credit" }]`.

Each entry of `layers`:

- `layer_id` (string): for example `"slope_degrees"`.
- `file` (string): file name in `data/processed/`.
- `dtype` (string): `"float32"` or `"uint8"`.
- `unit` (string): for example `"degrees"`, `"metres"`, `"seconds"`, `"dimensionless"`.
- `source_dataset` (string): provenance.
- `product_id` (string): provenance.
- `native_resolution_m` (number): resolution of the source before resampling.
- `is_estimate` (boolean): `true` for model-derived layers.
- `description` (string): one sentence.

Example (values are illustrative; real values TBD at Stage 0/1):

```json
{
  "contract_version": "0.1.0",
  "generated_at_utc": "2026-11-14T10:00:00Z",
  "pipeline_commit": "TBD",
  "grid": { "width": 2000, "height": 2000, "cell_size_m": 1.0 },
  "origin_northwest": { "latitude_deg": -4.7, "longitude_deg": 137.4 },
  "crs": "IAU_2015:49900",
  "elevation_reference": "mars_areoid",
  "bounds": {
    "width_m": 2000,
    "height_m": 2000,
    "south_east": { "latitude_deg": -4.72, "longitude_deg": 137.42 }
  },
  "staging_point": { "x_m": 1000, "z_m": 1900 },
  "texture": { "file": "texture_hirise.jpg", "width_px": 4096, "height_px": 4096 },
  "sun": { "sun_azimuth_deg": 0, "sun_incidence_deg": 0 },
  "layers": [
    {
      "layer_id": "slope_degrees",
      "file": "slope_degrees.bin",
      "dtype": "float32",
      "unit": "degrees",
      "source_dataset": "HiRISE DTM",
      "product_id": "TBD",
      "native_resolution_m": 1.0,
      "is_estimate": true,
      "description": "Slope derived from the HiRISE DTM."
    }
  ],
  "mineralogy_classes": { "0": "no_data", "1": "TBD" },
  "sources": [
    { "source_dataset": "HiRISE DTM", "product_id": "TBD", "url": "https://www.uahirise.org/dtm/", "licence_credit": "TBD" }
  ]
}
```

All coordinates in the example above are placeholders, not decisions. Bounds and staging point are TBD at Stage 0 (whole team).


### 3.2 heightmap.bin

- float32, metres above the Mars areoid (`elevation_reference`).
- `NaN` allowed only where the DTM (digital terrain model, a height map) has no data. Validator reports the count; Stage 1 should fill small gaps and document it.
- Source: HiRISE DTM, native 1 m.


### 3.3 slope_degrees.bin

- float32, degrees, range 0 to 90 inclusive.
- No `NaN` except where the heightmap is `NaN`.
- Derived from `heightmap.bin` with a documented method (method TBD, Person A).


### 3.4 roughness_m.bin

- float32, metres. Range ≥ 0.
- Local height variation in a moving window (window size and statistic TBD, Person A).
- No `NaN` except where the heightmap is `NaN`.


### 3.5 traversal_penalty.bin

- float32 multiplier, ≥ 1. `1` = ordinary firm ground, larger = slower or riskier.
- `+Infinity` = impassable: rocks above the size limit, soft sand, excessive roughness, slope above `max_walkable_slope_deg`.
- `NaN` is not allowed. Cells without data are `+Infinity`.
- Used in edge cost, see section 4.


### 3.6 return_field.bin

- float32, seconds to walk from the cell back to `staging_point`. Computed in Python by one Dijkstra from the staging point using the shared walking-time function and `traversal_penalty.bin`.
- Staging point cell = 0.
- `+Infinity` = unreachable. `NaN` is not allowed.
- Edge direction: the cost is for walking towards the staging point, that is from the cell to its neighbour. The pipeline must run Dijkstra on the reversed graph so uphill/downhill asymmetry is correct.


### 3.7 sky_view_factor.bin

- float32, 0 to 1. 1 = open sky, lower = more terrain shielding.
- Estimate (`is_estimate: true`). Proxy for relative galactic cosmic ray exposure, not a measured dose.
- No `NaN` except where the heightmap is `NaN`.


### 3.8 thermal_inertia.bin

- float32, THEMIS thermal inertia in J m⁻² K⁻¹ s⁻½ (unit string in `meta.json` is authoritative).
- Resampled to the 1 m grid. Native resolution ~100 m, so it carries only ~10 to 30 real pixels across the patch. Context, not walk-level detail. The layer entry in `meta.json` states `native_resolution_m: 100`.
- `NaN` allowed where there is no data.


### 3.9 mineralogy_class.bin

- uint8. `0` = no data. Other values map to names through `mineralogy_classes` in `meta.json`.
- Source: ready-made CRISM mineral maps (native ~18 m). Raw CRISM is never processed.
- Class list is TBD at Stage 1 (Person A).


### 3.10 texture_hirise.jpg

- JPEG, at most 4096 × 4096 px (performance budget, Person B confirms).
- Covers the grid extent exactly: the top-left pixel corner is the NW corner of the grid, the bottom-right corner is the SE corner. Size in pixels is in `meta.json`.
- If the image is not square or not a clean multiple of the grid, `meta.json` still states pixel size and the image is stretched to exactly the grid extent.


### 3.11 rocks.json

Array of objects.

Fields:

- `rock_id` (string): for example `"rock_00042"`.
- `x_m`, `z_m` (number): position in the local grid, inside the extent.
- `diameter_m` (number): estimated diameter.
- `height_m` (number): estimated height.
- `detection_method` (string): `"shadow_based"` in v0.1.0.
- `confidence` (number): 0 to 1.
- `provenance` (object): see 1.5. `is_estimate` is `true`.

Example:

```json
[
  {
    "rock_id": "rock_00001",
    "x_m": 812.5,
    "z_m": 1204.0,
    "diameter_m": 2.1,
    "height_m": 1.3,
    "detection_method": "shadow_based",
    "confidence": 0.8,
    "provenance": {
      "source_dataset": "HiRISE orthoimage",
      "product_id": "TBD",
      "resolution_m": 0.25,
      "is_estimate": true,
      "uncertainty": "TBD"
    }
  }
]
```

Rocks below roughly 1.5 m are not individually detected. They are represented statistically through the penalty layer and labelled "est.".


### 3.12 knots.json

Array of 4 to 5 objects (count TBD at Stage 0).

Fields:

- `knot_id` (string): for example `"knot_boxwork_ridge_a"`.
- `name` (string): display name.
- `x_m`, `z_m` (number): local grid position.
- `latitude_deg`, `longitude_deg` (number): for display only.
- `science_rationale` (string): why a crew would go there.
- `measurements` (array): `[{ "label", "value", "unit", "provenance" }]`.
- `photos` (array): `[{ "url", "sol", "camera", "caption", "credit" }]`.

Example:

```json
[
  {
    "knot_id": "knot_boxwork_ridge_a",
    "name": "Boxwork ridge A",
    "x_m": 640.0,
    "z_m": 900.0,
    "latitude_deg": -4.71,
    "longitude_deg": 137.41,
    "science_rationale": "TBD",
    "measurements": [
      {
        "label": "Slope",
        "value": 6.2,
        "unit": "degrees",
        "provenance": {
          "source_dataset": "HiRISE DTM",
          "product_id": "TBD",
          "resolution_m": 1.0,
          "is_estimate": true
        }
      }
    ],
    "photos": [
      {
        "url": "TBD",
        "sol": 0,
        "camera": "TBD",
        "caption": "TBD",
        "credit": "NASA/JPL-Caltech"
      }
    ]
  }
]
```

Every Knot must have a finite `return_field` value at its cell. The position `x_m`, `z_m` must lie on passable ground.


### 3.13 shelters.json

Array of objects.

Fields:

- `shelter_id` (string): for example `"shelter_rover"`.
- `shelter_type` (string): `"pressurised_rover"`, `"habitat"` or `"terrain_overhang"`.
- `x_m`, `z_m` (number): local grid position.
- `sky_view_factor` (number): 0 to 1 at the shelter position.
- `is_estimate` (boolean): `true` for `terrain_overhang` (derived), normally `false` for the rover.

Example:

```json
[
  {
    "shelter_id": "shelter_rover",
    "shelter_type": "pressurised_rover",
    "x_m": 1000.0,
    "z_m": 1900.0,
    "sky_view_factor": 1.0,
    "is_estimate": false
  }
]
```

The rover shelter sits at `staging_point`. Which shelters exist in the patch (and whether a habitat entry is included at all) is TBD at Stage 0, whole team.


### 3.14 environment_timeline.json

A replay of real historical data on a simulation clock (decision D-014).

Top level object fields:

- `replay_source` (object): `{ "mission": "msl", "instrument_set": ["rems", "rad"], "sol": int }`. The sol is TBD at Stage 0.
- `samples` (array): ordered by `seconds_since_replay_start`, ascending.

Each sample:

- `seconds_since_replay_start` (number): seconds from the start of the replay.
- `local_mean_solar_time` (string): `"HH:MM:SS"`.
- `air_temperature_c` (number): °C.
- `ground_temperature_c` (number): °C.
- `pressure_pa` (number): Pa.
- `uv_index_level` (string): `"low"`, `"moderate"`, `"high"`, `"very_high"` or `"extreme"`.
- `dust_opacity_tau` (number): dimensionless.
- `radiation_dose_rate_usv_per_hour` (number): µSv/h.
- `provenance` (object): see 1.5.

Example:

```json
{
  "replay_source": { "mission": "msl", "instrument_set": ["rems", "rad"], "sol": 0 },
  "samples": [
    {
      "seconds_since_replay_start": 0,
      "local_mean_solar_time": "09:00:00",
      "air_temperature_c": -40.0,
      "ground_temperature_c": -25.0,
      "pressure_pa": 740,
      "uv_index_level": "moderate",
      "dust_opacity_tau": 0.5,
      "radiation_dose_rate_usv_per_hour": 27.0,
      "provenance": {
        "source_dataset": "Curiosity REMS and RAD",
        "product_id": "TBD",
        "timestamp": "TBD",
        "is_estimate": false
      }
    }
  ]
}
```

Values above are placeholders. Fields that REMS or RAD do not measure directly (for example `uv_index_level`, from REMS UV data, or `dust_opacity_tau`, from other products) set `is_estimate` accordingly. The source product per field is TBD (Person A, Stage 1).


### 3.15 scenario.json

Produced and consumed by Stage 3 (Person C). It is app content, not pipeline output, so it lives in `app/` (exact path TBD, Person C) and not in `data/processed/`. The validator does not require it. It is specified here so the format is stable.

Top level object fields:

- `scenario_id` (string): for example `"solar_particle_event_reroute"`.
- `description` (string): one sentence.
- `events` (array): ordered by `at_sim_seconds`.

Each event:

- `at_sim_seconds` (number): simulation time at which the event fires.
- `event_type` (string): for example `"solar_particle_event_alert"`, `"dust_opacity_rising"`, `"consumables_warning"`, `"comms_loss"`.
- `payload` (object): event-specific data (for example a shelter id, a new dust tau).
- `display_message` (string): text shown to the crew.
- `recommended_action` (string): what the crew should do (design principle: alerts always come with an action).

Example:

```json
{
  "scenario_id": "solar_particle_event_reroute",
  "description": "A solar particle event alert mid-walk reroutes the crew to the nearest shelter.",
  "events": [
    {
      "at_sim_seconds": 1800,
      "event_type": "solar_particle_event_alert",
      "payload": { "shelter_id": "shelter_rover" },
      "display_message": "Solar storm: shelter at rover.",
      "recommended_action": "Route to shelter_rover now."
    }
  ]
}
```

The set of `event_type` values grows over time. Existing values are not renamed (D-012).


## 4. Shared walking-time function

The same function exists in Python (pipeline, for `return_field.bin`) and in TypeScript (app, runtime routing). Both must give the same result.


### 4.1 Interface

```
walking_time_seconds(horizontal_distance_m, elevation_change_m) -> seconds
```

- `horizontal_distance_m` > 0, the distance in the horizontal plane between the two cell centres.
- `elevation_change_m` is signed: positive when walking uphill, negative downhill.
- Returns seconds to walk that edge on ground with penalty 1.


### 4.2 Edge cost

```
edge_cost_seconds = walking_time_seconds(horizontal_distance_m, elevation_change_m)
                    * max(traversal_penalty[from_cell], traversal_penalty[to_cell])
```

- Using the maximum of the two cells' penalties is PROPOSED. Person A confirms at Stage 0.
- If either penalty is `+Infinity`, the edge does not exist.
- Neighbours are 8-connected. For a diagonal move the horizontal distance is `cell_size_m * sqrt(2)`; for an orthogonal move it is `cell_size_m`. `elevation_change_m` is the difference between the two cell heights.
- The cost is direction-dependent: the reverse edge has `-elevation_change_m` and therefore a different cost.


### 4.3 Base formula: Tobler's hiking function (Earth)

```
S = elevation_change_m / horizontal_distance_m
speed_kmh = 6 * exp(-3.5 * abs(S + 0.05))
speed_m_per_s = speed_kmh * 1000 / 3600
walking_time_seconds_earth = horizontal_distance_m / speed_m_per_s
```

Note:

- Tobler's function uses horizontal distance and slope S as written above.
- Whether the path length along the slope is used instead is not decided here.
- v0.1.0 uses horizontal distance as in the formula.


### 4.4 Mars and suit adaptation

Placeholders, decided by Person A at Stage 0 and recorded in `decisions.md`.

Parameters:

- `suit_speed_factor` (TBD): multiplier on walking speed for the pressurised suit.
- `gravity_adjustment` (TBD): adjustment for Mars gravity (0.38 g).
- `max_walkable_slope_deg` (TBD, proposal: 25): slopes above this are impassable (`+Infinity` penalty).

How `suit_speed_factor` and `gravity_adjustment` enter the formula is also TBD (Person A).


### 4.5 Test vectors

Python (pipeline) and TypeScript (app) implementations MUST both pass these 8 rows. Tolerance: ±1e-3 s.

```
#  horizontal_distance_m  elevation_change_m  expected_seconds
1  1.0                    0.0                 TBD
2  1.0                    0.1                 TBD
3  1.0                    -0.1                TBD
4  1.0                    0.5                 TBD
5  1.0                    -0.5                TBD
6  1.4142135623730951     0.0                 TBD
7  10.0                   2.0                 TBD
8  10.0                   -2.0                TBD
```

Notes:

- Every `expected_seconds` value is TBD: Person A computes it at Stage 0 once parameters are fixed.
- Row 1 is flat ground over 1 m, the anchor example.
- Row 6 is a diagonal move on flat ground.
- The set of rows may grow. Rows are never changed after sign-off without a `decisions.md` entry.


## 5. Validator

`pipeline/validate/run.py`, run with `uv run`. It must check:

1. Every file listed in section 2 under `data/processed/` exists.
2. Binary file sizes equal `width × height × bytes per value` (4 for float32, 1 for uint8).
3. `NaN` and `+Infinity` appear only where this contract allows them.
4. Value ranges: slope 0 to 90, sky view factor 0 to 1, penalty ≥ 1, roughness ≥ 0.
5. Every x and z in JSON files lies inside the grid extent.
6. `return_field` at the staging point is 0.
7. Every Knot is reachable (finite `return_field` at its cell).
8. Every UI record has provenance (rocks, Knot measurements, environment samples, layers).
9. `contract_version` in `meta.json` matches the version in this document.

Notes:

- Passing the validator is part of the Stage 1 hand-off gate (see `docs/handoff.md`).
- The validator itself is written in Stage 1 and is not yet present.


## 6. Changelog

### v0.1.0, 2026-11-13 (DRAFT)

- Initial draft of all file formats, the shared walking-time function and the validator requirements.
- Open for sign-off at Stage 0. Walking-time parameters, test vector values, bounds, staging point, mineral class list and replay sol are TBD.
