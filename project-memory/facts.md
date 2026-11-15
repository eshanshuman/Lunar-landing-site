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
- **Our terrain backtest (JPL Horizons hourly Sun at the site + LOLA 60 m horizon mask, observer 2 m):** Sun 10.46° up at landing (skyline 0.20° there). At last contact (2024-02-29) the Sun was 5.4–6.6° up, still ~4.7–5.4° above the local skyline. Sun lower limb reaches the skyline 2024-03-02 09:32 UTC; Sun centre behind terrain 2024-03-02 14:17 UTC (az 273.0°, el 1.43° vs skyline 1.48°); fully hidden 2024-03-02 18:05 UTC. Flat-horizon sunset 2024-03-03 07:12 UTC. Earth visible 100% of the time after landing. Conclusion: Odysseus went quiet ~2.5 days before geometric terrain sunset, so it ran out of power (tipped, panels pointing the wrong way, low Sun), not sunlight. (An earlier DE421 run in this file was one day early due to a Julian-date bug; corrected 2026-11-15.) Sources for the power cause: Rappler, SatNews, The Space Review (Feb–Mar 2024 coverage).

## Chandrayaan-3 Vikram (second backtest)
- Landed 2023-08-23 12:33 UTC; Vikram put to sleep ~2023-09-04 02:30 UTC (08:00 IST); Pragyan slept 2023-09-02. Source: ISRO via SpacePolicyOnline / SpaceNews.
- **Our terrain backtest (Horizons + LOLA 60 m mask):** Sun 8.69° at landing; Sun lower limb at skyline 2023-09-04 04:48 UTC, centre behind terrain 06:11 UTC, fully hidden 07:36 UTC; flat-horizon sunset 2023-09-04 16:07 UTC. Earth 100% visible. Our terrain sunset is ~3.7 h after ISRO put Vikram to sleep, consistent with sleeping just before sunset. Caveats: hourly ephemeris, landing coordinate uncertainty; SpaceNews quoted local sunset as 5 Sep (likely a flat or date-line approximation).

