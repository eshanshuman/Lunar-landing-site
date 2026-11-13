# CLAUDE.md — Lunar Landing Site Navigator (NASA Space Apps 2026)

Read `PLAN.md` first. It is the source of truth for scope, scenes, data schema and milestones.

## Project in one line
A web app to compare lunar landing sites and dates in seconds. It shows Sun (power) and Earth (direct-to-Earth comms) against the real terrain horizon. It opens with a short skippable cinematic and runs on a 3D Moon. Theme: "What if we slip?"

## Hard rules
- **No made-up numbers.** Synthetic data lives only in `src/data/sample.ts`, and anything rendered from it shows a "Sample data" badge.
- **No live API calls at runtime.** All ephemeris and terrain data is precomputed into `public/data/`.
- Only build features listed in `PLAN.md` §3. If something seems missing, ask before adding scope.
- Original 3D models only (the rocket is built from primitives). NASA public-domain textures for the Earth and Moon; record every asset URL in `SOURCES.md`.
- The intro must be skippable from frame 1 and respect `prefers-reduced-motion`.
- Keep the visual language of `reference/prototype.html`: dark greyscale UI, with colour only for meaning (Sun #F5A524, Earth #60A5FA, OK #22C55E, blocked #EF4444).
- Wrap localStorage in try/catch. The app must work if storage is unavailable.

## Stack
Vite + React + TypeScript · React Three Fiber + drei · Zustand · Tailwind · Canvas 2D for the charts · Python 3.11 in `pipeline/` (numpy, rasterio, pyproj, requests).

## Layout
```
/reference/prototype.html   # approved visual prototype, don't edit
/pipeline/                  # Python data pipeline (run locally; JPL is reachable from laptops)
/public/data/               # generated JSON consumed by the app
/src/scenes/Intro/          # Scene 0 cinematic
/src/scenes/Moon/           # Scene 1 3D explorer
/src/panels/                # slip grid, sky view, timeline, countdowns, diff, explain
/src/state/store.ts         # Zustand: site, landingDay, missionLength, t, pinA
/src/lib/visibility.ts      # horizon interpolation, window stats, next-flip countdowns
```

## Working style
- Work milestone by milestone (M0 → M7 in `PLAN.md` §7). After each one: run the app, check it in the browser, commit, and summarise what changed in 3–5 lines.
- Unit-test `src/lib/visibility.ts` (window stats, countdowns, horizon interpolation) and the pipeline's horizon-mask maths (flat plane → 0°, a single tall ridge → the expected angle).
- Performance target: 60 fps on a mid-range laptop. Lazy-load the large textures.
- Commit messages: short, imperative.
