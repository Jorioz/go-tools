"""Hide not-yet-in-service trains (issue #4).

The live Metrolinx feed lists trips in advance of departure, carrying a
``StartTime`` (mapped to ``TrainState.start_time``). A trip is only actually
running -- and only displayed -- once its scheduled start time has been reached.
``TrainManager.upsert_many`` drops any trip whose start time is still in the
future before it touches any cycle state.

Boundary convention: a trip is in service when ``now >= start_time`` -- at
exactly the start time it is shown.

Time is driven through ``TrainManager``'s injectable ``now`` seam (a
``FakeClock``, the same pattern DataRefresher uses for staleness) so a start time
is crossed by advancing a fake clock -- no test sleeps.
"""
from __future__ import annotations

import dataclasses
from datetime import datetime, timedelta

from app.constants import LINE_CODES
from app.services.train_manager import TrainManager

from tests.factories import build_synthetic_line, make_train


class FakeClock:
    """A hand-advanced stand-in for ``datetime.now`` -- no wall-clock sleeping."""

    def __init__(self, start: datetime) -> None:
        self.now = start

    def __call__(self) -> datetime:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += timedelta(seconds=seconds)


def _make_manager(clock: FakeClock) -> TrainManager:
    """A TrainManager over the synthetic Milton line, driven by a fake clock."""
    return TrainManager(
        {LINE_CODES.MILTON: build_synthetic_line(LINE_CODES.MILTON)},
        {},
        now=clock,
    )


def _train_with_start(trip_number: str, start_time: str):
    """A synthetic Milton train with an explicit StartTime string."""
    return dataclasses.replace(make_train(trip_number), start_time=start_time)


def _trips(manager: TrainManager) -> set[str]:
    return set(manager.states.keys())


def test_future_start_time_is_excluded() -> None:
    # Clock sits before the trip's scheduled start: it is not yet in service.
    clock = FakeClock(datetime(2026, 7, 2, 7, 0, 0))
    manager = _make_manager(clock)

    manager.upsert_many([_train_with_start("1001", "2026-07-02 07:30:00")])

    assert _trips(manager) == set()


def test_already_started_train_is_included() -> None:
    # Clock is past the scheduled start: the trip is running and displayed.
    clock = FakeClock(datetime(2026, 7, 2, 8, 0, 0))
    manager = _make_manager(clock)

    manager.upsert_many([_train_with_start("1001", "2026-07-02 07:30:00")])

    assert _trips(manager) == {"1001"}


def test_boundary_exactly_at_start_time_is_included() -> None:
    # now == start_time: convention is inclusive, so the trip is shown.
    start = datetime(2026, 7, 2, 7, 30, 0)
    clock = FakeClock(start)
    manager = _make_manager(clock)

    manager.upsert_many([_train_with_start("1001", "2026-07-02 07:30:00")])

    assert _trips(manager) == {"1001"}


def test_future_and_started_trains_in_one_cycle_are_split() -> None:
    # A mixed feed: only the already-started trip survives; the future one is
    # invisible (not mapped, not carried, not counted).
    clock = FakeClock(datetime(2026, 7, 2, 7, 45, 0))
    manager = _make_manager(clock)

    manager.upsert_many(
        [
            _train_with_start("1001", "2026-07-02 07:30:00"),  # started
            _train_with_start("2002", "2026-07-02 08:15:00"),  # future
        ]
    )

    assert _trips(manager) == {"1001"}


def test_train_appears_once_its_start_time_is_reached() -> None:
    # Same trip across two cycles: hidden while future, shown once the clock
    # advances past its start time. Proves the filter is re-evaluated per cycle
    # off the live clock rather than latching the first decision.
    clock = FakeClock(datetime(2026, 7, 2, 7, 0, 0))
    manager = _make_manager(clock)
    train = _train_with_start("1001", "2026-07-02 07:30:00")

    manager.upsert_many([train])
    assert _trips(manager) == set()

    clock.advance(45 * 60)  # now 07:45, past the 07:30 start
    manager.upsert_many([train])
    assert _trips(manager) == {"1001"}
