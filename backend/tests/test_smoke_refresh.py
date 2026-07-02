"""Smoke test: one direct refresh cycle serves train states per line.

Drives a single ``DataRefresher.refresh()`` call with a scripted normal payload
and asserts the resulting states are retrievable for the expected line -- no
background thread, no network, no API key, no GTFS files.
"""
from __future__ import annotations

from app.constants import LINE_CODES
from app.jobs.data_refresher import DataRefresher
from app.services.line_manager import LineManager

from tests.factories import build_synthetic_line, normal_payload
from tests.fakes import FakeMetrolinxService


def _make_refresher() -> DataRefresher:
    """Wire a DataRefresher to a fake feed scripted with one normal cycle."""
    fake_service = FakeMetrolinxService(script=[normal_payload()])
    manager = LineManager(
        go_service=fake_service,
        lines={LINE_CODES.MILTON: build_synthetic_line(LINE_CODES.MILTON)},
        lakeshore_west_variants={},
    )
    return DataRefresher(refresh_interval=15, manager=manager)


def test_refresh_serves_train_states_for_line() -> None:
    refresher = _make_refresher()

    # Drive a single cycle directly -- never start() (no thread, no sleep loop).
    refresher.refresh()

    milton_states = refresher.get_states(LINE_CODES.MILTON)
    trip_numbers = {state.trip_number for state in milton_states}
    assert trip_numbers == {"1001", "1002"}
    assert all(state.line_code == LINE_CODES.MILTON for state in milton_states)


def test_refresh_leaves_other_lines_empty() -> None:
    refresher = _make_refresher()

    refresher.refresh()

    # The scripted payload only carried Milton trains, so every other line serves
    # an empty list rather than raising.
    for line_code in LINE_CODES:
        if line_code == LINE_CODES.MILTON:
            continue
        assert refresher.get_states(line_code) == []


def test_refresh_records_last_updated() -> None:
    refresher = _make_refresher()
    assert refresher.last_updated is None

    refresher.refresh()

    assert refresher.last_updated is not None
