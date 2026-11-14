"""The shared walking-time function (docs/contracts.md section 4).

The TypeScript version in the app must give the same results for the test vectors.
"""

import math

import numpy as np

from ariadne_pipeline import settings




# ---------------------------------------------------------------- scalar version (the reference)


def walking_time_seconds(horizontal_distance_m, elevation_change_m):
    """Seconds to walk one step on ground with penalty 1. +Infinity if the step is too steep."""
    slope_ratio = elevation_change_m / horizontal_distance_m
    slope_degrees = math.degrees(math.atan(abs(slope_ratio)))
    if slope_degrees > settings.MAX_WALKABLE_SLOPE_DEG:
        return math.inf

    speed_kmh = 6.0 * math.exp(-3.5 * abs(slope_ratio + 0.05))
    speed_kmh = speed_kmh * settings.SUIT_SPEED_FACTOR * settings.GRAVITY_ADJUSTMENT
    speed_m_per_s = speed_kmh / 3.6
    return horizontal_distance_m / speed_m_per_s




# ---------------------------------------------------------------- array version (same maths, for whole grids)


def walking_time_seconds_array(horizontal_distance_m, elevation_change_m):
    slope_ratio = elevation_change_m / horizontal_distance_m
    slope_degrees = np.degrees(np.arctan(np.abs(slope_ratio)))
    speed_kmh = 6.0 * np.exp(-3.5 * np.abs(slope_ratio + 0.05))
    speed_kmh = speed_kmh * settings.SUIT_SPEED_FACTOR * settings.GRAVITY_ADJUSTMENT
    seconds = horizontal_distance_m / (speed_kmh / 3.6)
    too_steep = slope_degrees > settings.MAX_WALKABLE_SLOPE_DEG
    seconds = np.where(too_steep, np.inf, seconds)
    return seconds




# ---------------------------------------------------------------- test vectors (contracts.md 4.5)

TEST_VECTORS = [
    (1.0, 0.0, 1.1912),
    (1.0, 0.1, 1.6905),
    (1.0, -0.1, 1.1912),
    (1.0, 0.5, math.inf),
    (1.0, -0.5, math.inf),
    (1.4142135623730951, 0.0, 1.6847),
    (10.0, 2.0, 23.9888),
    (10.0, -2.0, 16.9046),
]
TEST_TOLERANCE_SECONDS = 1e-3


def check_test_vectors():
    """Returns a list of failure messages. Empty list means all rows pass."""
    failures = []
    for row_number, (distance, elevation_change, expected) in enumerate(TEST_VECTORS, start=1):
        actual = walking_time_seconds(distance, elevation_change)
        if math.isinf(expected):
            if not math.isinf(actual):
                failures.append(f"row {row_number}: expected +Infinity, got {actual}")
        else:
            if abs(actual - expected) > TEST_TOLERANCE_SECONDS:
                failures.append(f"row {row_number}: expected {expected}, got {actual:.4f}")
    return failures
