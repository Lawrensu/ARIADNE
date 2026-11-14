"""traversal_penalty: how hard each cell is to walk on (contracts.md 3.5)."""

import numpy as np

from ariadne_pipeline import settings




# ---------------------------------------------------------------- rocks to cells


def rock_blocked_cells(rocks, export_grid):
    """True where a rock of 1.5 m or more (plus clearance) covers the cell centre."""
    blocked = np.zeros((export_grid.height, export_grid.width), dtype=bool)
    cell = export_grid.cell_size_m
    for rock in rocks:
        if rock["diameter_m"] < settings.ROCK_IMPASSABLE_DIAMETER_M:
            continue
        reach_m = rock["diameter_m"] / 2.0 + settings.ROCK_CLEARANCE_M
        col_min = max(0, int(np.floor((rock["x_m"] - reach_m) / cell)))
        col_max = min(export_grid.width - 1, int(np.floor((rock["x_m"] + reach_m) / cell)))
        row_min = max(0, int(np.floor((rock["z_m"] - reach_m) / cell)))
        row_max = min(export_grid.height - 1, int(np.floor((rock["z_m"] + reach_m) / cell)))
        for row in range(row_min, row_max + 1):
            for col in range(col_min, col_max + 1):
                centre_x = (col + 0.5) * cell
                centre_z = (row + 0.5) * cell
                distance = np.hypot(centre_x - rock["x_m"], centre_z - rock["z_m"])
                if distance <= reach_m:
                    blocked[row, col] = True
        # A rock smaller than one cell still blocks the cell it sits in.
        rock_row = min(export_grid.height - 1, int(rock["z_m"] // cell))
        rock_col = min(export_grid.width - 1, int(rock["x_m"] // cell))
        blocked[rock_row, rock_col] = True
    return blocked




# ---------------------------------------------------------------- the penalty layer


def build_traversal_penalty(slope_degrees, roughness_m, soft_sand, rocks, export_grid):
    penalty = np.ones(slope_degrees.shape, dtype="float64")

    too_steep = slope_degrees > settings.MAX_WALKABLE_SLOPE_DEG
    too_rough = roughness_m > settings.ROUGHNESS_IMPASSABLE_M
    rough = (roughness_m > settings.ROUGHNESS_ROUGH_M) & ~too_rough
    blocked_by_rock = rock_blocked_cells(rocks, export_grid)
    no_data = np.isnan(slope_degrees) | np.isnan(roughness_m)

    penalty = np.where(rough, penalty * settings.ROUGHNESS_ROUGH_FACTOR, penalty)
    penalty = np.where(soft_sand, penalty * settings.SAND_FACTOR, penalty)

    impassable = too_steep | too_rough | blocked_by_rock | no_data
    penalty = np.where(impassable, np.inf, penalty)

    summary = {
        "cells_total": int(penalty.size),
        "cells_too_steep": int(too_steep.sum()),
        "cells_too_rough": int(too_rough.sum()),
        "cells_rough": int(rough.sum()),
        "cells_soft_sand": int(soft_sand.sum()),
        "cells_blocked_by_rock": int(blocked_by_rock.sum()),
        "cells_impassable": int(impassable.sum()),
    }
    return penalty, summary
