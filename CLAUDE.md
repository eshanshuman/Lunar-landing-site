# CLAUDE.md — Lunar Landing Site Navigator (NASA Space Apps 2026)

## Shared memory — read this first, every session
`project-memory/` is the shared memory for Claude Code, the claude.ai Project and the team. At the start of every session read all of `project-memory/` (vision, scope, status, decisions, facts), then `PLAN.md` for scenes, data schema and milestones. Where they disagree, `project-memory/` wins.
At the end of every milestone or work session: rewrite the "Now" section of `project-memory/status.md`, append a dated line to `project-memory/decisions.md` for any decision made, add any newly verified number with its source to `project-memory/facts.md`, and commit those with the code.

## Project in one line
An installable app (PWA) that plans Moon landings at the lunar south pole for the Moon Base era: compare landing sites and dates in seconds. It shows Sun (power) and Earth (direct-to-Earth comms) against the real terrain horizon. It opens with a short skippable cinematic and runs on a 3D Moon. Theme: "What if we slip?"

## Hard rules
- **No made-up numbers.** Synthetic data lives only in `src/data/sample.ts`, and anything rendered from it shows a "Sample data" badge.
- **No live API calls at runtime.** All ephemeris and terrain data is precomputed into `public/data/`.
- Only build features listed in `project-memory/scope.md` (which extends `PLAN.md` §3), in its tier order. If something seems missing, ask before adding scope. Follow each feature's honesty rule.
- Original 3D models only (the rocket is built from primitives). NASA public-domain textures for the Earth and Moon; record every asset URL in `SOURCES.md`.
- The intro must be skippable from frame 1 and respect `prefers-reduced-motion`.
- Visual language (updated 2026-11-15; supersedes the prototype's look, PLAN.md §8 fonts/colours and the earlier "Moon fills the first screen" layout): on desktop (1024 px and wider) the app is one fixed, zero-scroll screen divided by 1px hairlines (`rgba(255,255,255,0.12)`), never rounded boxes: top bar, an always-visible left column (site, verdict, meters, scenario controls), a main stage whose views are swapped by a switcher strip, and the timeline docked at the bottom. Phones stack the same parts and scroll. Warm neutral greys on black, one typeface (Instrument Sans), sentence case, 2px radius on controls, outlines only on things you can click. Colour only for meaning (amber is the Sun and nothing else), in softened tones (Sun #EFB54F, Earth #82B4E8, good #6CBF90, blocked #DB6450); tokens live in `src/index.css`. `reference/prototype.html` remains the reference for behaviour and data shape, not for styling.
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
/src/scenes/Terrain/        # 3D LOLA shadow predictor (terrain tile, shadow-mapped Sun)
/src/panels/Shell.tsx       # the application shell: top bar, left column, view switcher, stage, shadows mini-window, docked timeline
/src/panels/                # the stage views: sunlight map, slip grid, sky view, backtest, night planner, data notes
/src/state/store.ts         # Zustand: site, landingDay, missionLength, t, pinA, view (which stage view is showing)
/src/lib/visibility.ts      # horizon interpolation, window stats, next-flip countdowns
/src/lib/terrainShadow.ts   # terrain tiles: heights, line of sight inside a tile, tile-vs-skyline check
/src/lib/grid.ts            # Sunlight-map grid bits, hours per point, nearest better point
```

## Working style
- Work milestone by milestone (M0 → M7 in `PLAN.md` §7). After each one: run the app, check it in the browser, commit, and summarise what changed in 3–5 lines.
- Unit-test `src/lib/visibility.ts` (window stats, countdowns, horizon interpolation) and the pipeline's horizon-mask maths (flat plane → 0°, a single tall ridge → the expected angle).
- Performance target: 60 fps on a mid-range laptop. Lazy-load the large textures.
- Commit messages: short, imperative.
