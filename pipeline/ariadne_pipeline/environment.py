"""environment_timeline.json: a replay of one real Curiosity sol (contracts.md 3.14, decision D-014).

Inputs: REMS MODRDR (air temperature, ground temperature, pressure, UV) and RAD RDR (dose rate)
for sol 4760, read from data/raw/msl_environment/.

Time convention used everywhere in this module:
- LMST is local mean solar time on the Mars clock. One sol is 86,400 clock seconds ("LMST seconds").
- A sample sits at LMST 00:00, 00:15, ... 23:45 (96 samples, 900 clock seconds apart).
- seconds_since_replay_start is measured from LMST 00:00 in Mars (SI) seconds: one sol is
  88,775.244 s, so one LMST hour is 3,698.97 s and one sample step is 924.74 s.
- Each sample is the mean of the readings within plus or minus 7.5 LMST minutes of its time.
"""

import csv
import datetime
import json
import re
import statistics
import sys

import numpy as np

from ariadne_pipeline import settings




# ---------------------------------------------------------------- constants

REPLAY_SOL = 4760
SPE_SOL = 4190

SOL_SI_SECONDS = 88775.244
SOL_CLOCK_SECONDS = 86400
SI_SECONDS_PER_CLOCK_SECOND = SOL_SI_SECONDS / SOL_CLOCK_SECONDS

SAMPLE_STEP_CLOCK_SECONDS = 15 * 60
SAMPLE_COUNT = SOL_CLOCK_SECONDS // SAMPLE_STEP_CLOCK_SECONDS

REMS_NO_DATA_VALUE = -999.0
KELVIN_TO_CELSIUS_OFFSET = 273.15

DUST_OPACITY_TAU_ASSUMED = 0.5
RAD_QUALITY_FACTOR = 3.05
UV_SMOOTHING_WINDOW_SAMPLES = 5
RAD_MINIMUM_OBSERVATION_SECONDS = 300
RAD_OUTLIER_FRACTION = 0.85

REMS_PRODUCT_ID = "RME_820012645RMD47600000000_______P1"
RAD_PRODUCT_ID = "RAD_RDR_2025_360_10_42_4760_V00"
RAD_SPE_PRODUCT_ID = "RAD_RDR_2024_140_18_30_4190_V00"

DATA_DIR = settings.RAW_DIR / "msl_environment"
REMS_PATH = DATA_DIR / "rems" / (REMS_PRODUCT_ID + ".TAB")
RAD_PATH = DATA_DIR / "rad" / (RAD_PRODUCT_ID + ".TXT")
RAD_SPE_PATH = DATA_DIR / "rad_spe_sol4190" / (RAD_SPE_PRODUCT_ID + ".TXT")

# The REMS file starts at this UTC time with its first row at LMST 00:00:27.621 of the replay sol
# (label START_TIME, first row of the TAB). Used to convert between LMST and UTC.
REMS_FIRST_ROW_UTC = datetime.datetime(2025, 12, 26, 10, 26, 26, 820000, tzinfo=datetime.timezone.utc)
REMS_FIRST_ROW_LMST_CLOCK_SECONDS = 27.621

# REMS TAB column positions (0-based), see the RME_820012645RMD*.LBL column list.
REMS_COLUMN_LMST = 1
REMS_COLUMN_GROUND_BRIGHTNESS_TEMPERATURE_K = 7
REMS_COLUMN_AIR_TEMPERATURE_K = 15
REMS_COLUMN_UV_ABC_W_M2 = 20
REMS_COLUMN_PRESSURE_PA = 37

# Plausible ranges used to reject bad rows that are not flagged with -999.
PLAUSIBLE_TEMPERATURE_K = (100.0, 350.0)
PLAUSIBLE_PRESSURE_PA = (300.0, 1200.0)
PLAUSIBLE_UV_ABC_W_M2 = (0.0, 100.0)

