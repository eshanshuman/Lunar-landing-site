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
| M2 3D Moon explorer | Next (placeholder in the layout) |
| P1 Pipeline v1 | Skeletons written; not yet run on real data (see `pipeline/README.md`) |

**All numbers in the app are currently synthetic** (`src/data/sample.ts`) and the header shows a
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
src/data/                  sample.ts (synthetic) and dataset.ts (the one data entry point)
src/lib/visibility.ts      skyline interpolation, window stats, rise/set countdowns (unit-tested)
src/state/store.ts         Zustand: site, landingDay, missionLength, t, pinA
src/panels/                sites, sky view, timeline, slip grid, right now, scenario diff, why
src/scenes/                Intro (M4) and Moon (M2)
pipeline/                  Python data pipeline
public/data/               generated JSON consumed by the app (empty until the pipeline runs)
```

Keys: Space play/pause · ←/→ step one hour · ↑/↓ change site.

## Deploy

`.github/workflows/deploy.yml` publishes `dist/` to GitHub Pages on every push to `main`
(enable once under Settings → Pages → Source: GitHub Actions). The build uses a relative base
path, so it also works on Vercel unchanged.
