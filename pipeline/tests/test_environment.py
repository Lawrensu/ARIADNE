"""Tests for ariadne_pipeline.environment using synthetic data (no raw files needed)."""

import datetime

import numpy as np

from ariadne_pipeline import environment


EXPECTED_SAMPLE_KEYS = {
    "seconds_since_replay_start",
    "local_mean_solar_time",
    "air_temperature_c",
    "ground_temperature_c",
    "pressure_pa",
    "uv_index_level",
    "dust_opacity_tau",
    "radiation_dose_rate_usv_per_hour",
    "provenance",
}
EXPECTED_PROVENANCE_KEYS = {"source_dataset", "product_id", "timestamp", "is_estimate", "uncertainty"}


def make_flat_rems_readings(bin_indices_with_data, air_k=200.0, ground_k=210.0, pressure=700.0, uv=0.0):
    """One reading at the centre of each listed bin, same values everywhere."""
    times = [index * 900.0 for index in bin_indices_with_data]
    count = len(times)
    return {
        "air_temperature_c": (times, [environment.kelvin_to_celsius(air_k)] * count),
        "ground_temperature_c": (times, [environment.kelvin_to_celsius(ground_k)] * count),
        "pressure_pa": (times, [pressure] * count),
        "uv_abc_w_m2": (times, [uv] * count),
    }


def make_rad_observations(dose_ugy_per_hour=6.0):
    """RAD observations every 900 s of LMST for the whole sol."""
    observations = []
    for index in range(environment.SAMPLE_COUNT):
        centre_utc = environment.lmst_to_utc(index * 900.0 + 5.0)
        observations.append({"centre_utc": centre_utc, "duration_s": 481, "dose_ugy_per_hour": dose_ugy_per_hour})
    return observations




# ---------------------------------------------------------------- conversions


def test_kelvin_to_celsius():
    assert environment.kelvin_to_celsius(273.15) == 0.0
    assert abs(environment.kelvin_to_celsius(212.61) - (-60.54)) < 1e-9


def test_format_lmst():
    assert environment.format_lmst(0) == "00:00:00"
    assert environment.format_lmst(900) == "00:15:00"
    assert environment.format_lmst(23 * 3600 + 45 * 60) == "23:45:00"


def test_sample_seconds_use_mars_seconds():
    one_lmst_hour = environment.clock_seconds_to_si_seconds(3600)
    assert abs(one_lmst_hour - 3698.97) < 0.01
    assert abs(environment.clock_seconds_to_si_seconds(86400) - 88775.244) < 1e-6


def test_utc_lmst_round_trip():
    utc = environment.lmst_to_utc(40000.0)
    assert abs(environment.utc_to_lmst_clock_seconds(utc) - 40000.0) < 1e-3




# ---------------------------------------------------------------- UV thresholds


def test_uv_thresholds():
    assert environment.uv_level_from_abc(0.0) == "low"
    assert environment.uv_level_from_abc(0.99) == "low"
    assert environment.uv_level_from_abc(1.0) == "moderate"
    assert environment.uv_level_from_abc(2.99) == "moderate"
    assert environment.uv_level_from_abc(3.0) == "high"
    assert environment.uv_level_from_abc(5.99) == "high"
    assert environment.uv_level_from_abc(6.0) == "very_high"
    assert environment.uv_level_from_abc(8.99) == "very_high"
    assert environment.uv_level_from_abc(9.0) == "extreme"
    assert environment.uv_level_from_abc(15.0) == "extreme"


def test_rolling_median_removes_single_spike_and_wraps():
    values = np.zeros(96)
    values[40] = 10.0
    values[0] = 8.0
    smoothed = environment.rolling_median_circular(values, 5)
    assert smoothed[40] == 0.0
    assert smoothed[0] == 0.0
    assert smoothed[95] == 0.0




# ---------------------------------------------------------------- binning and interpolation


def test_bin_readings_means_and_counts():
    times = [880.0, 920.0, 1360.0]
    values = [10.0, 20.0, 50.0]
    means, counts = environment.bin_readings(times, values)
    assert counts[1] == 2 and means[1] == 15.0
    assert counts[2] == 1 and means[2] == 50.0
    assert counts.sum() == 3
    assert np.isnan(means[50])


