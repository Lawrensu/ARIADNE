"""Regional context image for the Planning Table (docs/contracts.md 3.17 and 3.1).

A north-up picture of Gale Crater in the local projected CRS (metres), so the patch
rectangle sits in the same projection as the rest of the app. The rectangle is not
drawn into the image; the app draws it from `patch_rect_px`.
"""

import numpy as np
import rasterio
from PIL import Image
from rasterio.transform import Affine
from rasterio.warp import Resampling, reproject, transform as warp_transform

from ariadne_pipeline import settings
from ariadne_pipeline.grid import GEOGRAPHIC_CRS, LOCAL_CRS




# ---------------------------------------------------------------- constants

REGIONAL_SOURCE_URL = "https://planetarymaps.usgs.gov/mosaic/Mars_Viking_MDIM21_ClrMosaic_global_232m.tif"
REGIONAL_SOURCE_DATASET = "Viking MDIM 2.1 Colorized Global Mosaic"
REGIONAL_PRODUCT_ID = "Mars_Viking_MDIM21_ClrMosaic_global_232m"
REGIONAL_SOURCE_RESOLUTION_M = 232
REGIONAL_LICENCE_CREDIT = "NASA/JPL/USGS Astrogeology Science Center (public domain)"

GALE_CENTRE_LAT = -5.4
GALE_CENTRE_LON = 137.8
REGIONAL_EXTENT_M = 200_000.0
REGIONAL_IMAGE_SIZE_PX = 2000
REGIONAL_FILE_NAME = "gale_context.jpg"
JPEG_QUALITY = 88




# ---------------------------------------------------------------- patch rectangle


def patch_corners_projected():
    """Return (west_x, east_x, north_y, south_y) of the patch in LOCAL_CRS metres."""
    xs, ys = warp_transform(
        GEOGRAPHIC_CRS,
        LOCAL_CRS,
        [settings.PATCH_WEST_LON, settings.PATCH_EAST_LON],
        [settings.PATCH_NORTH_LAT, settings.PATCH_SOUTH_LAT],
    )
    return xs[0], xs[1], ys[0], ys[1]


def patch_rect_px(image_transform):
    """Return the patch rectangle as {"x", "y", "width", "height"} in image pixels.

    image_transform maps image pixel (col, row) to LOCAL_CRS metres (north-up).
    """
    west_x, east_x, north_y, south_y = patch_corners_projected()
    inverse = ~image_transform
    left_px, top_px = inverse @ (west_x, north_y)
    right_px, bottom_px = inverse @ (east_x, south_y)
    x = int(round(left_px))
    y = int(round(top_px))
    width = max(1, int(round(right_px)) - x)
    height = max(1, int(round(bottom_px)) - y)
    return {"x": x, "y": y, "width": width, "height": height}


def regional_image_transform(centre_lat, centre_lon, extent_m, size_px):
    """Return the north-up Affine of a square image of extent_m centred on lat/lon."""
    xs, ys = warp_transform(GEOGRAPHIC_CRS, LOCAL_CRS, [centre_lon], [centre_lat])
    pixel_size_m = extent_m / size_px
    origin_x = xs[0] - extent_m / 2.0
    origin_y = ys[0] + extent_m / 2.0
    return Affine(pixel_size_m, 0.0, origin_x, 0.0, -pixel_size_m, origin_y)




# ---------------------------------------------------------------- build


def build_regional_context(output_path, source_path=None, centre_lat=GALE_CENTRE_LAT, centre_lon=GALE_CENTRE_LON,
                           extent_m=REGIONAL_EXTENT_M, size_px=REGIONAL_IMAGE_SIZE_PX):
    """Write the regional context JPEG and return (regional_context, provenance).

    source_path defaults to the USGS Viking MDIM 2.1 colour mosaic, read by window over
    HTTP (only the needed rows are fetched). Pass a local raster for tests.
    regional_context matches contracts.md 3.1; provenance lists the dataset details.
    """
    if source_path is None:
        source_path = "/vsicurl/" + REGIONAL_SOURCE_URL
    image_transform = regional_image_transform(centre_lat, centre_lon, extent_m, size_px)

    with rasterio.open(source_path) as source:
        band_count = min(source.count, 3)
        destination = np.zeros((band_count, size_px, size_px), dtype=np.uint8)
        for band_index in range(1, band_count + 1):
            reproject(
                source=rasterio.band(source, band_index),
                destination=destination[band_index - 1],
                dst_transform=image_transform,
                dst_crs=LOCAL_CRS,
                resampling=Resampling.cubic,
            )

    if band_count == 1:
        destination = np.repeat(destination, 3, axis=0)
    picture = Image.fromarray(np.moveaxis(destination, 0, -1), mode="RGB")
    picture.save(output_path, format="JPEG", quality=JPEG_QUALITY)

    regional_context = {
        "file": REGIONAL_FILE_NAME,
        "width_px": size_px,
        "height_px": size_px,
        "patch_rect_px": patch_rect_px(image_transform),
    }
    provenance = {
        "source_dataset": REGIONAL_SOURCE_DATASET,
        "product_id": REGIONAL_PRODUCT_ID,
        "resolution_m": REGIONAL_SOURCE_RESOLUTION_M,
        "url": REGIONAL_SOURCE_URL,
        "licence_credit": REGIONAL_LICENCE_CREDIT,
    }
    return regional_context, provenance




# ---------------------------------------------------------------- offline cache (so runs do not need the network)

REGIONAL_CACHE_PATH = settings.RAW_DIR / "regional" / "gale_mdim21_crop.tif"
CACHE_MARGIN_DEG = 0.3


def cache_source_crop(cache_path=REGIONAL_CACHE_PATH):
    """Read the Gale area once from the USGS mosaic over HTTP and save it as a local GeoTIFF.

    Returns the cache path. Does nothing if the cache already exists.
    """
    from rasterio.warp import transform_bounds
    from rasterio.windows import from_bounds

    if cache_path.exists():
        return cache_path
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    metres_per_degree = settings.MARS_SPHERE_RADIUS_M * 3.141592653589793 / 180.0
    half_extent_deg = REGIONAL_EXTENT_M / 2.0 / metres_per_degree + CACHE_MARGIN_DEG
    west = GALE_CENTRE_LON - half_extent_deg
    east = GALE_CENTRE_LON + half_extent_deg
    south = GALE_CENTRE_LAT - half_extent_deg
    north = GALE_CENTRE_LAT + half_extent_deg
    with rasterio.open("/vsicurl/" + REGIONAL_SOURCE_URL) as source:
        left, bottom, right, top = transform_bounds(GEOGRAPHIC_CRS, source.crs, west, south, east, north)
        window = from_bounds(left, bottom, right, top, source.transform).round_offsets().round_lengths()
        data = source.read(window=window)
        profile = source.profile.copy()
        profile.update(
            driver="GTiff",
            width=data.shape[2],
            height=data.shape[1],
            transform=source.window_transform(window),
            compress="deflate",
            tiled=True,
        )
        profile.pop("blockxsize", None)
        profile.pop("blockysize", None)
        with rasterio.open(cache_path, "w", **profile) as destination:
            destination.write(data)
    return cache_path
