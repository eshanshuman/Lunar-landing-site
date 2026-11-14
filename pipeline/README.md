# Data pipeline

Runs locally (JPL Horizons is not reachable from the Claude cloud sandbox). Python 3.11+.

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r pipeline/requirements.txt
python -m pytest pipeline/tests
```

| Step | Script | Status |
|---|---|---|
| 1 | `fetch_horizons.py` Sun/Earth az/el from JPL Horizons | Written, **not yet run against the live API** |
| 2 | `build_horizons.py` 720-azimuth terrain masks from the LOLA DEM | Written, **not yet run on a real DEM**; maths unit-tested |
| 3 | `build_grids.py` hourly Sun/Earth visibility on a 41 x 41, 500 m grid around each Artemis region | Written, **not yet run on a real DEM**; per-point az/el conversion unit-tested |
| 3b | `build_tile.py` 20 km terrain tile (16-bit PNG + JSON) per site for the 3D shadow view | **Run for the five Artemis sites**; outputs committed in `public/data/` |
| 4 | `build_dataset.py` combine into `public/data/` (PLAN.md §6) | Not started |
| 5 | `backtest.py` IM-1 and Chandrayaan-3 | Not started |

Order: run step 2 first (it reports each site's ground height), copy those into `alt_km` in
`sites.json`, then run step 1.

```bash
python pipeline/build_horizons.py --dem /path/to/dem.tif
python pipeline/fetch_horizons.py --dry-run
python pipeline/fetch_horizons.py --start 2027-06-01 --stop 2028-12-31
```

```bash
python pipeline/build_grids.py --dem /path/to/dem.tif --only ridge --max-dist-km 60
```

A full grid is 1681 horizon masks per region and is slow at the defaults; try one region with a
shorter reach first. The output layout is documented on `GridData` in `src/types.ts`.

Open TODOs are marked `TODO(pipeline)` in the scripts: the DEM product and its URL, the DEM height
datum, the grid's central meridian, the Horizons azimuth convention and column layout, and the
two validation checks from PLAN.md §5. Site coordinates in `sites.json` are unverified.

## Terrain tiles for the 3D shadow view

```bash
python pipeline/build_tile.py --site ridge shack degerl peak nobile --dem /path/to/LDEM_80S_20MPP_ADJ.tif --size-km 20 --px 512
```

`--dem` also takes the file's https address from the PGDA product page (see `SOURCES.md`); the file is a
cloud-optimised GeoTIFF, so only the 20 km windows are downloaded. The JSON's
`grid_north_to_true_north_deg` is the clockwise angle from the top of the tile to true north; add it to a
Horizons azimuth to get the direction in tile axes (`pipeline/tile_math.py` has the details).
