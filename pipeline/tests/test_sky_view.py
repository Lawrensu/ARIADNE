"""Tests for sky-view factor, rover viewshed and shelters on synthetic terrain."""

import numpy as np

from ariadne_pipeline import sky_view
from ariadne_pipeline.grid import LocalGrid


CELL_SIZE_M = 2.0


def make_test_grid(height, width):
    return LocalGrid(cell_size_m=CELL_SIZE_M, width=width, height=height, origin_x_projected=0.0, origin_y_projected=0.0)




# ---------------------------------------------------------------- sky-view factor


def test_flat_plane_has_open_sky_everywhere():
    heightmap = np.full((80, 90), 100.0)
    result = sky_view.compute_sky_view_factor(heightmap, CELL_SIZE_M, max_distance_m=100.0)
    assert result.dtype == np.float32
    assert np.allclose(result, 1.0, atol=1e-6)


def test_tall_wall_lowers_sky_view_next_to_it():
    heightmap = np.zeros((100, 100))
    heightmap[:, 50] = 40.0
    result = sky_view.compute_sky_view_factor(heightmap, CELL_SIZE_M, max_distance_m=100.0)
    next_to_wall = result[50, 49]
    far_from_wall = result[50, 5]
    assert next_to_wall < 0.7
    assert far_from_wall > next_to_wall + 0.15
    assert result.min() >= 0.0 and result.max() <= 1.0


def test_nan_height_gives_nan_result():
    heightmap = np.zeros((40, 40))
    heightmap[10, 10] = np.nan
    result = sky_view.compute_sky_view_factor(heightmap, CELL_SIZE_M, max_distance_m=50.0)
    assert np.isnan(result[10, 10])
    assert not np.isnan(result[20, 20])




# ---------------------------------------------------------------- viewshed


def test_flat_plane_viewshed_is_all_visible():
    heightmap = np.zeros((60, 70))
    result = sky_view.compute_rover_viewshed(heightmap, CELL_SIZE_M, 30, 35, 3.0, 1.8)
    assert result.dtype == np.uint8
    assert result.min() == 1


def test_wall_blocks_view_behind_it():
    heightmap = np.zeros((101, 101))
    heightmap[:, 60:62] = 30.0
    result = sky_view.compute_rover_viewshed(heightmap, CELL_SIZE_M, 50, 30, 3.0, 1.8)
    assert result[50, 30] == 1
    assert result[50, 50] == 1
    assert result[50, 80] == 0
    assert result[20, 90] == 0
    assert result[50, 62:].sum() == 0 or result[50, 90] == 0




# ---------------------------------------------------------------- shelters


def test_shelters_respect_spacing_passability_and_threshold():
    height, width = 100, 100
    export_grid = make_test_grid(height, width)
    svf = np.full((height, width), 0.9, dtype=np.float32)
    penalty = np.ones((height, width))
    return_field = np.full((height, width), 100.0)

    svf[10, 10] = 0.30
    svf[10, 12] = 0.31
    svf[60, 60] = 0.40
    svf[80, 20] = 0.20
    penalty[80, 20] = np.inf
    svf[20, 80] = 0.50
    return_field[20, 80] = np.inf
    svf[90, 90] = 0.80

    shelters = sky_view.find_overhang_shelters(svf, penalty, return_field, export_grid, max_shelters=5, min_spacing_m=100.0)

    assert [s["shelter_id"] for s in shelters] == ["shelter_overhang_01", "shelter_overhang_02"]
    assert shelters[0]["sky_view_factor"] == 0.3
    assert shelters[0]["x_m"] == 21.0 and shelters[0]["z_m"] == 21.0
    assert shelters[1]["sky_view_factor"] == 0.4
    for shelter in shelters:
        assert shelter["shelter_type"] == "terrain_overhang"
        assert shelter["is_estimate"] is True


def test_no_candidates_gives_empty_list_and_reports_minimum():
    export_grid = make_test_grid(20, 20)
    svf = np.full((20, 20), 0.9, dtype=np.float32)
    penalty = np.ones((20, 20))
    return_field = np.full((20, 20), 10.0)
    assert sky_view.find_overhang_shelters(svf, penalty, return_field, export_grid) == []
    assert abs(sky_view.minimum_reachable_sky_view_factor(svf, penalty, return_field) - 0.9) < 1e-6


def test_rover_shelter_entry():
    export_grid = make_test_grid(20, 20)
    svf = np.ones((20, 20), dtype=np.float32)
    entry = sky_view.rover_shelter(export_grid, 5, 7, svf)
    assert entry["shelter_id"] == "shelter_rover"
    assert entry["shelter_type"] == "pressurised_rover"
    assert entry["x_m"] == 15.0 and entry["z_m"] == 11.0
    assert entry["is_estimate"] is False
