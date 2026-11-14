#!/usr/bin/env python3
"""Bundle the pipeline outputs into the one file the app reads (PLAN.md §5.4, milestone M3).

    python pipeline/build_dataset.py                          # October 2028 demo window
    python pipeline/build_dataset.py --start 2028-05-01 --days 28

Reads pipeline/sites.json, cache/horizon_<site>.json (build_horizons.py) and
cache/ephem_<site>.json (fetch_horizons.py), keeps the hours from --start for
(days + longest mission) days, and writes public/data/dataset.json.

Rounded to 0.01° (Horizons and the skyline are not more accurate than that for our use).
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

MISSION_LENGTHS = [3, 7, 10, 14]


def r2(xs):
    return [round(float(x), 2) for x in xs]


def window(ephem: dict, start: datetime, hours: int) -> dict:
    t0 = datetime.fromisoformat(ephem["start_utc"].replace("Z", "+00:00"))
    step = float(ephem["step_h"])
    i0 = round((start - t0).total_seconds() / 3600 / step)
    n = round(hours / step)
    if i0 < 0 or i0 + n > len(ephem["sun"]["el"]):
        raise SystemExit(f"{ephem['id']}: window {start:%Y-%m-%d} + {hours} h is outside the ephemeris file")
    sl = slice(i0, i0 + n)
    return {b: {"az": r2(ephem[b]["az"][sl]), "el": r2(ephem[b]["el"][sl])} for b in ("sun", "earth")}


def main() -> int:
    here = Path(__file__).parent
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--start", default="2028-10-01")
    ap.add_argument("--days", type=int, default=28)
    ap.add_argument("--cache", type=Path, default=here / "cache")
    ap.add_argument("--sites", type=Path, default=here / "sites.json")
    ap.add_argument("--out", type=Path, default=here.parent / "public" / "data" / "dataset.json")
    a = ap.parse_args()

    start = datetime.fromisoformat(a.start).replace(tzinfo=timezone.utc)
    hours = (a.days + max(MISSION_LENGTHS)) * 24
    sites = json.loads(a.sites.read_text())
    by_site = {}
    for s in sites:
        hz = json.loads((a.cache / f"horizon_{s['id']}.json").read_text())
        ep = json.loads((a.cache / f"ephem_{s['id']}.json").read_text())
        by_site[s["id"]] = {
            "id": s["id"],
            "start_utc": start.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "step_h": ep["step_h"],
            "horizon_deg": r2(hz["horizon_deg"]),
            **window(ep, start, hours),
            "meta": {
                "dem": hz["meta"]["dem"].split(" ")[0] + " (LOLA, PGDA product 90)",
                "observer_height_m": hz["meta"]["observer_height_m"],
                "ephemeris": "JPL Horizons observer table, hourly, airless",
            },
        }
    out = {
        "source": "pipeline",
        "start_utc": start.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "days": a.days,
        "mission_lengths": MISSION_LENGTHS,
        "sites": sites,
        "bySite": by_site,
    }
    a.out.parent.mkdir(parents=True, exist_ok=True)
    a.out.write_text(json.dumps(out, separators=(",", ":"), ensure_ascii=False))
    print(f"wrote {a.out} ({a.out.stat().st_size / 1e6:.2f} MB): {len(sites)} sites, {hours} h from {a.start}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
