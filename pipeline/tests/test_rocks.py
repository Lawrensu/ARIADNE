"""Tests for shadow-based rock detection on a synthetic image with known shadows."""

import math
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ariadne_pipeline import rocks


CELL_M = 0.25
SUN_FROM_WEST = {"sun_azimuth_deg": 270.0, "sun_incidence_deg": 60.0}


def _make_image(shadows):
    """Bright noisy ground, 60 m x 40 m, with dark rectangles given as (x0, z0, length_x, width_z) in metres."""
    generator = np.random.default_rng(1)
    height_px = int(40 / CELL_M)
    width_px = int(60 / CELL_M)
    image = 150.0 + generator.normal(0.0, 3.0, size=(height_px, width_px))
    for x0, z0, length, width in shadows:
        row0, row1 = int(z0 / CELL_M), int((z0 + width) / CELL_M)
        col0, col1 = int(x0 / CELL_M), int((x0 + length) / CELL_M)
        image[row0:row1, col0:col1] = 40.0
    return image.astype("float32")


def _nearest(found, x_m, z_m):
    return min(found, key=lambda rock: math.hypot(rock["x_m"] - x_m, rock["z_m"] - z_m))


def test_sun_geometry_matches_label():
    sun = rocks.sun_geometry()
    assert abs(sun["sun_azimuth_deg"] - 303.08) < 0.01
    assert abs(sun["sun_incidence_deg"] - 58.808) < 0.01


def test_known_shadows_become_rocks_with_right_size_and_position():
    # Sun from the west: shadows fall east of the rock, rock centre is half a diameter west of the shadow.
    image = _make_image([(20.0, 10.0, 4.0, 2.0), (40.0, 25.0, 3.0, 3.0)])
    found = rocks.detect_rocks_in_image(image, CELL_M, SUN_FROM_WEST)
    assert len(found) == 2

    first = _nearest(found, 19.0, 11.0)
    assert abs(first["x_m"] - 19.0) < 0.5
    assert abs(first["z_m"] - 11.0) < 0.5
    assert abs(first["diameter_m"] - 2.0) < 0.3
    expected_height = 4.0 * math.tan(math.radians(30.0))
    assert abs(first["height_m"] - expected_height) < 0.3
    assert 0.0 <= first["confidence"] <= 1.0

    second = _nearest(found, 38.5, 26.5)
    assert abs(second["diameter_m"] - 3.0) < 0.3


def test_ridge_shadow_and_tiny_shadow_are_dropped():
    image = _make_image([(10.0, 5.0, 25.0, 3.0), (30.0, 30.0, 0.5, 0.5)])
    found = rocks.detect_rocks_in_image(image, CELL_M, SUN_FROM_WEST)
    assert found == []


def test_flat_image_has_no_rocks():
    image = _make_image([])
    assert rocks.detect_rocks_in_image(image, CELL_M, SUN_FROM_WEST) == []
