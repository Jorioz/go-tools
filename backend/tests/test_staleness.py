"""Read-path staleness expiry for ``DataRefresher`` (issue #10).

Once the served snapshot outlives its cutoff -- ``refresh_interval * 8`` seconds,
deliberately matching the completed-train TTL -- ``get_states`` degrades to empty
lists for every line rather than serving misleading stale positions. The decision
is made purely on the read path from the snapshot's own timestamp, so it holds
even if the refresh loop is wedged or dead. Crucially, ``last_updated`` keeps
reporting the real last-success timestamp so the X-Last-Updated header stays
honest.

Boundary convention: a snapshot expires only when its age is *strictly greater*
than the cutoff. Age exactly at the cutoff still serves data.

Time is driven through the injectable ``now`` seam (a ``FakeClock``) so the cutoff
is crossed by advancing a fake clock -- no test sleeps.
"""
from __future__ import annotations

from datetime import datetime, timedelta

from app.constants import LINE_CODES
from app.jobs.data_refresher import STALE_AFTER_CYCLES, DataRefresher
from app.services.line_manager import LineManager

from tests.factories import build_synthetic_line, make_train
from tests.fakes import FakeMetrolinxService


class FakeClock:
    """A hand-advanced stand-in for ``datetime.now`` -- no wall-clock sleeping."""

    def __init__(self, start: datetime) -> None:
        self.now = start

    def __call__(self) -> datetime:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += timedelta(seconds=seconds)


def _make_refresher(script, *, refresh_interval: int = 15, clock: FakeClock) -> DataRefresher:
    """Wire a DataRefresher to a fake feed and a controllable clock."""
    fake_service = FakeMetrolinxService(script=script)
    manager = LineManager(
        go_service=fake_service,
        lines={LINE_CODES.MILTON: build_synthetic_line(LINE_CODES.MILTON)},
        lakeshore_west_variants={},
    )
    return DataRefresher(refresh_interval=refresh_interval, manager=manager, now=clock)


def test_fresh_snapshot_within_cutoff_serves_states_normally() -> None:
    clock = FakeClock(datetime(2026, 7, 2, 8, 0, 0))
    refresher = _make_refresher([[make_train("1001", latitude=0.3)]], clock=clock)
    refresher.refresh()

    # Advance well within the 120s cutoff (8 * 15s).
    clock.advance(60)

    states = refresher.get_states(LINE_CODES.MILTON)
    assert [s.trip_number for s in states] == ["1001"]


def test_aged_snapshot_past_cutoff_serves_empty_for_every_line_but_keeps_honest_timestamp() -> None:
    stamped_at = datetime(2026, 7, 2, 8, 0, 0)
    clock = FakeClock(stamped_at)
    refresher = _make_refresher([[make_train("1001", latitude=0.3)]], clock=clock)
    refresher.refresh()
    assert refresher.last_updated == stamped_at

    # One second past the 120s cutoff.
    clock.advance(refresher.refresh_interval * STALE_AFTER_CYCLES + 1)

    # Every line now serves an empty list, not just the one that had data.
    for line_code in LINE_CODES:
        assert refresher.get_states(line_code) == []

    # Honest-header guarantee: the timestamp is untouched by expiry -- it still
    # reports the real moment of the last successful refresh.
    assert refresher.last_updated == stamped_at


def test_age_exactly_at_cutoff_still_serves_data() -> None:
    clock = FakeClock(datetime(2026, 7, 2, 8, 0, 0))
    refresher = _make_refresher([[make_train("1001", latitude=0.3)]], clock=clock)
    refresher.refresh()

    # Exactly at the cutoff (age == 120s). Convention: only strictly-older expires.
    clock.advance(refresher.refresh_interval * STALE_AFTER_CYCLES)

    states = refresher.get_states(LINE_CODES.MILTON)
    assert [s.trip_number for s in states] == ["1001"]


def test_expiry_flips_to_empty_purely_on_read_with_a_dead_refresh_loop() -> None:
    stamped_at = datetime(2026, 7, 2, 8, 0, 0)
    clock = FakeClock(stamped_at)
    # Script has a single cycle: refresh() is never called again, standing in for
    # a refresh loop that has wedged or died.
    refresher = _make_refresher([[make_train("1001", latitude=0.3)]], clock=clock)
    refresher.refresh()

    # Fresh immediately after the one and only refresh.
    assert [s.trip_number for s in refresher.get_states(LINE_CODES.MILTON)] == ["1001"]

    # Time marches past the cutoff with no cooperation from any refresh cycle.
    clock.advance(refresher.refresh_interval * STALE_AFTER_CYCLES + 1)

    # The read path alone flips the result to empty; last_updated stays truthful.
    assert refresher.get_states(LINE_CODES.MILTON) == []
    assert refresher.last_updated == stamped_at


def test_cutoff_scales_with_refresh_interval_no_hardcoded_120s() -> None:
    # With a 60s interval the cutoff is 480s, so a 200s-old snapshot -- long
    # expired under the default 15s/120s config -- is still fresh here. This proves
    # the cutoff derives from the interval rather than a hardcoded 120 seconds.
    clock = FakeClock(datetime(2026, 7, 2, 8, 0, 0))
    refresher = _make_refresher(
        [[make_train("1001", latitude=0.3)]], refresh_interval=60, clock=clock
    )
    refresher.refresh()

    clock.advance(200)

    states = refresher.get_states(LINE_CODES.MILTON)
    assert [s.trip_number for s in states] == ["1001"]
