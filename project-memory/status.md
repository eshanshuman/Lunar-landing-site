# Status

## Now (2026-11-15 01:30 IST)
**App (branch `claude/vibrant-thompson-kpf3hb`):** intro cinematic, 3D Moon explorer, verdict + countdowns, timeline, slip grid, plan compare, sky view, explain mode, Shadow Vision + nearest better point. All on sample data.

**Pipeline:**
- The team has the LOLA DEM `LDEM_80S_20MPP_ADJ` (PGDA product 90, 20 m/px, 80–90°S) locally.
- `sites.json` now has `alt_km` for every site from the DEM, and `shack` was snapped onto the Shackleton rim crest with `snap_to_rim.py` (commit 8913db0).
- Horizons fetch timeout raised; Horizons data and horizon masks are cached locally (not in git) — status of the full run unknown here.

**Open checks (data lane):**
- `ch3` (69.37°S) and the north edge of `im1` (80.13°S) are outside or at the edge of the 80–90°S DEM. Use `LDEM_60S_240MPP_ADJ.TIF` for both, and confirm where ch3's `alt_km` 0.5285 came from.
- `nobile` `alt_km` 5.9445 is unusually high — sanity-check it against the DEM before trusting it.
- For horizon masks and grids, the 80 m file (`LDEM_80S_80MPP_ADJ.TIF`) is enough and much lighter; keep the 20 m file for the 3D shadow-predictor tiles.
- The five Artemis region coordinates are still UNVERIFIED against the NASA source.

**Pitch material:** web presentation (claude.ai artifact, 9 slides with 3D morphs), `Lunar_Site_Navigator_Pitch_Clean.pptx` (8 static slides). Both still show sample-data screenshots.

## Next
1. Finish P1, commit `public/data/site_*.json` (Garima + Avin).
2. M3 real-data swap, then the 3D LOLA shadow predictor (scope item 4) and the IM-1 backtest (item 5).
3. Presets + PWA, then Tier C as time allows.
4. Refresh screenshots in the deck once real data is in.
