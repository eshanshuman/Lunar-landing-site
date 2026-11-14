"""Geometry for the Sunlight-map grids (pipeline/build_grids.py). Pure numpy, no I/O.

A grid is a square of points in the tangent plane at a centre site. For every point we need the
Sun's and Earth's azimuth and elevation *as seen from that point*. Horizons gives them for the
centre site only, so we turn the site's (az, el) into a direction in the Moon-fixed frame and
read that same direction in the point's own east / north / up frame.

That treats the Sun and Earth as infinitely far away. Across a 20 km grid the error is far below
the Sun's angular size (parallax to Earth over 10 km is about 0.0015 degrees).

Moon-fixed frame used here: +x towards (lat 0, lon 0), +y towards (lat 0, lon 90 E), +z north.
"""
from __future__ import annotations

import numpy as np

MOON_RADIUS_M = 1_737_400.0


def enu(lat_deg, lon_deg):
    """East, north and up unit vectors at (lat, east lon). Each has shape (..., 3)."""
    la = np.deg2rad(np.asarray(lat_deg, dtype=float))
    lo = np.deg2rad(np.asarray(lon_deg, dtype=float))
    e = np.stack([-np.sin(lo), np.cos(lo), np.zeros_like(lo)], axis=-1)
    n = np.stack([-np.sin(la) * np.cos(lo), -np.sin(la) * np.sin(lo), np.cos(la)], axis=-1)
    u = np.stack([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)], axis=-1)
    return e, n, u


def azel_to_vector(lat_deg, lon_deg, az_deg, el_deg):
    """Moon-fixed unit vector towards (az clockwise from north, el above the horizontal) at a site."""
    e, n, u = enu(lat_deg, lon_deg)
    az = np.deg2rad(np.asarray(az_deg, dtype=float))[..., None]
    el = np.deg2rad(np.asarray(el_deg, dtype=float))[..., None]
    return np.cos(el) * (np.sin(az) * e + np.cos(az) * n) + np.sin(el) * u


def vector_to_azel(lat_deg, lon_deg, vec):
    """(az, el) in degrees of Moon-fixed unit vector(s) `vec` as seen from (lat, lon). az is in [0, 360)."""
    e, n, u = enu(lat_deg, lon_deg)
    ve = np.sum(vec * e, axis=-1)
    vn = np.sum(vec * n, axis=-1)
    vu = np.sum(vec * u, axis=-1)
    az = np.rad2deg(np.arctan2(ve, vn)) % 360.0
    az = np.where(az >= 360.0, 0.0, az)  # a tiny negative angle wraps to exactly 360.0 in floating point
    el = np.rad2deg(np.arcsin(np.clip(vu, -1.0, 1.0)))
    return az, el


def convert_azel(site_lat, site_lon, point_lat, point_lon, az_deg, el_deg):
    """Azimuth and elevation at a grid point of a far-away body that the site sees at (az, el).

    `az_deg` / `el_deg` may be arrays (one value per hour). With the point at the site itself the
    result equals the input.
    """
    return vector_to_azel(point_lat, point_lon, azel_to_vector(site_lat, site_lon, az_deg, el_deg))


def offset_to_latlon(lat_deg, lon_deg, east_m, north_m, radius_m: float = MOON_RADIUS_M):
    """(lat, east lon) of the surface point `east_m`, `north_m` from a site, measured in its tangent plane.

    Works across the pole, where "add metres to the latitude" does not. Longitude is in (-180, 180].
    """
    e, n, u = enu(lat_deg, lon_deg)
    east = np.asarray(east_m, dtype=float)[..., None]
    north = np.asarray(north_m, dtype=float)[..., None]
    p = radius_m * u + east * e + north * n
    p = p / np.linalg.norm(p, axis=-1, keepdims=True)
    lat = np.rad2deg(np.arcsin(np.clip(p[..., 2], -1.0, 1.0)))
    lon = np.rad2deg(np.arctan2(p[..., 1], p[..., 0]))
    return lat, lon


def grid_offsets(size: int, spacing_m: float):
    """(east_m, north_m) for every point, row-major from the north-west corner. Each has shape (size * size,)."""
    mid = (size - 1) / 2.0
    row, col = np.divmod(np.arange(size * size), size)
    return (col - mid) * spacing_m, (mid - row) * spacing_m


def horizon_at(mask_deg: np.ndarray, az_deg):
    """Skyline height at any azimuth: linear interpolation of an evenly spaced mask, wrapping at 360."""
    n = mask_deg.shape[-1]
    x = (np.asarray(az_deg, dtype=float) % 360.0) / 360.0 * n
    a = np.floor(x).astype(np.intp) % n
    f = x - np.floor(x)
    return mask_deg[a] * (1 - f) + mask_deg[(a + 1) % n] * f


def pack_bits(visible: np.ndarray) -> bytes:
    """Pack a (points, hours) boolean array: each point gets ceil(hours / 8) bytes, hour h is bit (h & 7)
    of byte (h >> 3), LSB first. This is the layout the app reads (src/types.ts, GridData)."""
    return np.packbits(np.asarray(visible, dtype=bool), axis=1, bitorder="little").tobytes()
