"""Every fixed value the pipeline uses, in one place.

Each value cites the decision that set it (docs/decisions.md).
"""

from pathlib import Path




# ---------------------------------------------------------------- paths

REPO_ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = REPO_ROOT / "data" / "raw"
PROCESSED_DIR = REPO_ROOT / "data" / "processed"
CONTRACTS_DOC = REPO_ROOT / "docs" / "contracts.md"

HIRISE_DIR = RAW_DIR / "hirise"
DTM_PATH = HIRISE_DIR / "DTEEC_009149_1750_009294_1750_U01.IMG"
ORTHO_PATH = HIRISE_DIR / "PSP_009149_1750_RED_A_01_ORTHO.JP2"

CONTRACT_VERSION = "1.1.0"




# ---------------------------------------------------------------- patch and grid (D-017, D-021)

PATCH_NORTH_LAT = -4.7809
PATCH_SOUTH_LAT = -4.8124
PATCH_WEST_LON = 137.3771
PATCH_EAST_LON = 137.4114

MARS_SPHERE_RADIUS_M = 3396190.0

COMPUTE_CELL_SIZE_M = 1.0
EXPORT_CELL_SIZE_M = 2.0
MAX_TEXTURE_PX = 4096

CRS_LABEL = "IAU_2015:49900"
ELEVATION_REFERENCE = "mars_areoid"




# ---------------------------------------------------------------- staging point (D-018)

STAGING_POINT_LAT = -4.78877
STAGING_POINT_LON = 137.39023




# ---------------------------------------------------------------- walking model (D-019)

SUIT_SPEED_FACTOR = 0.6
GRAVITY_ADJUSTMENT = 1.0
MAX_WALKABLE_SLOPE_DEG = 25.0




# ---------------------------------------------------------------- penalty rules (contracts.md 3.5, D-019)

ROUGHNESS_SMOOTHING_SIGMA_M = 2.5
ROUGHNESS_WINDOW_M = 5.0
ROUGHNESS_IMPASSABLE_M = 0.5
ROUGHNESS_ROUGH_M = 0.2
ROUGHNESS_ROUGH_FACTOR = 1.5

ROCK_IMPASSABLE_DIAMETER_M = 1.5
ROCK_CLEARANCE_M = 0.5

SAND_DEPTH_BELOW_SMOOTH_M = 0.3
SAND_MAX_ROUGHNESS_M = 0.1
SAND_FACTOR = 1.3




# ---------------------------------------------------------------- consumables (D-020)

SUIT_CAPABILITY_HOURS = 8.0
PLANNED_MARSWALK_HOURS = 6.0
RESERVE_MINUTES = 30.0




# ---------------------------------------------------------------- carried load (D-027, contracts.md 4.6)

BASE_CARRIED_LOAD_KG = 10.0
LOAD_TIME_FACTOR_PER_KG = 0.01




# ---------------------------------------------------------------- comms and shelters (contracts.md 3.13, 3.16)

ROVER_ANTENNA_HEIGHT_M = 3.0
HELMET_HEIGHT_M = 1.8
OVERHANG_MAX_SKY_VIEW_FACTOR = 0.75




# ---------------------------------------------------------------- Knots (D-023)

KNOTS = [
    {"knot_id": "knot_sulfur_stones", "name": "Sulfur stones", "sol": 4210, "latitude_deg": -4.78572, "longitude_deg": 137.40886},
    {"knot_id": "knot_channel_west_edge", "name": "Gediz Vallis west edge", "sol": 4389, "latitude_deg": -4.78339, "longitude_deg": 137.39898},
    {"knot_id": "knot_boxwork_first_view", "name": "Boxwork first view", "sol": 4527, "latitude_deg": -4.79721, "longitude_deg": 137.38751},
    {"knot_id": "knot_boxwork_ridge", "name": "Boxwork ridge", "sol": 4602, "latitude_deg": -4.80437, "longitude_deg": 137.37962},
    {"knot_id": "knot_boxwork_hollow", "name": "Boxwork hollow", "sol": 4653, "latitude_deg": -4.80708, "longitude_deg": 137.37990},
]




# ---------------------------------------------------------------- provenance labels

DTM_PRODUCT_ID = "DTEEC_009149_1750_009294_1750_U01"
ORTHO_PRODUCT_ID = "PSP_009149_1750_RED_A_01_ORTHO"
HIRISE_CREDIT = "NASA/JPL/University of Arizona"
HIRISE_DTM_URL = "https://hirise-pds.lpl.arizona.edu/PDS/DTM/PSP/ORB_009100_009199/PSP_009149_1750_PSP_009294_1750/"
