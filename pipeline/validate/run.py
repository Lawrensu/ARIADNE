"""The ARIADNE contract validator (docs/contracts.md section 5).

Run from pipeline/:  uv run python validate/run.py [--processed-dir PATH]

Prints one line per check (PASS or FAIL with the reason), then a summary.
Exit code 0 only if every check passes.
"""

import argparse
import json
import math
import re
import sys
from pathlib import Path

PIPELINE_DIR = Path(__file__).resolve().parents[1]
if str(PIPELINE_DIR) not in sys.path:
    sys.path.insert(0, str(PIPELINE_DIR))

import numpy as np
from PIL import Image

from ariadne_pipeline import settings
from ariadne_pipeline import walking




# ---------------------------------------------------------------- contract constants (docs/contracts.md section 2 and 3)

BINARY_LAYER_FILES = {
    "heightmap.bin": "float32",
    "slope_degrees.bin": "float32",
    "roughness_m.bin": "float32",
    "traversal_penalty.bin": "float32",
    "return_field.bin": "float32",
    "sky_view_factor.bin": "float32",
    "thermal_inertia.bin": "float32",
    "mineralogy_class.bin": "uint8",
    "viewshed_rover.bin": "uint8",
}
BYTES_PER_VALUE = {"float32": 4, "uint8": 1}
NUMPY_DTYPES = {"float32": "<f4", "uint8": "u1"}

JSON_FILES = [
    "rocks.json",
    "knots.json",
    "shelters.json",
    "environment_timeline.json",
]
IMAGE_FILES = ["texture_hirise.jpg", "gale_context.jpg"]
META_FILE = "meta.json"

MAX_IMAGE_SIDE_PX = 4096
EXPECTED_KNOT_COUNT = 5
SHELTER_TYPES = ["pressurised_rover", "habitat", "terrain_overhang"]
UV_INDEX_LEVELS = ["low", "moderate", "high", "very_high", "extreme"]
LAYER_ENTRY_STRING_FIELDS = ["layer_id", "file", "dtype", "unit", "source_dataset", "product_id", "description"]
SAMPLE_NUMBER_FIELDS = [
    "seconds_since_replay_start",
    "air_temperature_c",
    "ground_temperature_c",
    "pressure_pa",
    "dust_opacity_tau",
    "radiation_dose_rate_usv_per_hour",
]




# ---------------------------------------------------------------- report

class Report:
    """Collects one PASS or FAIL line per check."""

    def __init__(self):
        self.results = []

    def passed(self, name, detail=""):
        self.results.append(("PASS", name, detail))

    def failed(self, name, detail):
        self.results.append(("FAIL", name, detail))

    def check(self, name, problems, ok_detail=""):
        """PASS if the list of problems is empty, otherwise FAIL listing the first few."""
        if len(problems) == 0:
            self.passed(name, ok_detail)
            return
        shown = "; ".join(problems[:5])
        if len(problems) > 5:
            shown += f"; ... and {len(problems) - 5} more"
        self.failed(name, shown)

    def failure_count(self):
        return sum(1 for status, _, _ in self.results if status == "FAIL")

    def lines(self):
        """Returns the printable lines, including the final summary."""
        lines = []
        for status, name, detail in self.results:
            text = f"{status}  {name}"
            if detail:
                text += f": {detail}"
            lines.append(text)
        total = len(self.results)
        failures = self.failure_count()
        lines.append("")
        if failures == 0:
            lines.append(f"SUMMARY: all {total} checks passed.")
        else:
            lines.append(f"SUMMARY: {failures} of {total} checks FAILED.")
        return lines




# ---------------------------------------------------------------- small helpers

def is_number(value):
    """True for a finite int or float (not a bool)."""
    if isinstance(value, bool):
        return False
    if not isinstance(value, (int, float)):
        return False
    return math.isfinite(value)


def is_string(value):
    return isinstance(value, str) and value != ""


def read_contract_version(contracts_doc_path):
    """Returns the version from the 'Status: SIGNED v1.0.0' line of contracts.md, or None."""
    try:
        text = Path(contracts_doc_path).read_text(encoding="utf-8")
    except OSError:
        return None
    match = re.search(r"^Status:.*?v(\d+\.\d+\.\d+)", text, flags=re.MULTILINE)
    if match is None:
        return None
    return match.group(1)


