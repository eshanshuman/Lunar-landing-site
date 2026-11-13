"""Terrain horizon-mask maths (PLAN.md §5.2). Pure numpy, no I/O, so it is unit-testable.

The DEM is a 2-D array of heights in metres above the lunar reference sphere, on a square-pixel
planar grid (the polar stereographic projection of the LOLA polar products). Row 0 is the top
(largest y); x grows with the column index.

For each azimuth we walk outwards from the observer and keep the largest elevation angle:

    angle = atan2(h_target - h_observer - d^2 / (2 R), d)

The d^2 / (2R) term is how far the reference sphere falls away below the observer's horizontal
plane at ground distance d. There is no refraction term: the Moon has no atmosphere.
"""
from __future__ import annotations

import numpy as np

MOON_RADIUS_M = 1_737_400.0


def bilinear(dem: np.ndarray, rows: np.ndarray, cols: np.ndarray) -> np.ndarray:
    """Sample `dem` at fractional (row, col). Points outside the grid come back as NaN."""
    h, w = dem.shape
    inside = (rows >= 0) & (rows <= h - 1) & (cols >= 0) & (cols <= w - 1)
    r = np.clip(rows, 0, h - 1)
    c = np.clip(cols, 0, w - 1)
    r0 = np.minimum(np.floor(r).astype(np.intp), h - 2) if h > 1 else np.zeros_like(r, dtype=np.intp)
    c0 = np.minimum(np.floor(c).astype(np.intp), w - 2) if w > 1 else np.zeros_like(c, dtype=np.intp)
    fr = r - r0
    fc = c - c0
    r1 = np.minimum(r0 + 1, h - 1)
    c1 = np.minimum(c0 + 1, w - 1)
    out = (
        dem[r0, c0] * (1 - fr) * (1 - fc)
        + dem[r0, c1] * (1 - fr) * fc
        + dem[r1, c0] * fr * (1 - fc)
        + dem[r1, c1] * fr * fc
    )
    return np.where(inside, out, np.nan)


def horizon_mask(
    dem: np.ndarray,
    pixel_m: float,
    row: float,
    col: float,
    *,
    n_az: int = 720,
    max_dist_m: float = 150_000.0,
    step_m: float | None = None,
    observer_height_m: float = 2.0,
    north_xy: tuple[float, float] = (0.0, 1.0),
    east_xy: tuple[float, float] = (1.0, 0.0),
    radius_m: float = MOON_RADIUS_M,
    curvature: bool = True,
) -> np.ndarray:
    """Maximum terrain elevation angle (degrees) for `n_az` azimuths, clockwise from north.

    `row`, `col` locate the observer in the DEM (fractional pixels allowed).
    `north_xy` / `east_xy` are unit vectors, in grid (x right, y up) coordinates, of local north
    and east at the observer. The defaults suit a north-up grid; for a polar stereographic grid
    use `stereo_south_axes`.

    TODO(pipeline): distances are grid distances. Polar stereographic scale error grows away from
    the pole (about +0.8 % at 80°S, +3 % at 70°S); correct for it, or use a locally centred
    projection, for the lower-latitude sites.
    """
    step = float(step_m if step_m is not None else pixel_m)
    d = np.arange(step, max_dist_m + step / 2, step)  # (n_d,)
    az = np.deg2rad(np.arange(n_az) * 360.0 / n_az)  # (n_az,)
    # Unit direction in grid x/y for each azimuth: north * cos(az) + east * sin(az).
    ux = north_xy[0] * np.cos(az) + east_xy[0] * np.sin(az)
    uy = north_xy[1] * np.cos(az) + east_xy[1] * np.sin(az)

    cols = col + np.outer(ux, d) / pixel_m
    rows = row - np.outer(uy, d) / pixel_m  # row index grows downwards

    h_obs = float(bilinear(dem, np.array([row]), np.array([col]))[0]) + observer_height_m
    h_tgt = bilinear(dem, rows, cols)
    drop = d * d / (2.0 * radius_m) if curvature else 0.0
    ang = np.arctan2(h_tgt - h_obs - drop, d)
    with np.errstate(all="ignore"):
        mask = np.nanmax(ang, axis=1)  # NaN only if a whole ray is off the DEM
    return np.rad2deg(mask)


def stereo_south_axes(lon_deg: float) -> tuple[tuple[float, float], tuple[float, float]]:
    """(north_xy, east_xy) at east-longitude `lon_deg` on a south polar stereographic grid
    with central meridian 0° pointing up (+y), the usual LOLA polar layout.

    A point sits at (x, y) = r * (sin lon, cos lon). North is away from the pole; east is the
    direction of increasing longitude.

    TODO(pipeline): confirm the DEM's central meridian and axis order from its CRS before trusting this.
    """
    lon = np.deg2rad(lon_deg)
    return (float(np.sin(lon)), float(np.cos(lon))), (float(np.cos(lon)), float(-np.sin(lon)))
