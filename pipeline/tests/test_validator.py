"""The contract validator: a tiny valid processed folder passes, and each single break fails clearly."""

import copy
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

PIPELINE_DIR = Path(__file__).resolve().parents[1]
if str(PIPELINE_DIR) not in sys.path:
    sys.path.insert(0, str(PIPELINE_DIR))

from ariadne_pipeline import settings
from validate.run import BINARY_LAYER_FILES, read_contract_version, run_validation

GRID_WIDTH = 4
GRID_HEIGHT = 3
CELL_SIZE_M = 2.0


def provenance(is_estimate=True):
    return {"source_dataset": "HiRISE DTM", "product_id": "TEST_ID", "is_estimate": is_estimate}


def build_meta():
    layers = []
    for file_name, dtype_name in BINARY_LAYER_FILES.items():
        layers.append({
            "layer_id": file_name.replace(".bin", ""),
            "file": file_name,
            "dtype": dtype_name,
            "unit": "dimensionless",
            "source_dataset": "HiRISE DTM",
            "product_id": "TEST_ID",
            "native_resolution_m": 1.0,
            "is_estimate": True,
            "description": "Test layer.",
        })
    return {
        "contract_version": read_contract_version(settings.CONTRACTS_DOC),
        "generated_at_utc": "2026-11-14T10:00:00Z",
        "pipeline_commit": "abc123",
        "grid": {"width": GRID_WIDTH, "height": GRID_HEIGHT, "cell_size_m": CELL_SIZE_M},
        "origin_northwest": {"latitude_deg": -4.78, "longitude_deg": 137.37},
        "crs": "IAU_2015:49900",
        "elevation_reference": "mars_areoid",
        "bounds": {
            "width_m": GRID_WIDTH * CELL_SIZE_M,
            "height_m": GRID_HEIGHT * CELL_SIZE_M,
            "south_east": {"latitude_deg": -4.81, "longitude_deg": 137.41},
        },
        "staging_point": {"x_m": 1.0, "z_m": 1.0},
        "texture": {"file": "texture_hirise.jpg", "width_px": 16, "height_px": 12},
        "sun": {"sun_azimuth_deg": 100.0, "sun_incidence_deg": 50.0},
        "parameters": {
            "suit_speed_factor": 0.6,
            "gravity_adjustment": 1.1,
            "max_walkable_slope_deg": 25.0,
            "suit_capability_hours": 8.0,
            "planned_marswalk_hours": 4.0,
            "reserve_minutes": 30.0,
            "base_carried_load_kg": 10.0,
            "load_time_factor_per_kg": 0.01,
        },
        "layers": layers,
        "mineralogy_classes": {"0": "no_data", "1": "test_mineral"},
        "sources": [{"source_dataset": "HiRISE DTM", "product_id": "TEST_ID", "url": "https://example.org", "licence_credit": "test"}],
        "regional_context": {
            "file": "gale_context.jpg",
            "width_px": 20,
            "height_px": 10,
            "patch_rect_px": {"x": 1, "y": 1, "width": 4, "height": 3},
        },
    }


def build_layer_arrays():
    shape = (GRID_HEIGHT, GRID_WIDTH)
    return_field = np.full(shape, 10.0, dtype="<f4")
    return_field[0, 0] = 0.0
    return {
        "heightmap.bin": np.full(shape, 100.0, dtype="<f4"),
        "slope_degrees.bin": np.full(shape, 5.0, dtype="<f4"),
        "roughness_m.bin": np.full(shape, 0.1, dtype="<f4"),
        "traversal_penalty.bin": np.ones(shape, dtype="<f4"),
        "return_field.bin": return_field,
        "sky_view_factor.bin": np.full(shape, 0.9, dtype="<f4"),
        "thermal_inertia.bin": np.full(shape, 300.0, dtype="<f4"),
        "mineralogy_class.bin": np.ones(shape, dtype="u1"),
        "viewshed_rover.bin": np.ones(shape, dtype="u1"),
    }


def build_knots():
    knots = []
    for index in range(5):
        knots.append({
            "knot_id": f"knot_test_{index}",
            "name": f"Test knot {index}",
            "x_m": 3.0 + index,
            "z_m": 3.0,
            "latitude_deg": -4.78,
            "longitude_deg": 137.38,
            "science_rationale": "Test rationale.",
            "measurements": [{"label": "Slope", "value": 5.0, "unit": "degrees", "provenance": provenance()}],
            "photos": [],
        })
    knots[0]["science_tasks"] = [{
        "task_id": "task_test_0",
        "label": "Test core sample",
        "task_type": "core_sample",
        "duration_minutes": 20,
        "sample_mass_kg": 0.5,
        "equipment": ["drill"],
        "provenance": provenance(),
    }]
    return knots


