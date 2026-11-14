#!/usr/bin/env python3
"""Terrain tile for the 3D shadow view: a square of the LOLA DEM around a site, as a 16-bit PNG.

    python pipeline/build_tile.py --site ridge --dem /path/to/LDEM_80S_20MPP_ADJ.tif --size-km 20 --px 512

`--dem` is a local path, or the product's own https address (the file is a cloud-optimised
GeoTIFF, so only the window that is needed gets downloaded). The address is recorded in SOURCES.md.

Writes public/data/tile_<site>.png (16-bit grayscale; row 0 is the top of the DEM grid) and
public/data/tile_<site>.json:

    {site, centre_lat, centre_lon, size_m, px, h_min_m, h_max_m,
     grid_north_to_true_north_deg, dem, sphere_r_m, ...}

Height of pixel value v:  h_min_m + v / 65535 * (h_max_m - h_min_m), metres above the sphere.
`size_m` is measured on the DEM grid; `scale_factor` says how much the projection stretches it
(grid / true distance, 1.0 at the pole).
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import numpy as np

from tile_math import block_mean, grid_north_to_true_north_deg, quantise_u16, scale_factor

HERE = Path(__file__).resolve().parent


def write_png16(path: Path, u16: np.ndarray) -> None:
    from PIL import Image

    Image.fromarray(u16).save(path, optimize=True)  # uint16 array -> 16-bit grayscale PNG


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--site", required=True, nargs="+", help="site id(s) from sites.json")
    ap.add_argument("--dem", required=True, help="LOLA DEM GeoTIFF: local path or https address")
    ap.add_argument("--size-km", type=float, default=20.0)
    ap.add_argument("--px", type=int, default=512)
    ap.add_argument("--sites", type=Path, default=HERE / "sites.json")
    ap.add_argument("--out", type=Path, default=HERE.parent / "public" / "data")
    args = ap.parse_args()

    remote = args.dem.startswith("http")
    if not remote and not Path(args.dem).exists():
        print(f"DEM not found: {args.dem}", file=sys.stderr)
        return 2
    if remote:
        os.environ.setdefault("GDAL_DISABLE_READDIR_ON_OPEN", "EMPTY_DIR")
        os.environ.setdefault("CPL_VSIL_CURL_ALLOWED_EXTENSIONS", ".TIF,.tif,.tiff")

    import rasterio
    from pyproj import CRS, Transformer
    from rasterio.windows import Window

    by_id = {s["id"]: s for s in json.loads(args.sites.read_text())}
    unknown = [i for i in args.site if i not in by_id]
    if unknown:
        print("Unknown site id: " + ", ".join(unknown), file=sys.stderr)
        return 2
    args.out.mkdir(parents=True, exist_ok=True)

    with rasterio.open(args.dem) as ds:
        crs = CRS.from_user_input(ds.crs)
        tf = Transformer.from_crs(crs.geodetic_crs, crs, always_xy=True)
        to_xy = lambda lat, lon: tf.transform(lon, lat)  # noqa: E731
        px_m = abs(ds.transform.a)
        if not np.isclose(px_m, abs(ds.transform.e)) or ds.transform.b != 0 or ds.transform.d != 0:
            print("DEM grid is rotated or has non-square pixels; not supported.", file=sys.stderr)
            return 2
        sphere_r = float(crs.ellipsoid.semi_major_metre)
        n_src = int(round(args.size_km * 1000.0 / px_m))

        for sid in args.site:
            s = by_id[sid]
            x, y = to_xy(s["lat"], s["lon"])
            col, row = ~ds.transform * (x, y)  # fractional pixel position of the site (pixel-edge convention)
            c0 = int(round(col - n_src / 2))
            r0 = int(round(row - n_src / 2))
            if c0 < 0 or r0 < 0 or c0 + n_src > ds.width or r0 + n_src > ds.height:
                print(f"{sid}: the {args.size_km:g} km window runs off the DEM, skipped.", file=sys.stderr)
                continue
            src = ds.read(1, window=Window(c0, r0, n_src, n_src)).astype(np.float64)
            if ds.nodata is not None and not np.isnan(ds.nodata):
                src[src == ds.nodata] = np.nan
            holes = float(np.isnan(src).mean())
            tile = block_mean(src, args.px)
            u16, h_min, h_max = quantise_u16(tile)

            # The window snaps to whole DEM pixels, so the tile centre can be up to half a pixel from the site.
            cx, cy = ds.transform * (c0 + n_src / 2, r0 + n_src / 2)
            inv = Transformer.from_crs(crs, crs.geodetic_crs, always_xy=True)
            centre_lon, centre_lat = inv.transform(cx, cy)
            meta = {
                "site": sid,
                "centre_lat": round(centre_lat, 6),
                "centre_lon": round(centre_lon, 6),
                "size_m": n_src * px_m,
                "px": args.px,
                "h_min_m": round(h_min, 3),
                "h_max_m": round(h_max, 3),
                "grid_north_to_true_north_deg": round(grid_north_to_true_north_deg(centre_lat, centre_lon, to_xy), 4),
                "dem": Path(args.dem).name,
                "sphere_r_m": sphere_r,
                # extras, for checking and for the app's labels
                "site_lat": s["lat"],
                "site_lon": s["lon"],
                "centre_offset_m": [round(x - cx, 2), round(y - cy, 2)],
                "source_px_m": px_m,
                "scale_factor": round(scale_factor(centre_lat), 6),
                "centre_height_m": round(float(tile[args.px // 2 - 1 : args.px // 2 + 1, args.px // 2 - 1 : args.px // 2 + 1].mean()), 2),
                "nodata_fraction": round(holes, 6),
                "encoding": "uint16; height_m = h_min_m + v / 65535 * (h_max_m - h_min_m); row 0 = top of the DEM grid (largest y)",
            }
            write_png16(args.out / f"tile_{sid}.png", u16)
            (args.out / f"tile_{sid}.json").write_text(json.dumps(meta, indent=1) + "\n")
            kb = (args.out / f"tile_{sid}.png").stat().st_size / 1024
            print(
                f"{sid}: {n_src}x{n_src} px at {px_m:g} m -> {args.px}x{args.px}, heights {h_min:.0f} to {h_max:.0f} m, "
                f"centre {meta['centre_height_m']:.0f} m, grid north to true north {meta['grid_north_to_true_north_deg']:.2f} deg, {kb:.0f} KB"
            )
    return 0


if __name__ == "__main__":
    sys.exit(main())
