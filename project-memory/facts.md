# Verified facts and numbers

Every number used in the app, deck or pitch must appear here with a source, or come from the pipeline.

## Programme context
- NASA cancelled the Lunar Gateway orbital station on 2026-03-24 and redirected about $20 billion to a lunar surface base; Gateway hardware is to be repurposed. Sources: [The Register](https://www.theregister.com/2026/03/24/goodbye_lunar_gateway_nasa_ditches/), [Novaspace](https://nova.space/in-the-loop/the-end-of-gateway-exploring-the-consequences-of-nasas-lunar-shift/), [21st Century Tech](https://www.21stcentech.com/jared-isaacman-cancels-lunar-gateway-along-with-other-artemis-changes/)
- The Moon Base is planned near Shackleton Crater at the south pole. Moon Base 1 (Blue Origin Blue Moon Mk1 "Endurance") and Moon Base 2 (Astrobotic Griffin) target Shackleton. Artemis IV (target 2028) is intended to land four astronauts, likely near the south pole. Source: [The Weather Network](https://www.theweathernetwork.com/en/news/science/space/nasa-is-planning-a-permanent-base-on-the-moon)
- NASA targets 25 robotic missions and 21 landings by 2029. Source: [WIRED via Pulse](https://www.pulse.bot/aerospace/news/nasa-details-its-plan-to-build-a-lunar-base-at-the-moons-south-pole-67d2f595-dfb1-4a8c-a5ea-cadfada22975/)
- Artemis II launched 2026-04-01. Source: The Weather Network (above)

## IM-1 Odysseus (real-landing demo)
- Landed 2024-02-22 23:23 UTC at Malapert A, 80.13°S 1.44°E; last contact 2024-02-29; end of mission declared 2024-03-23. Source: [Wikipedia: IM-1](https://en.wikipedia.org/wiki/IM-1)
- Stayed active about a week before the Sun set at the site; not designed to survive the lunar night. Source: Wikipedia (above)
- Landed tipped at about 30°. Source: Wikipedia / Inverse (via Wikipedia references)
- **Our calculation (JPL DE421 ephemeris, flat horizon, no terrain):** Sun 10.9° up at landing; Sun below 3° at 2024-02-29 21:08 UTC, below 2° at 2024-03-01 08:38, below 1° at 2024-03-01 19:53, sets on the flat horizon at 2024-03-02 07:23 UTC. Terrain result pending from the pipeline.

## South pole geometry
- Sun stays within ~1.5° of the horizon at the pole itself (Moon's axial tilt ≈ 1.54°); up to ~7° across the wider south-pole region.
- Earth's elevation swings about ±7° over ~27 days (libration).
- **Our calculation (JPL DE421, flat horizon):** % of 14 days with Earth above the horizon —
  landing 2026-12-01: Connecting ridge 1, Shackleton rim 1, Peak near Shackleton 0, de Gerlache rim 6, Nobile rim 1 35;
  landing 2026-12-15: 86, 87, 85, 90, 100. Sun above the horizon 100% of both windows at the near-pole sites.

## Data products
- Terrain: PGDA product 90, "A New View of the Lunar South Pole from LOLA" (Barker et al. 2023). Cloud-optimised GeoTIFFs, south polar stereographic, MOON_ME frame of DE421, heights in metres. Files: `LDEM_80S_20MPP_ADJ`, `LDEM_80S_80MPP_ADJ`, `LDEM_60S_240MPP_ADJ`, hillshade `LDEM_80S_80MPP_ADJ_HILL`. Source: [PGDA product 90](https://pgda.gsfc.nasa.gov/products/90)
- Ephemeris: JPL Horizons API, observer tables, `CENTER='coord@301'`, targets 10 (Sun) and 399 (Earth), `QUANTITIES='4'`.

## Unverified (do not present as fact yet)
- The five Artemis region centre coordinates in `pipeline/sites.json` (came from another team's repo citing the NASA Lunar Surface Data Book 2025).
- Chandrayaan-3 and Nobile `alt_km` values (see `status.md`).