def test_bin_edges_are_centred_on_samples():
    means, counts = environment.bin_readings([449.0, 451.0], [1.0, 2.0])
    assert counts[0] == 1 and means[0] == 1.0
    assert counts[1] == 1 and means[1] == 2.0


def test_bin_wraps_at_midnight():
    means, counts = environment.bin_readings([86400 - 100.0, 100.0], [10.0, 20.0])
    assert counts[0] == 2
    assert means[0] == 15.0


def test_fill_gaps_linear():
    means = np.full(96, np.nan)
    means[10] = 0.0
    means[14] = 8.0
    filled, interpolated = environment.fill_gaps_circular(means)
    assert filled[12] == 4.0
    assert interpolated[12] and not interpolated[10] and not interpolated[14]


def test_fill_gaps_wraps_around_midnight():
    means = np.full(96, np.nan)
    means[94] = 10.0
    means[2] = 18.0
    filled, interpolated = environment.fill_gaps_circular(means)
    assert filled[95] == 12.0
    assert filled[0] == 14.0
    assert filled[1] == 16.0
    assert interpolated[95] and interpolated[0] and interpolated[1]


def test_fill_gaps_all_nan_stays_nan():
    filled, interpolated = environment.fill_gaps_circular(np.full(96, np.nan))
    assert np.all(np.isnan(filled))
    assert np.all(interpolated)




# ---------------------------------------------------------------- RAD parsing helpers


def test_parse_rad_utc():
    parsed = environment.parse_rad_utc("2025-360 10:42:16")
    assert parsed == datetime.datetime(2025, 12, 26, 10, 42, 16, tzinfo=datetime.timezone.utc)


def test_drop_low_outliers_removes_truncated_observation():
    base = datetime.datetime(2024, 1, 1, tzinfo=datetime.timezone.utc)
    observations = [
        {"centre_utc": base + datetime.timedelta(minutes=10 * i), "duration_s": 481, "dose_ugy_per_hour": dose}
        for i, dose in enumerate([80.0, 78.0, 6.0, 75.0, 74.0])
    ]
    kept = environment.drop_low_outliers(observations)
    assert [item["dose_ugy_per_hour"] for item in kept] == [80.0, 78.0, 75.0, 74.0]




# ---------------------------------------------------------------- contract shape


def test_contract_shape_with_synthetic_data():
    rems = make_flat_rems_readings(range(0, 96, 2))
    timeline = environment.build_timeline_from_readings(rems, make_rad_observations(6.0))

    assert set(timeline.keys()) == {"replay_source", "samples"}
    assert timeline["replay_source"] == {"mission": "msl", "instrument_set": ["rems", "rad"], "sol": 4760}

    samples = timeline["samples"]
    assert len(samples) == 96
    seconds = [sample["seconds_since_replay_start"] for sample in samples]
    assert seconds == sorted(seconds)
    assert seconds[0] == 0.0
    assert abs(seconds[1] - 924.742) < 0.01

    for sample in samples:
        assert set(sample.keys()) == EXPECTED_SAMPLE_KEYS
        assert set(sample["provenance"].keys()) == EXPECTED_PROVENANCE_KEYS
        assert sample["provenance"]["is_estimate"] is True
        assert sample["provenance"]["source_dataset"] == "Curiosity REMS and RAD"
        assert sample["provenance"]["timestamp"].endswith("Z")
        assert sample["uv_index_level"] in {"low", "moderate", "high", "very_high", "extreme"}
        assert sample["dust_opacity_tau"] == 0.5

    assert samples[0]["local_mean_solar_time"] == "00:00:00"
    assert samples[95]["local_mean_solar_time"] == "23:45:00"
    assert abs(samples[0]["air_temperature_c"] - (-73.15)) < 0.06
    assert samples[0]["pressure_pa"] == 700.0
    assert abs(samples[0]["radiation_dose_rate_usv_per_hour"] - 18.3) < 0.01


def test_interpolated_bins_are_marked_in_provenance():
    rems = make_flat_rems_readings(range(0, 96, 2))
    timeline = environment.build_timeline_from_readings(rems, make_rad_observations(6.0))
    measured = timeline["samples"][2]["provenance"]["uncertainty"]
    gap = timeline["samples"][3]["provenance"]["uncertainty"]
    assert "No field interpolated" in measured
    assert "Interpolated in this bin" in gap
    assert "air_temperature_c" in gap
    assert "uv_index_level" in gap and "dust_opacity_tau" in gap
