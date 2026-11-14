"""Sky-view factor, rover viewshed and terrain-overhang shelters (contracts.md 3.7, 3.13, 3.16)."""

import numpy as np

from ariadne_pipeline import grid as grid_module
from ariadne_pipeline import settings




# ---------------------------------------------------------------- sky-view factor


def horizon_step_distances_in_cells(cell_size_m, max_distance_m):
    """Distances (in cells) at which the horizon is sampled: every cell near, wider spacing far."""
    max_cells = int(np.floor(max_distance_m / cell_size_m))
    distances = []
    distance = 1
    while distance <= max_cells:
        distances.append(distance)
        if distance < 24:
            distance += 1
        else:
            distance += max(1, int(distance * 0.12))
    return distances


def compute_sky_view_factor(heightmap, cell_size_m, directions=16, max_distance_m=400.0):
    """Sky-view factor per cell as float32, 0 to 1 (1 = open sky).

    For each of `directions` compass directions, march outward up to `max_distance_m`
    and find the largest elevation angle to the terrain (the horizon angle), clipped at 0.
    Sky-view factor = mean over directions of (1 - sin(horizon_angle)).
    This is the standard approximation for a level surface.

    Samples sit on the nearest cell along each direction (no interpolation).
    Outside the grid counts as open sky (no obstruction), so cells near the edge of the
    patch are slightly overestimated. NaN heights are ignored as obstructions, and the
    result is NaN where the heightmap is NaN.
    """
    heights = heightmap.astype(np.float32)
    height, width = heights.shape
    step_distances = horizon_step_distances_in_cells(cell_size_m, max_distance_m)
    openness_sum = np.zeros((height, width), dtype=np.float32)

    for direction_index in range(directions):
        bearing = 2.0 * np.pi * direction_index / directions
        step_row = -np.cos(bearing)
        step_col = np.sin(bearing)
        highest_tangent = np.zeros((height, width), dtype=np.float32)

        for cells_away in step_distances:
            row_offset = int(round(step_row * cells_away))
            col_offset = int(round(step_col * cells_away))
            if row_offset == 0 and col_offset == 0:
                continue
            ground_distance_m = np.hypot(row_offset, col_offset) * cell_size_m

            rows_here = slice(max(0, -row_offset), height - max(0, row_offset))
            cols_here = slice(max(0, -col_offset), width - max(0, col_offset))
            rows_there = slice(max(0, row_offset), height - max(0, -row_offset))
            cols_there = slice(max(0, col_offset), width - max(0, -col_offset))
            if rows_here.start >= rows_here.stop or cols_here.start >= cols_here.stop:
                continue

            rise = heights[rows_there, cols_there] - heights[rows_here, cols_here]
            tangent = rise / np.float32(ground_distance_m)
            highest_here = highest_tangent[rows_here, cols_here]
            highest_tangent[rows_here, cols_here] = np.fmax(highest_here, tangent)

        horizon_angle = np.arctan(highest_tangent)
        openness_sum += 1.0 - np.sin(horizon_angle)

    result = (openness_sum / np.float32(directions)).astype(np.float32)
    result = np.clip(result, 0.0, 1.0)
    result[np.isnan(heights)] = np.nan
    return result




# ---------------------------------------------------------------- rover viewshed


def border_cells(height, width):
    """All (row, col) cells on the outer edge of a grid."""
    cells = []
    for col in range(width):
        cells.append((0, col))
        cells.append((height - 1, col))
    for row in range(1, height - 1):
        cells.append((row, 0))
        cells.append((row, width - 1))
    return cells


