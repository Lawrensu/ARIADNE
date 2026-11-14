"""ARIADNE Stage 1: run the whole pipeline and write data/processed.

Usage (from pipeline/):  uv run python run.py
Then check it:           uv run python validate/run.py
"""

import time

import numpy as np

from ariadne_pipeline import environment
from ariadne_pipeline import export
from ariadne_pipeline import grid as local_grid
from ariadne_pipeline import knots
from ariadne_pipeline import penalty
from ariadne_pipeline import regional
from ariadne_pipeline import return_field
from ariadne_pipeline import rocks
from ariadne_pipeline import settings
from ariadne_pipeline import sky_view
from ariadne_pipeline import surface
from ariadne_pipeline import terrain
from ariadne_pipeline import walking




# ---------------------------------------------------------------- helpers


def log_step(message):
    print(f"[{time.strftime('%H:%M:%S')}] {message}", flush=True)


MINIMUM_ROCK_CONFIDENCE = 0.6
DTM_SOURCE = "HiRISE DTM"
ORTHO_SOURCE = "HiRISE orthoimage"




# ---------------------------------------------------------------- pipeline


def main():
    failures = walking.check_test_vectors()
    if failures:
        raise SystemExit("Walking test vectors fail: " + "; ".join(failures))
    settings.PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    log_step("Grids")
    export_grid = local_grid.export_grid()
    compute_grid = local_grid.compute_grid()
    staging_x_m, staging_z_m = local_grid.latlon_to_xz(settings.STAGING_POINT_LAT, settings.STAGING_POINT_LON)
    staging_row, staging_col = local_grid.xz_to_rowcol(export_grid, staging_x_m, staging_z_m)
    staging_x_m, staging_z_m = local_grid.rowcol_to_xz(export_grid, staging_row, staging_col)

    log_step("Terrain: heightmap, slope, roughness, soft sand")
    layers = terrain.build_terrain_layers(compute_grid, export_grid)

    log_step("Rocks (shadow-based)")
    detected_rocks, sun = rocks.detect_rocks(export_grid)
    # Low-confidence detections are mostly steep terrain edges, not boulders. With this filter,
    # none of Curiosity's 203 stops in the patch falls on a rock-blocked cell (see docs/log/person_a.md).
    rock_list = [rock for rock in detected_rocks if rock["confidence"] >= MINIMUM_ROCK_CONFIDENCE]
    log_step(f"  {len(rock_list)} of {len(detected_rocks)} detections kept (confidence >= {MINIMUM_ROCK_CONFIDENCE})")

    log_step("Traversal penalty")
    penalty_grid, penalty_summary = penalty.build_traversal_penalty(
        layers["slope_degrees"], layers["roughness_m"], layers["soft_sand"], rock_list, export_grid
    )
    penalty_grid[staging_row, staging_col] = 1.0
    log_step(f"  {penalty_summary}")

    log_step("Return field (Dijkstra from the staging point)")
    return_seconds = return_field.build_return_field(
        layers["heightmap"], penalty_grid, export_grid.cell_size_m, staging_row, staging_col
    )

    log_step("Sky-view factor, rover viewshed, shelters")
    sky_view_factor = sky_view.compute_sky_view_factor(layers["heightmap"], export_grid.cell_size_m)
    viewshed = sky_view.compute_rover_viewshed(
        layers["heightmap"], export_grid.cell_size_m, staging_row, staging_col,
        settings.ROVER_ANTENNA_HEIGHT_M, settings.HELMET_HEIGHT_M,
    )
    shelters = [sky_view.rover_shelter(export_grid, staging_row, staging_col, sky_view_factor)]
    shelters += sky_view.find_overhang_shelters(sky_view_factor, penalty_grid, return_seconds, export_grid)

    log_step("Thermal inertia (THEMIS) and mineralogy (CRISM)")
    thermal_inertia, thermal_layer = surface.build_thermal_inertia(export_grid)
    mineralogy, mineralogy_classes, mineralogy_layer = surface.build_mineralogy(export_grid)

    log_step("Knots")
    knot_list = knots.build_knots(export_grid, layers, return_seconds, penalty_grid)

    log_step("Environment timeline (REMS and RAD replay)")
    timeline = environment.build_environment_timeline()

    log_step("Texture and Gale regional image")
    texture_size = export.write_texture(export_grid)
    regional_cache = regional.cache_source_crop()
    regional_context, regional_source = regional.build_regional_context(
        settings.PROCESSED_DIR / "gale_context.jpg", source_path=str(regional_cache)
    )

    log_step("Writing files")
    export.write_float32_grid(layers["heightmap"], "heightmap.bin")
    export.write_float32_grid(layers["slope_degrees"], "slope_degrees.bin")
    export.write_float32_grid(layers["roughness_m"], "roughness_m.bin")
    export.write_float32_grid(penalty_grid, "traversal_penalty.bin")
    export.write_float32_grid(return_seconds, "return_field.bin")
    export.write_float32_grid(sky_view_factor, "sky_view_factor.bin")
    export.write_float32_grid(thermal_inertia, "thermal_inertia.bin")
    export.write_uint8_grid(mineralogy, "mineralogy_class.bin")
    export.write_uint8_grid(viewshed, "viewshed_rover.bin")
    export.write_json(rock_list, "rocks.json")
    export.write_json(knot_list, "knots.json")
    export.write_json(shelters, "shelters.json")
    export.write_json(timeline, "environment_timeline.json")

    dtm_resolution = 1.0117
    layer_registry = [
        export.layer_entry("heightmap", "heightmap.bin", "float32", "metres", DTM_SOURCE, settings.DTM_PRODUCT_ID, dtm_resolution, False,
                           "Elevation above the Mars areoid, mean of the 1 m DTM per 2 m cell."),
        export.layer_entry("slope_degrees", "slope_degrees.bin", "float32", "degrees", DTM_SOURCE, settings.DTM_PRODUCT_ID, dtm_resolution, True,
                           "Slope from central differences on the 2 m heightmap."),
        export.layer_entry("roughness_m", "roughness_m.bin", "float32", "metres", DTM_SOURCE, settings.DTM_PRODUCT_ID, dtm_resolution, True,
                           "Local height variation (5 m window, 1 m DTM), maximum per 2 m cell."),
        export.layer_entry("traversal_penalty", "traversal_penalty.bin", "float32", "dimensionless", "ARIADNE penalty rules (contracts.md 3.5)",
                           settings.DTM_PRODUCT_ID + " + " + settings.ORTHO_PRODUCT_ID, dtm_resolution, True,
                           "Walking cost multiplier; +Infinity is impassable."),
        export.layer_entry("return_field", "return_field.bin", "float32", "seconds", "ARIADNE walking model (contracts.md 4)",
                           settings.DTM_PRODUCT_ID, dtm_resolution, True,
                           "Seconds to walk back to the staging point; +Infinity is unreachable."),
        export.layer_entry("sky_view_factor", "sky_view_factor.bin", "float32", "dimensionless", DTM_SOURCE, settings.DTM_PRODUCT_ID, dtm_resolution, True,
                           "Open-sky fraction; proxy for relative cosmic ray exposure."),
        export.layer_entry("viewshed_rover", "viewshed_rover.bin", "uint8", "dimensionless", DTM_SOURCE, settings.DTM_PRODUCT_ID, dtm_resolution, True,
                           "1 = line of sight to the rover antenna, 0 = comms dead zone."),
        thermal_layer,
        mineralogy_layer,
    ]
    sources = [
        {"source_dataset": DTM_SOURCE, "product_id": settings.DTM_PRODUCT_ID, "url": settings.HIRISE_DTM_URL, "licence_credit": settings.HIRISE_CREDIT},
        {"source_dataset": ORTHO_SOURCE, "product_id": settings.ORTHO_PRODUCT_ID, "url": settings.HIRISE_DTM_URL, "licence_credit": settings.HIRISE_CREDIT},
        {"source_dataset": thermal_layer["source_dataset"], "product_id": thermal_layer["product_id"], "url": surface.THERMAL_URL, "licence_credit": surface.THERMAL_CREDIT},
        {"source_dataset": mineralogy_layer["source_dataset"], "product_id": mineralogy_layer["product_id"], "url": surface.MINERALOGY_URL, "licence_credit": surface.MINERALOGY_CREDIT},
        {"source_dataset": regional_source["source_dataset"], "product_id": regional_source["product_id"], "url": regional_source["url"], "licence_credit": regional_source["licence_credit"]},
    ]
    sources += environment.SOURCES
    meta = export.build_meta(
        export_grid, staging_x_m, staging_z_m, texture_size, sun, layer_registry,
        mineralogy_classes, sources, regional_context,
    )
    export.write_json(meta, "meta.json")

    reachable_percent = 100.0 * np.isfinite(return_seconds).mean()
    log_step(f"Done. {len(rock_list)} rocks, {len(shelters)} shelters, {len(knot_list)} Knots, {reachable_percent:.1f}% of cells reachable.")


if __name__ == "__main__":
    main()
