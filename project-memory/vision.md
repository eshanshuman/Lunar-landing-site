# Vision (updated 2026-11-15)

## In one line
An installable app that plans Moon landings at the lunar south pole: pick a site and a date, and see in seconds what you get in sunlight (power) and line of sight to Earth (comms), on real NASA terrain, and what a slip or a move of a few kilometres changes.

## Why now
- NASA cancelled the Lunar Gateway orbital station on 2026-03-24 and moved the money to a permanent **Moon Base on the surface near Shackleton Crater** at the south pole (see `facts.md`). There is no station to wait at: missions go straight to the surface, so site and date decide power and comms.
- Up to ~25 robotic missions and ~21 landings are planned by 2029, then Artemis IV (target 2028) aims to land four astronauts, likely near the south pole. Every one of them needs a site and a date that work.
- At the pole the Sun stays within ~1.5° of the horizon and Earth drifts ±7° over a month, so a ridge kilometres away decides everything. Today, checking one site on one date means JPL Horizons + Quickmap + Moon Trek + a spreadsheet.

## Who it is for
Mission planners first (robotic CLPS / Moon Base landers and crewed Artemis missions), then educators and the public.

## Product shape
- A web app made **installable** (PWA: own icon, own window, works offline). Not a native rewrite.
- Opens with the intro cinematic, then the interactive 3D Moon.
- Core question everywhere: "If the date slips or the site moves, what do we gain or lose, and why?"

## The demo story (3 minutes)
1. **Real landing: IM-1 Odysseus** at Malapert A, landed 2024-02-22 23:23 UTC, last contact 2024-02-29. Show our predicted sunset against what happened. The LOLA terrain run says the Sun went behind the terrain on 2 March ~14:17 UTC, about 2.5 days after last contact, so the honest story is: geometry gave it until 2 March, power (tipped lander, misaimed panels) ended it on 29 February. Chandrayaan-3 is the matching second check: our terrain sunset lands a few hours after ISRO put Vikram to sleep. Be honest that the lander also tipped over.
2. **Future landing: an Artemis IV-style crew landing** at an Artemis region near Shackleton in 2028 (planning scenario, not NASA's announced date or site). Slip it a week, watch sunlight and Earth contact change, use the 3D LOLA shadow predictor to see the shadows, and let the app find a better spot nearby.
3. Close: "Pick a site. Pick a date. See what you get, in seconds."

## Honesty rules (carry into every feature)
- No made-up numbers. Sample data always carries a badge.
- Geometric line of sight is not a guaranteed radio link; sunlight is not watts.
- Planning estimates that depend on user inputs (battery, heights) show those inputs on screen.
- Scenario dates/sites for future missions are labelled as scenarios.
