"""Tests for ariadne_pipeline.regional (no network)."""

import numpy as np
import rasterio
from rasterio.transform import Affine
from PIL import Image

from ariadne_pipeline import regional
from ariadne_pipeline.grid import GEOGRAPHIC_CRS


def test_patch_rect_on_synthetic_transform():
    west_x, east_x, north_y, south_y = regional.patch_corners_projected()
    pixel_size = 100.0
    transform = Affine(pixel_size, 0.0, west_x - 1000.0, 0.0, -pixel_size, north_y + 1500.0)
    rect = regional.patch_rect_px(transform)
    assert rect["x"] == 10
    assert rect["y"] == 15
    assert abs(rect["width"] - (east_x - west_x) / pixel_size) <= 1
    assert abs(rect["height"] - (north_y - south_y) / pixel_size) <= 1


def test_build_regional_context_from_synthetic_raster(tmp_path):
    source_path = tmp_path / "synthetic.tif"
    degrees_per_pixel = 0.01
    transform = Affine(degrees_per_pixel, 0.0, 136.0, 0.0, -degrees_per_pixel, -4.0)
    data = np.tile(np.linspace(0, 255, 400, dtype=np.uint8), (400, 1))
    with rasterio.open(source_path, "w", driver="GTiff", width=400, height=400, count=3, dtype="uint8",
                       crs=GEOGRAPHIC_CRS, transform=transform) as target:
        for band in (1, 2, 3):
            target.write(data, band)

    output_path = tmp_path / "gale_context.jpg"
    context, provenance = regional.build_regional_context(output_path, source_path=str(source_path), size_px=500)

    assert context["file"] == "gale_context.jpg"
    assert context["width_px"] == 500 and context["height_px"] == 500
    rect = context["patch_rect_px"]
    centre_x = rect["x"] + rect["width"] / 2.0
    centre_y = rect["y"] + rect["height"] / 2.0
    # Patch centre is about 0.6 deg north and 0.4 deg west of the Gale centre: left of and above middle.
    assert centre_x < 250 and centre_y < 250
    assert 0 <= rect["x"] and rect["x"] + rect["width"] <= 500
    assert Image.open(output_path).size == (500, 500)
    assert set(provenance) == {"source_dataset", "product_id", "resolution_m", "url", "licence_credit"}
