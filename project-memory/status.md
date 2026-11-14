# Status

## Now (2026-11-14 20:37 UTC)
**App (branch `claude/vibrant-thompson-kpf3hb`):** intro cinematic, 3D Moon explorer, verdict + countdowns, timeline, slip grid, plan compare, sky view, explain mode, Shadow Vision + nearest better point, **3D LOLA shadow predictor (scope 4, real terrain + real Sun)**. **M3 done: the app runs on real data** (JPL Horizons tracks + LOLA skylines for all 7 sites, October 2028 demo window, `public/data/dataset.json` from `pipeline/build_dataset.py`). Only the Sunlight map (P2 grids) is still sample and keeps its badge. `?sample` in the URL shows the old synthetic data. The **Backtest panel** (IM-1 + Chandrayaan-3) reads `public/data/backtest.json`. **Presets** (scope 6) and **installable PWA** (scope 7: manifest, original moon icon, service worker; checked offline reload) are done. **Tier C 11 (Survive the night) and 12 (Sky hidden by terrain)** are done (`src/panels/NightSky.tsx`, `src/lib/night.ts`, tested).

**Heads-up on duplicate work:** this file said Claude Code on the laptop was building the 3D LOLA shadow predictor. The Claude Code cloud session has now built and pushed it (details below). If the laptop session also has one in progress, do not merge a second copy; compare and keep one. The laptop session can go straight to the P2 grids.

**Team right now: Osho only** (with Claude in the claude.ai Project and Claude Code on the laptop).

**3D LOLA shadow predictor (scope 4) — done 2026-11-14, on real data** (panel "Shadows on the ground", `src/scenes/Terrain/`, added by the Claude Code cloud session at 2026-11-14 20:32 UTC):
- Terrain: `public/data/tile_<site>.png` + `.json` for ridge, shack, degerl, peak, nobile, cut by `pipeline/build_tile.py` from `LDEM_80S_20MPP_ADJ.TIF` (20 km square, 512 px = 39 m per pixel, 16-bit heights, ~350 KB each, committed). `--dem` also accepts the PGDA https address, so tiles rebuild without the 3.7 GB file.
- App: mesh at true scale (2× / 3× exaggeration is labelled on screen), shadow-mapped Sun from the real Horizons direction at the scrubber time, lander marker with Sun and Earth lines coloured from the 150 km horizon masks.
- Honesty on screen: shadows come only from terrain inside the 20 km tile; the verdict comes from the 150 km skyline; when the skyline blocks the Sun but nothing in the tile does, the panel says "far ridge beyond this tile". Hour counts for the mission are listed.
- Scope check passed: over the full 1,008-hour demo window the tile never contradicts the horizon mask at any of the five sites, for the Sun or Earth (`src/lib/terrainShadow.test.ts`; numbers in `facts.md`). Getting there needed one fix: the observer stands on the site's 20 m ground height (`site_height_m` in the tile JSON), because the 39 m average sits 1–3 m low on the ridge and shack crests.
- im1 and ch3 have no tile: only the five Artemis sites were built. ch3 (69.4°S) is outside the 20 m file, so it would need the 60 m one. The panel says there is no tile for those sites.
- The service worker now pre-caches the ten tile files (cache name bumped to `lsn-v2`), so the 3D view works offline for every site.
- Not checked: frame rate on a real GPU (the cloud sandbox renders in software). Try it on a laptop.

