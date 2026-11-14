import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from tile_math import (  # noqa: E402
    MOON_RADIUS_M, block_mean, dequantise_u16, grid_north_to_true_north_deg, quantise_u16, scale_factor, stereo_south_xy,
)


def test_flat_input_gives_a_flat_tile():
    src = np.full((1000, 1000), 1234.5)
    tile = block_mean(src, 512)
    assert tile.shape == (512, 512)
    assert np.allclose(tile, 1234.5)
    u16, h_min, h_max = quantise_u16(tile)
    assert u16.dtype == np.uint16 and u16.min() == u16.max() == 0
    assert h_min == h_max == 1234.5
    assert np.allclose(dequantise_u16(u16, h_min, h_max), 1234.5)


def test_block_mean_keeps_the_mean_and_a_ramp():
    rng = np.random.default_rng(1)
    src = rng.normal(500.0, 80.0, (1000, 1000))
    assert np.isclose(block_mean(src, 512).mean(), src.mean(), atol=1e-6)
    ramp = np.tile(np.arange(1000.0), (1000, 1))  # height grows to the east
    t = block_mean(ramp, 512)
    assert np.allclose(np.diff(t, axis=0), 0)  # no north-south change
    assert np.all(np.diff(t[0]) > 0)  # still rising eastwards
    assert np.isclose(t[0, 0], ramp[0, : 1000 // 512 + 1].mean(), atol=1.0)
    # exact when the factor is a whole number
    assert np.allclose(block_mean(np.arange(16.0).reshape(4, 4), 2), [[2.5, 4.5], [10.5, 12.5]])


def test_block_mean_ignores_holes():
    src = np.full((8, 8), 10.0)
    src[0, 0] = np.nan
    assert np.allclose(block_mean(src, 4), 10.0)


def test_quantise_round_trip_is_within_one_step():
    rng = np.random.default_rng(2)
    h = rng.uniform(-3000.0, 2500.0, (64, 64))
    u16, lo, hi = quantise_u16(h)
    assert u16.min() == 0 and u16.max() == 65535
    assert np.max(np.abs(dequantise_u16(u16, lo, hi) - h)) <= (hi - lo) / 65535 / 2 + 1e-9


@pytest.mark.parametrize("lon, expected", [(0.0, 0.0), (90.0, 90.0), (180.0, 180.0), (-90.0, 270.0), (-137.49, 222.51)])
def test_grid_north_to_true_north_is_the_longitude_for_lon0_zero(lon, expected):
    # South polar stereographic, central meridian 0: at lon 0 grid up IS true north; at lon 90 E true
    # north points along grid +x, a quarter turn clockwise from grid up.
    assert grid_north_to_true_north_deg(-89.0, lon) == pytest.approx(expected, abs=1e-6)
    assert grid_north_to_true_north_deg(-85.4, lon) == pytest.approx(expected, abs=1e-6)  # latitude does not matter


def test_rotation_follows_the_projection_it_is_given():
    shifted = lambda lat, lon: stereo_south_xy(lat, lon, lon0_deg=30.0)  # noqa: E731
    assert grid_north_to_true_north_deg(-88.0, 90.0, shifted) == pytest.approx(60.0, abs=1e-6)


def test_azimuth_to_tile_axes_recipe():
    # The app's recipe: phi = azimuth + rotation; direction = (sin phi, cos phi) in grid (x, y).
    # Check it against the projection itself for "due east" at lon 90 E, which is grid -y there.
    lat, lon = -89.0, 90.0
    phi = np.deg2rad(90.0 + grid_north_to_true_north_deg(lat, lon))
    x0, y0 = stereo_south_xy(lat, lon)
    x1, y1 = stereo_south_xy(lat, lon + 1e-4)  # a small step east
    step = np.array([x1 - x0, y1 - y0])
    assert np.allclose(step / np.linalg.norm(step), [np.sin(phi), np.cos(phi)], atol=1e-6)
    assert np.allclose([np.sin(phi), np.cos(phi)], [0.0, -1.0], atol=1e-6)


def test_projection_and_scale_factor():
    x, y = stereo_south_xy(-90.0, 0.0)
    assert abs(x) < 1e-6 and abs(y) < 1e-6
    x, y = stereo_south_xy(-89.0, 0.0)  # one degree from the pole, along lon 0 = grid +y
    assert abs(x) < 1e-6 and y == pytest.approx(np.deg2rad(1.0) * MOON_RADIUS_M, rel=1e-4)
    assert scale_factor(-90.0) == pytest.approx(1.0)
    assert scale_factor(-85.4381) == pytest.approx(1.0016, abs=1e-4)
