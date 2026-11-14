#!/usr/bin/env python3
"""Backtest on real landings (PLAN.md §5.5): when did the Sun actually go behind the terrain,
and how does that compare with when the mission stopped?

    python pipeline/backtest.py                       # reads pipeline/cache, writes public/data/backtest.json
    python pipeline/backtest.py --cache path/to/cache --out path/to/backtest.json

Inputs (from fetch_horizons.py and build_horizons.py, all in the cache folder):
    horizons_<site>_sun_<window>.txt, horizons_<site>_earth_<window>.txt, horizon_<site>.json

Method: Sun elevation from JPL Horizons (hourly, airless) against the LOLA skyline at the
Sun's azimuth (720 directions, linear interpolation). Crossings are interpolated linearly
between hours. "Terrain sunset" is the Sun's centre; the first and last limb (±0.267°) are
also reported. Mission dates and sources are in MISSIONS and in project-memory/facts.md.
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from fetch_horizons import parse_observer_table  # noqa: E402

SUN_RADIUS_DEG = 0.267
UTC = timezone.utc

MISSIONS = [
    {
        "mission": "IM-1 Odysseus",
        "site_id": "im1",
        "window": "2024-02-15_2024-03-10",
        "landed_utc": "2024-02-22T23:23:00Z",
        "ops_ended_utc": "2024-02-29T00:00:00Z",
        "ops_ended_label": "Last contact, 29 Feb 2024 (lander went into standby)",
        "ops_ended_day_only": True,
        "context": "Landed tipped over at about 30°, with its solar panels pointing the wrong way.",
        "sources": [
            "Wikipedia: IM-1 (landing time, last contact 2024-02-29)",
            "Rappler, SatNews, The Space Review (Feb–Mar 2024): standby on 29 Feb, power ran short with the panels misaimed",
        ],
    },
    {
        "mission": "Chandrayaan-3 Vikram",
        "site_id": "ch3",
        "window": "2023-08-15_2023-09-15",
        "landed_utc": "2023-08-23T12:33:00Z",
        "ops_ended_utc": "2023-09-04T02:30:00Z",
        "ops_ended_label": "Vikram put to sleep, about 08:00 IST on 4 Sep 2023",
        "ops_ended_day_only": False,
        "context": "ISRO put the lander to sleep on purpose before the lunar night.",
        "sources": ["ISRO, via SpacePolicyOnline and SpaceNews (Sep 2023)"],
    },
]


def horizon_at(mask: np.ndarray, az_deg):
    """Skyline elevation at azimuth (deg, clockwise from north), linear between samples."""
    n = len(mask)
    x = (np.asarray(az_deg, dtype=float) % 360.0) / 360.0 * n
    i = np.floor(x).astype(int) % n
    f = x - np.floor(x)
    return mask[i] * (1 - f) + mask[(i + 1) % n] * f


def first_set(times: list[datetime], margin: np.ndarray, after: datetime) -> datetime | None:
    """First time after `after` where `margin` goes from > 0 to <= 0, linearly interpolated."""
    for i in range(len(times) - 1):
        if times[i + 1] < after:
            continue
        a, b = margin[i], margin[i + 1]
        if a > 0 and b <= 0:
            step = (times[i + 1] - times[i]).total_seconds()
            return times[i] + timedelta(seconds=step * a / (a - b))
    return None


def iso(t: datetime | None) -> str | None:
    return None if t is None else t.astimezone(UTC).strftime("%Y-%m-%dT%H:%MZ")


def run_mission(m: dict, cache: Path) -> dict:
    site, win = m["site_id"], m["window"]
    t, s_az, s_el = parse_observer_table((cache / f"horizons_{site}_sun_{win}.txt").read_text())
    _, e_az, e_el = parse_observer_table((cache / f"horizons_{site}_earth_{win}.txt").read_text())
    mask = np.array(json.loads((cache / f"horizon_{site}.json").read_text())["horizon_deg"], dtype=float)
    s_az, s_el, e_az, e_el = map(np.asarray, (s_az, s_el, e_az, e_el))
    sky_sun = horizon_at(mask, s_az)
    sky_earth = horizon_at(mask, e_az)

    landed = datetime.fromisoformat(m["landed_utc"].replace("Z", "+00:00"))
    ended = datetime.fromisoformat(m["ops_ended_utc"].replace("Z", "+00:00"))
    k = int(np.argmin([abs((x - landed).total_seconds()) for x in t]))
    after = [x >= landed for x in t]

    centre = first_set(t, s_el - sky_sun, landed)
    out = {k2: m[k2] for k2 in ("mission", "site_id", "landed_utc", "ops_ended_utc", "ops_ended_label",
                                 "ops_ended_day_only", "context", "sources")}
    out.update({
        "predicted_sunset_utc": iso(centre),
        "sun_first_limb_behind_utc": iso(first_set(t, s_el - SUN_RADIUS_DEG - sky_sun, landed)),
        "sun_fully_behind_utc": iso(first_set(t, s_el + SUN_RADIUS_DEG - sky_sun, landed)),
        "flat_horizon_sunset_utc": iso(first_set(t, s_el, landed)),
        "sun_el_at_landing_deg": round(float(s_el[k]), 2),
        "skyline_at_sun_at_landing_deg": round(float(sky_sun[k]), 2),
        "earth_visible_after_landing_pct": round(float(np.mean((e_el > sky_earth)[after]) * 100), 1),
        "hours_between_end_and_sunset": None if centre is None else round((centre - ended).total_seconds() / 3600, 1),
        "series": {
            "start_utc": iso(t[0]),
            "step_h": round((t[1] - t[0]).total_seconds() / 3600, 4),
            "sun_el": [round(float(v), 3) for v in s_el],
            "skyline_at_sun": [round(float(v), 3) for v in sky_sun],
        },
        "meta": {
            "ephemeris": "JPL Horizons observer table, hourly, airless",
            "terrain": "LOLA LDEM_60S_60MPP_ADJ (PGDA product 90), 720 directions to 150 km, observer 2 m",
            "sunset_definition": "Sun centre behind the terrain skyline",
        },
    })
    return out


def main() -> int:
    here = Path(__file__).parent
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--cache", type=Path, default=here / "cache")
    ap.add_argument("--out", type=Path, default=here.parent / "public" / "data" / "backtest.json")
    a = ap.parse_args()
    results = [run_mission(m, a.cache) for m in MISSIONS]
    a.out.parent.mkdir(parents=True, exist_ok=True)
    a.out.write_text(json.dumps(results, separators=(",", ":")))
    for r in results:
        print(f"{r['mission']}: terrain sunset {r['predicted_sunset_utc']} | flat {r['flat_horizon_sunset_utc']} | "
              f"ops ended {r['ops_ended_utc']} | gap {r['hours_between_end_and_sunset']} h")
    print(f"wrote {a.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
