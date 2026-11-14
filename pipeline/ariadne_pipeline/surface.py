"""Thermal inertia (THEMIS) and mineralogy class (CRISM) layers, contracts.md 3.8 and 3.9.

Both are context layers: THEMIS is 100 m per pixel, CRISM is 18 m per pixel.
"""

import numpy as np
import rasterio
from rasterio.warp import Resampling, reproject

from ariadne_pipeline import export
from ariadne_pipeline import grid as local_grid
from ariadne_pipeline import settings




# ---------------------------------------------------------------- constants

THERMAL_URL = "https://astrogeology.usgs.gov/search/map/themis_thermal_inertia_mosaic_quantitative_30s120e_100mpp"
THERMAL_CREDIT = (
    "Fergason, Christensen and Kieffer (2006), doi:10.1029/2006JE002735; "
    "Mars Odyssey THEMIS, ASU/USGS Astropedia (public domain)"
)
MINERALOGY_URL = "https://pds-geosciences.wustl.edu/mro/mro-m-crism-5-rdr-mptargeted-v1/mrocr_4001/mtrdr/"
MINERALOGY_CREDIT = (
    "Viviano-Beck et al. (2014), DOI 10.17189/1519470 (CRISM summary parameters); "
    "NASA/JPL/JHUAPL MRO CRISM team, NASA PDS"
)

THERMAL_PATH = settings.RAW_DIR / "themis" / "THEMIS_TI_Mosaic_Quant_30S120E_100mpp_gale_crop.tif"
THERMAL_PRODUCT_ID = "THEMIS_TI_Mosaic_Quant_30S120E_100mpp"
PRIMARY_MINERALOGY_PATH = settings.RAW_DIR / "crism" / "frt0000b6f1_07_sr165j_mtr3.img"
CROSS_CHECK_MINERALOGY_PATH = settings.RAW_DIR / "crism" / "frt000058a3_07_sr165j_mtr3.img"

CRISM_NODATA_VALUE = 65535.0
Z_SCORE_THRESHOLD = 3.0
MAD_TO_SIGMA = 1.4826

CLASS_NO_DATA = 0
CLASS_CLAY = 1
CLASS_SULFATE = 2
CLASS_HEMATITE = 3
CLASS_CARBONATE = 4
CLASS_NONE_DETECTED = 5

MINERALOGY_CLASSES = {
    "0": "no_data",
    "1": "clay_bearing",
    "2": "sulfate_bearing",
    "3": "hematite_bearing",
    "4": "carbonate_bearing",
    "5": "none_detected",
}

# CRISM summary parameter band names (Viviano-Beck et al. 2014)
CLAY_BANDS = ("D2300", "BD2290")
SULFATE_BANDS = ("SINDEX2", "BD2100_2")
HEMATITE_BANDS = ("BD860_2",)
CARBONATE_BANDS = ("BD2500_2",)
ALL_BANDS = CLAY_BANDS + SULFATE_BANDS + HEMATITE_BANDS + CARBONATE_BANDS




# ---------------------------------------------------------------- thermal inertia


def build_thermal_inertia(export_grid):
    """Returns (float32 array on the 2 m grid with NaN where no data, layer registry dict)."""
    values = local_grid.read_onto_grid(THERMAL_PATH, export_grid, resampling=Resampling.bilinear)
    layer = export.layer_entry(
        layer_id="thermal_inertia",
        file_name="thermal_inertia.bin",
        dtype="float32",
        unit="J m-2 K-1 s-1/2",
        source_dataset="THEMIS thermal inertia mosaic",
        product_id=THERMAL_PRODUCT_ID,
        native_resolution_m=100,
        is_estimate=False,
        description="THEMIS thermal inertia (about 20% absolute accuracy). Context only: 100 m native pixels, "
        "so about 10 to 30 real pixels across the patch, bilinearly smoothed onto the 2 m grid.",
    )
    return values.astype("float32"), layer




# ---------------------------------------------------------------- CRISM reading


def read_crism_parameters(path):
    """Returns (dict band name to float64 array with NaN for no data, affine transform, crs) for the six used bands."""
    with rasterio.open(path) as source:
        band_names = list(source.descriptions)
        parameters = {}
        for name in ALL_BANDS:
            values = source.read(band_names.index(name) + 1).astype("float64")
            values[values == CRISM_NODATA_VALUE] = np.nan
            values[~np.isfinite(values)] = np.nan
            parameters[name] = values
        return parameters, source.transform, source.crs




# ---------------------------------------------------------------- CRISM classification


def robust_z_score(values):
    """Scene-relative z: (value minus scene median) / (1.4826 * MAD), over all finite pixels. NaN stays NaN."""
    finite = values[np.isfinite(values)]
    if finite.size == 0:
        return np.full(values.shape, np.nan)
    median = np.median(finite)
    mad = np.median(np.abs(finite - median))
    if mad == 0.0:
        return np.full(values.shape, np.nan)
    return (values - median) / (MAD_TO_SIGMA * mad)


def class_score(raw_parameters, z_parameters, band_names):
    """Per pixel: highest z among the class's bands that fire (z >= threshold and raw > 0), else -inf."""
    score = np.full(raw_parameters[band_names[0]].shape, -np.inf)
    for name in band_names:
        raw = raw_parameters[name]
        z = z_parameters[name]
        with np.errstate(invalid="ignore"):
            fires = (z >= Z_SCORE_THRESHOLD) & (raw > 0.0)
            better = fires & (z > score)
        score = np.where(better, z, score)
    return score


def clay_score(raw_parameters, z_parameters):
    return class_score(raw_parameters, z_parameters, CLAY_BANDS)


def sulfate_score(raw_parameters, z_parameters):
    return class_score(raw_parameters, z_parameters, SULFATE_BANDS)