def compute_rover_viewshed(heightmap, cell_size_m, rover_row, rover_col, antenna_height_m, helmet_height_m):
    """uint8 grid: 1 where a helmet can see the rover antenna, 0 where terrain blocks the line.

    Radial sweep: one ray from the rover to every border cell, keeping the running maximum
    slope of the terrain seen from the antenna. A cell is visible when the slope to its
    helmet is at least that running maximum. Each cell takes the value of the ray that
    passes closest to its centre. Rover cell = 1. NaN terrain counts as not visible.
    """
    height, width = heightmap.shape
    heights = heightmap.astype(np.float64)
    antenna_z = heights[rover_row, rover_col] + antenna_height_m

    visible = np.zeros((height, width), dtype=np.uint8)
    best_error = np.full((height, width), np.inf)

    for target_row, target_col in border_cells(height, width):
        delta_row = target_row - rover_row
        delta_col = target_col - rover_col
        steps = max(abs(delta_row), abs(delta_col))
        if steps == 0:
            continue

        step_numbers = np.arange(1, steps + 1)
        exact_rows = rover_row + step_numbers * (delta_row / steps)
        exact_cols = rover_col + step_numbers * (delta_col / steps)
        rows = np.rint(exact_rows).astype(int)
        cols = np.rint(exact_cols).astype(int)
        error = np.hypot(exact_rows - rows, exact_cols - cols)

        distance_m = np.hypot(rows - rover_row, cols - rover_col) * cell_size_m
        ground = heights[rows, cols]
        terrain_slope = (ground - antenna_z) / distance_m
        helmet_slope = (ground + helmet_height_m - antenna_z) / distance_m

        blocking_before = np.maximum.accumulate(terrain_slope)
        blocking_before = np.concatenate(([-np.inf], blocking_before[:-1]))
        sees_rover = helmet_slope >= blocking_before
        sees_rover &= ~np.isnan(ground)

        closer = error < best_error[rows, cols]
        write_rows = rows[closer]
        write_cols = cols[closer]
        visible[write_rows, write_cols] = sees_rover[closer].astype(np.uint8)
        best_error[write_rows, write_cols] = error[closer]

    visible = fill_unreached_cells(visible, best_error)
    visible[rover_row, rover_col] = 1
    return visible


def fill_unreached_cells(visible, best_error):
    """Give cells that no ray touched the value of the nearest cell that a ray touched."""
    unreached = np.isinf(best_error)
    if not unreached.any():
        return visible
    from scipy.ndimage import distance_transform_edt
    _, nearest_rows_cols = distance_transform_edt(unreached, return_indices=True)
    nearest_rows, nearest_cols = nearest_rows_cols
    return visible[nearest_rows, nearest_cols]




# ---------------------------------------------------------------- shelters


def overhang_candidate_mask(sky_view_factor, penalty, return_field):
    """True where a cell is passable, reachable and shielded enough to count as an overhang."""
    passable = np.isfinite(penalty)
    reachable = np.isfinite(return_field)
    shielded = sky_view_factor < settings.OVERHANG_MAX_SKY_VIEW_FACTOR
    return passable & reachable & shielded


def minimum_reachable_sky_view_factor(sky_view_factor, penalty, return_field):
    """Lowest sky-view factor over passable, reachable cells (None if there are none)."""
    usable = np.isfinite(penalty) & np.isfinite(return_field) & ~np.isnan(sky_view_factor)
    if not usable.any():
        return None
    return float(sky_view_factor[usable].min())


def find_overhang_shelters(sky_view_factor, penalty, return_field, export_grid, max_shelters=5, min_spacing_m=100.0):
    """Terrain-overhang shelters as dicts (contracts.md 3.13); [] when no cell qualifies.

    Takes the lowest sky-view factors first, keeping each pick at least `min_spacing_m`
    from the ones already chosen. Use `minimum_reachable_sky_view_factor` to report how
    close the patch came to qualifying when the list is empty.
    """
    candidates = overhang_candidate_mask(sky_view_factor, penalty, return_field)
    candidate_rows, candidate_cols = np.nonzero(candidates)
    order = np.argsort(sky_view_factor[candidate_rows, candidate_cols], kind="stable")

    chosen = []
    for index in order:
        if len(chosen) >= max_shelters:
            break
        row = int(candidate_rows[index])
        col = int(candidate_cols[index])
        x_m, z_m = grid_module.rowcol_to_xz(export_grid, row, col)
        too_close = any(np.hypot(x_m - other["x_m"], z_m - other["z_m"]) < min_spacing_m for other in chosen)
        if too_close:
            continue
        chosen.append({
            "shelter_id": "shelter_overhang_%02d" % (len(chosen) + 1),
            "shelter_type": "terrain_overhang",
            "x_m": float(x_m),
            "z_m": float(z_m),
            "sky_view_factor": round(float(sky_view_factor[row, col]), 3),
            "is_estimate": True,
        })
    return chosen


def rover_shelter(export_grid, staging_row, staging_col, sky_view_factor):
    """The pressurised rover shelter at the staging point (contracts.md 3.13)."""
    x_m, z_m = grid_module.rowcol_to_xz(export_grid, staging_row, staging_col)
    return {
        "shelter_id": "shelter_rover",
        "shelter_type": "pressurised_rover",
        "x_m": float(x_m),
        "z_m": float(z_m),
        "sky_view_factor": round(float(sky_view_factor[staging_row, staging_col]), 3),
        "is_estimate": False,
    }
