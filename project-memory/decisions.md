# Decisions log (append only, newest at the bottom)

- **2026-11-13** — Dropped the "Mission Stress Tester" (PASS/CONCERN/UNKNOWN site screening). Rebuilt around the official challenge: compare sites and dates fast, Sun and Earth against the horizon, theme "What if we slip?".
- **2026-11-13** — No live API calls at runtime; everything precomputed into static JSON so the demo works on bad Wi-Fi.
- **2026-11-13** — Terrain horizon masks from LOLA are required; a flat 0° horizon is not good enough at the pole.
- **2026-11-14** — Shadow Vision kept, reframed as power potential (lit/dark ground, nearest better point). Glare, crew vision framing parked.
- **2026-11-14** — Rejected the "Regolith-Shield" thermal/radiation module and any single composite "safe haven" score: off-brief and not computable honestly from our data.
- **2026-11-14** — DEM choice: PGDA product 90 (Barker et al. 2023). 80 m file for masks/grids, 240 m file for IM-1 and Chandrayaan-3, 20 m file for close-up terrain.
- **2026-11-14** — Team: Osho (app), Garima + Avin (data pipeline). Replaces earlier names.
- **2026-11-14** — Pitch material: a web presentation with a live 3D scene and morph transitions, plus a static PowerPoint with AI-deck tells removed.
- **2026-11-15** — Vision updated: an installable planning app for the Moon Base era (robotic and crewed), south pole first. Gateway is cancelled, so the pitch does not rely on an orbital station.
- **2026-11-15** — Make the app installable as a PWA rather than a native rewrite.
- **2026-11-15** — 3D LOLA shadow predictor is a must-have. Demo uses a real landing (IM-1 backtest) and a future scenario (Artemis IV-style, 2028).
- **2026-11-15** — Tier C extras (base siting, lit route + hours in shadow, infrastructure shadows, survive-the-night battery calculator, sky-blocked %) are in scope for today after Tiers A and B, each with an honesty rule in `scope.md`.
- **2026-11-15** — Created this shared `project-memory/` folder; it is the single source of truth for Claude Code, the claude.ai Project and the team.
- **2026-11-14** — Used the 20 m DEM (`LDEM_80S_20MPP_ADJ`) for the Artemis sites and the 60 m file (`LDEM_60S_60MPP_ADJ`) for IM-1 and Chandrayaan-3 instead of the lighter 80 m / 240 m files; the script reads only a 150 km window per site, so memory is fine.
- **2026-11-14** — Moved `shack` onto Shackleton's rim crest with `snap_to_rim.py` (it sat on the inner wall). Interim fix until a published coordinate replaces it.
- **2026-11-14** — Z.ai (GLM) research chat is a cross-check and write-up source only; its numbers do not go into the app (Earth-visibility and map bugs, coarser terrain, no Horizons access).
- 2026-11-15: IM-1 demo story = 'terrain sunset 2 Mar, lander died 29 Feb on power'; Chandrayaan-3 added as second backtest. Earlier IM-1 dates were off by one day (JD bug) and are corrected.
- 2026-11-15: Backtest panel shows both IM-1 and Chandrayaan-3 with a whole-mission / around-sunset zoom. IM-1's end is shown as a day-long band because only the date (29 Feb) is public, so the gap is stated as a range (1.6–2.6 days).
