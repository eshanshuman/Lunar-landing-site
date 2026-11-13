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
| 3 | `build_grids.py` masks on a grid around each region | Not started |
| 4 | `build_dataset.py` combine into `public/data/` (PLAN.md §6) | Not started |
| 5 | `backtest.py` IM-1 and Chandrayaan-3 | Not started |

Order: run step 2 first (it reports each site's ground height), copy those into `alt_km` in
`sites.json`, then run step 1.

```bash
python pipeline/build_horizons.py --dem /path/to/dem.tif
python pipeline/fetch_horizons.py --dry-run
python pipeline/fetch_horizons.py --start 2027-06-01 --stop 2028-12-31
```

Open TODOs are marked `TODO(pipeline)` in the scripts: the DEM product and its URL, the DEM height
datum, the grid's central meridian, the Horizons azimuth convention and column layout, and the
two validation checks from PLAN.md §5. Site coordinates in `sites.json` are unverified.
