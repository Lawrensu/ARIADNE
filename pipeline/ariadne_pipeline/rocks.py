"""Shadow-based rock detection (docs/contracts.md 3.11), in the style of Golombek et al.

A rock lit from one side throws a dark shadow on the far side. The shadow width
across the sun direction gives the rock diameter, and the shadow length along the sun
direction gives the rock height (height = length * tan(90 deg - incidence)).
"""

import math

import numpy as np
from rasterio.warp import Resampling
from scipy import ndimage
from skimage import measure

from ariadne_pipeline import grid as grid_module
from ariadne_pipeline import settings




# ---------------------------------------------------------------- sun geometry

# HiRISE RDR label PSP_009149_1750_RED.LBL (https://hirise-pds.lpl.arizona.edu/PDS/RDR/PSP/
# ORB_009100_009199/PSP_009149_1750/PSP_009149_1750_RED.LBL), fetched once:
#   INCIDENCE_ANGLE   = 58.808048 deg  (sun angle from the local vertical)
#   SUB_SOLAR_AZIMUTH = 213.082441 deg (clockwise from image right, i.e. from east)
#   NORTH_AZIMUTH     = 269.999999 deg (north is image up, clockwise from image right)
# Bearing clockwise from north = SUB_SOLAR_AZIMUTH - NORTH_AZIMUTH = 303.08 deg (north-west),
# consistent with the local time of 15.5 h (afternoon, sun in the west).
SUB_SOLAR_AZIMUTH_FROM_IMAGE_RIGHT_DEG = 213.082441
NORTH_AZIMUTH_FROM_IMAGE_RIGHT_DEG = 269.999999
SUN_INCIDENCE_DEG = 58.808048




def sun_geometry():
    """Return {"sun_azimuth_deg", "sun_incidence_deg"}: sun bearing clockwise from north, incidence from vertical."""
    bearing_deg = (SUB_SOLAR_AZIMUTH_FROM_IMAGE_RIGHT_DEG - NORTH_AZIMUTH_FROM_IMAGE_RIGHT_DEG) % 360.0
    return {"sun_azimuth_deg": bearing_deg, "sun_incidence_deg": SUN_INCIDENCE_DEG}




# ---------------------------------------------------------------- tuning values

ORTHO_CELL_SIZE_M = 0.25
BACKGROUND_BLOCK_PX = 4
BACKGROUND_WINDOW_M = 10.0
SHADOW_MAD_FACTOR = 3.0
SHADOW_MIN_RELATIVE_DROP = 0.25
MIN_SHADOW_AREA_PX = 4
MAX_SHADOW_LENGTH_M = 10.0
MAX_PLAUSIBLE_DIAMETER_M = 6.0
MIN_ROCK_DIAMETER_M = 1.0
MAX_ELONGATION = 6.0
MIN_FILL_RATIO = 0.4
UNCERTAINTY_TEXT = "est. from shadow geometry, about +/-0.5 m in size, assumes flat ground"




# ---------------------------------------------------------------- shadow mask


def _upsample(small_array, block_px, shape):
    """Repeat each value of a block-reduced array back to full resolution, cropped to shape."""
    repeated = np.repeat(np.repeat(small_array, block_px, axis=0), block_px, axis=1)
    return repeated[: shape[0], : shape[1]]


