"""Maths for the terrain tiles (pipeline/build_tile.py). Pure numpy, no I/O.

A tile is a square cut from the south polar stereographic DEM, aligned with the DEM's grid:
row 0 is the top (largest grid y), column 0 the left (smallest grid x).

Grid "up" is not local north. On a south polar stereographic grid with central meridian lon0, a
point at east longitude lon has true north pointing along (sin(lon - lon0), cos(lon - lon0)) in
grid (x, y). `grid_north_to_true_north_deg` is that angle: clockwise, from grid +y (the top of the
tile) to true north at the tile centre. The app adds it to a Horizons azimuth (clockwise from true
north) to get the direction in tile axes:

    phi = azimuth + grid_north_to_true_north_deg
    direction in grid (x, y) = (sin phi, cos phi)
"""
from __future__ import annotations

from typing import Callable

import numpy as np

MOON_RADIUS_M = 1_737_400.0


def stereo_south_xy(lat_deg, lon_deg, lon0_deg: float = 0.0, radius_m: float = MOON_RADIUS_M):
    """South polar stereographic (true scale at the pole) on a sphere: (lat, east lon) -> grid (x, y) metres."""
    lat = np.deg2rad(np.asarray(lat_deg, dtype=float))
    dlon = np.deg2rad(np.asarray(lon_deg, dtype=float) - lon0_deg)
    r = 2.0 * radius_m * np.tan(np.pi / 4.0 + lat / 2.0)
    return r * np.sin(dlon), r * np.cos(dlon)


def grid_north_to_true_north_deg(lat_deg: float, lon_deg: float, to_xy: Callable = stereo_south_xy, step_deg: float = 1e-4) -> float:
    """Clockwise angle in degrees, in [0, 360), from grid +y to true north at (lat, lon).

    Measured numerically by stepping a little towards the north pole through `to_xy`, so it follows
    whatever projection the DEM really uses (pass a pyproj transform for the DEM's CRS).
    """
    x0, y0 = to_xy(lat_deg, lon_deg)
    x1, y1 = to_xy(lat_deg + step_deg, lon_deg)
    return float(np.rad2deg(np.arctan2(x1 - x0, y1 - y0)) % 360.0)


def scale_factor(lat_deg: float) -> float:
    """Grid distance / true distance for the south polar stereographic projection (1 at the pole)."""
    return float(2.0 / (1.0 + np.sin(np.deg2rad(-lat_deg))))


def _overlap_weights(n: int, out: int) -> np.ndarray:
    """(out, n) matrix: how much of each source pixel falls in each output cell, in source-pixel units."""
    edges = np.arange(out + 1) * (n / out)
    j = np.arange(n)
    lo = np.maximum(edges[:-1, None], j[None, :])
    hi = np.minimum(edges[1:, None], j[None, :] + 1)
    return np.clip(hi - lo, 0.0, None)


def block_mean(a: np.ndarray, out: int) -> np.ndarray:
    """Area-weighted resample of a square array to out x out, for any size ratio.

    Each output cell is the mean of the source pixels it covers, weighted by overlap area.
    NaNs are ignored; a cell with no valid source stays NaN.
    """
    n = a.shape[0]
    assert a.shape == (n, n), "tile source must be square"
    if n == out:
        return a.astype(np.float64)
    w = _overlap_weights(n, out)
    valid = ~np.isnan(a)
    num = w @ np.where(valid, a, 0.0) @ w.T
    den = w @ valid.astype(np.float64) @ w.T
    with np.errstate(invalid="ignore", divide="ignore"):
        return np.where(den > 0, num / den, np.nan)


def quantise_u16(h: np.ndarray):
    """Heights -> uint16 over [h_min, h_max]. Returns (u16, h_min, h_max). A flat tile maps to all zeros."""
    h_min = float(np.nanmin(h))
    h_max = float(np.nanmax(h))
    span = h_max - h_min
    filled = np.where(np.isnan(h), h_min, h)
    if span <= 0:
        return np.zeros(h.shape, dtype=np.uint16), h_min, h_max
    return np.round((filled - h_min) / span * 65535.0).astype(np.uint16), h_min, h_max


def dequantise_u16(u16: np.ndarray, h_min: float, h_max: float) -> np.ndarray:
    """Inverse of `quantise_u16`: the formula the app uses to read the PNG."""
    return h_min + u16.astype(np.float64) / 65535.0 * (h_max - h_min)
