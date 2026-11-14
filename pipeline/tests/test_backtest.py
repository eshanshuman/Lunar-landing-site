from datetime import datetime, timedelta, timezone

import numpy as np

from backtest import first_set, horizon_at

T0 = datetime(2024, 3, 1, tzinfo=timezone.utc)


def hours(n):
    return [T0 + timedelta(hours=i) for i in range(n)]


def test_horizon_at_interpolates_and_wraps():
    mask = np.zeros(720)
    mask[0] = 2.0  # 0° north
    assert horizon_at(mask, 0.0) == 2.0
    assert abs(horizon_at(mask, 0.25) - 1.0) < 1e-9  # halfway to the next 0.5° sample
    assert abs(horizon_at(mask, 359.75) - 1.0) < 1e-9  # wraps past north
    assert horizon_at(mask, 180.0) == 0.0


def test_first_set_interpolates_between_hours():
    margin = np.array([3.0, 2.0, 1.0, -1.0, -2.0])
    t = first_set(hours(5), margin, T0)
    assert t == T0 + timedelta(hours=2, minutes=30)


def test_first_set_ignores_crossings_before_start():
    margin = np.array([1.0, -1.0, 1.0, 1.0, -1.0])
    t = first_set(hours(5), margin, T0 + timedelta(hours=2))
    assert t == T0 + timedelta(hours=3, minutes=30)


def test_first_set_none_when_never_sets():
    assert first_set(hours(4), np.ones(4), T0) is None