def load_json(path):
    """Returns (data, error_message). One of them is None."""
    try:
        with open(path, "r", encoding="utf-8") as file:
            return json.load(file), None
    except json.JSONDecodeError as error:
        return None, f"invalid JSON ({error})"
    except OSError as error:
        return None, f"cannot read ({error})"


def provenance_problems(provenance, label, must_be_estimate=False):
    """Returns a list of problems with one provenance object (contracts.md 1.5)."""
    if not isinstance(provenance, dict):
        return [f"{label}: provenance missing"]
    problems = []
    if not is_string(provenance.get("source_dataset")):
        problems.append(f"{label}: provenance.source_dataset missing")
    if not is_string(provenance.get("product_id")):
        problems.append(f"{label}: provenance.product_id missing")
    is_estimate = provenance.get("is_estimate")
    if not isinstance(is_estimate, bool):
        problems.append(f"{label}: provenance.is_estimate missing or not a boolean")
    elif must_be_estimate and is_estimate is not True:
        problems.append(f"{label}: provenance.is_estimate must be true")
    return problems


def position_problems(record, label, width_m, height_m):
    """Returns problems with x_m, z_m: must be numbers inside the grid extent."""
    x_m = record.get("x_m")
    z_m = record.get("z_m")
    if not is_number(x_m) or not is_number(z_m):
        return [f"{label}: x_m and z_m must be numbers"]
    if not (0 <= x_m <= width_m and 0 <= z_m <= height_m):
        return [f"{label}: position ({x_m}, {z_m}) outside extent {width_m} x {height_m} m"]
    return []


