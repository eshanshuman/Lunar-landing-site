import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fetch_horizons import build_params, check_hourly, parse_observer_table  # noqa: E402

# Hand-written in the layout this parser expects, NOT a captured Horizons response.
# Replace with a real cached response once the script has been run (see the TODOs in fetch_horizons.py).
FIXTURE = """header text
$$SOE
 2028-Jan-01 00:00, , , 123.4567, 1.2345,
 2028-Jan-01 01:00,*,m, 124.0000, -0.5000,
$$EOE
footer text
"""


def test_parse_observer_table():
    times, az, el = parse_observer_table(FIXTURE)
    assert times == [datetime(2028, 1, 1, 0, tzinfo=timezone.utc), datetime(2028, 1, 1, 1, tzinfo=timezone.utc)]
    assert az == [123.4567, 124.0]
    assert el == [1.2345, -0.5]
    check_hourly(times)


def test_parse_rejects_a_response_without_a_table():
    with pytest.raises(ValueError):
        parse_observer_table("No ephemeris for target")


def test_build_params_follow_the_plan():
    p = build_params({"lon": -137.49, "lat": -89.4632, "alt_km": 1.9}, "10", "2027-06-01", "2027-06-02")
    assert p["CENTER"] == "'coord@301'"
    assert p["COORD_TYPE"] == "'GEODETIC'"
    assert p["SITE_COORD"] == "'-137.49,-89.4632,1.9'"
    assert p["QUANTITIES"] == "'4'"
    assert p["APPARENT"] == "'AIRLESS'"
    assert p["STEP_SIZE"] == "'1 h'"
