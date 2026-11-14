"""Walking-time function: the 8 contract test vectors (docs/contracts.md 4.5)."""

import math
import sys
from pathlib import Path

import numpy as np
import pytest

PIPELINE_DIR = Path(__file__).resolve().parents[1]
if str(PIPELINE_DIR) not in sys.path:
    sys.path.insert(0, str(PIPELINE_DIR))

from ariadne_pipeline.walking import (
    TEST_TOLERANCE_SECONDS,
    walking_time_seconds,
    walking_time_seconds_array,
)

CONTRACT_VECTORS = [
    (1.0, 0.0, 1.1912),
    (1.0, 0.1, 1.6905),
    (1.0, -0.1, 1.1912),
    (1.0, 0.5, math.inf),
    (1.0, -0.5, math.inf),
    (1.4142135623730951, 0.0, 1.6847),
    (10.0, 2.0, 23.9888),
    (10.0, -2.0, 16.9046),
]


@pytest.mark.parametrize("distance,elevation_change,expected", CONTRACT_VECTORS)
def test_contract_vector(distance, elevation_change, expected):
    actual = walking_time_seconds(distance, elevation_change)
    if math.isinf(expected):
        assert actual == math.inf
    else:
        assert abs(actual - expected) <= TEST_TOLERANCE_SECONDS


def test_array_version_matches_scalar_version():
    distances = np.array([row[0] for row in CONTRACT_VECTORS])
    elevation_changes = np.array([row[1] for row in CONTRACT_VECTORS])
    array_result = walking_time_seconds_array(distances, elevation_changes)
    for index, (distance, elevation_change, _) in enumerate(CONTRACT_VECTORS):
        scalar_result = walking_time_seconds(distance, elevation_change)
        if math.isinf(scalar_result):
            assert array_result[index] == math.inf
        else:
            assert array_result[index] == pytest.approx(scalar_result, abs=1e-9)
