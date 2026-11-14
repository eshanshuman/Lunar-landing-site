#!/usr/bin/env python3
"""Sun and Earth azimuth/elevation for each site from JPL Horizons (PLAN.md §5.1).

    python pipeline/fetch_horizons.py --start 2027-06-01 --stop 2028-12-31
    python pipeline/fetch_horizons.py --dry-run          # print the requests, send nothing

Run this on a team laptop; JPL is not reachable from the Claude cloud sandbox, so this script
has NOT been run against the live API yet.

Raw responses are cached in pipeline/cache/horizons_<site>_<body>_<start>_<stop>.txt and reused.
Parsed output goes to pipeline/cache/ephem_<site>.json:
    {"id", "start_utc", "step_h", "sun": {"az", "el"}, "earth": {"az", "el"}}

TODO(pipeline) before trusting the output (PLAN.md §5.1, §11):
  - Spot-check two timestamps per body against the Horizons web UI with the same settings.
  - Confirm the azimuth convention Horizons uses for a site on the Moon (this script assumes
    clockwise from north, the same as the horizon masks). A mismatch would mirror the sky.
  - Confirm the response column layout matches `parse_observer_table` (CSV: date, two flag
    columns, azimuth, elevation).
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

API = "https://ssd.jpl.nasa.gov/api/horizons.api"
BODIES = {"sun": "10", "earth": "399"}
HERE = Path(__file__).resolve().parent


def build_params(site: dict, body_id: str, start: str, stop: str, step: str = "1 h") -> dict:
    """Horizons OBSERVER-table request for a surface site on the Moon (body 301)."""
    q = lambda v: f"'{v}'"  # Horizons wants its values single-quoted
    return {
        "format": "text",
        "COMMAND": q(body_id),
        "OBJ_DATA": q("NO"),
        "MAKE_EPHEM": q("YES"),
        "EPHEM_TYPE": q("OBSERVER"),
        "CENTER": q("coord@301"),
        "COORD_TYPE": q("GEODETIC"),
        "SITE_COORD": q(f"{site['lon']},{site['lat']},{'<alt_km not set>' if site.get('alt_km') is None else site['alt_km']}"),  # E-lon deg, lat deg, alt km
        "START_TIME": q(start),
        "STOP_TIME": q(stop),
        "STEP_SIZE": q(step),
        "QUANTITIES": q("4"),  # apparent azimuth and elevation
        "APPARENT": q("AIRLESS"),  # no refraction: the Moon has no atmosphere
        "ANG_FORMAT": q("DEG"),
        "TIME_TYPE": q("UT"),
        "CAL_FORMAT": q("CAL"),
        "CSV_FORMAT": q("YES"),
    }


def parse_observer_table(text: str) -> tuple[list[datetime], list[float], list[float]]:
    """Rows between $$SOE and $$EOE -> (times, azimuth deg, elevation deg)."""
    if "$$SOE" not in text or "$$EOE" not in text:
        raise ValueError("No ephemeris table in the Horizons response:\n" + text[-1500:])
    body = text.split("$$SOE", 1)[1].split("$$EOE", 1)[0]
    times, az, el = [], [], []
    for line in body.strip().splitlines():
        cells = [c.strip() for c in line.split(",")]
        # The date is first; azimuth and elevation are the last two numeric cells.
        nums = [c for c in cells[1:] if _is_number(c)]
        if len(nums) < 2:
            raise ValueError(f"Unexpected Horizons row: {line!r}")
        times.append(datetime.strptime(cells[0], "%Y-%b-%d %H:%M").replace(tzinfo=timezone.utc))
        az.append(float(nums[-2]))
        el.append(float(nums[-1]))
    return times, az, el


def _is_number(s: str) -> bool:
    try:
        float(s)
        return True
    except ValueError:
        return False


def check_hourly(times: list[datetime]) -> None:
    for a, b in zip(times, times[1:]):
        if b - a != timedelta(hours=1):
            raise ValueError(f"Horizons rows are not hourly between {a} and {b}")


def fetch(site: dict, body: str, start: str, stop: str, cache: Path, sleep_s: float) -> str:
    path = cache / f"horizons_{site['id']}_{body}_{start}_{stop}.txt"
    if path.exists():
        return path.read_text()
    import requests

    r = requests.get(API, params=build_params(site, BODIES[body], start, stop), timeout=(30, 900))
    r.raise_for_status()
    if "$$SOE" not in r.text:
        raise RuntimeError(f"Horizons returned no table for {site['id']} / {body}:\n{r.text[-1500:]}")
    path.write_text(r.text)
    time.sleep(sleep_s)  # be polite: one request at a time, with a pause
    return r.text


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--sites", type=Path, default=HERE / "sites.json")
    ap.add_argument("--cache", type=Path, default=HERE / "cache")
    ap.add_argument("--start", default="2027-06-01", help="UTC date, inclusive")
    ap.add_argument("--stop", default="2028-12-31", help="UTC date, inclusive")
    ap.add_argument("--only", nargs="*", help="site ids to fetch (default: all)")
    ap.add_argument("--sleep", type=float, default=1.5, help="seconds between API calls")
    ap.add_argument("--dry-run", action="store_true", help="print the request parameters and exit")
    args = ap.parse_args()

    sites = json.loads(args.sites.read_text())
    if args.only:
        sites = [s for s in sites if s["id"] in args.only]
    args.cache.mkdir(parents=True, exist_ok=True)

    missing = [s["id"] for s in sites if s.get("alt_km") is None]
    if missing and not args.dry_run:
        print(
            "alt_km is not set for: " + ", ".join(missing) + "\n"
            "Horizons needs the site height. Run build_horizons.py, then copy each site's\n"
            "ground_height_m (as km) into pipeline/sites.json. Not guessed on purpose.",
            file=sys.stderr,
        )
        return 2

    for s in sites:
        if args.dry_run:
            for body, body_id in BODIES.items():
                print(s["id"], body, json.dumps(build_params(s, body_id, args.start, args.stop)))
            continue
        out: dict = {"id": s["id"], "step_h": 1}
        for body in BODIES:
            times, az, el = parse_observer_table(fetch(s, body, args.start, args.stop, args.cache, args.sleep))
            check_hourly(times)
            start_utc = times[0].strftime("%Y-%m-%dT%H:%M:%SZ")
            if out.setdefault("start_utc", start_utc) != start_utc:
                raise ValueError(f"{s['id']}: Sun and Earth tables start at different times")
            out[body] = {"az": [round(v, 4) for v in az], "el": [round(v, 4) for v in el]}
        if len(out["sun"]["el"]) != len(out["earth"]["el"]):
            raise ValueError(f"{s['id']}: Sun and Earth tables have different lengths")
        path = args.cache / f"ephem_{s['id']}.json"
        path.write_text(json.dumps(out))
        print(f"{s['id']}: {len(out['sun']['el'])} hourly rows from {out['start_utc']} -> {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
