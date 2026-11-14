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
