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

## Textures and models
NASA Scientific Visualization Studio, "CGI Moon Kit" (SVS entry 4720), downloaded 2026-11-13.
NASA SVS media is public domain; credit "NASA's Scientific Visualization Studio".

| File in `public/textures/` | Downloaded from | Conversion |
|---|---|---|
| `moon_color_4k.jpg` | https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_4k.tif | TIFF to JPEG (quality 84), 4096x2048, unchanged otherwise |
| `moon_ldem_4.png` | https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_4.tif | 32-bit float to 8-bit PNG, 1440x720. File range -8.8785 to 10.504 mapped to 0..255 |

- The elevation file's values are treated as kilometres relative to the 1737.4 km sphere (the app uses the
  range above for true-scale relief). TODO: confirm the unit on the SVS page before the demo.
- TODO: confirm the licence wording on the SVS page and add the credit line to the app footer or README.
- The explorer's small Earth marker is a plain blue sphere. The intro's rocket is built from primitives in
  `src/scenes/Intro/Rocket.tsx` (no imported model, no logos).

Intro Earth (downloaded 2026-11-14, NASA SVS, public domain):

| File in `public/textures/` | Downloaded from | Conversion |
|---|---|---|
| `earth_day_2k.jpg` | https://svs.gsfc.nasa.gov/vis/a000000/a003600/a003615/flat_earth03.jpg (SVS entry 3615) | Re-saved as JPEG (quality 86), 2048x1024 |
| `earth_night_2k.jpg` | https://svs.gsfc.nasa.gov/vis/a030000/a030000/a030028/earthatnight2012.png (SVS entry 30028, "Earth at Night 2012") | Resized 5760x2880 to 2048x1024, PNG to JPEG (quality 86) |

- TODO: confirm the credit lines on both SVS pages before the demo.

## Mission dates (backtest, M6)
- TODO: IM-1 and Chandrayaan-3 landing and end-of-operations times, with primary sources.

## Sample data
`src/data/sample.ts` is synthetic. Anything rendered from it carries the "Sample data" badge.
