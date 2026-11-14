import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from grid_math import (  # noqa: E402
    MOON_RADIUS_M, azel_to_vector, convert_azel, enu, grid_offsets, horizon_at, offset_to_latlon, pack_bits, vector_to_azel,
)

SITES = [(-89.4632, -137.49), (-85.4381, 37.3667), (-69.37, 32.32), (0.0, 0.0), (45.0, 170.0)]
AZ = np.array([0.0, 37.5, 90.0, 179.9, 211.0, 359.5])
EL = np.array([-3.0, 0.0, 0.2, 1.2, 6.5, 40.0])


def test_enu_is_right_handed_and_orthonormal():
    for lat, lon in SITES:
        e, n, u = enu(lat, lon)
        for v in (e, n, u):
            assert np.isclose(np.linalg.norm(v), 1.0)
        assert np.allclose(np.cross(e, n), u)
        assert n[2] >= 0  # north points towards +z


def test_zero_offset_reproduces_the_sites_own_values():
    for lat, lon in SITES:
        az, el = convert_azel(lat, lon, lat, lon, AZ, EL)
        assert np.allclose(az, AZ, atol=1e-9)
        assert np.allclose(el, EL, atol=1e-9)
        # and via a zero-metre grid offset, as build_grids.py does it
        plat, plon = offset_to_latlon(lat, lon, 0.0, 0.0)
        az, el = convert_azel(lat, lon, plat, plon, AZ, EL)
        assert np.allclose(az, AZ, atol=1e-7)
        assert np.allclose(el, EL, atol=1e-7)


def test_azel_vector_round_trip():
    for lat, lon in SITES:
        az, el = vector_to_azel(lat, lon, azel_to_vector(lat, lon, AZ, EL))
        assert np.allclose(az, AZ, atol=1e-9)
        assert np.allclose(el, EL, atol=1e-9)


def test_across_the_pole_north_becomes_south_and_the_body_drops_by_the_arc_between():
    # Site 1 degree from the south pole on lon 0; point 1 degree from it on lon 180: 2 degrees apart.
    # A body on the site's northern horizon is, for the point, due south and 2 degrees below horizontal.
    az, el = convert_azel(-89.0, 0.0, -89.0, 180.0, 0.0, 0.0)
    assert np.isclose(az, 180.0)
    assert np.isclose(el, -2.0)
    # Looking the other way it is 2 degrees up.
    az, el = convert_azel(-89.0, 0.0, -89.0, 180.0, 180.0, 0.0)
    assert np.isclose(az % 360.0, 0.0) or np.isclose(az, 360.0)
    assert np.isclose(el, 2.0)


def test_a_few_km_changes_elevation_by_the_arc_moved():
    lat, lon = -85.0, 30.0
    plat, plon = offset_to_latlon(lat, lon, 0.0, 5000.0)  # 5 km north
    arc = np.rad2deg(5000.0 / MOON_RADIUS_M)
    _, el = convert_azel(lat, lon, plat, plon, 0.0, 1.0)  # body due north, 1 degree up
    assert np.isclose(el, 1.0 + arc, atol=1e-4)  # walking towards it lifts it
    _, el = convert_azel(lat, lon, plat, plon, 180.0, 1.0)
    assert np.isclose(el, 1.0 - arc, atol=1e-4)


def test_offset_to_latlon():
    lat, lon = offset_to_latlon(-80.0, 10.0, 0.0, 0.0)
    assert np.isclose(lat, -80.0) and np.isclose(lon, 10.0)
    arc = np.rad2deg(1000.0 / MOON_RADIUS_M)
    lat, lon = offset_to_latlon(-80.0, 10.0, 0.0, 1000.0)
    assert np.isclose(lat, -80.0 + arc, atol=1e-6) and np.isclose(lon, 10.0, atol=1e-9)
    lat, lon = offset_to_latlon(0.0, 10.0, 1000.0, 0.0)
    assert np.isclose(lon, 10.0 + arc, atol=1e-6) and np.isclose(lat, 0.0, atol=1e-9)
    # stepping over the pole lands on the opposite meridian
    lat, lon = offset_to_latlon(-89.99, 0.0, 0.0, -2000.0)
    assert lat < -89.9 and np.isclose(abs(lon), 180.0)


def test_grid_offsets_are_row_major_from_the_north_west():
    east, north = grid_offsets(3, 500.0)
    assert east.tolist() == [-500, 0, 500, -500, 0, 500, -500, 0, 500]
    assert north.tolist() == [500, 500, 500, 0, 0, 0, -500, -500, -500]
    east, north = grid_offsets(41, 500.0)
    assert east.shape == (1681,) and east[840] == 0 and north[840] == 0 and east.max() == 10_000


def test_horizon_at_interpolates_and_wraps():
    m = np.array([0.0, 2.0, 4.0, 2.0])
    assert np.allclose(horizon_at(m, [0, 45, 90, 315, 360, -90]), [0, 1, 2, 1, 0, 2])


def test_pack_bits_matches_the_apps_layout():
    vis = np.zeros((2, 10), dtype=bool)
    vis[0, 0] = vis[0, 9] = True
    vis[1, 3] = True
    b = pack_bits(vis)
    assert len(b) == 2 * 2  # ceil(10 / 8) bytes per point
    assert b[0] == 0b00000001 and b[1] == 0b00000010
    assert b[2] == 0b00001000 and b[3] == 0


def test_build_grids_visibility_bits_and_cli_guards():
    import subprocess
    from build_grids import visibility_bits

    mask = np.array([0.0, 2.0, 4.0, 2.0])  # skyline at 0, 90, 180, 270 degrees
    az = np.array([0.0, 90.0, 90.0, 180.0, 45.0])
    el = np.array([0.1, 1.9, 2.1, 4.0, 1.5])
    assert visibility_bits(mask, az, el).tolist() == [True, False, True, False, True]

    script = str(Path(__file__).resolve().parents[1] / "build_grids.py")
    r = subprocess.run([sys.executable, script, "--dem", "does-not-exist.tif"], capture_output=True, text=True)
    assert r.returncode == 2 and "DEM not found" in r.stderr
    r = subprocess.run([sys.executable, script, "--dem", script, "--size", "40"], capture_output=True, text=True)
    assert r.returncode == 2 and "odd" in r.stderr
