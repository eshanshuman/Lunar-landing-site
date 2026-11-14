# Sources

Every data product, asset and coordinate the app uses, with where it came from and how it was
changed. Nothing here is filled in from memory. Where something has not been checked against a
primary source it says so.

## Terrain: LOLA south pole elevation models

All three files come from one product:

- **PGDA product 90, "A New View of the Lunar South Pole from LOLA"**, NASA Goddard Planetary Geology,
  Geophysics and Geochemistry Laboratory. https://pgda.gsfc.nasa.gov/products/90
- **Cite as** (the product page's own wording): Barker et al., 2023, Planet. Sci. J., 4, 183.
  https://doi.org/10.3847/PSJ/acf3e1. Data DOI: 10.60903/gsfcpgda-lola-spole.
- Format, from the product page: cloud-optimised GeoTIFFs, south polar stereographic X/Y in metres, in the
  MOON_ME reference frame of the JPL DE421 ephemeris.
- Checked by us on the files themselves: longitude of origin 0, sphere radius 1,737,400 m, heights in metres
  above that sphere, 32-bit floats. No missing pixels in the tile and grid windows.

| File | Pixel size | Used for | Address |
|---|---|---|---|
| `LDEM_80S_20MPP_ADJ.TIF` | 20 m | The 720-direction skyline (out to 150 km) at the five Artemis sites: ridge, shack, degerl, peak, nobile. The 3D shadow view's terrain tiles. Moving `shack` onto the rim crest. | https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF |
| `LDEM_80S_80MPP_ADJ.TIF` | 80 m | The Sunlight map: a skyline for each of 41 × 41 points around the five Artemis sites. | https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF |
| `LDEM_60S_60MPP_ADJ.TIF` | 60 m | The skyline at IM-1 (Malapert A) and Chandrayaan-3, for the main dataset and the backtest. | https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_60S_60MPP_ADJ.TIF |

What was built from them:

| Output in `public/data/` | Script | From | Notes |
|---|---|---|---|
| `dataset.json` (skylines, `horizon_deg`) | `build_horizons.py`, `build_dataset.py` | 20 m file (Artemis sites), 60 m file (im1, ch3) | 720 directions, rays to 150 km, observer 2 m above the ground, curvature drop d²/2R, no refraction. Run on the team laptop. |
| `backtest.json` | `backtest.py` | 60 m file | Same skyline method. Run on the team laptop. |
| `tile_<site>.png` + `.json` | `build_tile.py` | 20 m file | 20 km square (1000 × 1000 source pixels) area-averaged to 512 × 512 (39 m per pixel), 16-bit grayscale. Built 2026-11-14. |
| `grid_<site>.json` | `build_grids.py` | 80 m file | 41 × 41 points every 500 m, each with its own 720-direction skyline to 150 km. Built 2026-11-14. |

Not done: validation against a published LOLA illumination map (for example Mazarico et al. 2011).

## Sun and Earth positions: JPL Horizons

- Service: JPL Horizons API, https://ssd.jpl.nasa.gov/api/horizons.api (NASA Jet Propulsion Laboratory,
  Solar System Dynamics). Queried by `pipeline/fetch_horizons.py` on the team laptop; the app makes no live calls.
- Settings, exactly as sent:

| Parameter | Value | Meaning |
|---|---|---|
| `EPHEM_TYPE` | `OBSERVER` | Observer table |
| `CENTER` | `coord@301` | A surface site on the Moon (body 301) |
| `COORD_TYPE` | `GEODETIC` | Site given as east longitude, latitude, height |
| `SITE_COORD` | `<E-lon deg>,<lat deg>,<alt km>` | From `pipeline/sites.json` |
| `COMMAND` | `10`, then `399` | Sun, then Earth |
| `QUANTITIES` | `4` | Apparent azimuth and elevation |
| `APPARENT` | `AIRLESS` | No refraction: the Moon has no atmosphere |
| `STEP_SIZE` | `1 h` | Hourly |
| `TIME_TYPE` | `UT` | Times in UTC |
| `ANG_FORMAT` | `DEG` | Decimal degrees |
| `CAL_FORMAT`, `CSV_FORMAT` | `CAL`, `YES` | Calendar dates, comma-separated rows |
| `OBJ_DATA`, `MAKE_EPHEM` | `NO`, `YES` | Table only |

- Azimuth is clockwise from north, elevation is above the site's horizontal plane.
- Windows fetched: 2027-06-01 to 2028-12-31 (demo), 2024-02-15 to 2024-03-10 (IM-1), 2023-08-15 to 2023-09-15
  (Chandrayaan-3). The app's `dataset.json` holds 2028-10-01 00:00 UTC onwards, 1,008 hourly steps (42 days).
- Independent check: a DE421 + IAU Moon-orientation calculation (Skyfield) agrees with the Horizons azimuth and
  elevation to within 0.01° at six dates for ridge and degerl (details in `project-memory/facts.md`).
- Not recorded: the exact date and time of each fetch. The raw responses are cached on the team laptop only.

