# Lunar Landing Site Navigator

NASA Space Apps 2026 · Challenge: Lunar Landing Site Navigator.
Compare lunar landing sites and dates in seconds: where the Sun (power) and Earth (direct-to-Earth
comms) are relative to the terrain horizon. Theme: **"What if we slip?"**

`PLAN.md` is the source of truth for scope and milestones; `CLAUDE.md` has the working rules.

## Status

| Milestone | State |
|---|---|
| M0 Scaffold | Done |
| M1 2D panels on sample data | Done |
| M2 3D Moon explorer | Done: globe, Sun lighting from the store's time, site pins, Earth marker, sight lines |
| M3 Real data swap | Waiting on pipeline output |
| Sunlight map | Done on real grids for the five Artemis sites (LOLA 80 m terrain, `pipeline/build_grids.py`) |
| 3D LOLA shadow predictor | Done on real LOLA terrain tiles for the five Artemis sites; Sun direction is still sample data until M3 |
| M4 Intro cinematic | Done: 12 s, skippable (button, Esc, Enter, Space), plays once, "Replay intro" in the header, off under reduced motion |
| P1 Pipeline v1 | Skeletons written; not yet run on real data (see `pipeline/README.md`) |

The Moon imagery is real NASA data. **All numbers in the app are currently synthetic** (`src/data/sample.ts`) and the header shows a
"Sample data" badge. Site coordinates are unverified. See `SOURCES.md`.

## Run

```bash
npm install
npm run dev
```

```bash
npm test
npm run build
```

Python pipeline: see `pipeline/README.md`.

## Layout

```
reference/prototype.html   approved visual prototype (do not edit)
src/data/                  sample.ts and sampleGrid.ts (synthetic), dataset.ts (the one data entry point)
src/lib/grid.ts            Sunlight-map bits, hours per point, nearest better point (unit-tested)
src/lib/visibility.ts      skyline interpolation, window stats, rise/set countdowns (unit-tested)
src/state/store.ts         Zustand: site, landingDay, missionLength, t, pinA
src/panels/Shell.tsx       application shell: top bar, left column, view switcher, stage, shadows mini-window, docked timeline
src/panels/                the stage views: sunlight map, slip grid, sky view, backtest, night planner, data notes
src/scenes/Moon/           3D Moon explorer (geo.ts holds the lat/lon and sky-direction maths, unit-tested)
src/scenes/Terrain/        3D shadow view: real terrain tile, shadow-mapped Sun, lander with Sun/Earth lines
src/lib/terrainShadow.ts   tile heights, line of sight inside a tile, tile-vs-skyline comparison (unit-tested)
src/scenes/Intro/          intro cinematic: camera director, rocket, captions, seen-state
public/textures/           NASA SVS CGI Moon Kit maps (see SOURCES.md)
pipeline/                  Python data pipeline
public/data/               generated JSON consumed by the app (empty until the pipeline runs)
```

Keys: Space play/pause · ←/→ step one hour · ↑/↓ change site.

## Deploy

`.github/workflows/deploy.yml` publishes `dist/` to GitHub Pages on every push to `main`
(enable once under Settings → Pages → Source: GitHub Actions). The build uses a relative base
path, so it also works on Vercel unchanged.
