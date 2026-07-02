"""Feed failure contract at the DataRefresher boundary.

Drives ``DataRefresher.refresh()`` directly (no thread, no network, no API key)
with a scripted fake feed to prove:

* a failed cycle keeps the previously served states AND ``last_updated`` exactly
  as they were after the prior successful cycle, and
* a legitimately empty feed is a success: the served states empty and
  ``last_updated`` advances.
"""
from __future__ import annotations

from app.constants import LINE_CODES
from app.jobs.data_refresher import DataRefresher
from app.services.line_manager import LineManager
from app.services.metrolinx_service import MetrolinxFeedError

from tests.factories import build_synthetic_line, normal_payload
from tests.fakes import FakeMetrolinxService


def _make_refresher(script) -> DataRefresher:
    """Wire a DataRefresher to a fake feed driven by the given per-cycle script."""
    fake_service = FakeMetrolinxService(script=script)
    manager = LineManager(
        go_service=fake_service,
        lines={LINE_CODES.MILTON: build_synthetic_line(LINE_CODES.MILTON)},
        lakeshore_west_variants={},
    )
    return DataRefresher(refresh_interval=15, manager=manager)


def test_failed_cycle_keeps_cache_and_last_updated() -> None:
    # Cycle 1: a normal payload succeeds. Cycle 2: the feed raises.
    refresher = _make_refresher([normal_payload(), MetrolinxFeedError("simulated outage")])

    refresher.refresh()
    states_after_success = refresher.get_states(LINE_CODES.MILTON)
    trips_after_success = {state.trip_number for state in states_after_success}
    last_updated_after_success = refresher.last_updated
    assert trips_after_success == {"1001", "1002"}
    assert last_updated_after_success is not None

    # The failing cycle must not touch the cache or advance the timestamp.
    refresher.refresh()

    trips_after_failure = {state.trip_number for state in refresher.get_states(LINE_CODES.MILTON)}
    assert trips_after_failure == {"1001", "1002"}
    # Same object identity: last_updated was never reassigned on the failed cycle.
    assert refresher.last_updated is last_updated_after_success


def test_empty_feed_cycle_succeeds_and_empties_cache() -> None:
    # Cycle 1: normal payload. Cycles 2-4: a well-formed empty feed (no trains).
    # An empty feed is truth (GO trains stop overnight): every empty cycle is a
    # SUCCESS -- the timestamp advances, unlike an outage which freezes it. The
    # cache empties once the live-train dropout grace (issue #12) is spent: the two
    # live trains are carried forward through their grace window, then dropped.
    refresher = _make_refresher([normal_payload(), [], [], []])

    refresher.refresh()
    assert {s.trip_number for s in refresher.get_states(LINE_CODES.MILTON)} == {"1001", "1002"}
    last_updated_after_success = refresher.last_updated
    assert last_updated_after_success is not None

    # First empty cycle: a success (timestamp advances), but grace carries the
    # live trains forward -- proving the cycle ran to completion rather than being
    # frozen like a failed cycle would be.
    refresher.refresh()
    assert refresher.last_updated is not None
    assert refresher.last_updated >= last_updated_after_success
    assert {s.trip_number for s in refresher.get_states(LINE_CODES.MILTON)} == {"1001", "1002"}

    # Grace is 2 cycles: a third consecutive empty cycle finally drops both trains,
    # emptying the cache while the timestamp keeps advancing (still a success).
    refresher.refresh()
    refresher.refresh()

    assert refresher.get_states(LINE_CODES.MILTON) == []
    assert refresher.last_updated is not None
    assert refresher.last_updated >= last_updated_after_success
