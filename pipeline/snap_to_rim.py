#!/usr/bin/env python3
"""Move one site in sites.json onto the highest DEM point within a search radius.

Use it when a site's coordinates land just off a rim or ridge crest (e.g. "shack" sits on
Shackleton's inner wall). It prints the old and new position and, with --write, updates
lat/lon in pipeline/sites.json and notes the change in the site's "source" field.

    python pipeline/snap_to_rim.py --dem DEM.tif --site shack --radius-km 3
    python pipeline/snap_to_rim.py --dem DEM.tif --site shack --radius-km 3 --write

After --write: delete that site's cached Horizons files, re-run build_horizons.py --only <site>,
re-fill alt_km, and re-fetch with --only <site>.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--dem", required=True, type=Path)
    ap.add_argument("--site", required=True)
    ap.add_argument("--radius-km", type=float, default=3.0)
    ap.add_argument("--sites", type=Path, default=HERE / "sites.json")
    ap.add_argument("--write", action="store_true", help="update sites.json (default: only print)")
    args = ap.parse_args()

    if not args.dem.exists():
        print(f"DEM not found: {args.dem}", file=sys.stderr)
        return 2

    import rasterio
    from pyproj import CRS, Transformer
    from rasterio.windows import Window

    sites = json.loads(args.sites.read_text(encoding="utf-8"))
    site = next((s for s in sites if s["id"] == args.site), None)
    if site is None:
        print(f"No site with id {args.site!r} in {args.sites}", file=sys.stderr)
        return 2

    with rasterio.open(args.dem) as ds:
        crs = CRS.from_user_input(ds.crs)
        to_xy = Transformer.from_crs(crs.geodetic_crs, crs, always_xy=True)
        to_ll = Transformer.from_crs(crs, crs.geodetic_crs, always_xy=True)
        px = abs(ds.transform.a)
        x, y = to_xy.transform(site["lon"], site["lat"])
        col, row = ~ds.transform * (x, y)
        pad = int(np.ceil(args.radius_km * 1000.0 / px)) + 1
        r0, c0 = max(0, int(row) - pad), max(0, int(col) - pad)
        r1, c1 = min(ds.height, int(row) + pad + 1), min(ds.width, int(col) + pad + 1)
        dem = ds.read(1, window=Window(c0, r0, c1 - c0, r1 - r0)).astype(np.float64)
        if ds.nodata is not None:
            dem[dem == ds.nodata] = np.nan

        rr, cc = np.mgrid[r0:r1, c0:c1]
        dist_m = np.hypot((rr + 0.5 - row) * px, (cc + 0.5 - col) * px)
        dem[dist_m > args.radius_km * 1000.0] = np.nan
        if np.all(np.isnan(dem)):
            print("No valid DEM pixels in the search radius.", file=sys.stderr)
            return 2
        i, j = np.unravel_index(np.nanargmax(dem), dem.shape)
        old_h = ds.read(1, window=Window(int(col), int(row), 1, 1))[0, 0]
        new_x, new_y = ds.transform * (c0 + j + 0.5, r0 + i + 0.5)
        new_lon, new_lat = to_ll.transform(new_x, new_y)
        moved_km = dist_m[i, j] / 1000.0

    new_lon = round(float(new_lon), 4)
    new_lat = round(float(new_lat), 4)
    print(f"{args.site}: old lat {site['lat']}, lon {site['lon']}  height {float(old_h):.0f} m")
    print(f"{args.site}: new lat {new_lat}, lon {new_lon}  height {dem[i, j]:.0f} m  (moved {moved_km:.2f} km)")

    if args.write:
        site["source"] = (
            f"snapped to highest {args.dem.name} point within {args.radius_km} km of "
            f"({site['lat']}, {site['lon']}) by snap_to_rim.py; still UNVERIFIED vs published coordinates"
        )
        site["lat"], site["lon"], site["alt_km"] = new_lat, new_lon, None
        args.sites.write_text(
            "[\n" + ",\n".join("  " + json.dumps(s, ensure_ascii=False) for s in sites) + "\n]\n",
            encoding="utf-8",
        )
        print(f"Updated {args.sites} (alt_km cleared: re-run build_horizons.py --only {args.site}, then re-fill it).")
    else:
        print("Dry run. Add --write to update sites.json.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
