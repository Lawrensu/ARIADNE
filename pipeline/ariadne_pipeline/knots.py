"""knots.json: the five science waypoints (contracts.md 3.12, decision D-023).

Positions come from settings.KNOTS (Curiosity stops). Text and photos come from
pipeline/content/knots_content.json. Measurements are read from the terrain layers.
"""

import json
import math

import numpy as np

from ariadne_pipeline import grid as local_grid
from ariadne_pipeline import settings




# ---------------------------------------------------------------- content

CONTENT_PATH = settings.REPO_ROOT / "pipeline" / "content" / "knots_content.json"
SNAP_SEARCH_RADIUS_M = 20.0


def load_content():
    with open(CONTENT_PATH, encoding="utf-8") as handle:
        content = json.load(handle)
    return {entry["knot_id"]: entry for entry in content}




# ---------------------------------------------------------------- placing a Knot on walkable ground


def snap_to_reachable_cell(export_grid, row, col, return_seconds, penalty_grid):
    """Nearest cell (within 20 m) that is passable and reachable. Returns (row, col, moved_m)."""
    if np.isfinite(return_seconds[row, col]) and np.isfinite(penalty_grid[row, col]):
        return row, col, 0.0

    radius_cells = int(math.ceil(SNAP_SEARCH_RADIUS_M / export_grid.cell_size_m))
    best = None
    for row_offset in range(-radius_cells, radius_cells + 1):
        for col_offset in range(-radius_cells, radius_cells + 1):
            candidate_row = row + row_offset
            candidate_col = col + col_offset
            inside = 0 <= candidate_row < export_grid.height and 0 <= candidate_col < export_grid.width
            if not inside:
                continue
            usable = np.isfinite(return_seconds[candidate_row, candidate_col]) and np.isfinite(penalty_grid[candidate_row, candidate_col])
            if not usable:
                continue
            distance_m = math.hypot(row_offset, col_offset) * export_grid.cell_size_m
            if distance_m > SNAP_SEARCH_RADIUS_M:
                continue
            if best is None or distance_m < best[2]:
                best = (candidate_row, candidate_col, distance_m)
    if best is None:
        raise ValueError(f"No walkable cell within {SNAP_SEARCH_RADIUS_M} m of row {row}, col {col}")
    return best




# ---------------------------------------------------------------- measurements with provenance


def dtm_provenance(is_estimate):
    return {
        "source_dataset": "HiRISE DTM",
        "product_id": settings.DTM_PRODUCT_ID,
        "resolution_m": 1.0117,
        "is_estimate": is_estimate,
    }


def terrain_measurements(layers, return_seconds, row, col):
    walk_back_minutes = return_seconds[row, col] / 60.0
    return [
        {"label": "Elevation", "value": round(float(layers["heightmap"][row, col]), 1), "unit": "metres", "provenance": dtm_provenance(False)},
        {"label": "Slope", "value": round(float(layers["slope_degrees"][row, col]), 1), "unit": "degrees", "provenance": dtm_provenance(True)},
        {
            "label": "Walk back to rover",
            "value": round(float(walk_back_minutes), 1),
            "unit": "minutes",
            "provenance": {
                "source_dataset": "ARIADNE walking model (contracts.md 4)",
                "product_id": settings.DTM_PRODUCT_ID,
                "resolution_m": settings.EXPORT_CELL_SIZE_M,
                "is_estimate": True,
                "uncertainty": "walking speed is an estimate (suit factor 0.6, no gravity correction)",
            },
        },
    ]


def content_measurements(entry):
    measurements = []
    for extra in entry.get("extra_measurements", []):
        measurements.append({
            "label": extra["label"],
            "value": extra["value"],
            "unit": extra.get("unit", ""),
            "provenance": {
                "source_dataset": extra.get("source_dataset", "NASA/JPL Curiosity mission"),
                "product_id": extra.get("product_id", extra.get("source_url", "")),
                "is_estimate": "est." in str(extra["value"]),
            },
        })
    return measurements




# ---------------------------------------------------------------- science tasks (contracts.md 3.12, v1.1.0)


def science_tasks(entry):
    """Science tasks at a Knot, with provenance. Durations and masses are estimates."""
    tasks = []
    for task in entry.get("science_tasks", []):
        tasks.append({
            "task_id": task["task_id"],
            "label": task["label"],
            "task_type": task["task_type"],
            "duration_minutes": task["duration_minutes"],
            "sample_mass_kg": task["sample_mass_kg"],
            "equipment": list(task["equipment"]),
            "provenance": {
                "source_dataset": "ARIADNE science plan (Apollo and analog EVA practice)",
                "product_id": task.get("basis_url", ""),
                "is_estimate": True,
                "uncertainty": task.get("basis_note", "duration and mass are planning estimates"),
            },
        })
    return tasks




# ---------------------------------------------------------------- knots.json


def build_knots(export_grid, layers, return_seconds, penalty_grid):
    content = load_content()
    knots = []
    for knot in settings.KNOTS:
        entry = content[knot["knot_id"]]
        x_m, z_m = local_grid.latlon_to_xz(knot["latitude_deg"], knot["longitude_deg"])
        row, col = local_grid.xz_to_rowcol(export_grid, x_m, z_m)
        row, col, moved_m = snap_to_reachable_cell(export_grid, row, col, return_seconds, penalty_grid)
        x_m, z_m = local_grid.rowcol_to_xz(export_grid, row, col)
        latitude_deg, longitude_deg = local_grid.xz_to_latlon(x_m, z_m)

        photos = []
        for photo in entry.get("photos", []):
            photos.append({
                "url": photo["url"],
                "sol": photo["sol"],
                "camera": photo["camera"],
                "caption": photo["caption"],
                "credit": photo["credit"],
            })

        knots.append({
            "knot_id": knot["knot_id"],
            "name": entry.get("name", knot["name"]),
            "x_m": round(x_m, 2),
            "z_m": round(z_m, 2),
            "latitude_deg": round(latitude_deg, 6),
            "longitude_deg": round(longitude_deg, 6),
            "science_rationale": entry["science_rationale"],
            "measurements": terrain_measurements(layers, return_seconds, row, col) + content_measurements(entry),
            "photos": photos,
            "science_tasks": science_tasks(entry),
        })
        if moved_m > 0:
            print(f"  {knot['knot_id']} moved {moved_m:.1f} m to the nearest walkable cell")
    return knots