**Pipeline P1: done on Osho's laptop (files in `pipeline/cache/`, which git ignores).**
- Terrain: `LDEM_80S_20MPP_ADJ` (20 m/px) for ridge, shack, degerl, peak, nobile; `LDEM_60S_60MPP_ADJ` (60 m/px) for im1 and ch3. Both from PGDA product 90. Files live in `C:\Users\LOQ\Downloads\`.
- Projection checked with `rio info`: longitude of origin 0, standard parallel −90 (south polar stereographic), sphere radius 1,737,400 m. Heights are relative to that sphere.
- Horizon masks built for all 7 sites. Skylines (min to max): ch3 0.45° to 2.40° · degerl −2.88° to 2.85° · im1 −0.25° to 10.99° · nobile −5.68° to 12.70° · peak −3.18° to 1.05° · ridge −3.23° to 2.04° · shack −2.55° to 1.04°.
- `shack` was on Shackleton's inner wall (skyline up to 32°, ground 775 m). `snap_to_rim.py` moved it 1.92 km to the rim crest (−89.7804, −156.1686, 1,738 m). Still not a published coordinate.
- JPL Horizons fetched for all 7 sites and 3 windows: Chandrayaan-3 backtest 2023-08-15 → 09-15 (745 hourly rows), IM-1 backtest 2024-02-15 → 03-10 (577 rows), demo 2027-06-01 → 2028-12-31 (13,897 rows). `ephem_<site>.json` currently holds the demo window; the backtest windows rebuild in seconds from the cached raw files by re-running their fetch command.
- Horizons output independently checked (DE421 via Skyfield + IAU Moon orientation): azimuth and elevation agree to within 0.01° at six dates for ridge and degerl. Azimuth is clockwise from north; the parser reads the right columns.

**Open items**
1. ~~Share the data~~ done: the bundled outputs are committed in `public/data/`. Raw cache still only on the laptop (re-run `build_dataset.py` / `backtest.py` there after any pipeline change).
2. `fetch_horizons.py` overwrites `ephem_<site>.json` per run; give each window its own output file before the backtest panel is built.
3. `build_dataset.py` and `backtest.py` are done. `build_grids.py` (Shadow Vision) has not been run on real terrain.
4. `SOURCES.md`: add both DEM files, the PGDA link, and the shack snapping note.
5. All site coordinates still need published sources. Candidates from the Z.ai research (verify in the papers first): Gläser et al. 2018 Connecting Ridge C1 (−89.4505°, 222.84°E, 0.4 km from `ridge`) and C2 (−89.3157°, 245.94°E); Bussey et al. 2010 (Icarus, doi:10.1016/j.icarus.2010.03.028) Points A–D, e.g. Shackleton Pt A 89.68°S 166.0°W, de Gerlache Pt C 88.71°S 68.7°W (about 1 km from `degerl`); `peak` may be Bussey Point D.
6. Possible extra backtest with a documented answer: Apollo 15 and 17 Sun elevation at touchdown (reported ~12.0° and ~13.3°; verify from mission records before use).

**Z.ai parallel research (GLM chat):** use only as a cross-check and for write-up material. Its sunlight numbers roughly agree with ours (Oct 2027: ridge 92.6% ours vs 100% its C1; degerl 89.0% vs 89.6%), but its Earth-visibility numbers are wrong (0% at rim sites where our verified data shows Earth ~5° up), its 41 × 41 map had visible/blocked inverted, and its terrain is 118 m vs our 20 m. Do not put its numbers in the app.

**Pitch material:** `Lunar_Site_Navigator_Pitch_Real.pptx` (9 static slides, real-data screenshots: hero on the Artemis preset, slip grid + plan compare (−163 h Earth contact for a 5→12 Oct slip), sky view (Earth sinks ~7° below the horizon), 3D shadows, IM-1 backtest, survive-the-night). The web presentation artifact and the older pptx files still show sample data.

**External critique (Gemini, 2026-11-15) triage:** already handled: precomputed static data, 720-direction LOLA horizon masks, Horizons queried topocentric at body-fixed site coordinates (verified to 0.01°), both 3D canvases use `frameloop="demand"`. Worth doing: (a) quantitative uncertainty section in About the data (ephemeris window and step, ±30 min from hourly steps, DEM resolution per site, coordinate uncertainty); (b) a 'marginal' state when the Sun/Earth clears the skyline by less than ~0.3°; (c) laptop FPS check (globe 360×180 sphere with displacement + terrain 520k triangles, 4096 shadow map). Rejected as out of scope/no data: plume-ejecta hazard matrix, Ar-40/volatile transients, boulder hazards.

## Next
1. 3D LOLA shadow predictor (scope 4) is done. Still open from Tier A: P2 grids for the Sunlight map (scope 3). The 20 m and 80 m DEMs can be read window by window from the PGDA https address (cloud-optimised GeoTIFF), so the grids no longer need the laptop's copy; `build_grids.py` still wants `ephem_<site>.json`, which is only in the laptop's `pipeline/cache/`; in the cloud, use the Sun/Earth tracks already in `public/data/dataset.json` (the October 2028 window) instead.
2. Deck refreshed (done). Next in the Project: critique items (a) uncertainty section and (b) marginal state, if Osho agrees.
3. Tier C 8–10 need the grids / 3D scene, so they follow step 1.
