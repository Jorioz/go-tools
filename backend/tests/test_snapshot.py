"""Copy-on-write snapshot contract for ``DataRefresher`` (issue #9).

Drives ``DataRefresher.refresh()`` directly (no thread, no network, no API key)
with a scripted fake feed to prove the concurrency guarantees:

* a snapshot a reader captured before a refresh stays internally consistent while
  the next cycle runs -- the state objects it holds are never mutated in place,
* states and ``last_updated`` come from a single atomic snapshot: a successful
  cycle pairs new states with a new timestamp; a failed cycle re-serves the
  *entire previous snapshot* (same object identity), and
* ``TrainState`` is frozen, so a torn read is impossible at the type level.
"""
from __future__ import annotations

import dataclasses

import pytest

from app.constants import LINE_CODES
from app.jobs.data_refresher import DataRefresher, Snapshot
from app.services.line_manager import LineManager
from app.services.metrolinx_service import MetrolinxFeedError
from app.services.train_manager import TrainState

from tests.factories import build_synthetic_line, make_train
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


def _state_by_trip(states, trip_number: str) -> TrainState:
    return next(s for s in states if s.trip_number == trip_number)


def test_captured_snapshot_is_unchanged_by_the_next_cycle() -> None:
    # Cycle 1 places 1001 at lat 0.3; cycle 2 moves it north to 0.6.
    cycle_one = [make_train("1001", latitude=0.3)]
    cycle_two = [make_train("1001", latitude=0.6)]
    refresher = _make_refresher([cycle_one, cycle_two])

    # A reader captures what it would serialize: the states list, a specific state
    # object out of it, and the timestamp -- all before the next cycle runs.
    refresher.refresh()
    held_states = refresher.get_states(LINE_CODES.MILTON)
    held_state = _state_by_trip(held_states, "1001")
    held_latitude = held_state.latitude
    held_progress = held_state.progress
    held_last_updated = refresher.last_updated

    # The next cycle moves the train.
    refresher.refresh()

    # The captured objects are untouched: same values a reader would have seen.
    assert held_state.latitude == held_latitude
    assert held_state.progress == held_progress
    assert held_last_updated is not None
    # And the captured list still references the same object (not re-populated).
    assert _state_by_trip(held_states, "1001") is held_state

    # Fresh reads see the moved train.
    fresh_state = _state_by_trip(refresher.get_states(LINE_CODES.MILTON), "1001")
    assert fresh_state.latitude == 0.6
    assert fresh_state is not held_state


def test_successful_cycle_pairs_new_states_with_new_snapshot() -> None:
    refresher = _make_refresher([[make_train("1001", latitude=0.3)]])

    snapshot_before = refresher._snapshot
    refresher.refresh()
    snapshot_after = refresher._snapshot

    # A brand-new snapshot was published, bundling states and their timestamp.
    assert snapshot_after is not snapshot_before
    assert snapshot_after.last_updated is not None
    assert refresher.last_updated is snapshot_after.last_updated
    assert refresher.get_states(LINE_CODES.MILTON) is snapshot_after.states_by_line[LINE_CODES.MILTON]


def test_failed_cycle_re_serves_the_entire_previous_snapshot() -> None:
    refresher = _make_refresher(
        [[make_train("1001", latitude=0.3)], MetrolinxFeedError("simulated outage")]
    )

    refresher.refresh()
    snapshot_after_success = refresher._snapshot
    states_after_success = refresher.get_states(LINE_CODES.MILTON)

    # The failing cycle leaves the whole previous snapshot in place, untouched.
    refresher.refresh()

    assert refresher._snapshot is snapshot_after_success
    assert refresher.get_states(LINE_CODES.MILTON) is states_after_success
    assert refresher.last_updated is snapshot_after_success.last_updated


def test_train_state_is_frozen() -> None:
    train = make_train("1001", latitude=0.3)
    refresher = _make_refresher([[train]])
    refresher.refresh()
    state = _state_by_trip(refresher.get_states(LINE_CODES.MILTON), "1001")

    # Freezing enforces no-mutation at the type level: a torn read is impossible.
    with pytest.raises(dataclasses.FrozenInstanceError):
        state.latitude = 99.9  # type: ignore[misc]


def test_snapshot_is_frozen() -> None:
    snapshot = Snapshot()
    with pytest.raises(dataclasses.FrozenInstanceError):
        snapshot.last_updated = None  # type: ignore[misc]
