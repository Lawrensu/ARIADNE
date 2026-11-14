"""Write the contract files into data/processed (contracts.md sections 2 and 3)."""

from datetime import datetime, timezone
import json
import subprocess

import numpy as np
from PIL import Image
from rasterio.warp import Resampling

from ariadne_pipeline import grid as local_grid
from ariadne_pipeline import settings




# ---------------------------------------------------------------- binary grids


def write_float32_grid(array, file_name):
    path = settings.PROCESSED_DIR / file_name
    array.astype("<f4").tofile(path)
    return path


def write_uint8_grid(array, file_name):
    path = settings.PROCESSED_DIR / file_name
    array.astype("u1").tofile(path)
    return path




# ---------------------------------------------------------------- JSON


def write_json(data, file_name):
    path = settings.PROCESSED_DIR / file_name
    with open(path, "w", encoding="utf-8", newline="\n") as handle:
        json.dump(data, handle, indent=2, ensure_ascii=False)
        handle.write("\n")
    return path




# ---------------------------------------------------------------- texture


def write_texture(export_grid):
    """HiRISE orthoimage on the grid extent, longer side at most 4096 px. Returns (width_px, height_px)."""
    longer_side_m = max(export_grid.width_m, export_grid.height_m)
    texture_cell_m = longer_side_m / settings.MAX_TEXTURE_PX
    texture_grid = local_grid.make_grid(texture_cell_m)
    image = local_grid.read_onto_grid(
        settings.ORTHO_PATH,
        texture_grid,
        resampling=Resampling.average,
        source_decimation=2,
    )
    image = np.nan_to_num(image, nan=0.0)
    image = np.clip(image, 0, 255).astype("uint8")
    Image.fromarray(image, mode="L").save(settings.PROCESSED_DIR / "texture_hirise.jpg", quality=90)
    return texture_grid.width, texture_grid.height




# ---------------------------------------------------------------- meta.json


def current_pipeline_commit():
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            cwd=settings.REPO_ROOT,
            capture_output=True,
            text=True,
            check=True,
        )
        return result.stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return "unknown"


def layer_entry(layer_id, file_name, dtype, unit, source_dataset, product_id, native_resolution_m, is_estimate, description):
    return {
        "layer_id": layer_id,
        "file": file_name,
        "dtype": dtype,
        "unit": unit,
        "source_dataset": source_dataset,
        "product_id": product_id,
        "native_resolution_m": native_resolution_m,
        "is_estimate": is_estimate,
        "description": description,
    }


def build_meta(export_grid, staging_x_m, staging_z_m, texture_size, sun, layers, mineralogy_classes, sources, regional_context):
    north_west_lat, north_west_lon = local_grid.xz_to_latlon(0.0, 0.0)
    south_east_lat, south_east_lon = local_grid.xz_to_latlon(export_grid.width_m, export_grid.height_m)
    meta = {
        "contract_version": settings.CONTRACT_VERSION,
        "generated_at_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "pipeline_commit": current_pipeline_commit(),
        "grid": {
            "width": export_grid.width,
            "height": export_grid.height,
            "cell_size_m": export_grid.cell_size_m,
        },
        "origin_northwest": {"latitude_deg": round(north_west_lat, 6), "longitude_deg": round(north_west_lon, 6)},
        "crs": settings.CRS_LABEL,
        "elevation_reference": settings.ELEVATION_REFERENCE,
        "bounds": {
            "width_m": export_grid.width_m,
            "height_m": export_grid.height_m,
            "south_east": {"latitude_deg": round(south_east_lat, 6), "longitude_deg": round(south_east_lon, 6)},
        },
        "staging_point": {"x_m": round(staging_x_m, 2), "z_m": round(staging_z_m, 2)},
        "texture": {"file": "texture_hirise.jpg", "width_px": texture_size[0], "height_px": texture_size[1]},
        "sun": sun,
        "layers": layers,
        "mineralogy_classes": mineralogy_classes,
        "sources": sources,
        "parameters": {
            "suit_speed_factor": settings.SUIT_SPEED_FACTOR,
            "gravity_adjustment": settings.GRAVITY_ADJUSTMENT,
            "max_walkable_slope_deg": settings.MAX_WALKABLE_SLOPE_DEG,
            "suit_capability_hours": settings.SUIT_CAPABILITY_HOURS,
            "planned_marswalk_hours": settings.PLANNED_MARSWALK_HOURS,
            "reserve_minutes": settings.RESERVE_MINUTES,
            "base_carried_load_kg": settings.BASE_CARRIED_LOAD_KG,
            "load_time_factor_per_kg": settings.LOAD_TIME_FACTOR_PER_KG,
        },
    }
    if regional_context is not None:
        meta["regional_context"] = regional_context
    return meta