def cell_of(x_m, z_m, cell_size_m, width, height):
    """Returns (row, col) of the cell containing the position, clamped to the grid."""
    col = min(int(x_m // cell_size_m), width - 1)
    row = min(int(z_m // cell_size_m), height - 1)
    return row, col




# ---------------------------------------------------------------- check 1: files exist

def check_files_exist(processed_dir, report):
    """Check 1: every file of section 2 that lives in data/processed/ exists."""
    all_names = [META_FILE] + list(BINARY_LAYER_FILES) + IMAGE_FILES + JSON_FILES
    all_names = sorted(set(all_names))
    for name in all_names:
        path = processed_dir / name
        if path.is_file():
            report.passed(f"file exists {name}", f"{path.stat().st_size} bytes")
        else:
            report.failed(f"file exists {name}", "missing file")




# ---------------------------------------------------------------- meta.json (3.1, checks 8 and 9)

def check_meta(processed_dir, contract_version, report):
    """Checks meta.json fields and contract version. Returns the meta dict, or None if unusable."""
    meta_path = processed_dir / META_FILE
    if not meta_path.is_file():
        report.failed("meta.json fields", "cannot check, meta.json is missing")
        return None
    meta, error = load_json(meta_path)
    if error is not None:
        report.failed("meta.json fields", error)
        return None
    if not isinstance(meta, dict):
        report.failed("meta.json fields", "top level must be an object")
        return None

    report.check("meta.json fields", meta_field_problems(meta))
    report.check("contract version", contract_version_problems(meta, contract_version),
                 f"meta.json matches contracts.md v{contract_version}")
    report.check("meta.json layer registry", layer_registry_problems(meta))
    return meta


def meta_field_problems(meta):
    problems = []

    grid = meta.get("grid")
    if not isinstance(grid, dict):
        problems.append("grid missing")
    else:
        for key in ["width", "height"]:
            value = grid.get(key)
            if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
                problems.append(f"grid.{key} must be a positive integer")
        cell_size = grid.get("cell_size_m")
        if not is_number(cell_size) or cell_size <= 0:
            problems.append("grid.cell_size_m must be a positive number")

    for string_field in ["generated_at_utc", "pipeline_commit", "crs", "elevation_reference"]:
        if not is_string(meta.get(string_field)):
            problems.append(f"{string_field} must be a non-empty string")
    if meta.get("crs") != "IAU_2015:49900":
        problems.append("crs must be 'IAU_2015:49900'")
    if meta.get("elevation_reference") != "mars_areoid":
        problems.append("elevation_reference must be 'mars_areoid'")

    problems += number_object_problems(meta, "origin_northwest", ["latitude_deg", "longitude_deg"])
    problems += number_object_problems(meta, "staging_point", ["x_m", "z_m"])
    problems += number_object_problems(meta, "sun", ["sun_azimuth_deg", "sun_incidence_deg"])

    bounds = meta.get("bounds")
    if not isinstance(bounds, dict):
        problems.append("bounds missing")
    else:
        for key in ["width_m", "height_m"]:
            if not is_number(bounds.get(key)):
                problems.append(f"bounds.{key} must be a number")
        south_east = bounds.get("south_east")
        if not isinstance(south_east, dict) or not is_number(south_east.get("latitude_deg")) or not is_number(south_east.get("longitude_deg")):
            problems.append("bounds.south_east must have latitude_deg and longitude_deg")

    texture = meta.get("texture")
    if not isinstance(texture, dict):
        problems.append("texture missing")
    else:
        if not is_string(texture.get("file")):
            problems.append("texture.file missing")
        for key in ["width_px", "height_px"]:
            value = texture.get(key)
            if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
                problems.append(f"texture.{key} must be a positive integer")

    classes = meta.get("mineralogy_classes")
    if not isinstance(classes, dict):
        problems.append("mineralogy_classes missing")
    elif classes.get("0") != "no_data":
        problems.append("mineralogy_classes['0'] must be 'no_data'")

    sources = meta.get("sources")
    if not isinstance(sources, list) or len(sources) == 0:
        problems.append("sources must be a non-empty array")
    else:
        for index, source in enumerate(sources):
            if not isinstance(source, dict):
                problems.append(f"sources[{index}] must be an object")
                continue
            for key in ["source_dataset", "product_id", "url", "licence_credit"]:
                if not is_string(source.get(key)):
                    problems.append(f"sources[{index}].{key} missing")

    regional = meta.get("regional_context")
    if regional is not None:
        problems += regional_context_problems(regional)

    return problems


def number_object_problems(meta, key, number_keys):
    value = meta.get(key)
    if not isinstance(value, dict):
        return [f"{key} missing"]
    problems = []
    for number_key in number_keys:
        if not is_number(value.get(number_key)):
            problems.append(f"{key}.{number_key} must be a number")
    return problems


def regional_context_problems(regional):
    if not isinstance(regional, dict):
        return ["regional_context must be an object"]
    problems = []
    if not is_string(regional.get("file")):
        problems.append("regional_context.file missing")
    for key in ["width_px", "height_px"]:
        if not is_number(regional.get(key)):
            problems.append(f"regional_context.{key} must be a number")
    rect = regional.get("patch_rect_px")
    if not isinstance(rect, dict):
        problems.append("regional_context.patch_rect_px missing")
    else:
        for key in ["x", "y", "width", "height"]:
            if not is_number(rect.get(key)):
                problems.append(f"regional_context.patch_rect_px.{key} must be a number")
    return problems


def contract_version_problems(meta, contract_version):
    if contract_version is None:
        return ["could not read the version from the Status line of docs/contracts.md"]
    meta_version = meta.get("contract_version")
    if meta_version != contract_version:
        return [f"meta.json contract_version is {meta_version!r}, contracts.md says {contract_version!r}"]
    return []


def layer_registry_problems(meta):
    layers = meta.get("layers")
    if not isinstance(layers, list):
        return ["layers must be an array"]
    problems = []
    registered_files = set()
    for index, layer in enumerate(layers):
        if not isinstance(layer, dict):
            problems.append(f"layers[{index}] must be an object")
            continue
        label = f"layers[{index}] ({layer.get('layer_id')})"
        for key in LAYER_ENTRY_STRING_FIELDS:
            if not is_string(layer.get(key)):
                problems.append(f"{label}: {key} missing")
        if not is_number(layer.get("native_resolution_m")):
            problems.append(f"{label}: native_resolution_m must be a number")
        if not isinstance(layer.get("is_estimate"), bool):
            problems.append(f"{label}: is_estimate must be a boolean")
        file_name = layer.get("file")
        registered_files.add(file_name)
        expected_dtype = BINARY_LAYER_FILES.get(file_name)
        if expected_dtype is not None and layer.get("dtype") != expected_dtype:
            problems.append(f"{label}: dtype should be {expected_dtype}, is {layer.get('dtype')!r}")
    for file_name in BINARY_LAYER_FILES:
        if file_name not in registered_files:
            problems.append(f"{file_name} is not listed in layers")
    return problems




# ---------------------------------------------------------------- checks 2 to 4: binary layers

def load_binary_layers(processed_dir, meta, report):
    """Checks file sizes (check 2) and returns {file_name: 2D array} for the files with the right size."""
    if meta is None or not grid_is_usable(meta):
        report.failed("binary file sizes", "cannot check, meta.json grid is unusable")
        return {}
    width = meta["grid"]["width"]
    height = meta["grid"]["height"]
    arrays = {}
    for file_name, dtype_name in BINARY_LAYER_FILES.items():
        path = processed_dir / file_name
        check_name = f"file size {file_name}"
        if not path.is_file():
            report.failed(check_name, "cannot check, file is missing")
            continue
        expected_bytes = width * height * BYTES_PER_VALUE[dtype_name]
        actual_bytes = path.stat().st_size
        if actual_bytes != expected_bytes:
            report.failed(check_name, f"{actual_bytes} bytes, expected {expected_bytes} ({width} x {height} {dtype_name})")
            continue
        flat = np.fromfile(path, dtype=NUMPY_DTYPES[dtype_name])
        arrays[file_name] = flat.reshape(height, width)
        report.passed(check_name, f"{actual_bytes} bytes")
    return arrays


def grid_is_usable(meta):
    grid = meta.get("grid")
    if not isinstance(grid, dict):
        return False
    for key in ["width", "height"]:
        value = grid.get(key)
        if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
            return False
    return is_number(grid.get("cell_size_m")) and grid["cell_size_m"] > 0


def count_text(count):
    return f"{count} cells"


def check_binary_values(arrays, meta, report):
    """Checks 3 and 4: NaN and Infinity rules and value ranges, file by file."""
    heightmap = arrays.get("heightmap.bin")
    height_is_nan = np.isnan(heightmap) if heightmap is not None else None

    if heightmap is not None:
        problems = []
        if np.isinf(heightmap).any():
            problems.append("contains Infinity")
        nan_count = int(np.isnan(heightmap).sum())
        report.check("values heightmap.bin", problems, f"NaN only where the DTM has no data ({count_text(nan_count)} NaN)")

    for file_name, minimum, maximum in [
        ("slope_degrees.bin", 0.0, 90.0),
        ("roughness_m.bin", 0.0, None),
        ("sky_view_factor.bin", 0.0, 1.0),
    ]:
        layer = arrays.get(file_name)
        if layer is None:
            continue
        problems = float_range_problems(layer, minimum, maximum)
        if height_is_nan is None:
            problems.append("cannot check NaN placement, heightmap.bin unavailable")
        else:
            stray_nan = int((np.isnan(layer) & ~height_is_nan).sum())
            if stray_nan > 0:
                problems.append(f"{count_text(stray_nan)} are NaN where heightmap is valid")
        report.check(f"values {file_name}", problems, "ranges ok, NaN only where heightmap is NaN")

    penalty = arrays.get("traversal_penalty.bin")
    if penalty is not None:
        problems = []
        if np.isnan(penalty).any():
            problems.append(f"{count_text(int(np.isnan(penalty).sum()))} are NaN (use +Infinity for impassable)")
        if np.isneginf(penalty).any():
            problems.append("contains -Infinity")
        finite_values = penalty[np.isfinite(penalty)]
        if finite_values.size > 0 and finite_values.min() < 1.0:
            problems.append(f"minimum {float(finite_values.min()):.4g} is below 1")
        passable = int(np.isfinite(penalty).sum())
        report.check("values traversal_penalty.bin", problems, f">= 1, no NaN, {passable} passable cells")

    return_field = arrays.get("return_field.bin")
    if return_field is not None:
        problems = []
        if np.isnan(return_field).any():
            problems.append(f"{count_text(int(np.isnan(return_field).sum()))} are NaN (use +Infinity for unreachable)")
        if np.isneginf(return_field).any():
            problems.append("contains -Infinity")
        finite_values = return_field[np.isfinite(return_field)]
        if finite_values.size > 0 and finite_values.min() < 0.0:
            problems.append(f"minimum {float(finite_values.min()):.4g} is below 0")
        reachable = int(np.isfinite(return_field).sum())
        report.check("values return_field.bin", problems, f">= 0, no NaN, {reachable} reachable cells")

    thermal = arrays.get("thermal_inertia.bin")
    if thermal is not None:
        problems = []
        if np.isinf(thermal).any():
            problems.append("contains Infinity")
        report.check("values thermal_inertia.bin", problems, "NaN allowed, no Infinity")

    mineralogy = arrays.get("mineralogy_class.bin")
    if mineralogy is not None:
        problems = []
        classes = meta.get("mineralogy_classes") if isinstance(meta, dict) else None
        if isinstance(classes, dict):
            present = {str(int(value)) for value in np.unique(mineralogy)}
            unknown = sorted(present - set(classes), key=int)
            if unknown:
                problems.append(f"class ids {unknown} are not in meta.json mineralogy_classes")
        report.check("values mineralogy_class.bin", problems, "all class ids are named in meta.json")

    viewshed = arrays.get("viewshed_rover.bin")
    if viewshed is not None:
        problems = []
        bad_count = int((viewshed > 1).sum())
        if bad_count > 0:
            problems.append(f"{count_text(bad_count)} are neither 0 nor 1")
        report.check("values viewshed_rover.bin", problems, "only 0 and 1")


def float_range_problems(layer, minimum, maximum):
    """Problems for a float layer where NaN is checked elsewhere: no Infinity, within range."""
    problems = []
    if np.isinf(layer).any():
        problems.append("contains Infinity")
    finite_values = layer[np.isfinite(layer)]
    if finite_values.size > 0:
        if minimum is not None and finite_values.min() < minimum:
            problems.append(f"minimum {float(finite_values.min()):.4g} is below {minimum}")
        if maximum is not None and finite_values.max() > maximum:
            problems.append(f"maximum {float(finite_values.max()):.4g} is above {maximum}")
    return problems




# ---------------------------------------------------------------- images

def check_images(processed_dir, meta, report):
    """Checks texture_hirise.jpg and gale_context.jpg against meta.json and the size budget."""
    texture_path = processed_dir / "texture_hirise.jpg"
    if texture_path.is_file():
        problems = []
        size = image_size(texture_path, problems)
        if size is not None:
            if max(size) > MAX_IMAGE_SIDE_PX:
                problems.append(f"longer side {max(size)} px exceeds {MAX_IMAGE_SIDE_PX}")
            texture_meta = meta.get("texture") if isinstance(meta, dict) else None
            if isinstance(texture_meta, dict):
                expected = (texture_meta.get("width_px"), texture_meta.get("height_px"))
                if size != expected:
                    problems.append(f"image is {size[0]} x {size[1]} px, meta.json says {expected[0]} x {expected[1]}")
        report.check("image texture_hirise.jpg", problems, "size matches meta.json, within 4096 px")

    gale_path = processed_dir / "gale_context.jpg"
    if gale_path.is_file():
        problems = []
        size = image_size(gale_path, problems)
        if size is not None:
            if max(size) > MAX_IMAGE_SIDE_PX:
                problems.append(f"longer side {max(size)} px exceeds {MAX_IMAGE_SIDE_PX}")
            regional = meta.get("regional_context") if isinstance(meta, dict) else None
            if isinstance(regional, dict):
                expected = (regional.get("width_px"), regional.get("height_px"))
                if size != expected:
                    problems.append(f"image is {size[0]} x {size[1]} px, meta.json regional_context says {expected[0]} x {expected[1]}")
        report.check("image gale_context.jpg", problems, "within 4096 px, size matches regional_context if present")


def image_size(path, problems):
    """Returns (width, height) or None, appending a problem if the file is not a readable JPEG."""
    try:
        with Image.open(path) as image:
            if image.format != "JPEG":
                problems.append(f"format is {image.format}, expected JPEG")
            return image.size
    except Exception as error:
        problems.append(f"cannot read image ({error})")
        return None




# ---------------------------------------------------------------- JSON files (checks 5, 6, 7, 8)

def check_json_files(processed_dir, meta, arrays, report):
    """Checks rocks, knots, shelters and the environment timeline, plus the staging point and Knot reachability."""
    if meta is None or not grid_is_usable(meta):
        report.failed("json files", "cannot check, meta.json grid is unusable")
        return
    cell_size_m = meta["grid"]["cell_size_m"]
    width = meta["grid"]["width"]
    height = meta["grid"]["height"]
    width_m = width * cell_size_m
    height_m = height * cell_size_m

    check_staging_point(meta, arrays, cell_size_m, width, height, width_m, height_m, report)

    rocks = load_json_or_report(processed_dir / "rocks.json", "rocks.json", report)
    if rocks is not None:
        report.check("rocks.json", rock_problems(rocks, width_m, height_m), f"{len(rocks)} rocks, inside extent, with provenance")

    knots = load_json_or_report(processed_dir / "knots.json", "knots.json", report)
    if knots is not None:
        report.check("knots.json", knot_problems(knots, width_m, height_m), f"{len(knots)} Knots, inside extent, with provenance")
        check_knots_reachable(knots, arrays, cell_size_m, width, height, width_m, height_m, report)

    shelters = load_json_or_report(processed_dir / "shelters.json", "shelters.json", report)
    if shelters is not None:
        report.check("shelters.json", shelter_problems(shelters, width_m, height_m), f"{len(shelters)} shelters, inside extent")

    timeline = load_json_or_report(processed_dir / "environment_timeline.json", "environment_timeline.json", report)
    if timeline is not None:
        report.check("environment_timeline.json", timeline_problems(timeline), "samples ordered, with provenance")


def load_json_or_report(path, name, report):
    """Returns parsed JSON, or None after recording a failure (a missing file is already reported by check 1)."""
    if not path.is_file():
        report.failed(f"{name} content", "cannot check, file is missing")
        return None
    data, error = load_json(path)
    if error is not None:
        report.failed(name, error)
        return None
    return data


def check_staging_point(meta, arrays, cell_size_m, width, height, width_m, height_m, report):
    """Check 6 and the staging point position check."""
    staging = meta.get("staging_point")
    if not isinstance(staging, dict) or not is_number(staging.get("x_m")) or not is_number(staging.get("z_m")):
        report.failed("return_field at staging point", "meta.json staging_point is missing or invalid")
        return
    problems = position_problems(staging, "staging_point", width_m, height_m)
    if problems:
        report.failed("return_field at staging point", problems[0])
        return
    return_field = arrays.get("return_field.bin")
    if return_field is None:
        report.failed("return_field at staging point", "cannot check, return_field.bin unavailable")
        return
    row, col = cell_of(staging["x_m"], staging["z_m"], cell_size_m, width, height)
    value = float(return_field[row, col])
    if value != 0.0:
        report.failed("return_field at staging point", f"cell (row {row}, col {col}) is {value}, expected 0")
    else:
        report.passed("return_field at staging point", f"cell (row {row}, col {col}) is 0")


def check_knots_reachable(knots, arrays, cell_size_m, width, height, width_m, height_m, report):
    """Check 7: every Knot has a finite return_field value (and passable ground) at its cell."""
    return_field = arrays.get("return_field.bin")
    penalty = arrays.get("traversal_penalty.bin")
    if return_field is None:
        report.failed("knots reachable", "cannot check, return_field.bin unavailable")
        return
    if not isinstance(knots, list):
        report.failed("knots reachable", "knots.json is not an array")
        return
    problems = []
    for index, knot in enumerate(knots):
        if not isinstance(knot, dict) or position_problems(knot, "knot", width_m, height_m):
            continue
        label = knot.get("knot_id", f"knots[{index}]")
        row, col = cell_of(knot["x_m"], knot["z_m"], cell_size_m, width, height)
        if not math.isfinite(float(return_field[row, col])):
            problems.append(f"{label}: return_field at (row {row}, col {col}) is not finite, Knot is unreachable")
        elif penalty is not None and not math.isfinite(float(penalty[row, col])):
            problems.append(f"{label}: sits on impassable ground (penalty is Infinity)")
    report.check("knots reachable", problems, "finite return_field at every Knot cell")


def rock_problems(rocks, width_m, height_m):
    if not isinstance(rocks, list):
        return ["rocks.json must be an array"]
    problems = []
    for index, rock in enumerate(rocks):
        if not isinstance(rock, dict):
            problems.append(f"rocks[{index}] must be an object")
            continue
        label = str(rock.get("rock_id", f"rocks[{index}]"))
        if not is_string(rock.get("rock_id")):
            problems.append(f"rocks[{index}]: rock_id missing")
        problems += position_problems(rock, label, width_m, height_m)
        for key in ["diameter_m", "height_m"]:
            if not is_number(rock.get(key)) or rock[key] < 0:
                problems.append(f"{label}: {key} must be a number >= 0")
        confidence = rock.get("confidence")
        if not is_number(confidence) or not (0 <= confidence <= 1):
            problems.append(f"{label}: confidence must be 0 to 1")
        if not is_string(rock.get("detection_method")):
            problems.append(f"{label}: detection_method missing")
        problems += provenance_problems(rock.get("provenance"), label, must_be_estimate=True)
    return problems


def knot_problems(knots, width_m, height_m):
    if not isinstance(knots, list):
        return ["knots.json must be an array"]
    problems = []
    if len(knots) != EXPECTED_KNOT_COUNT:
        problems.append(f"expected {EXPECTED_KNOT_COUNT} Knots, found {len(knots)}")
    for index, knot in enumerate(knots):
        if not isinstance(knot, dict):
            problems.append(f"knots[{index}] must be an object")
            continue
        label = str(knot.get("knot_id", f"knots[{index}]"))
        for key in ["knot_id", "name", "science_rationale"]:
            if not is_string(knot.get(key)):
                problems.append(f"{label}: {key} missing")
        problems += position_problems(knot, label, width_m, height_m)
        for key in ["latitude_deg", "longitude_deg"]:
            if not is_number(knot.get(key)):
                problems.append(f"{label}: {key} must be a number")
        measurements = knot.get("measurements")
        if not isinstance(measurements, list):
            problems.append(f"{label}: measurements must be an array")
        else:
            for measurement_index, measurement in enumerate(measurements):
                measurement_label = f"{label} measurement {measurement_index}"
                if not isinstance(measurement, dict):
                    problems.append(f"{measurement_label}: must be an object")
                    continue
                for key in ["label", "unit"]:
                    if not isinstance(measurement.get(key), str):
                        problems.append(f"{measurement_label}: {key} missing")
                if "value" not in measurement:
                    problems.append(f"{measurement_label}: value missing")
                problems += provenance_problems(measurement.get("provenance"), measurement_label)
        if not isinstance(knot.get("photos"), list):
            problems.append(f"{label}: photos must be an array")
    return problems


def shelter_problems(shelters, width_m, height_m):
    if not isinstance(shelters, list):
        return ["shelters.json must be an array"]
    problems = []
    for index, shelter in enumerate(shelters):
        if not isinstance(shelter, dict):
            problems.append(f"shelters[{index}] must be an object")
            continue
        label = str(shelter.get("shelter_id", f"shelters[{index}]"))
        if not is_string(shelter.get("shelter_id")):
            problems.append(f"shelters[{index}]: shelter_id missing")
        if shelter.get("shelter_type") not in SHELTER_TYPES:
            problems.append(f"{label}: shelter_type must be one of {SHELTER_TYPES}")
        problems += position_problems(shelter, label, width_m, height_m)
        sky_view = shelter.get("sky_view_factor")
        if not is_number(sky_view) or not (0 <= sky_view <= 1):
            problems.append(f"{label}: sky_view_factor must be 0 to 1")
        if not isinstance(shelter.get("is_estimate"), bool):
            problems.append(f"{label}: is_estimate must be a boolean")
    return problems


def timeline_problems(timeline):
    if not isinstance(timeline, dict):
        return ["environment_timeline.json must be an object"]
    problems = []
    replay_source = timeline.get("replay_source")
    if not isinstance(replay_source, dict):
        problems.append("replay_source missing")
    else:
        if not is_string(replay_source.get("mission")):
            problems.append("replay_source.mission missing")
        if not isinstance(replay_source.get("instrument_set"), list):
            problems.append("replay_source.instrument_set must be an array")
        sol = replay_source.get("sol")
        if isinstance(sol, bool) or not isinstance(sol, int):
            problems.append("replay_source.sol must be an integer")

    samples = timeline.get("samples")
    if not isinstance(samples, list) or len(samples) == 0:
        problems.append("samples must be a non-empty array")
        return problems

    previous_seconds = None
    for index, sample in enumerate(samples):
        label = f"samples[{index}]"
        if not isinstance(sample, dict):
            problems.append(f"{label} must be an object")
            continue
        for key in SAMPLE_NUMBER_FIELDS:
            if not is_number(sample.get(key)):
                problems.append(f"{label}: {key} must be a number")
        local_time = sample.get("local_mean_solar_time")
        if not isinstance(local_time, str) or re.fullmatch(r"\d{2}:\d{2}:\d{2}", local_time) is None:
            problems.append(f"{label}: local_mean_solar_time must be 'HH:MM:SS'")
        if sample.get("uv_index_level") not in UV_INDEX_LEVELS:
            problems.append(f"{label}: uv_index_level must be one of {UV_INDEX_LEVELS}")
        seconds = sample.get("seconds_since_replay_start")
        if is_number(seconds):
            if previous_seconds is not None and seconds < previous_seconds:
                problems.append(f"{label}: samples are not ordered by seconds_since_replay_start")
            previous_seconds = seconds
        problems += provenance_problems(sample.get("provenance"), label)
    return problems




# ---------------------------------------------------------------- check 10: walking test vectors

def check_walking_vectors(report):
    failures = walking.check_test_vectors()
    report.check("walking test vectors", failures, f"all {len(walking.TEST_VECTORS)} rows of contracts.md 4.5 pass")




# ---------------------------------------------------------------- run everything

def run_validation(processed_dir, contracts_doc_path=None):
    """Runs every check against a processed folder and returns the Report."""
    processed_dir = Path(processed_dir)
    if contracts_doc_path is None:
        contracts_doc_path = settings.CONTRACTS_DOC
    contract_version = read_contract_version(contracts_doc_path)

    report = Report()
    steps = [
        ("file existence", lambda: check_files_exist(processed_dir, report)),
        ("walking test vectors", lambda: check_walking_vectors(report)),
    ]
    for step_name, step in steps:
        run_step(step_name, step, report)

    state = {"meta": None, "arrays": {}}

    def step_meta():
        state["meta"] = check_meta(processed_dir, contract_version, report)

    def step_binary_sizes():
        state["arrays"] = load_binary_layers(processed_dir, state["meta"], report)

    run_step("meta.json", step_meta, report)
    run_step("binary file sizes", step_binary_sizes, report)
    run_step("binary values", lambda: check_binary_values(state["arrays"], state["meta"], report), report)
    run_step("images", lambda: check_images(processed_dir, state["meta"], report), report)
    run_step("json files", lambda: check_json_files(processed_dir, state["meta"], state["arrays"], report), report)
    return report


def run_step(step_name, step, report):
    """Runs one group of checks. An unexpected error becomes a FAIL line, never a traceback."""
    try:
        step()
    except Exception as error:
        report.failed(f"{step_name} (validator error)", f"{type(error).__name__}: {error}")


def main():
    parser = argparse.ArgumentParser(description="Validate data/processed/ against docs/contracts.md.")
    parser.add_argument("--processed-dir", type=Path, default=settings.PROCESSED_DIR)
    arguments = parser.parse_args()

    print(f"Validating {arguments.processed_dir}")
    report = run_validation(arguments.processed_dir)
    for line in report.lines():
        print(line)
    if report.failure_count() == 0:
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