SOURCES = [
    {
        "source_dataset": "MSL-M-REMS-5-MODRDR-V1.0",
        "product_id": REMS_PRODUCT_ID,
        "url": "https://atmos.nmsu.edu/PDS/data/mslrem_1001/",
        "licence_credit": "NASA/JPL-Caltech, Centro de Astrobiologia (CSIC-INTA)",
    },
    {
        "source_dataset": "MSL-M-RAD-3-RDR-V1.0",
        "product_id": RAD_PRODUCT_ID,
        "url": "https://pds-ppi.igpp.ucla.edu/data/MSL-M-RAD-3-RDR-V1.0/DATA/SOL_04710_04843/"
        + RAD_PRODUCT_ID
        + ".TXT",
        "licence_credit": "NASA/JPL-Caltech/SwRI",
    },
]

# (inclusive lower bound of REMS UV_ABC in W/m2, level name), highest first.
UV_LEVEL_THRESHOLDS_W_M2 = [
    (9.0, "extreme"),
    (6.0, "very_high"),
    (3.0, "high"),
    (1.0, "moderate"),
]
UV_LEVEL_LOWEST = "low"

FIELD_NAMES = [
    "air_temperature_c",
    "ground_temperature_c",
    "pressure_pa",
    "uv_abc_w_m2",
    "radiation_dose_rate_ugy_per_hour",
]

ESTIMATED_FIELDS_TEXT = (
    "Estimated fields: uv_index_level (own thresholds on smoothed REMS UV_ABC), "
    "dust_opacity_tau (assumed 0.5, unsourced, range 0.3 to 0.8), "
    "radiation_dose_rate_usv_per_hour (RAD plastic detector uGy/h times quality factor 3.05, plus or minus 0.26)."
)




# ---------------------------------------------------------------- small conversions


def kelvin_to_celsius(kelvin):
    """Convert kelvin to degrees Celsius."""
    return kelvin - KELVIN_TO_CELSIUS_OFFSET


def clock_seconds_to_si_seconds(clock_seconds):
    """Convert LMST clock seconds (86,400 per sol) to Mars SI seconds (88,775.244 per sol)."""
    return clock_seconds * SI_SECONDS_PER_CLOCK_SECOND