## South pole geometry
- Sun stays within ~1.5° of the horizon at the pole itself (Moon's axial tilt ≈ 1.54°); up to ~7° across the wider south-pole region.
- Earth's elevation swings about ±7° over ~27 days (libration).
- **Our calculation (JPL DE421, flat horizon):** % of 14 days with Earth above the horizon —
  landing 2026-12-01: Connecting ridge 1, Shackleton rim 1, Peak near Shackleton 0, de Gerlache rim 6, Nobile rim 1 35;
  landing 2026-12-15: 86, 87, 85, 90, 100. Sun above the horizon 100% of both windows at the near-pole sites.

## Our pipeline results (real data)
- Terrain files used: `LDEM_80S_20MPP_ADJ` (Artemis sites) and `LDEM_60S_60MPP_ADJ` (IM-1, Chandrayaan-3). Projection verified: south polar stereographic, longitude of origin 0, sphere R = 1,737,400 m.
- Ground heights (m above the 1,737.4 km sphere): ridge 1945.3 · shack 1738.4 (after snap to rim) · degerl 1793.8 · peak 1646.5 · nobile 5944.5 · im1 2593.0 · ch3 528.5.
- JPL Horizons values agree with an independent DE421 + IAU Moon-orientation calculation to within 0.01° (ridge and degerl, six dates, 2027–2028). Example checks at 2027-10-20 00:00 UTC: ridge (−89.4632, 222.51°E) Sun az 79.14 el 1.61, Earth az 133.89 el 4.15; degerl (−88.6834, 292.07°E) Sun az 9.57 el 2.80, Earth az 64.41 el 5.09.
- Seasons at the Artemis sites (our data, 10-day missions, ≥75% sunlight and ≥75% Earth contact = good; 140 site-dates per 4-week block): March–May 2028 is the dark season (as few as 1–7 good, 80–91 bad); late Sep–Oct 2028 is the best (40–42 good, 19 bad); Dec 2027 is in between (~38 good, ~47 bad).
- Sky hidden by terrain (our skylines, share of the sky above the local horizontal): ridge 1.2%, shack <0.1%, degerl 1.2%, peak 0.2%, nobile 10.2%, im1 8.4%, ch3 2.3%.
- Sunlight 2027-10-19 → 11-02 (Sun's upper limb above the terrain skyline): ridge 92.6%, degerl 89.0%.

- **Terrain tiles (20 km, 512 px, from `LDEM_80S_20MPP_ADJ.TIF`, `pipeline/build_tile.py`):** height range in the tile, metres above the sphere — ridge −1173 to 1959 · shack −2846 to 1958 · degerl −1037 to 1815 · peak −1244 to 1648 · nobile 859 to 6800. Ground at the site from the 20 m DEM (`site_height_m`) vs the 39 m tile centre: ridge 1944.8 vs 1944.2 · shack 1738.3 vs 1735.5 · degerl 1793.6 vs 1793.6 · peak 1645.3 vs 1645.3 · nobile 5946.4 vs 5946.4. Grid-north to true-north rotation: ridge 222.51°, shack 203.88°, degerl 292.07°, peak 123.69°, nobile 37.37° (equal to east longitude for this projection).
- **3D shadow predictor check (tile vs 150 km horizon mask, real October 2028 data, 1,008 hourly steps per site, 2 m observer):** the tile's own skyline never exceeds the mask by more than 0.07° at any azimuth, and there are 0 hours at any site where the tile blocks the Sun or Earth while the mask says it is in view. Hours the Sun is blocked by a ridge beyond the 20 km tile (mask blocked, tile clear): ridge 57 · shack 0 · degerl 120 · peak 0 · nobile 1. Hours blocked by terrain inside the tile: ridge 263 · shack 0 · degerl 48 · peak 0 · nobile 721. Source: `src/lib/terrainShadow.test.ts` and `compareOverWindow`.
- Highest skyline from the tile alone vs the full mask maximum: ridge 1.79° vs 2.04° · shack 1.04° vs 1.04° · degerl 2.50° vs 2.85° · peak 0.80° vs 1.05° · nobile 12.53° vs 12.70°.
- The 20 m file is 30,400 × 30,400 pixels of 32-bit floats, cloud-optimised with overviews; address: https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF (linked from the PGDA product 90 page).

- **Sunlight-map grids (real, `pipeline/build_grids.py`, `LDEM_80S_80MPP_ADJ.TIF`, 2 m observer, October 2028 window, 1,008 h):** share of all point-hours in sunlight across each 20 km map — ridge 36.8% · shack 27.7% · degerl 37.3% · peak 38.9% · nobile 33.9%.
- **80 m grid vs 20 m site skyline at the same point (hours of 1,008 with the Sun in view):** ridge 631 vs 688 · shack 1008 vs 1008 · degerl 1008 vs 840 · peak 1008 vs 1008 · nobile 288 vs 286. Hour-by-hour agreement: Sun ridge 94.0%, shack 100%, degerl 83.3%, peak 100%, nobile 99.8%; Earth ridge 98.5%, shack 100%, degerl 99.9%, peak 99.5%, nobile 100%. Mean skyline difference (80 m minus 20 m): ridge +0.10°, shack −0.02°, degerl −0.32°, peak −0.24°, nobile −0.07°. So the map is optimistic at de Gerlache and slightly pessimistic at Connecting ridge; do not quote small map gains as exact.
- Example map suggestion on real data (default view, landing 2028-10-16, 10 days): Nobile rim 1 has 147 h of 240 h sunlight on the map (146 h on the 20 m skyline); the nearest square reaching 75% is 1.4 km NE with 187 h (+40 h).
- The 80 m file is 7,600 × 7,600 pixels, 189 MB: https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF (linked from the PGDA product 90 page).

## Apparent disc sizes seen from the Moon (used for "marginal" hours)
- **Sun: radius about 0.267°.** Worked out as asin(695,700 km ÷ 149,597,870.7 km) = 0.2665°. Constants: nominal solar radius 695,700 km (IAU 2015 Resolution B3) and the astronomical unit 149,597,870.7 km (IAU 2012 Resolution B2). It varies between about 0.262° and 0.271° over the year as the Earth–Moon system's distance from the Sun changes. `pipeline/backtest.py` already used 0.267°, so the app uses the same value.
- **Earth: radius about 0.95°.** Worked out as asin(6,371.0 km ÷ 384,400 km) = 0.9497°. Constants: Earth's mean radius 6,371.0 km and the mean Earth–Moon distance 384,400 km (NASA Earth and Moon fact sheets, nssdc.gsfc.nasa.gov/planetary/factsheet). With the Moon between about 363,300 km (perigee) and 405,500 km (apogee) it ranges from about 1.00° to 0.90°. The app uses the fixed mean.
- Status of these two: the arithmetic was done in this project; the constants are standard published values quoted from memory. The source pages were **not** re-opened from the cloud session (those hosts are not reachable from it), so check them once before quoting the figures in the deck.
- **Marginal hours in the app (real October 2028 data, default view at the time of writing):** Earth's disc is partly behind the skyline for 33 h at Connecting ridge, 31 h at de Gerlache rim, 34 h at Shackleton rim and 3 h at Nobile rim 1 of the selected mission. Earth's disc is 3.6 times wider than the Sun's, so Earth rises and sets take much longer.

## Data products
- Terrain: PGDA product 90, "A New View of the Lunar South Pole from LOLA" (Barker et al. 2023). Cloud-optimised GeoTIFFs, south polar stereographic, MOON_ME frame of DE421, heights in metres. Files: `LDEM_80S_20MPP_ADJ`, `LDEM_80S_80MPP_ADJ`, `LDEM_60S_60MPP_ADJ`, `LDEM_60S_240MPP_ADJ`, hillshade `LDEM_80S_80MPP_ADJ_HILL`. Source: [PGDA product 90](https://pgda.gsfc.nasa.gov/products/90)
- Ephemeris: JPL Horizons API, observer tables, `CENTER='coord@301'`, `COORD_TYPE='GEODETIC'`, targets 10 (Sun) and 399 (Earth), `QUANTITIES='4'`, hourly; azimuth clockwise from north.

## Unverified (do not present as fact yet)
- All site coordinates in `pipeline/sites.json`; `shack` is DEM-snapped, not published. Candidate published points (check the papers): Gläser et al. 2018 Connecting Ridge C1 −89.4505°, 222.84°E and C2 −89.3157°, 245.94°E; Bussey et al. 2010, Icarus, doi:10.1016/j.icarus.2010.03.028, Points A–D (e.g. Shackleton Pt A 89.68°S 166.0°W, de Gerlache Pt C 88.71°S 68.7°W).
- Apollo 15 / 17 Sun elevation at touchdown (~12.0° / ~13.3°), reported via the Z.ai research chat; verify from mission records before using as a backtest.
- Any number from the Z.ai research chat (see `status.md`).
