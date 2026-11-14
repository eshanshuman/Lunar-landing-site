# Status

## Now (2026-11-15 02:00 IST)
**App (branch `claude/vibrant-thompson-kpf3hb`):** intro cinematic, 3D Moon explorer, verdict + countdowns, timeline, slip grid, plan compare, sky view, explain mode, Shadow Vision + nearest better point. **M3 done: the app runs on real data** (JPL Horizons tracks + LOLA skylines for all 7 sites, October 2028 demo window, `public/data/dataset.json` from `pipeline/build_dataset.py`). Only the Sunlight map (P2 grids) is still sample and keeps its badge. `?sample` in the URL shows the old synthetic data. The **Backtest panel** (IM-1 + Chandrayaan-3) reads `public/data/backtest.json`.

**Team right now: Osho only** (with Claude in the claude.ai Project and Claude Code on the laptop).

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

**Pitch material:** web presentation (claude.ai artifact, 9 slides with 3D morphs), `Lunar_Site_Navigator_Pitch_Clean.pptx` (8 static slides). Both still show sample-data screenshots.

## Next
1. 3D LOLA shadow predictor (scope item 4), in Claude Code on the laptop (needs the 20 m DEM). Backtest panel (item 5) and M3 are done.
2. Refresh deck screenshots with real data.
3. P2 grids on real terrain for Shadow Vision.
4. Presets + PWA, then Tier C as time allows. Refresh deck screenshots once real data is in.
