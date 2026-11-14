# Lunar Landing Site Navigator — Build Plan (final, v1)

NASA Space Apps 2026 · Challenge: **Lunar Landing Site Navigator** (CLPS) · Hackathon: 14–15 Nov 2026
Team: Osho (app lead), Garima + Avin (data pipeline), everyone (story/pitch)

---

## 1. What we are building (one paragraph)

A web app that lets mission planners, educators and the public **compare lunar landing sites and dates in seconds**, by showing where the **Sun** (power) and **Earth** (direct-to-Earth comms) are relative to the **real terrain horizon** at each site. It opens with a **short, skippable cinematic** (rocket leaves Earth → arrives at the Moon → dives to the South Pole). That hands off into an **interactive 3D Moon** where every feature lives. Core idea: **"What if we slip?"** Schedules slip, and our tool shows instantly what a new date or a nearby site gains or loses.

## 2. Why: the official challenge in brief (judging lens)

- Existing tools (Quickmap, Moon Trek, JPL Horizons) are powerful but slow for **rapid scenario comparison**.
- Users: **mission planners, educators, the public**.
- They ask for: curated sites + custom coordinates · side-by-side comparison · date/time flexibility · Sun/Earth position vs horizon · **time remaining before sunset/Earthset** · solar elevation, sunlight duration, Earth visibility windows · 2D/3D/animated views · real **LOLA topography** · **no atmosphere** (horizon = terrain + lunar curvature, no refraction) · Earth **libration** · explaining **why small location/date changes have big impacts** · responding to **schedule slips**.
- Every feature below maps to one of these. Don't build anything that doesn't.

## 3. User flow (scenes)

### Scene 0: Intro cinematic (≤ 12 s, always skippable)
| Time | Shot | Caption (lower third, large, short) |
|---|---|---|
| 0–2 s | Night-side Earth, a small original rocket lifts off and arcs up | "Every Moon mission starts with a date." |
| 2–5 s | Camera follows a glowing trajectory line across black space; Earth shrinks | "But launch dates slip." |
| 5–8 s | Moon grows; camera swings toward the South Pole; low Sun grazes the craters, long shadows | "At the South Pole, the Sun barely clears the horizon." |
| 8–11 s | Dive toward the pole; site pins fade in; UI panels slide in | "Pick a site. Pick a date. See what you get." |
| 11–12 s | Hand-off to Scene 1 (same camera, no cut) | — |

Rules:
- **Skip button** visible from frame 1 (top-right, plus Esc/Enter/Space). Remember "seen" in localStorage (wrapped in try/catch) and offer "Replay intro" in the header.
- `prefers-reduced-motion` → skip straight to Scene 1 with a cross-fade.
- The rocket is an **original low-poly model built in code** (no brand logos, no copied 3D models). Earth and Moon use NASA public-domain textures.
- The intro must never block the demo: total load-to-interactive under 3 s on a laptop. Load the Scene 1 assets during the intro.

### Scene 1: 3D Moon explorer (the main screen)
- **Globe:** NASA SVS "CGI Moon Kit" colour + displacement maps on a sphere. **Lighting comes from the real Sun direction** for the selected date and time, so the terminator is correct.
- **Earth in the sky:** a small Earth placed in its real direction from the selected site (from Horizons). With one toggle the camera "stands" at the site and looks at the horizon.
- **Site pins:** a curated list grouped as *Artemis study regions*, *Past landings* (IM-1 Malapert A, Chandrayaan-3, etc.), *Apollo* (Apollo 11, 15, 17 for the pole-vs-equator contrast), plus **click-to-add custom coordinates** (lat/lon input or click on the globe).
- **South Pole close-up:** zooming past a threshold swaps in a **LOLA DEM terrain tile** (polar stereographic) with real-sun shadows. This avoids the polar pinching of equirectangular textures.
- **Sight lines:** from the selected site, a yellow line to the Sun and a blue line to Earth. A line turns **red and dashed** when terrain blocks it.

### Scene 2: Analysis panels (docked around the 3D view; port from the prototype)
The visual design is already set in `reference/prototype.html`. Match it.
1. **Slip grid:** rows are sites, columns are landing dates (28+). Colour = sunlight % and Earth-contact % over the mission length (green both ≥ 75%, amber one, red neither). Hover shows numbers, click loads the scenario.
2. **Sky view:** a 360° panorama of the terrain skyline with the Sun and Earth tracks for the mission window. Blocked segments are red and dotted. The current Sun is drawn at its true angular size (0.53°).
3. **Timeline + scrubber + play:** hourly Sunlight / Earth bars. The 3D view, sky view and countdowns all follow the scrubber.
4. **Right now:** Sun height, Earth height, **"Sunset in / Earthset in"** (or "rise in") countdowns.
5. **Scenario diff:** "Pin as plan A", then click another cell. Shows Δ sunlight hours, Δ Earth-contact hours, Δ longest dark, Δ longest Earth gap, Δ first sunset.
6. **Explain mode:** a plain-language toggle ("The Sun never climbs above 1.2° here, so a ridge 0.8° high to the SW blocks it for 40 h…") generated from the data.

