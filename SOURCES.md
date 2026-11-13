# Sources

Every data product, asset and coordinate used by the app is recorded here with its URL and
version. Nothing below is filled in from memory: an entry stays `TODO` until someone has opened
the primary source.

## Site coordinates
| Site | lat, E-lon | Source | Verified |
|---|---|---|---|
| All 7 sites in `pipeline/sites.json` | prototype values | TODO (NASA Lunar Surface Data Book 2025; mission primary sources) | No |

## Ephemeris
- JPL Horizons API, OBSERVER table, `coord@301` geodetic site, airless apparent az/el. Parameters: `pipeline/fetch_horizons.py`.
- TODO: date fetched, and the two spot-checks against the Horizons web UI.

## Terrain
- TODO: PGDA LOLA South Pole DEM product name, URL, resolution, version.
- TODO: validation against published LOLA illumination maps (Mazarico et al. 2011; Barker et al. 2021/2023).

## Textures and models (M2, M4)
- TODO: NASA SVS CGI Moon Kit URLs and licence notes; Earth texture URL.

## Mission dates (backtest, M6)
- TODO: IM-1 and Chandrayaan-3 landing and end-of-operations times, with primary sources.

## Sample data
`src/data/sample.ts` is synthetic. Anything rendered from it carries the "Sample data" badge.
