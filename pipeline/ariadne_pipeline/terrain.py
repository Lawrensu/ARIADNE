"""Terrain layers from the HiRISE DTM: heightmap, slope, roughness, soft sand (contracts.md 3.2 to 3.5)."""

import numpy as np
from scipy import ndimage
from rasterio.warp import Resampling

from ariadne_pipeline import grid as local_grid
from ariadne_pipeline import settings




# ---------------------------------------------------------------- heights


def read_heights_1m(compute_grid):
    heights = local_grid.read_onto_grid(settings.DTM_PATH, compute_grid, resampling=Resampling.bilinear)
    return heights


def fill_small_gaps(heights):
    """Fill no-data cells with the nearest valid height. Returns (filled, number_of_filled_cells)."""
    missing = np.isnan(heights)
    filled_count = int(missing.sum())
    if filled_count == 0:
        return heights, 0
    nearest_index = ndimage.distance_transform_edt(missing, return_distances=False, return_indices=True)
    filled = heights[tuple(nearest_index)]
    return filled, filled_count




# ---------------------------------------------------------------- slope


def slope_degrees(heights, cell_size_m):
    """Central differences (numpy.gradient), as in contracts.md 3.3."""
    gradient_z, gradient_x = np.gradient(heights, cell_size_m)
    slope_ratio = np.hypot(gradient_x, gradient_z)
    return np.degrees(np.arctan(slope_ratio))




# ---------------------------------------------------------------- roughness and sand (1 m grid)


def smoothed_surface(heights_1m, cell_size_m):
    sigma_cells = settings.ROUGHNESS_SMOOTHING_SIGMA_M / cell_size_m
    return ndimage.gaussian_filter(heights_1m, sigma_cells, mode="nearest")


def roughness_1m(heights_1m, cell_size_m):
    """Standard deviation of (height minus smoothed surface) in a 5 m window."""
    residual = heights_1m - smoothed_surface(heights_1m, cell_size_m)
    window_cells = max(1, int(round(settings.ROUGHNESS_WINDOW_M / cell_size_m)))
    mean = ndimage.uniform_filter(residual, window_cells, mode="nearest")
    mean_of_squares = ndimage.uniform_filter(residual * residual, window_cells, mode="nearest")
    variance = np.clip(mean_of_squares - mean * mean, 0.0, None)
    return np.sqrt(variance)


def soft_sand_mask_1m(heights_1m, roughness, cell_size_m):
    """Likely sand fill: low spots below the smoothed surface that are also smooth (boxwork hollows)."""
    depth_below_surface = smoothed_surface(heights_1m, cell_size_m) - heights_1m
    is_low = depth_below_surface > settings.SAND_DEPTH_BELOW_SMOOTH_M
    is_smooth = roughness < settings.SAND_MAX_ROUGHNESS_M
    return is_low & is_smooth




# ---------------------------------------------------------------- all terrain layers at once


def build_terrain_layers(compute_grid, export_grid):
    """Returns a dict of export-grid arrays plus the 1 m heights for other steps."""
    factor = int(round(export_grid.cell_size_m / compute_grid.cell_size_m))

    heights_1m = read_heights_1m(compute_grid)
    heights_1m, filled_cells = fill_small_gaps(heights_1m)

    roughness_fine = roughness_1m(heights_1m, compute_grid.cell_size_m)
    sand_fine = soft_sand_mask_1m(heights_1m, roughness_fine, compute_grid.cell_size_m)

    heightmap = local_grid.block_reduce(heights_1m, factor, "mean")
    roughness = local_grid.block_reduce(roughness_fine, factor, "max")
    sand_fraction = local_grid.block_reduce(sand_fine.astype("float64"), factor, "mean")
    slope = slope_degrees(heightmap, export_grid.cell_size_m)

    return {
        "heights_1m": heights_1m,
        "heightmap": heightmap,
        "slope_degrees": slope,
        "roughness_m": roughness,
        "soft_sand": sand_fraction > 0.5,
        "filled_cells_1m": filled_cells,
    }
