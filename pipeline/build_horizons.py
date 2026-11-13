#!/usr/bin/env python3
"""Terrain horizon masks for each site from the LOLA South Pole DEM (PLAN.md §5.2).

    python pipeline/build_horizons.py --dem /path/to/lola_south_pole_dem.tif

Writes pipeline/cache/horizon_<id>.json:
    {"id", "horizon_deg": [720 values, clockwise from north], "ground_height_m", "meta"}

`ground_height_m` is the DEM height at the site; use it to fill `alt_km` in pipeline/sites.json
(needed by fetch_horizons.py).

TODO(pipeline): choose the DEM. PLAN.md §5.2 asks for the current high-resolution PGDA LOLA
South Pole polar stereographic GeoTIFF. Its URL is deliberately NOT written here: find the
product, download it, and record URL, resolution and version in SOURCES.md.
TODO(pipeline): validate one site's yearly sunlit % against published LOLA illumination maps
(Mazarico et al. 2011; Barker et al. 2021/2023) and record the comparison in SOURCES.md.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np

from horizon_math import horizon_mask, stereo_south_axes

HERE = Path(__file__).resolve().parent


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--dem", required=True, type=Path, help="LOLA South Pole DEM GeoTIFF (polar stereographic, metres)")
    ap.add_argument("--sites", type=Path, default=HERE / "sites.json")
    ap.add_argument("--out", type=Path, default=HERE / "cache")
    ap.add_argument("--only", nargs="*", help="site ids to process (default: all)")
    ap.add_argument("--n-az", type=int, default=720)
    ap.add_argument("--max-dist-km", type=float, default=150.0)
    ap.add_argument("--observer-height-m", type=float, default=2.0)
    args = ap.parse_args()

    if not args.dem.exists():
        print(f"DEM not found: {args.dem}\nDownload the PGDA LOLA South Pole DEM first (see the TODO at the top of this file).", file=sys.stderr)
        return 2

    # Imported here so the maths and its tests run without the geospatial stack installed.
    import rasterio
    from pyproj import CRS, Transformer
    from rasterio.windows import Window

    sites = json.loads(args.sites.read_text())
    if args.only:
        sites = [s for s in sites if s["id"] in args.only]
    args.out.mkdir(parents=True, exist_ok=True)

    with rasterio.open(args.dem) as ds:
        crs = CRS.from_user_input(ds.crs)
        to_xy = Transformer.from_crs(crs.geodetic_crs, crs, always_xy=True)
        px = abs(ds.transform.a)
        if not np.isclose(px, abs(ds.transform.e)):
            print("DEM pixels are not square; horizon_mask assumes they are.", file=sys.stderr)
            return 2
        pad = int(np.ceil(args.max_dist_km * 1000.0 / px)) + 2
        # TODO(pipeline): check the product's height datum and units. This assumes metres above
        # the 1737.4 km sphere; some products store scaled integers or kilometres.
        for s in sites:
            x, y = to_xy.transform(s["lon"], s["lat"])
            col, row = ~ds.transform * (x, y)
            col -= 0.5  # pixel-centre convention
            row -= 0.5
            if not (0 <= row < ds.height and 0 <= col < ds.width):
                print(f"{s['id']}: outside the DEM, skipped (the app labels it 'terrain not modelled')")
                continue
            r0, c0 = max(0, int(row) - pad), max(0, int(col) - pad)
            r1, c1 = min(ds.height, int(row) + pad + 1), min(ds.width, int(col) + pad + 1)
            dem = ds.read(1, window=Window(c0, r0, c1 - c0, r1 - r0)).astype(np.float64)
            if ds.nodata is not None:
                dem[dem == ds.nodata] = np.nan
            # TODO(pipeline): stereo_south_axes assumes central meridian 0° pointing up. Check against `crs`.
            north, east = stereo_south_axes(s["lon"])
            mask = horizon_mask(
                dem, px, row - r0, col - c0,
                n_az=args.n_az, max_dist_m=args.max_dist_km * 1000.0,
                observer_height_m=args.observer_height_m, north_xy=north, east_xy=east,
            )
            ground = float(dem[int(round(row - r0)), int(round(col - c0))])
            out = {
                "id": s["id"],
                "horizon_deg": [round(float(v), 4) for v in mask],
                "ground_height_m": round(ground, 1),
                "meta": {
                    "dem": f"{args.dem.name} (TODO: product name, version and URL in SOURCES.md)",
                    "pixel_m": px,
                    "max_dist_km": args.max_dist_km,
                    "observer_height_m": args.observer_height_m,
                },
            }
            path = args.out / f"horizon_{s['id']}.json"
            path.write_text(json.dumps(out))
            print(f"{s['id']}: ground {ground:.0f} m, skyline {np.nanmin(mask):.2f}° to {np.nanmax(mask):.2f}° -> {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
