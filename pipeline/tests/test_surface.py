"""Tests for the mineralogy classification on synthetic parameter maps."""

import sys
from pathlib import Path

import numpy as np
from rasterio.transform import Affine

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ariadne_pipeline import grid as local_grid
from ariadne_pipeline import surface


def _background_parameters(size=40):
    generator = np.random.default_rng(3)
    return {name: generator.normal(0.0, 0.01, size=(size, size)) for name in surface.ALL_BANDS}


def test_clean_background_is_mostly_none_detected():
    classes = surface.classify_parameters(_background_parameters())
    assert (classes == surface.CLASS_NONE_DETECTED).mean() > 0.9


def test_single_strong_band_picks_its_class():
    parameters = _background_parameters()
    parameters["BD860_2"][5, 5] = 0.5
    classes = surface.classify_parameters(parameters)
    assert classes[5, 5] == surface.CLASS_HEMATITE


def test_highest_z_wins():
    parameters = _background_parameters()
    parameters["D2300"][10, 10] = 0.2
    parameters["SINDEX2"][10, 10] = 0.5
    parameters["D2300"][11, 11] = 0.5
    parameters["SINDEX2"][11, 11] = 0.2
    classes = surface.classify_parameters(parameters)
    assert classes[10, 10] == surface.CLASS_SULFATE
    assert classes[11, 11] == surface.CLASS_CLAY


def test_nodata_in_any_band_stays_zero():
    parameters = _background_parameters()
    parameters["BD2500_2"][7, 7] = np.nan
    parameters["D2300"][7, 7] = 0.5
    classes = surface.classify_parameters(parameters)
    assert classes[7, 7] == surface.CLASS_NO_DATA


def test_negative_raw_value_never_fires():
    parameters = {name: np.random.default_rng(0).normal(-0.5, 0.001, size=(40, 40)) for name in surface.ALL_BANDS}
    parameters["D2300"][3, 3] = -0.3
    classes = surface.classify_parameters(parameters)
    assert classes[3, 3] == surface.CLASS_NONE_DETECTED


def test_nearest_resampling_keeps_classes_intact():
    export_grid = local_grid.export_grid()
    source_cell_m = 18.0
    source_transform = Affine(
        source_cell_m, 0.0, export_grid.origin_x_projected,
        0.0, -source_cell_m, export_grid.origin_y_projected,
    )
    pattern = np.array([[1, 2, 3], [4, 5, 1], [2, 3, 4]], dtype="uint8")
    classes = np.tile(pattern, (40, 40))
    warped = surface.warp_classes_to_grid(classes, source_transform, local_grid.LOCAL_CRS, export_grid)
    assert warped.dtype == np.uint8
    assert set(np.unique(warped)) <= {0, 1, 2, 3, 4, 5}
    inside = warped[: 9 * 9, : 9 * 9]
    assert (inside != 0).all()
    assert set(np.unique(inside)) == {1, 2, 3, 4, 5}