### Standout features (what no other public team has, as far as we've seen)
7. **Nearest better site:** when a site–date fails, search a precomputed grid of points around the region (~250–500 m spacing within ~10 km). Highlight the closest point that does better on the 3D terrain: "Move 1.8 km NE → +40 h sunlight."
8. **Backtest on real landings:** run the tool for real missions (IM-1 Odysseus at Malapert A, Chandrayaan-3) and compare predicted sunset with when the mission actually ended. *Verify mission dates and coordinates from primary sources first.*
9. **Libration made visible:** in the sky view and the 3D site view, Earth traces its slow monthly loop.

### Stretch (only after everything above works)
Pole-vs-equator side-by-side · CSV / share-link export · Moon Trek / Quickmap deep link for the selected point · mast-height toggle · partial Sun disc fraction.

## 4. Tech stack
- **Frontend:** Vite + React + TypeScript · **React Three Fiber** + **drei** (3D) · **Zustand** (single store: site, landingDate, missionLength, t, pinA) · **Tailwind** for layout · Canvas 2D for the sky view / timeline / slip grid (fast, matches prototype). Animation timeline for the intro: plain R3F `useFrame` + an easing helper, or GSAP if preferred.
- **No backend.** All data is precomputed into `public/data/*.json` (+ binary `.bin` for big arrays if needed). Zero live API calls during the demo.
- **Deploy:** Vercel or GitHub Pages. Make sure the production build works offline once loaded (judges' Wi-Fi).
- **Fallback:** if WebGL fails, skip the intro and the 3D view and show the 2D panels only (the prototype layout).

## 5. Data pipeline (`pipeline/`, Python 3.11)

Run it locally. JPL is reachable from team laptops, not from the Claude cloud sandbox.

1. **`fetch_horizons.py`**: For each site, query the JPL Horizons API (`https://ssd.jpl.nasa.gov/api/horizons.api`) as an OBSERVER table:
   - `CENTER='coord@301'`, `COORD_TYPE='GEODETIC'`, `SITE_COORD='<E-lon>,<lat>,<alt_km>'`
   - `COMMAND='10'` (Sun) and `'399'` (Earth), `QUANTITIES='4'` (azimuth/elevation), airless (no refraction), `STEP_SIZE='1h'`
   - Range: the full demo window (e.g. 2027-06-01 → 2028-12-31) plus the backtest windows (2023-08, 2024-02).
   - Parse to arrays and cache raw responses under `pipeline/cache/`. Respect rate limits (sleep between calls).
   - **Validate:** spot-check two timestamps against the Horizons web UI.
2. **`build_horizons.py`** (terrain horizon masks): Load the **PGDA LOLA South Pole DEM** (find the current high-res polar stereographic GeoTIFF product; record its URL, resolution and version in `data/SOURCES.md`). For each site point, cast **720 azimuth rays** out to ~150 km. Elevation angle per sample = `atan2(h_target − h_obs − curvature_drop, distance)`, with curvature drop ≈ `d² / (2R)` and R = 1737.4 km. Observer height default 2 m above ground. The mask is the max angle per azimuth. Use numpy, vectorised, with `rasterio` + `pyproj` for the projection.
   - **Validate:** compare a site's yearly sunlit % against published LOLA illumination maps (Mazarico et al. 2011, Barker et al. 2021/2023). Record the comparison.
3. **`build_grids.py`**: horizon masks for a point grid around each Artemis region (for "nearest better site").
4. **`build_dataset.py`**: Combine into the schema below. Precompute visibility booleans and blackout intervals.
5. **`backtest.py`**: for IM-1 and Chandrayaan-3, predicted sunset vs actual end of operations, written to `backtest.json`.

Custom coordinates in the app: inside the DEM tile, the app loads a **coarse DEM (e.g. 240 m/px) into a Web Worker** and computes the horizon mask on the fly, with a "terrain: coarse" label. Outside the tile it uses the smooth-sphere horizon, labelled **"terrain not modelled"**. For ephemeris at custom points, interpolate from the nearest precomputed site within the pole region and note the approximation.

## 6. Data schema (`public/data/`)

```jsonc
// sites.json
[{ "id": "ridge", "name": "Connecting ridge", "group": "Artemis study regions",
   "lat": -89.4632, "lon": -137.49, "alt_km": 1.9, "source": "NASA Lunar Surface Data Book 2025 (verify)" }]

// site_<id>.json
{ "id": "ridge",
  "start_utc": "2027-06-01T00:00:00Z", "step_h": 1,
  "horizon_deg": [/* 720 values, azimuth 0..359.5, clockwise from north */],
  "sun":   { "az": [/*…*/], "el": [/*…*/] },
  "earth": { "az": [/*…*/], "el": [/*…*/] },
  "meta":  { "dem": "PGDA product …", "observer_height_m": 2, "ephemeris": "JPL Horizons, airless" } }

// grid_<region>.json  (nearest-better-site)
{ "region": "ridge", "spacing_m": 500,
  "points": [{ "lat": …, "lon": …, "horizon_deg": [/*720*/] }] }

// backtest.json
[{ "mission": "IM-1 Odysseus", "site_id": "im1", "landed_utc": "…", "ops_ended_utc": "…",
   "predicted_sunset_utc": "…", "sources": ["…"] }]
```

The prototype's synthetic generator produces this same shape. **Keep it as `src/data/sample.ts` behind a "Sample data" badge** so the UI works before the pipeline lands.

## 7. Milestones (in order; each ends in something demoable)

| # | Milestone | Owner | Done when |
|---|---|---|---|
| M0 | Scaffold: Vite+React+TS+R3F+Tailwind+Zustand, deploy pipeline, sample data wired | Osho + Claude Code | Blank app deploys; store works |
| M1 | **Port the 2D panels** from the prototype into React (slip grid, sky view, timeline, countdowns, diff, explain) on sample data | Claude Code | Matches prototype visually; all interactions work |
| M2 | **3D Moon explorer:** globe, real-sun lighting from the store's time, site pins, select → panels update, Earth marker, sight lines | Claude Code | Clicking a pin or scrubbing time moves the light and the lines |
| P1 | **Pipeline v1:** Horizons fetch + horizon masks for 5 Artemis sites + 2 past landings | Garima + Avin (parallel to M0–M2) | `site_*.json` validated; SOURCES.md written |
| M3 | **Real data swap:** load pipeline JSON, keep sample as fallback, remove "sample" badge only for real-data sites | Claude Code | Grid colours come from real data |
| M4 | **Intro cinematic** (Scene 0) with skip, reduced-motion, preload | Claude Code | ≤ 12 s, 60 fps on a laptop, seamless hand-off |
| M5 | **South Pole terrain close-up** (LOLA tile mesh + shadows) | Claude Code + data lane | Zoom-in swaps to terrain without a pop |
| M6 | **Standouts:** nearest better site (P2 grids) + backtest view | all | Both demo cleanly with real numbers |
| M7 | Polish: explain mode copy, accessibility, loading states, offline check, README, demo rehearsal | all | 3-minute demo runs twice without a hitch |

**Cut order if time runs out:** M5 → backtest → nearest better site → intro polish. The **slip grid + sky view + 3D Moon with real data** must ship no matter what.

## 8. Visual and UX rules
- Dark, calm, data-first (closer to a NASA/GIS tool than sci-fi). Colour only carries meaning: **Sun = amber #F5A524, Earth = blue #60A5FA, OK = green #22C55E, blocked/bad = red #EF4444**. Everything else is greyscale.
- Fonts: Inter (UI), JetBrains Mono (numbers).
- Every number has units and a source tooltip. The vertical exaggeration in the sky view is labelled.
- Keyboard: Space = play/pause, ←/→ = step hours, ↑/↓ = change site, Esc = skip intro. Visible focus rings.
- Never block on loading: show skeletons, and the intro covers asset loading.
- Use the words planners and the public both understand: "Sunset in 3 d 4 h", not "solar occultation".

## 9. Honesty rules (non-negotiable)
- **No made-up numbers** in the UI, deck or pitch. Anything synthetic carries the "Sample data" badge.
- Geometric line of sight ≠ guaranteed power or radio link. Say so in the Data panel.
- Site coordinates come from published sources only, cited in `SOURCES.md`.
- Say what we don't model: link budgets, thermal, slopes/hazards, relays.

## 10. Demo script (3 min)
1. **(0:00)** Intro cinematic plays (12 s). Presenter: "Every Moon mission starts with a date. And dates slip."
2. **(0:20)** On the 3D Moon: click *Connecting ridge*. The Sun light and sight lines update. "At the pole the Sun barely clears the horizon, so terrain decides everything."
3. **(0:50)** Slip grid: pin plan A, click "+6 days" → the diff shows what we lose. Countdown: "Earthset in 19 h."
4. **(1:30)** Nearest better site: "Move 1.8 km and get 40 hours of sunlight back." *(real numbers by then)*
5. **(2:00)** Backtest: "We predicted IM-1's sunset; here's when the mission actually ended."
6. **(2:30)** Explain mode + Apollo 11 comparison for educators. Close: "Pick a site. Pick a date. See what you get, in seconds."

## 11. Things to verify before the demo
- Site coordinates for the Artemis regions (NASA Lunar Surface Data Book 2025), IM-1 Malapert A, and Chandrayaan-3.
- IM-1 and Chandrayaan-3 landing and end-of-operations dates/times.
- The PGDA DEM product URL and resolution, and the SVS CGI Moon Kit texture URLs and licence notes.
- Horizons parameters (`coord@301` geodetic site, airless apparent az/el) against the Horizons web UI.
