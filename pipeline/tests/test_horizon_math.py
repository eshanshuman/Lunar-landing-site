import math
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from horizon_math import MOON_RADIUS_M, bilinear, horizon_mask, stereo_south_axes  # noqa: E402

PX = 100.0  # metres per pixel
N = 601  # 60 km square, observer in the middle
MID = N // 2


def flat():
    return np.zeros((N, N))


def test_flat_plane_without_curvature_is_zero():
    m = horizon_mask(flat(), PX, MID, MID, n_az=72, max_dist_m=25_000, observer_height_m=0, curvature=False)
    assert m.shape == (72,)
    assert np.allclose(m, 0.0, atol=1e-12)


def test_flat_sphere_horizon_dips_below_zero():
    # On a smooth sphere the 2 m observer looks slightly down at the horizon: dip = sqrt(2h/R).
    m = horizon_mask(flat(), PX, MID, MID, n_az=72, max_dist_m=25_000, observer_height_m=2.0)
    dip = -math.degrees(math.sqrt(2 * 2.0 / MOON_RADIUS_M))
    assert np.all(m < 0)
    assert np.allclose(m, dip, atol=0.002)


def test_single_tall_ridge_gives_the_expected_angle():
    dem = flat()
    ridge_col = MID + 100  # a north-south wall 10 km to the east
    height = 1000.0
    dem[:, ridge_col] = height
    m = horizon_mask(dem, PX, MID, MID, n_az=720, max_dist_m=25_000, observer_height_m=2.0)

    d = 10_000.0
    expected = math.degrees(math.atan2(height - 2.0 - d * d / (2 * MOON_RADIUS_M), d))
    assert abs(m[180] - expected) < 1e-6  # index 180 = azimuth 90° = due east
    # Away from the wall the horizon is the bare sphere again.
    assert m[540] < 0  # due west
    # Obliquely, the wall is further away, so it looks lower.
    assert 0 < m[90] < m[180]  # azimuth 45°


def test_azimuth_is_clockwise_from_north():
    dem = flat()
    dem[MID - 50, MID] = 500.0  # one peak 5 km towards the top of the grid (north, by default)
    m = horizon_mask(dem, PX, MID, MID, n_az=8, max_dist_m=10_000)
    assert int(np.argmax(m)) == 0
    dem = flat()
    dem[MID, MID + 50] = 500.0  # east
    m = horizon_mask(dem, PX, MID, MID, n_az=8, max_dist_m=10_000)
    assert int(np.argmax(m)) == 2


def test_observer_height_is_measured_from_the_local_ground():
    dem = np.full((N, N), 300.0)  # a flat plain 300 m up behaves like one at 0 m
    a = horizon_mask(dem, PX, MID, MID, n_az=16, max_dist_m=10_000)
    b = horizon_mask(flat(), PX, MID, MID, n_az=16, max_dist_m=10_000)
    assert np.allclose(a, b)


def test_rays_leaving_the_dem_are_ignored():
    m = horizon_mask(flat(), PX, MID, MID, n_az=16, max_dist_m=100_000, observer_height_m=0, curvature=False)
    assert np.all(np.isfinite(m))
    assert np.allclose(m, 0.0, atol=1e-12)


def test_bilinear():
    dem = np.array([[0.0, 10.0], [20.0, 30.0]])
    got = bilinear(dem, np.array([0.0, 0.5, 1.0, 2.0]), np.array([0.0, 0.5, 1.0, 0.0]))
    assert np.allclose(got[:3], [0.0, 15.0, 30.0])
    assert np.isnan(got[3])


def test_stereo_south_axes():
    (nx, ny), (ex, ey) = stereo_south_axes(0.0)
    assert np.allclose([nx, ny, ex, ey], [0, 1, 1, 0])
    (nx, ny), (ex, ey) = stereo_south_axes(90.0)
    assert np.allclose([nx, ny, ex, ey], [1, 0, 0, -1], atol=1e-12)
    # north and east stay perpendicular, with east 90° clockwise from north
    for lon in (-137.49, 37.4, 123.7):
        (nx, ny), (ex, ey) = stereo_south_axes(lon)
        assert abs(nx * ex + ny * ey) < 1e-12
        assert nx * ey - ny * ex < 0