## Site coordinates

Not yet checked against published papers. Do not present any of these as an official site.

| Site (`id`) | Latitude, east longitude | Height used | Where it came from |
|---|---|---|---|
| Connecting ridge (`ridge`) | −89.4632°, −137.49° | 1,945.3 m | Carried over from the prototype. Unverified. |
| Shackleton rim (`shack`) | −89.7804°, −156.1686° | 1,738.4 m | **Moved by us.** See the note below. Unverified. |
| de Gerlache rim (`degerl`) | −88.6834°, −67.9321° | 1,793.8 m | Carried over from the prototype. Unverified. |
| Peak near Shackleton (`peak`) | −88.811°, 123.6901° | 1,646.5 m | Carried over from the prototype. Unverified. |
| Nobile rim 1 (`nobile`) | −85.4381°, 37.3667° | 5,944.5 m | Carried over from the prototype. Unverified. |
| IM-1, Malapert A (`im1`) | −80.13°, 1.44° | 2,593.0 m | Carried over from the prototype; matches the figure quoted on Wikipedia's IM-1 page. Not checked against a primary source. |
| Chandrayaan-3 (`ch3`) | −69.37°, 32.32° | 528.5 m | Carried over from the prototype. Not checked against a primary source. |

Heights are the ground height from the DEM at that point (20 m file for the Artemis sites, 60 m file for im1
and ch3), in metres above the 1,737,400 m sphere.

**Shackleton rim snapping note.** The prototype's point for Shackleton rim (−89.7668°, −171.87°) fell on the
crater's inner wall: ground at 775 m and a skyline up to 32°. `pipeline/snap_to_rim.py` moved it to the highest
point of `LDEM_80S_20MPP_ADJ` within 3.0 km, which is 1.92 km away on the rim crest at −89.7804°, −156.1686°,
1,738 m. This is our own choice of point, made from the terrain model. It is not a published coordinate.

Candidate published points to check the sites against (not yet read by us; see `project-memory/facts.md`):
Gläser et al. 2018 for Connecting ridge, and Bussey et al. 2010, Icarus, doi:10.1016/j.icarus.2010.03.028.

## Mission dates used in the backtest

| Mission | Fact | Source as recorded in `project-memory/facts.md` |
|---|---|---|
| IM-1 Odysseus | Landed 2024-02-22 23:23 UTC at Malapert A; last contact 2024-02-29 | Wikipedia, "IM-1" |
| IM-1 Odysseus | Landed tipped at about 30°, panels misaimed, went to standby on power | Rappler, SatNews, The Space Review (Feb–Mar 2024 coverage) |
| Chandrayaan-3 Vikram | Landed 2023-08-23 12:33 UTC; put to sleep about 2023-09-04 02:30 UTC | ISRO, via SpacePolicyOnline and SpaceNews (Sep 2023) |

These are secondary sources. The primary sources (Intuitive Machines and ISRO releases) have not been read by us.

## Textures

NASA Scientific Visualization Studio (SVS). NASA SVS media is generally free to use with credit to
"NASA's Scientific Visualization Studio"; the exact credit line on each page has not been confirmed by us.

| File in `public/textures/` | Downloaded from | SVS entry | Date | Conversion |
|---|---|---|---|---|
| `moon_color_4k.jpg` | https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_4k.tif | 4720, "CGI Moon Kit" | 2026-11-13 | TIFF to JPEG (quality 84), 4096 × 2048, otherwise unchanged |
| `moon_ldem_4.png` | https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_4.tif | 4720, "CGI Moon Kit" | 2026-11-13 | 32-bit float to 8-bit PNG, 1440 × 720; file range −8.8785 to 10.504 mapped to 0..255 |
| `earth_day_2k.jpg` | https://svs.gsfc.nasa.gov/vis/a000000/a003600/a003615/flat_earth03.jpg | 3615 | 2026-11-14 | Re-saved as JPEG (quality 86), 2048 × 1024 |
| `earth_night_2k.jpg` | https://svs.gsfc.nasa.gov/vis/a030000/a030000/a030028/earthatnight2012.png | 30028, "Earth at Night 2012" | 2026-11-14 | Resized 5760 × 2880 to 2048 × 1024, PNG to JPEG (quality 86) |

- The Moon elevation file's values are treated as kilometres relative to the 1,737.4 km sphere; the app uses the
  range above for true-scale relief on the globe. The unit has not been confirmed on the SVS page.
- The globe's small Earth marker is a plain blue sphere with no texture.

## Models, icons and fonts

- The intro's rocket is built from primitives in `src/scenes/Intro/Rocket.tsx`: no imported model, no logos.
- App icons in `public/icons/` are original artwork made for this project.
- Typeface: Instrument Sans (SIL Open Font License), bundled through the `@fontsource-variable/instrument-sans` package.

## Sample data

`src/data/sample.ts` and `src/data/sampleGrid.ts` are synthetic. They are only shown when `?sample` is added
to the address, and everything drawn from them carries a "Sample data" label.