def format_lmst(clock_seconds):
    """Return LMST as an "HH:MM:SS" string from clock seconds since LMST midnight."""
    whole_seconds = int(round(clock_seconds)) % SOL_CLOCK_SECONDS
    hours, remainder = divmod(whole_seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    return "%02d:%02d:%02d" % (hours, minutes, seconds)


def lmst_to_utc(lmst_clock_seconds):
    """Return the UTC datetime of an LMST (clock seconds since midnight) on the replay sol."""
    clock_seconds_since_first_row = lmst_clock_seconds - REMS_FIRST_ROW_LMST_CLOCK_SECONDS
    si_seconds = clock_seconds_to_si_seconds(clock_seconds_since_first_row)
    return REMS_FIRST_ROW_UTC + datetime.timedelta(seconds=si_seconds)


def utc_to_lmst_clock_seconds(utc_datetime):
    """Return LMST clock seconds since midnight of the replay sol for a UTC datetime."""
    si_seconds = (utc_datetime - REMS_FIRST_ROW_UTC).total_seconds()
    return REMS_FIRST_ROW_LMST_CLOCK_SECONDS + si_seconds / SI_SECONDS_PER_CLOCK_SECOND


def format_utc_iso(utc_datetime):
    """Return an ISO 8601 UTC string with whole seconds, for example "2025-12-26T10:26:27Z"."""
    rounded = utc_datetime.replace(microsecond=0) + datetime.timedelta(
        seconds=1 if utc_datetime.microsecond >= 500000 else 0
    )
    return rounded.strftime("%Y-%m-%dT%H:%M:%SZ")


def uv_level_from_abc(uv_abc_w_m2):
    """Return the uv_index_level string for a (smoothed) REMS UV_ABC irradiance in W/m2.

    Own mapping, an estimate: under 1 low, 1 to 3 moderate, 3 to 6 high, 6 to 9 very_high, 9 and above extreme.
    """
    for lower_bound, level in UV_LEVEL_THRESHOLDS_W_M2:
        if uv_abc_w_m2 >= lower_bound:
            return level
    return UV_LEVEL_LOWEST




# ---------------------------------------------------------------- binning, interpolation, smoothing


def bin_readings(lmst_clock_seconds, values):
    """Mean of the readings in each of the 96 bins centred on LMST 00:00, 00:15, ... 23:45.

    Bin k covers 900 * k minus 450 to 900 * k plus 450 clock seconds, wrapping at midnight.
    Returns (means, counts): two arrays of length 96. A bin without readings has mean NaN.
    """
    times = np.asarray(lmst_clock_seconds, dtype=float)
    readings = np.asarray(values, dtype=float)
    half_step = SAMPLE_STEP_CLOCK_SECONDS / 2
    bin_indices = np.floor((times + half_step) / SAMPLE_STEP_CLOCK_SECONDS).astype(int) % SAMPLE_COUNT

    sums = np.zeros(SAMPLE_COUNT)
    counts = np.zeros(SAMPLE_COUNT, dtype=int)
    np.add.at(sums, bin_indices, readings)
    np.add.at(counts, bin_indices, 1)

    means = np.full(SAMPLE_COUNT, np.nan)
    has_readings = counts > 0
    means[has_readings] = sums[has_readings] / counts[has_readings]
    return means, counts


def fill_gaps_circular(bin_means):
    """Fill NaN bins by linear interpolation in time, wrapping around midnight.

    Returns (filled, was_interpolated): the filled array and a boolean array marking filled bins.
    With no valid bin at all the result is all NaN.
    """
    values = np.asarray(bin_means, dtype=float)
    was_interpolated = np.isnan(values)
    if not np.any(~was_interpolated):
        return values.copy(), was_interpolated

    indices = np.arange(len(values))
    valid_indices = indices[~was_interpolated]
    filled = np.interp(indices, valid_indices, values[~was_interpolated], period=len(values))
    return filled, was_interpolated


def rolling_max_circular(values, window):
    """Rolling maximum (upper envelope) with an odd window, wrapping around the ends.

    Used for UV: rover or terrain shadow can only lower a UV reading, never raise it,
    so the envelope is closer to the real sky UV than a median.
    """
    array = np.asarray(values, dtype=float)
    half = window // 2
    smoothed = np.zeros(len(array))
    for index in range(len(array)):
        neighbour_indices = [(index + offset) % len(array) for offset in range(-half, half + 1)]
        smoothed[index] = np.max(array[neighbour_indices])
    return smoothed


def rolling_median_circular(values, window):
    """Rolling median with an odd window, wrapping around the ends. Returns an array of the same length."""
    array = np.asarray(values, dtype=float)
    half = window // 2
    smoothed = np.zeros(len(array))
    for index in range(len(array)):
        neighbour_indices = [(index + offset) % len(array) for offset in range(-half, half + 1)]
        smoothed[index] = np.median(array[neighbour_indices])
    return smoothed




# ---------------------------------------------------------------- reading REMS


def parse_rems_lmst_clock_seconds(lmst_text):
    """Parse a REMS LMST string such as "04760M00:00:27.621". Returns (sol, clock seconds since midnight)."""
    sol_text, clock_text = lmst_text.split("M")
    hours, minutes, seconds = clock_text.split(":")
    clock_seconds = int(hours) * 3600 + int(minutes) * 60 + float(seconds)
    return int(sol_text), clock_seconds


def is_valid_reading(value, plausible_range):
    """True if a REMS value is not the -999 no-data marker and lies in the plausible range."""
    if value == REMS_NO_DATA_VALUE:
        return False
    return plausible_range[0] <= value <= plausible_range[1]


def read_rems_columns(path, sol=REPLAY_SOL):
    """Read the needed REMS columns for one sol.

    Returns a dict of lists: lmst_clock_seconds, plus per field a pair (times, values) of valid readings
    only, with temperatures converted to degrees Celsius. Keys: air_temperature_c, ground_temperature_c,
    pressure_pa, uv_abc_w_m2. Each value is a (times, values) tuple of lists.
    """
    readings = {
        "air_temperature_c": ([], []),
        "ground_temperature_c": ([], []),
        "pressure_pa": ([], []),
        "uv_abc_w_m2": ([], []),
    }
    with open(path, newline="", encoding="ascii") as handle:
        for row in csv.reader(handle):
            row_sol, clock_seconds = parse_rems_lmst_clock_seconds(row[REMS_COLUMN_LMST].strip())
            if row_sol != sol:
                continue

            air_kelvin = float(row[REMS_COLUMN_AIR_TEMPERATURE_K])
            if is_valid_reading(air_kelvin, PLAUSIBLE_TEMPERATURE_K):
                readings["air_temperature_c"][0].append(clock_seconds)
                readings["air_temperature_c"][1].append(kelvin_to_celsius(air_kelvin))

            ground_kelvin = float(row[REMS_COLUMN_GROUND_BRIGHTNESS_TEMPERATURE_K])
            if is_valid_reading(ground_kelvin, PLAUSIBLE_TEMPERATURE_K):
                readings["ground_temperature_c"][0].append(clock_seconds)
                readings["ground_temperature_c"][1].append(kelvin_to_celsius(ground_kelvin))

            pressure_pa = float(row[REMS_COLUMN_PRESSURE_PA])
            if is_valid_reading(pressure_pa, PLAUSIBLE_PRESSURE_PA):
                readings["pressure_pa"][0].append(clock_seconds)
                readings["pressure_pa"][1].append(pressure_pa)

            uv_abc = float(row[REMS_COLUMN_UV_ABC_W_M2])
            if is_valid_reading(uv_abc, PLAUSIBLE_UV_ABC_W_M2):
                readings["uv_abc_w_m2"][0].append(clock_seconds)
                readings["uv_abc_w_m2"][1].append(uv_abc)
    return readings




# ---------------------------------------------------------------- reading RAD


def parse_rad_utc(utc_text):
    """Parse a RAD UTC string "YYYY-DDD HH:MM:SS" (day of year) into a UTC datetime."""
    year_and_day, clock = utc_text.split(" ")
    year_text, day_text = year_and_day.split("-")
    hours, minutes, seconds = clock.split(":")
    start_of_year = datetime.datetime(int(year_text), 1, 1, tzinfo=datetime.timezone.utc)
    return start_of_year + datetime.timedelta(
        days=int(day_text) - 1, hours=int(hours), minutes=int(minutes), seconds=int(seconds)
    )


def drop_low_outliers(observations):
    """Drop observations more than 15% below both of their neighbours (partial, truncated observations).

    A rise or a decay is monotonic, so such an observation is always at least as high as one neighbour
    and is kept. Only a dip below both sides is removed. Edge observations compare with their one neighbour.
    """
    kept = []
    for index, observation in enumerate(observations):
        neighbour_doses = []
        if index > 0:
            neighbour_doses.append(observations[index - 1]["dose_ugy_per_hour"])
        if index < len(observations) - 1:
            neighbour_doses.append(observations[index + 1]["dose_ugy_per_hour"])
        if neighbour_doses and observation["dose_ugy_per_hour"] < RAD_OUTLIER_FRACTION * min(neighbour_doses):
            continue
        kept.append(observation)
    return kept


def read_rad_observations(path):
    """Read the RAD RDR dose observations (plastic E detector, absorbed dose rate in uGy/h).

    Returns a list of dicts sorted by time: {"centre_utc": datetime, "duration_s": int, "dose_ugy_per_hour": float}.
    Observations shorter than 300 s, without a positive E dose, or far below their neighbours
    (truncated) are dropped.
    Note: START_OBS_MARS in this file is local TRUE solar time, so UTC is used for all timing.
    """
    with open(path, encoding="ascii", errors="replace") as handle:
        text = handle.read()

    observations = {}
    for match in re.finditer(r"\[OBSERVATION: (\d+)\]\n(.*?)\n\n", text, re.S):
        block = match.group(2)
        utc_match = re.search(r'START_OBS_UTC="([^"]+)"', block)
        duration_match = re.search(r"OBS_DURATION=(\d+)", block)
        if utc_match and duration_match:
            observations[match.group(1)] = {
                "start_utc": parse_rad_utc(utc_match.group(1)),
                "duration_s": int(duration_match.group(1)),
            }

    for match in re.finditer(r"\[DOSIMETRY_TOTAL_DOSE_E: (\d+)\]\n\n([-\d.eE+]+)", text):
        observation = observations.get(match.group(1))
        if observation is not None:
            observation["dose_ugy_per_hour"] = float(match.group(2))

    results = []
    for observation in observations.values():
        dose = observation.get("dose_ugy_per_hour")
        if dose is None or dose <= 0:
            continue
        if observation["duration_s"] < RAD_MINIMUM_OBSERVATION_SECONDS:
            continue
        centre = observation["start_utc"] + datetime.timedelta(seconds=observation["duration_s"] / 2)
        results.append(
            {
                "centre_utc": centre,
                "duration_s": observation["duration_s"],
                "dose_ugy_per_hour": dose,
            }
        )
    results.sort(key=lambda item: item["centre_utc"])
    return drop_low_outliers(results)




# ---------------------------------------------------------------- assembling the timeline


def build_provenance(sample_index, interpolated_field_names):
    """Provenance object for one sample (contracts.md 1.5). The sample is always an estimate."""
    if interpolated_field_names:
        interpolation_text = "Interpolated in this bin: " + ", ".join(interpolated_field_names) + "."
    else:
        interpolation_text = "No field interpolated in this bin."

    centre_utc = lmst_to_utc(sample_index * SAMPLE_STEP_CLOCK_SECONDS)
    return {
        "source_dataset": "Curiosity REMS and RAD",
        "product_id": REMS_PRODUCT_ID + " + " + RAD_PRODUCT_ID,
        "timestamp": format_utc_iso(centre_utc),
        "is_estimate": True,
        "uncertainty": ESTIMATED_FIELDS_TEXT + " " + interpolation_text,
    }


def build_timeline_from_readings(rems_readings, rad_observations):
    """Turn REMS readings and RAD observations (already parsed) into the contract dict.

    rems_readings: output of read_rems_columns. rad_observations: output of read_rad_observations.
    Returns the environment_timeline dict (contracts.md 3.14). See the module docstring for the time convention.
    """
    filled = {}
    interpolated = {}

    for field_name in ("air_temperature_c", "ground_temperature_c", "pressure_pa", "uv_abc_w_m2"):
        times, values = rems_readings[field_name]
        means, _counts = bin_readings(times, values)
        filled[field_name], interpolated[field_name] = fill_gaps_circular(means)

    rad_times = [utc_to_lmst_clock_seconds(item["centre_utc"]) for item in rad_observations]
    rad_values = [item["dose_ugy_per_hour"] for item in rad_observations]
    rad_means, _counts = bin_readings(rad_times, rad_values)
    filled["radiation_dose_rate_ugy_per_hour"], interpolated["radiation_dose_rate_ugy_per_hour"] = (
        fill_gaps_circular(rad_means)
    )

    smoothed_uv = rolling_max_circular(filled["uv_abc_w_m2"], UV_SMOOTHING_WINDOW_SAMPLES)

    samples = []
    for sample_index in range(SAMPLE_COUNT):
        clock_seconds = sample_index * SAMPLE_STEP_CLOCK_SECONDS
        interpolated_names = [name for name in FIELD_NAMES if interpolated[name][sample_index]]
        dose_equivalent = filled["radiation_dose_rate_ugy_per_hour"][sample_index] * RAD_QUALITY_FACTOR
        samples.append(
            {
                "seconds_since_replay_start": round(clock_seconds_to_si_seconds(clock_seconds), 3),
                "local_mean_solar_time": format_lmst(clock_seconds),
                "air_temperature_c": round(float(filled["air_temperature_c"][sample_index]), 1),
                "ground_temperature_c": round(float(filled["ground_temperature_c"][sample_index]), 1),
                "pressure_pa": round(float(filled["pressure_pa"][sample_index]), 1),
                "uv_index_level": uv_level_from_abc(float(smoothed_uv[sample_index])),
                "dust_opacity_tau": DUST_OPACITY_TAU_ASSUMED,
                "radiation_dose_rate_usv_per_hour": round(float(dose_equivalent), 2),
                "provenance": build_provenance(sample_index, interpolated_names),
            }
        )

    return {
        "replay_source": {"mission": "msl", "instrument_set": ["rems", "rad"], "sol": REPLAY_SOL},
        "samples": samples,
    }


def build_environment_timeline():
    """Read the real sol 4760 REMS and RAD files and return the environment_timeline dict (contracts.md 3.14).

    96 samples, one per 15 LMST minutes from 00:00 to 23:45. See the module docstring for the time convention.
    """
    rems_readings = read_rems_columns(REMS_PATH, REPLAY_SOL)
    rad_observations = read_rad_observations(RAD_PATH)
    return build_timeline_from_readings(rems_readings, rad_observations)


def count_interpolated_samples(timeline):
    """Return {field name: number of samples where that field was interpolated}, read from the provenance text."""
    counts = {}
    for sample in timeline["samples"]:
        text = sample["provenance"]["uncertainty"]
        marker = "Interpolated in this bin: "
        if marker not in text:
            continue
        names = text.split(marker)[1].rstrip(".").split(", ")
        for name in names:
            counts[name] = counts.get(name, 0) + 1
    return counts




# ---------------------------------------------------------------- solar particle event profile (reference data)

SPE_ELEVATED_FACTOR = 1.5
SPE_BASELINE_OBSERVATION_COUNT = 10
SPE_STEP_MINUTES = 10
SPE_MINUTES_BEFORE_ONSET = 30


def build_spe_profile_from_observations(observations):
    """Build the SPE profile dict from parsed RAD observations of the SPE sol. See build_spe_profile."""
    baseline = statistics.median(
        item["dose_ugy_per_hour"] for item in observations[:SPE_BASELINE_OBSERVATION_COUNT]
    )

    onset_observation = None
    for observation in observations:
        if observation["dose_ugy_per_hour"] > SPE_ELEVATED_FACTOR * baseline:
            onset_observation = observation
            break
    if onset_observation is None:
        raise ValueError("no elevated observation found: this sol has no solar particle event")
    onset_utc = onset_observation["centre_utc"] - datetime.timedelta(seconds=onset_observation["duration_s"] / 2)

    seconds_axis = np.array([(item["centre_utc"] - onset_utc).total_seconds() for item in observations])
    dose_axis = np.array([item["dose_ugy_per_hour"] for item in observations])

    first_minute = -SPE_MINUTES_BEFORE_ONSET
    last_minute = int(seconds_axis[-1] // 60)
    samples = []
    for minute in range(first_minute, last_minute + 1, SPE_STEP_MINUTES):
        dose = float(np.interp(minute * 60.0, seconds_axis, dose_axis))
        samples.append(
            {
                "minutes_since_onset": minute,
                "dose_rate_ugy_per_hour": round(dose, 2),
                "dose_rate_usv_per_hour_upper_bound": round(dose * RAD_QUALITY_FACTOR, 1),
            }
        )

    notes = (
        "Real RAD plastic (E) detector dose rate from MSL sol 4190 (product " + RAD_SPE_PRODUCT_ID + "), "
        "linearly interpolated between observation centres (observations of 481 to 961 s). "
        "Onset (minutes_since_onset 0) is the start of the first observation above 1.5 times the pre-event "
        "baseline, " + onset_utc.strftime("%Y-%m-%dT%H:%M:%SZ") + "; the steep rise follows within about 15 minutes. "
        "The DONKI CME id marks the coronal mass ejection from a backsided active region, not the arrival time. "
        "uSv/h is an upper bound: absorbed dose times the surface quality factor 3.05 (Hassler et al. 2014), "
        "which is probably too high for solar energetic protons. "
        "Truncated observations were dropped. NASA reported 8,100 microgray for an astronaut next to Curiosity; "
        "this sol's dosimetry totals only about 1.3 to 1.6 mGy, so that figure is not reproduced here "
        "(unresolved, cite as NASA reported). Estimates, not measured dose equivalent."
    )

    return {
        "event": "2024-05-20 solar energetic particle event",
        "donki_cme_id": "2024-05-20T05:36:00-CME-001",
        "sol": SPE_SOL,
        "baseline_ugy_per_hour": round(float(baseline), 2),
        "samples": samples,
        "notes": notes,
    }


def build_spe_profile():
    """Return the real 20 May 2024 solar energetic particle event profile from RAD sol 4190.

    Reference data for Stage 3, not written by the pipeline. Dict keys: event, donki_cme_id, sol,
    baseline_ugy_per_hour, samples (minutes_since_onset, dose_rate_ugy_per_hour,
    dose_rate_usv_per_hour_upper_bound, every 10 minutes from 30 minutes before onset to the end of the sol),
    notes.
    """
    observations = read_rad_observations(RAD_SPE_PATH)
    return build_spe_profile_from_observations(observations)




# ---------------------------------------------------------------- command line


def print_timeline_table(timeline):
    """Print every 4th sample as a compact table, then min and max per field."""
    print("replay_source:", json.dumps(timeline["replay_source"]))
    print("LMST      t_s       air_C  gnd_C  P_Pa   UV         tau  dose_uSv/h  interpolated")
    for sample in timeline["samples"][::4]:
        interpolated = sample["provenance"]["uncertainty"].split("Interpolated in this bin: ")
        interpolated_text = interpolated[1].rstrip(".") if len(interpolated) > 1 else "-"
        print(
            "%s  %8.1f  %6.1f %6.1f %6.1f  %-9s  %.1f  %6.2f      %s"
            % (
                sample["local_mean_solar_time"],
                sample["seconds_since_replay_start"],
                sample["air_temperature_c"],
                sample["ground_temperature_c"],
                sample["pressure_pa"],
                sample["uv_index_level"],
                sample["dust_opacity_tau"],
                sample["radiation_dose_rate_usv_per_hour"],
                interpolated_text,
            )
        )

    for field_name in (
        "air_temperature_c",
        "ground_temperature_c",
        "pressure_pa",
        "radiation_dose_rate_usv_per_hour",
    ):
        values = [sample[field_name] for sample in timeline["samples"]]
        print("%s: min %s max %s" % (field_name, min(values), max(values)))
    levels = sorted({sample["uv_index_level"] for sample in timeline["samples"]})
    print("uv_index_level values:", levels)
    print("samples:", len(timeline["samples"]), "interpolated counts per field:", count_interpolated_samples(timeline))


def main():
    """Command line: no flag prints the sol 4760 timeline table, --spe prints the SPE profile as JSON."""
    if "--spe" in sys.argv:
        print(json.dumps(build_spe_profile(), indent=2))
    else:
        print_timeline_table(build_environment_timeline())


if __name__ == "__main__":
    main()
