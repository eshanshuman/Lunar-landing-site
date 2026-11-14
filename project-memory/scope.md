# Scope (updated 2026-11-15) — overrides PLAN.md §3 for what to build

Hackathon ends 2026-11-15. Build in this order; stop where time runs out. Tiers A and B must ship.

## Already built (sample data until the pipeline lands)
Intro cinematic · 3D Moon explorer with Sun/Earth sight lines · verdict + countdowns · timeline with play · slip grid · plan compare · sky view · explain mode · Shadow Vision (sunlight map, whole mission + right now) · nearest better point.

## Tier A — real data (blocks everything)
1. **P1 pipeline:** horizon masks + JPL Horizons for all sites, written to `public/data/`. (Garima + Avin)
2. **M3 swap:** app reads real JSON; "Sample data" badge removed site by site.
3. **P2 grids** for Shadow Vision from the 80 m DEM.

## Tier B — must-haves for the pitch
4. **3D LOLA shadow predictor** (the headline feature).
   - Pipeline: crop a ~20 × 20 km tile around each site from the LOLA DEM (the 20 m file is ideal), resample to ~512 × 512, save as a 16-bit height PNG + JSON with extent, metres per pixel, min/max height. Record the product in `SOURCES.md`.
   - App: terrain mesh from the height PNG (true scale, optional vertical exaggeration toggle labelled on screen), real-time directional light from the actual Sun direction at the scrubber time, shadow mapping on, so long low-Sun shadows sweep the ground as the timeline plays. Lander marker at the site with Sun/Earth lines that turn red when blocked. Same panel shows Earth direction.
   - Check: shadows in the 3D view must agree with the precomputed horizon masks at the site (lit/blocked at the same hours).
5. **IM-1 backtest panel:** predicted sunset (terrain) vs flat-horizon sunset vs last contact 2024-02-29. Sources in `facts.md`.
6. **Mission presets:** one click loads "IM-1, Feb 2024 (real)" or "Artemis IV scenario, 2028 (planning scenario)".
7. **Installable app (PWA):** manifest, icons, service worker caching `public/data` and textures so it works offline.

## Tier C — add today if time allows (user asked for these). Each must follow its honesty rule.
8. **Base siting view:** Shadow Vision over a long window (e.g. a year) — which ground stays lit longest, i.e. where a base would put solar arrays. Real data from the grids.
9. **Lit-and-connected route:** shortest path on the Shadow Vision grid between two clicked points, weighted to stay in sunlight and Earth view for the chosen hours. Shows "hours in shadow along the route" ("cold minutes"). No temperatures.
10. **Infrastructure shadows / layout:** place a lander, habitat, solar array or comm mast on the 3D terrain with a user-entered height; its shadow length = height ÷ tan(Sun elevation) is drawn live, and the app warns when it shades a placed solar array. Pure geometry.
11. **Survive-the-night calculator:** longest dark stretch at the site (from data) × heater/standby power the user types in = battery energy needed (Wh). Inputs always visible. No default wattage presented as fact.
12. **Sky blocked by terrain:** % of the sky hidden by the skyline (from the horizon mask). One honest number, labelled as geometry only. No radiation dose claims.

## Out of scope (do not build)
Temperature or radiation dose estimates, crew survival scores, a single "best site" score, live API calls at runtime, link budgets.