def _local_background(image):
    """Return (median, spread) images: local brightness level and its robust noise, over about 10 m."""
    block = BACKGROUND_BLOCK_PX
    height = image.shape[0] - image.shape[0] % block
    width = image.shape[1] - image.shape[1] % block
    blocks = image[:height, :width].reshape(height // block, block, width // block, block)
    coarse = blocks.mean(axis=(1, 3))

    window_blocks = max(3, int(round(BACKGROUND_WINDOW_M / (ORTHO_CELL_SIZE_M * block))))
    median = ndimage.median_filter(coarse, size=window_blocks, mode="nearest")
    absolute_deviation = np.abs(coarse - median)
    mad = ndimage.median_filter(absolute_deviation, size=window_blocks, mode="nearest")
    spread = 1.4826 * mad

    median_full = _upsample(median, block, image.shape)
    spread_full = _upsample(spread, block, image.shape)
    pad_rows = image.shape[0] - median_full.shape[0]
    pad_cols = image.shape[1] - median_full.shape[1]
    if pad_rows or pad_cols:
        median_full = np.pad(median_full, ((0, pad_rows), (0, pad_cols)), mode="edge")
        spread_full = np.pad(spread_full, ((0, pad_rows), (0, pad_cols)), mode="edge")
    return median_full, spread_full


def find_shadow_mask(image):
    """Return a boolean mask of pixels clearly darker than their surroundings.

    A pixel is shadow when it is below the local median by both a noise margin
    (MAD factor) and a relative drop, so gentle dark slopes are not picked up.
    """
    median, spread = _local_background(image)
    drop_needed = np.maximum(SHADOW_MAD_FACTOR * spread, SHADOW_MIN_RELATIVE_DROP * median)
    mask = image < (median - drop_needed)
    mask &= np.isfinite(image)
    return mask, median




# ---------------------------------------------------------------- one shadow to one rock


def _sun_unit_vector_xz(sun_azimuth_deg):
    """Unit vector in local (x east, z south) pointing from the ground towards the sun."""
    azimuth = math.radians(sun_azimuth_deg)
    return math.sin(azimuth), -math.cos(azimuth)


def _shadow_to_rock(region, median_image, image, sun_azimuth_deg, sun_incidence_deg, cell_m):
    """Turn one connected shadow into a rock dict (without id and provenance), or None if it is not rock-like."""
    rows = region.coords[:, 0] + 0.5
    cols = region.coords[:, 1] + 0.5
    x_px = cols
    z_px = rows
    sun_x, sun_z = _sun_unit_vector_xz(sun_azimuth_deg)

    along_sun = (x_px * sun_x + z_px * sun_z) * cell_m
    across_sun = (x_px * -sun_z + z_px * sun_x) * cell_m

    # Add one pixel so a one-pixel-wide shadow still has a size.
    length_m = float(along_sun.max() - along_sun.min()) + cell_m
    width_m = float(across_sun.max() - across_sun.min()) + cell_m

    if length_m > MAX_SHADOW_LENGTH_M:
        return None
    if length_m / width_m > MAX_ELONGATION or width_m / length_m > MAX_ELONGATION:
        return None

    diameter_m = width_m
    if diameter_m < MIN_ROCK_DIAMETER_M:
        return None
    height_m = length_m * math.tan(math.radians(90.0 - sun_incidence_deg))

    # The rock sits against the sunward end of its shadow, its centre half a diameter further on.
    sunward_end = float(along_sun.max()) + cell_m / 2.0
    centre_along = sunward_end + diameter_m / 2.0
    centre_across = float(across_sun.mean())
    x_m = centre_along * sun_x + centre_across * -sun_z
    z_m = centre_along * sun_z + centre_across * sun_x

    fill_ratio = region.area * cell_m * cell_m / (length_m * width_m)
    if fill_ratio < MIN_FILL_RATIO:
        return None

    confidence = _confidence(region, median_image, image, length_m, width_m, fill_ratio)
    if diameter_m > MAX_PLAUSIBLE_DIAMETER_M:
        # Very wide shadows are more likely outcrop or ridge edges than single rocks.
        confidence = round(min(confidence, 0.3), 2)
    return {
        "x_m": x_m,
        "z_m": z_m,
        "diameter_m": diameter_m,
        "height_m": height_m,
        "confidence": confidence,
    }


def _confidence(region, median_image, image, length_m, width_m, fill_ratio):
    """0 to 1 from shadow contrast (darker is better), compactness and a plausible aspect ratio."""
    rows = region.coords[:, 0]
    cols = region.coords[:, 1]
    background = float(median_image[rows, cols].mean())
    shadow_level = float(image[rows, cols].mean())
    contrast = 0.0
    if background > 0:
        contrast = (background - shadow_level) / background
    contrast_score = min(1.0, contrast / 0.6)

    aspect = length_m / width_m
    if aspect < 0.5:
        aspect_score = aspect / 0.5
    elif aspect <= 3.0:
        aspect_score = 1.0
    else:
        aspect_score = max(0.0, 1.0 - (aspect - 3.0) / (MAX_ELONGATION - 3.0))

    length_score = 1.0
    if length_m > MAX_SHADOW_LENGTH_M / 2.0:
        length_score = max(0.0, 1.0 - (length_m - MAX_SHADOW_LENGTH_M / 2.0) / (MAX_SHADOW_LENGTH_M / 2.0))

    fill_score = min(1.0, fill_ratio / 0.7)
    confidence = 0.4 * contrast_score + 0.2 * aspect_score + 0.2 * length_score + 0.2 * fill_score
    return round(float(min(1.0, max(0.0, confidence))), 2)




# ---------------------------------------------------------------- public entry points


def detect_rocks_in_image(image, cell_size_m, sun):
    """Detect rocks in a brightness image (north up, x east, z south). Returns a list of rock dicts, no ids."""
    shadow_mask, median_image = find_shadow_mask(image)
    labels = measure.label(shadow_mask, connectivity=2)
    del shadow_mask
    rocks = []
    for region in measure.regionprops(labels):
        if region.area < MIN_SHADOW_AREA_PX:
            continue
        rock = _shadow_to_rock(region, median_image, image, sun["sun_azimuth_deg"], sun["sun_incidence_deg"], cell_size_m)
        if rock is not None:
            rocks.append(rock)
    return rocks


def detect_rocks(export_grid):
    """Detect rocks from the HiRISE orthoimage. Returns (rocks, sun).

    rocks follows docs/contracts.md 3.11 (ids rock_00001 and up, local grid metres, only rocks of
    at least 1 m diameter and inside the grid extent). sun is {"sun_azimuth_deg", "sun_incidence_deg"}.
    """
    sun = sun_geometry()
    fine_grid = grid_module.make_grid(ORTHO_CELL_SIZE_M)
    image = grid_module.read_onto_grid(settings.ORTHO_PATH, fine_grid, resampling=Resampling.average)
    image = image.astype("float32")

    raw_rocks = detect_rocks_in_image(image, fine_grid.cell_size_m, sun)
    del image

    extent_x_m = export_grid.width_m
    extent_z_m = export_grid.height_m
    rocks = []
    for raw in sorted(raw_rocks, key=lambda item: (item["z_m"], item["x_m"])):
        inside = 0.0 <= raw["x_m"] <= extent_x_m and 0.0 <= raw["z_m"] <= extent_z_m
        if not inside:
            continue
        rock = {
            "rock_id": f"rock_{len(rocks) + 1:05d}",
            "x_m": round(raw["x_m"], 2),
            "z_m": round(raw["z_m"], 2),
            "diameter_m": round(raw["diameter_m"], 2),
            "height_m": round(raw["height_m"], 2),
            "detection_method": "shadow_based",
            "confidence": raw["confidence"],
            "provenance": {
                "source_dataset": "HiRISE orthoimage",
                "product_id": settings.ORTHO_PRODUCT_ID,
                "resolution_m": ORTHO_CELL_SIZE_M,
                "is_estimate": True,
                "uncertainty": UNCERTAINTY_TEXT,
            },
        }
        rocks.append(rock)
    return rocks, sun
