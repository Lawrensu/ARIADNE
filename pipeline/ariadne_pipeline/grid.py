"""The local grid: the only coordinate system the app sees (docs/contracts.md 1.1).

Origin is the north-west corner of the patch. +x is east, +z is south, units are metres.
All georeferencing happens here, once.
"""

from dataclasses import dataclass
import math

import numpy as np
import rasterio
from rasterio.transform import Affine
from rasterio.warp import Resampling, reproject, transform as warp_transform, transform_bounds
from rasterio.windows import from_bounds

from ariadne_pipeline import settings




# ---------------------------------------------------------------- coordinate systems

PATCH_CENTRE_LAT = (settings.PATCH_NORTH_LAT + settings.PATCH_SOUTH_LAT) / 2.0
PATCH_CENTRE_LON = (settings.PATCH_WEST_LON + settings.PATCH_EAST_LON) / 2.0

# Equirectangular projection with true scale at the patch centre, on the same
# Mars sphere as the HiRISE products. Distortion across 2 km is negligible.
LOCAL_CRS = (
    f"+proj=eqc +lat_ts={PATCH_CENTRE_LAT} +lat_0=0 +lon_0={PATCH_CENTRE_LON} "
    f"+x_0=0 +y_0=0 +R={settings.MARS_SPHERE_RADIUS_M} +units=m +no_defs"
)
GEOGRAPHIC_CRS = f"+proj=longlat +R={settings.MARS_SPHERE_RADIUS_M} +no_defs"




# ---------------------------------------------------------------- grid definition


@dataclass(frozen=True)
class LocalGrid:
    """A raster grid aligned with the patch. Several grids share the same origin."""

    cell_size_m: float
    width: int
    height: int
    origin_x_projected: float
    origin_y_projected: float

    @property
    def transform(self):
        return Affine(self.cell_size_m, 0.0, self.origin_x_projected, 0.0, -self.cell_size_m, self.origin_y_projected)

    @property
    def width_m(self):
        return self.width * self.cell_size_m

    @property
    def height_m(self):
        return self.height * self.cell_size_m


def _patch_corners_projected():
    xs, ys = warp_transform(
        GEOGRAPHIC_CRS,
        LOCAL_CRS,
        [settings.PATCH_WEST_LON, settings.PATCH_EAST_LON],
        [settings.PATCH_NORTH_LAT, settings.PATCH_SOUTH_LAT],
    )
    west_x, east_x = xs
    north_y, south_y = ys
    return west_x, east_x, north_y, south_y


def make_grid(cell_size_m):
    """Build a grid with the given cell size.

    The export grid size (in whole export cells) fixes the extent, so every grid,
    whatever its cell size, covers exactly the same rectangle.
    """
    west_x, east_x, north_y, south_y = _patch_corners_projected()
    export_width = int(round((east_x - west_x) / settings.EXPORT_CELL_SIZE_M))
    export_height = int(round((north_y - south_y) / settings.EXPORT_CELL_SIZE_M))
    extent_x_m = export_width * settings.EXPORT_CELL_SIZE_M
    extent_z_m = export_height * settings.EXPORT_CELL_SIZE_M

    width = int(round(extent_x_m / cell_size_m))
    height = int(round(extent_z_m / cell_size_m))
    exact_cell_x = extent_x_m / width
    exact_cell_z = extent_z_m / height
    if not math.isclose(exact_cell_x, exact_cell_z, rel_tol=1e-6):
        # Only happens for cell sizes that do not divide the extent evenly (e.g. texture).
        # We keep square cells by using the x size; the last row may fall a fraction short.
        pass
    return LocalGrid(
        cell_size_m=exact_cell_x,
        width=width,
        height=height,
        origin_x_projected=west_x,
        origin_y_projected=north_y,
    )


def export_grid():
    return make_grid(settings.EXPORT_CELL_SIZE_M)


def compute_grid():
    return make_grid(settings.COMPUTE_CELL_SIZE_M)




# ---------------------------------------------------------------- conversions


def latlon_to_xz(latitude_deg, longitude_deg):
    """Planetocentric lat/lon to local grid metres (x east, z south from the NW corner)."""
    xs, ys = warp_transform(GEOGRAPHIC_CRS, LOCAL_CRS, [longitude_deg], [latitude_deg])
    reference = export_grid()
    x_m = xs[0] - reference.origin_x_projected
    z_m = reference.origin_y_projected - ys[0]
    return float(x_m), float(z_m)


def xz_to_latlon(x_m, z_m):
    reference = export_grid()
    projected_x = reference.origin_x_projected + x_m
    projected_y = reference.origin_y_projected - z_m
    lons, lats = warp_transform(LOCAL_CRS, GEOGRAPHIC_CRS, [projected_x], [projected_y])
    return float(lats[0]), float(lons[0])


def xz_to_rowcol(grid, x_m, z_m):
    col = int(math.floor(x_m / grid.cell_size_m))
    row = int(math.floor(z_m / grid.cell_size_m))
    return row, col


def rowcol_to_xz(grid, row, col):
    """Cell centre, as in contracts.md 1.1."""
    x_m = (col + 0.5) * grid.cell_size_m
    z_m = (row + 0.5) * grid.cell_size_m
    return x_m, z_m




# ---------------------------------------------------------------- reading rasters onto a grid


def read_onto_grid(source_path, grid, resampling=Resampling.bilinear, band=1, source_decimation=1):
    """Warp one band of a georeferenced raster onto the grid. Returns float64 with NaN for no-data.

    source_decimation > 1 reads the source at reduced resolution first (fast for big images).
    """
    with rasterio.open(source_path) as source:
        west, south, east, north = transform_bounds(
            LOCAL_CRS,
            source.crs,
            grid.origin_x_projected,
            grid.origin_y_projected - grid.height_m,
            grid.origin_x_projected + grid.width_m,
            grid.origin_y_projected,
            densify_pts=21,
        )
        margin = 50 * abs(source.res[0])
        window = from_bounds(west - margin, south - margin, east + margin, north + margin, source.transform)
        window = window.round_offsets().round_lengths()
        window = window.intersection(rasterio.windows.Window(0, 0, source.width, source.height))

        out_height = max(1, int(window.height // source_decimation))
        out_width = max(1, int(window.width // source_decimation))
        data = source.read(band, window=window, out_shape=(out_height, out_width), masked=True).astype("float64")
        window_transform = source.window_transform(window)
        scale_x = window.width / out_width
        scale_y = window.height / out_height
        data_transform = window_transform * Affine.scale(scale_x, scale_y)
        source_array = data.filled(np.nan)
        source_array[source_array < -1e30] = np.nan

        destination = np.full((grid.height, grid.width), np.nan, dtype="float64")
        reproject(
            source=source_array,
            destination=destination,
            src_transform=data_transform,
            src_crs=source.crs,
            src_nodata=np.nan,
            dst_transform=grid.transform,
            dst_crs=LOCAL_CRS,
            dst_nodata=np.nan,
            resampling=resampling,
        )
    return destination




# ---------------------------------------------------------------- moving between the 1 m and 2 m grids


def block_reduce(array, factor, statistic):
    """Combine factor × factor blocks. statistic is "mean" or "max"."""
    height, width = array.shape
    trimmed = array[: height - height % factor, : width - width % factor]
    blocks = trimmed.reshape(trimmed.shape[0] // factor, factor, trimmed.shape[1] // factor, factor)
    if statistic == "mean":
        return np.nanmean(blocks, axis=(1, 3))
    if statistic == "max":
        return np.nanmax(blocks, axis=(1, 3))
    raise ValueError(f"unknown statistic: {statistic}")