def hematite_score(raw_parameters, z_parameters):
    return class_score(raw_parameters, z_parameters, HEMATITE_BANDS)


def carbonate_score(raw_parameters, z_parameters):
    return class_score(raw_parameters, z_parameters, CARBONATE_BANDS)


def classify_parameters(raw_parameters):
    """uint8 class map at native resolution from the six raw parameter arrays (NaN = no data).

    z-scores use the whole array, so pass the whole observation, not a crop.
    """
    z_parameters = {name: robust_z_score(raw_parameters[name]) for name in ALL_BANDS}
    scores = np.stack(
        [
            clay_score(raw_parameters, z_parameters),
            sulfate_score(raw_parameters, z_parameters),
            hematite_score(raw_parameters, z_parameters),
            carbonate_score(raw_parameters, z_parameters),
        ]
    )
    class_ids = np.array([CLASS_CLAY, CLASS_SULFATE, CLASS_HEMATITE, CLASS_CARBONATE], dtype="uint8")
    best = np.argmax(scores, axis=0)
    anything_fires = np.max(scores, axis=0) > -np.inf
    classes = np.where(anything_fires, class_ids[best], CLASS_NONE_DETECTED).astype("uint8")

    no_data = np.zeros(classes.shape, dtype=bool)
    for name in ALL_BANDS:
        no_data |= ~np.isfinite(raw_parameters[name])
    classes[no_data] = CLASS_NO_DATA
    return classes


def warp_classes_to_grid(classes, source_transform, source_crs, export_grid):
    """Nearest-neighbour resampling (categorical) onto the grid. Outside the observation is 0 (no data)."""
    destination = np.zeros((export_grid.height, export_grid.width), dtype="uint8")
    reproject(
        source=classes,
        destination=destination,
        src_transform=source_transform,
        src_crs=source_crs,
        dst_transform=export_grid.transform,
        dst_crs=local_grid.LOCAL_CRS,
        resampling=Resampling.nearest,
    )
    return destination


def classify_observation(path, export_grid):
    """Reads one CRISM observation, classifies it, returns the uint8 class grid on the 2 m grid."""
    parameters, transform, crs = read_crism_parameters(path)
    classes = classify_parameters(parameters)
    return warp_classes_to_grid(classes, transform, crs, export_grid)


CLASS_NO_DATA = 0
CLASS_CARBONATE_BEARING = 4
CLASS_NONE_DETECTED = 5


def keep_only_agreeing_classes(primary_classes, cross_check_classes):
    """A mineral class survives only where both CRISM observations detect the same class.

    Carbonate is dropped: it appears in one observation only (artefact-prone bands).
    Everything else that is valid becomes none_detected.
    """
    agreed = primary_classes.copy()
    both_detect_same = (primary_classes == cross_check_classes) & (primary_classes != CLASS_NONE_DETECTED)
    is_carbonate = primary_classes == CLASS_CARBONATE_BEARING
    is_valid = primary_classes != CLASS_NO_DATA
    keep = both_detect_same & ~is_carbonate
    agreed = np.where(is_valid & ~keep, CLASS_NONE_DETECTED, agreed)
    return agreed.astype("uint8")


def build_mineralogy(export_grid):
    """Returns (uint8 class grid on the 2 m grid, mineralogy_classes dict, layer registry dict)."""
    primary_classes = classify_observation(PRIMARY_MINERALOGY_PATH, export_grid)
    cross_check_classes = classify_observation(CROSS_CHECK_MINERALOGY_PATH, export_grid)
    class_grid = keep_only_agreeing_classes(primary_classes, cross_check_classes)
    layer = export.layer_entry(
        layer_id="mineralogy_class",
        file_name="mineralogy_class.bin",
        dtype="uint8",
        unit="class",
        source_dataset="CRISM MTRDR summary parameters",
        product_id="FRT0000B6F1 + FRT000058A3 (MTRDR SR)",
        native_resolution_m=18,
        is_estimate=True,
        description="Weak candidate mineral signatures: a class is kept only where two CRISM observations "
        "agree (scene-relative robust z >= 3, raw value positive). Carbonate dropped (one scene only). "
        "Low confidence; do not use for routing.",
    )
    return class_grid, dict(MINERALOGY_CLASSES), layer




# ---------------------------------------------------------------- real-data run


def class_counts(class_grid):
    return {MINERALOGY_CLASSES[str(k)]: int((class_grid == k).sum()) for k in range(6)}


def main():
    export_grid = local_grid.export_grid()

    thermal, _ = build_thermal_inertia(export_grid)
    print("THEMIS TI on 2 m grid: min %.1f max %.1f mean %.1f NaN %.2f%%" % (
        np.nanmin(thermal), np.nanmax(thermal), np.nanmean(thermal), 100.0 * np.isnan(thermal).mean()))

    primary, _, _ = build_mineralogy(export_grid)
    cross_check = classify_observation(CROSS_CHECK_MINERALOGY_PATH, export_grid)
    print("FRT0000B6F1 classes:", class_counts(primary))
    print("FRT000058A3 classes:", class_counts(cross_check))

    overlap = (primary != CLASS_NO_DATA) & (cross_check != CLASS_NO_DATA)
    agreement = 100.0 * (primary[overlap] == cross_check[overlap]).mean()
    print("agreement in overlap: %.2f%% of %d cells" % (agreement, overlap.sum()))
    detected = overlap & ((primary != CLASS_NONE_DETECTED) | (cross_check != CLASS_NONE_DETECTED))
    if detected.any():
        print("agreement where either detects something: %.2f%% of %d cells" % (
            100.0 * (primary[detected] == cross_check[detected]).mean(), detected.sum()))


if __name__ == "__main__":
    main()