def build_json_files():
    return {
        "rocks.json": [{
            "rock_id": "rock_00001",
            "x_m": 4.0,
            "z_m": 4.0,
            "diameter_m": 2.0,
            "height_m": 1.0,
            "detection_method": "shadow_based",
            "confidence": 0.8,
            "provenance": provenance(),
        }],
        "knots.json": build_knots(),
        "shelters.json": [{
            "shelter_id": "shelter_rover",
            "shelter_type": "pressurised_rover",
            "x_m": 1.0,
            "z_m": 1.0,
            "sky_view_factor": 1.0,
            "is_estimate": False,
        }],
        "environment_timeline.json": {
            "replay_source": {"mission": "msl", "instrument_set": ["rems", "rad"], "sol": 100},
            "samples": [
                {
                    "seconds_since_replay_start": second,
                    "local_mean_solar_time": "09:00:00",
                    "air_temperature_c": -40.0,
                    "ground_temperature_c": -25.0,
                    "pressure_pa": 740,
                    "uv_index_level": "moderate",
                    "dust_opacity_tau": 0.5,
                    "radiation_dose_rate_usv_per_hour": 27.0,
                    "provenance": provenance(False),
                }
                for second in [0, 60, 120]
            ],
        },
    }


def write_processed_folder(folder):
    """Writes a tiny valid processed folder and returns nothing."""
    folder.mkdir(parents=True, exist_ok=True)
    (folder / "meta.json").write_text(json.dumps(build_meta()), encoding="utf-8")
    for file_name, array in build_layer_arrays().items():
        array.tofile(folder / file_name)
    for file_name, content in build_json_files().items():
        (folder / file_name).write_text(json.dumps(content), encoding="utf-8")
    Image.new("RGB", (16, 12), (120, 60, 30)).save(folder / "texture_hirise.jpg", format="JPEG")
    Image.new("RGB", (20, 10), (120, 60, 30)).save(folder / "gale_context.jpg", format="JPEG")


def rewrite_json(folder, file_name, change):
    """Loads a JSON file, applies change(data), writes it back."""
    path = folder / file_name
    data = json.loads(path.read_text(encoding="utf-8"))
    change(data)
    path.write_text(json.dumps(data), encoding="utf-8")


def rewrite_array(folder, file_name, change):
    """Loads a binary layer, applies change(array), writes it back."""
    path = folder / file_name
    dtype_name = BINARY_LAYER_FILES[file_name]
    array = np.fromfile(path, dtype="<f4" if dtype_name == "float32" else "u1")
    change(array)
    array.tofile(path)


def failure_text(report):
    """All FAIL lines joined, so a test can look for the reason."""
    lines = [f"{name}: {detail}" for status, name, detail in report.results if status == "FAIL"]
    return "\n".join(lines)


@pytest.fixture
def folder(tmp_path):
    processed = tmp_path / "processed"
    write_processed_folder(processed)
    return processed


def test_valid_folder_passes(folder):
    report = run_validation(folder)
    assert report.failure_count() == 0, failure_text(report)


def test_empty_folder_fails_cleanly(tmp_path):
    report = run_validation(tmp_path)
    assert report.failure_count() > 0
    assert "missing file" in failure_text(report)


def test_wrong_file_size_fails(folder):
    with open(folder / "heightmap.bin", "ab") as file:
        file.write(b"\x00\x00\x00\x00")
    report = run_validation(folder)
    assert "file size heightmap.bin" in failure_text(report)
    assert "expected 48" in failure_text(report)


def test_nan_in_penalty_fails(folder):
    rewrite_array(folder, "traversal_penalty.bin", lambda array: array.__setitem__(3, np.nan))
    report = run_validation(folder)
    assert "values traversal_penalty.bin" in failure_text(report)
    assert "NaN" in failure_text(report)


def test_infinity_in_penalty_is_allowed(folder):
    rewrite_array(folder, "traversal_penalty.bin", lambda array: array.__setitem__(11, np.inf))
    report = run_validation(folder)
    assert report.failure_count() == 0, failure_text(report)


def test_slope_out_of_range_fails(folder):
    rewrite_array(folder, "slope_degrees.bin", lambda array: array.__setitem__(2, 95.0))
    report = run_validation(folder)
    assert "values slope_degrees.bin" in failure_text(report)
    assert "above 90" in failure_text(report)


def test_viewshed_value_fails(folder):
    rewrite_array(folder, "viewshed_rover.bin", lambda array: array.__setitem__(0, 2))
    report = run_validation(folder)
    assert "neither 0 nor 1" in failure_text(report)


