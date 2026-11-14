#!/usr/bin/env python3
"""Sunlight-map grids: hourly Sun / Earth visibility on a 41 x 41 grid of points, 500 m apart,
around each Artemis study region (PLAN.md §5.3).

    python pipeline/build_grids.py --dem /path/to/LDEM_80S_80MPP_ADJ.tif --dataset public/data/dataset.json

`--dem` is a local path or the product's https address (a cloud-optimised GeoTIFF: only the window
that is needed is downloaded; the address is in SOURCES.md). The 80 m file is the intended input.

The centre site's hourly Sun and Earth azimuth / elevation come from `--dataset` (the app's own
public/data/dataset.json, so the map covers exactly the app's window), or without it from
pipeline/cache/ephem_<site>.json as written by fetch_horizons.py. For every grid point it

  1. finds the point's latitude and longitude from its east / north offset,
  2. builds the point's own 720-azimuth terrain horizon mask from the DEM,
  3. converts the site's Sun / Earth az/el into the point's local frame (grid_math.convert_azel),
  4. sets a bit for each hour the body's centre is above the point's skyline.

Writes public/data/grid_<region>.json (layout documented on GridData in src/types.ts):

    {"region", "center": {"lat", "lon"}, "spacing_m", "size", "start_utc", "step_h", "hours",
     "sun_bits": base64, "earth_bits": base64, "height_m": [size * size], "meta"}

Every point, the centre included, is computed from this DEM, so the map compares like with like.
With `--dataset`, `meta.centre_agreement` records the share of hours in which the grid's answer at
the centre matches the site's own skyline in the dataset (built from the finer 20 m DEM). The app
shows that figure next to the map. Measured 2026-11-14 on the 80 m file: Sun 83% at degerl, 94% at
ridge, 99.8-100% at shack, peak and nobile. Coarser terrain smooths small features away.

A full grid is 1681 horizon masks per region: a few minutes per region on the 80 m file.

TODO(pipeline): validate one region against a published LOLA illumination map.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import sys
from pathlib import Path

import numpy as np

from grid_math import convert_azel, grid_offsets, horizon_at, offset_to_latlon, pack_bits
from horizon_math import horizon_mask, stereo_south_axes

HERE = Path(__file__).resolve().parent
GRID_GROUP = "Artemis study regions"


def visibility_bits(mask_deg: np.ndarray, az_deg: np.ndarray, el_deg: np.ndarray) -> np.ndarray:
    """True for each hour the body's centre is above the skyline `mask_deg` at its azimuth."""
    return el_deg > horizon_at(mask_deg, az_deg)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--dem", required=True, help="LOLA South Pole DEM GeoTIFF: local path or https address")
    ap.add_argument("--dataset", type=Path, default=None, help="public/data/dataset.json: use its Sun / Earth tracks and window")
    ap.add_argument("--sites", type=Path, default=HERE / "sites.json")
    ap.add_argument("--cache", type=Path, default=HERE / "cache", help="where fetch_horizons.py wrote ephem_<site>.json")
    ap.add_argument("--out", type=Path, default=HERE.parent / "public" / "data")
    ap.add_argument("--only", nargs="*", help="site ids to process (default: every Artemis study region)")
    ap.add_argument("--size", type=int, default=41, help="points per side (odd, so the site is a grid point)")
    ap.add_argument("--spacing-m", type=float, default=500.0)
    ap.add_argument("--n-az", type=int, default=720)
    ap.add_argument("--max-dist-km", type=float, default=150.0)
    ap.add_argument("--ray-step-m", type=float, default=None, help="sample spacing along each ray (default: one DEM pixel)")
    ap.add_argument("--observer-height-m", type=float, default=2.0)
    args = ap.parse_args()

    if args.size % 2 == 0:
        print("--size must be odd so that the centre point is the site itself.", file=sys.stderr)
        return 2
    remote = str(args.dem).startswith("http")
    if not remote and not Path(args.dem).exists():
        print(f"DEM not found: {args.dem}", file=sys.stderr)
        return 2
    if remote:
        os.environ.setdefault("GDAL_DISABLE_READDIR_ON_OPEN", "EMPTY_DIR")
        os.environ.setdefault("CPL_VSIL_CURL_ALLOWED_EXTENSIONS", ".TIF,.tif,.tiff")

    sites = [s for s in json.loads(args.sites.read_text()) if s["group"] == GRID_GROUP]
    if args.only:
        sites = [s for s in sites if s["id"] in args.only]
    dataset = json.loads(args.dataset.read_text()) if args.dataset else None
    if dataset is None:
        missing = [s["id"] for s in sites if not (args.cache / f"ephem_{s['id']}.json").exists()]
        if missing:
            print("No ephemeris for: " + ", ".join(missing) + "\nRun fetch_horizons.py first, or pass --dataset.", file=sys.stderr)
            return 2

    # Imported here so the maths and its tests run without the geospatial stack installed.
    import rasterio
    from pyproj import CRS, Transformer
    from rasterio.windows import Window

    args.out.mkdir(parents=True, exist_ok=True)
    east_m, north_m = grid_offsets(args.size, args.spacing_m)

    with rasterio.open(args.dem) as ds:
        crs = CRS.from_user_input(ds.crs)
        to_xy = Transformer.from_crs(crs.geodetic_crs, crs, always_xy=True)
        px = abs(ds.transform.a)
        reach = args.max_dist_km * 1000.0 + args.size * args.spacing_m
        pad = int(np.ceil(reach / px)) + 2

        for s in sites:
            eph = dataset["bySite"][s["id"]] if dataset else json.loads((args.cache / f"ephem_{s['id']}.json").read_text())
            sun_az, sun_el = np.array(eph["sun"]["az"]), np.array(eph["sun"]["el"])
            earth_az, earth_el = np.array(eph["earth"]["az"]), np.array(eph["earth"]["el"])
            hours = len(sun_el)

            # One DEM window that covers every ray from every point of this grid.
            cx, cy = to_xy.transform(s["lon"], s["lat"])
            ccol, crow = ~ds.transform * (cx, cy)
            r0, c0 = max(0, int(crow) - pad), max(0, int(ccol) - pad)
            r1, c1 = min(ds.height, int(crow) + pad + 1), min(ds.width, int(ccol) + pad + 1)
            dem = ds.read(1, window=Window(c0, r0, c1 - c0, r1 - r0)).astype(np.float64)
            if ds.nodata is not None:
                dem[dem == ds.nodata] = np.nan

            lat, lon = offset_to_latlon(s["lat"], s["lon"], east_m, north_m)
            sun = np.zeros((lat.size, hours), dtype=bool)
            earth = np.zeros((lat.size, hours), dtype=bool)
            height = np.full(lat.size, np.nan)
            for p in range(lat.size):
                x, y = to_xy.transform(lon[p], lat[p])
                col, row = ~ds.transform * (x, y)
                col, row = col - 0.5 - c0, row - 0.5 - r0  # pixel centres, window-relative
                if not (0 <= row < dem.shape[0] and 0 <= col < dem.shape[1]):
                    continue  # off the DEM: left as "never visible" and NaN height
                north, east = stereo_south_axes(lon[p])
                mask = horizon_mask(
                    dem, px, row, col,
                    n_az=args.n_az, max_dist_m=args.max_dist_km * 1000.0, step_m=args.ray_step_m,
                    observer_height_m=args.observer_height_m, north_xy=north, east_xy=east,
                )
                az, el = convert_azel(s["lat"], s["lon"], lat[p], lon[p], sun_az, sun_el)
                sun[p] = visibility_bits(mask, az, el)
                az, el = convert_azel(s["lat"], s["lon"], lat[p], lon[p], earth_az, earth_el)
                earth[p] = visibility_bits(mask, az, el)
                height[p] = dem[int(round(row)), int(round(col))]
                if p % args.size == 0:
                    print(f"{s['id']}: row {p // args.size + 1}/{args.size}", flush=True)

            # The centre point is the site. Record how often this grid's coarser skyline agrees with the
            # site's own (finer) skyline. The grid itself is left untouched.
            agreement = None
            if dataset and "horizon_deg" in eph:
                c = (args.size * args.size) // 2
                site_mask = np.array(eph["horizon_deg"], dtype=float)
                site_sun = visibility_bits(site_mask, sun_az, sun_el)
                site_earth = visibility_bits(site_mask, earth_az, earth_el)
                agreement = {"sun": round(float((sun[c] == site_sun).mean()), 4), "earth": round(float((earth[c] == site_earth).mean()), 4)}

            out = {
                "region": s["id"],
                "center": {"lat": s["lat"], "lon": s["lon"]},
                "spacing_m": args.spacing_m,
                "size": args.size,
                "start_utc": eph["start_utc"],
                "step_h": eph["step_h"],
                "hours": hours,
                "sun_bits": base64.b64encode(pack_bits(sun)).decode("ascii"),
                "earth_bits": base64.b64encode(pack_bits(earth)).decode("ascii"),
                "height_m": [None if np.isnan(v) else round(float(v), 1) for v in height],
                "meta": {
                    "dem": f"{Path(str(args.dem)).name} (LOLA, PGDA product 90)",
                    "observer_height_m": args.observer_height_m,
                    "ephemeris": "JPL Horizons, airless, converted per point (grid_math.convert_azel)",
                    "max_dist_km": args.max_dist_km,
                    "centre_agreement": agreement,
                    "centre_from": "this grid",
                },
            }
            path = args.out / f"grid_{s['id']}.json"
            path.write_text(json.dumps(out))
            print(f"{s['id']}: {lat.size} points x {hours} h, sunlit {sun.mean() * 100:.1f}% of point-hours -> {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