def test_knot_unreachable_fails(folder):
    # Knot 0 is at (3.0, 3.0) m, which is row 1, col 1 on the 2 m grid.
    index = 1 * GRID_WIDTH + 1
    rewrite_array(folder, "return_field.bin", lambda array: array.__setitem__(index, np.inf))
    report = run_validation(folder)
    assert "knots reachable" in failure_text(report)
    assert "unreachable" in failure_text(report)


def test_return_field_not_zero_at_staging_fails(folder):
    rewrite_array(folder, "return_field.bin", lambda array: array.__setitem__(0, 5.0))
    report = run_validation(folder)
    assert "return_field at staging point" in failure_text(report)


def test_wrong_contract_version_fails(folder):
    rewrite_json(folder, "meta.json", lambda meta: meta.__setitem__("contract_version", "0.9.0"))
    report = run_validation(folder)
    assert "contract version" in failure_text(report)
    assert "0.9.0" in failure_text(report)


def test_missing_rock_provenance_fails(folder):
    rewrite_json(folder, "rocks.json", lambda rocks: rocks[0].pop("provenance"))
    report = run_validation(folder)
    assert "rocks.json" in failure_text(report)
    assert "provenance missing" in failure_text(report)


def test_missing_knot_measurement_provenance_fails(folder):
    def remove_product_id(knots):
        del knots[0]["measurements"][0]["provenance"]["product_id"]

    rewrite_json(folder, "knots.json", remove_product_id)
    report = run_validation(folder)
    assert "provenance.product_id missing" in failure_text(report)


def test_environment_sample_without_provenance_fails(folder):
    rewrite_json(folder, "environment_timeline.json", lambda timeline: timeline["samples"][1].pop("provenance"))
    report = run_validation(folder)
    assert "environment_timeline.json" in failure_text(report)


def test_position_outside_extent_fails(folder):
    rewrite_json(folder, "rocks.json", lambda rocks: rocks[0].__setitem__("x_m", 99.0))
    report = run_validation(folder)
    assert "outside extent" in failure_text(report)


def test_layer_missing_from_registry_fails(folder):
    def drop_last_layer(meta):
        meta["layers"].pop()

    rewrite_json(folder, "meta.json", drop_last_layer)
    report = run_validation(folder)
    assert "is not listed in layers" in failure_text(report)


def test_layer_entry_missing_field_fails(folder):
    rewrite_json(folder, "meta.json", lambda meta: meta["layers"][0].pop("product_id"))
    report = run_validation(folder)
    assert "product_id missing" in failure_text(report)


def test_texture_size_mismatch_fails(folder):
    Image.new("RGB", (10, 10), (0, 0, 0)).save(folder / "texture_hirise.jpg", format="JPEG")
    report = run_validation(folder)
    assert "image texture_hirise.jpg" in failure_text(report)


def test_command_line_exit_codes(folder, tmp_path):
    run_script = PIPELINE_DIR / "validate" / "run.py"
    good = subprocess.run([sys.executable, str(run_script), "--processed-dir", str(folder)], capture_output=True, text=True)
    assert good.returncode == 0, good.stdout
    bad = subprocess.run([sys.executable, str(run_script), "--processed-dir", str(tmp_path / "nothing")], capture_output=True, text=True)
    assert bad.returncode == 1
    assert "Traceback" not in bad.stderr


def test_bad_science_task_type_fails(folder):
    rewrite_json(folder, "knots.json", lambda knots: knots[0]["science_tasks"][0].__setitem__("task_type", "dancing"))
    report = run_validation(folder)
    assert "task_type must be one of" in failure_text(report)


def test_duplicate_task_id_fails(folder):
    def duplicate(knots):
        second = copy.deepcopy(knots[0]["science_tasks"][0])
        knots[1]["science_tasks"] = [second]

    rewrite_json(folder, "knots.json", duplicate)
    report = run_validation(folder)
    assert "duplicate task_id" in failure_text(report)


def test_negative_sample_mass_fails(folder):
    rewrite_json(folder, "knots.json", lambda knots: knots[0]["science_tasks"][0].__setitem__("sample_mass_kg", -1.0))
    report = run_validation(folder)
    assert "sample_mass_kg must be a number >= 0" in failure_text(report)


def test_missing_new_parameter_fails(folder):
    rewrite_json(folder, "meta.json", lambda meta: meta["parameters"].pop("load_time_factor_per_kg"))
    report = run_validation(folder)
    assert "parameters.load_time_factor_per_kg" in failure_text(report)


def test_science_task_is_estimate_false_fails(folder):
    rewrite_json(folder, "knots.json", lambda knots: knots[0]["science_tasks"][0]["provenance"].__setitem__("is_estimate", False))
    report = run_validation(folder)
    assert "provenance.is_estimate must be true" in failure_text(report)
