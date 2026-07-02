"""Dropout grace window for live trains missing from the feed (issue #12).

Drives ``DataRefresher.refresh()`` directly (no thread, no network, no API key)
with scripted fake feeds to prove the grace-window contract:

* A live (non-completed) train absent from an otherwise-successful cycle is
  carried forward UNCHANGED for up to ``MISSING_GRACE_CYCLES`` consecutive missed
  cycles, then dropped with a single info-level log line. A one-cycle flicker is
  therefore invisible -- no dropout, and no segment snap on reappearance because
  the carried-forward state feeds the keep-segment path.
* Completed / implied-completed trains keep their existing TTL afterlife,
  untouched by the new counter logic.
* An escalated (schema-drift) cycle is a failure: it neither consumes anyone's
  grace nor wipes the manager's cross-cycle memory.
"""
from __future__ import annotations

import dataclasses
import logging

from app.constants import LINE_CODES
from app.jobs.data_refresher import DataRefresher
from app.services.line_manager import LineManager
from app.services.train_manager import MISSING_GRACE_CYCLES

from tests.factories import build_synthetic_line, make_train
from tests.fakes import FakeMetrolinxService

DROP_LOG_FRAGMENT = "not seen for"
OLD_MISSING_WARNING = "WARNING - Missing trip"


def _make_refresher(script) -> DataRefresher:
    """Wire a DataRefresher to a fake feed driven by the given per-cycle script."""
    fake_service = FakeMetrolinxService(script=script)
    manager = LineManager(
        go_service=fake_service,
        lines={LINE_CODES.MILTON: build_synthetic_line(LINE_CODES.MILTON)},
        lakeshore_west_variants={},
    )
    return DataRefresher(refresh_interval=15, manager=manager)


def _states(refresher: DataRefresher):
    return refresher.get_states(LINE_CODES.MILTON)


def _trips(refresher: DataRefresher) -> set[str]:
    return {s.trip_number for s in _states(refresher)}


def _state_of(refresher: DataRefresher, trip_number: str):
    return next(s for s in _states(refresher) if s.trip_number == trip_number)


def _completed_train(trip_number: str):
    """A train stopped at its last stop (ML) -- implied-completed, so it takes the
    TTL afterlife path rather than the live-train grace path."""
    return dataclasses.replace(
        make_train(trip_number, latitude=1.0),
        is_in_motion=False,
        at_station_code="ML",
    )


def test_one_cycle_flicker_is_invisible_then_counter_resets_on_reappearance() -> None:
    # c1 present -> c2 absent (grace) -> c3 present again (moved) -> c4,c5 absent.
    refresher = _make_refresher(
        [
            [make_train("1001", latitude=0.3)],
            [],
            [make_train("1001", latitude=0.7)],
            [],
            [],
        ]
    )

    refresher.refresh()
    held = _state_of(refresher, "1001")
    held_lat, held_progress = held.latitude, held.progress

    # Flicker: absent for one cycle. The train is still served, and served as the
    # very same immutable object with identical values -- no recomputation.
    refresher.refresh()
    carried = _state_of(refresher, "1001")
    assert carried is held
    assert carried.latitude == held_lat
    assert carried.progress == held_progress

    # Reappears with a fresh position; the missed-cycle counter is reset.
    refresher.refresh()
    resumed = _state_of(refresher, "1001")
    assert resumed.latitude == 0.7
    assert resumed is not held

    # Prove the reset: two more consecutive misses stay within grace (misses 1 and
    # 2). Had the counter NOT reset on reappearance, it would already have been at
    # 1 and this second miss would be the 3rd -> dropped. Still served => reset.
    refresher.refresh()
    assert _trips(refresher) == {"1001"}
    refresher.refresh()
    assert _trips(refresher) == {"1001"}


def test_live_train_dropped_after_grace_with_single_info_log(caplog, capsys) -> None:
    caplog.set_level(logging.INFO, logger="app.services.train_manager")
    # Present once, then absent for three consecutive cycles. Grace is 2 cycles:
    # misses 1 and 2 are served, the 3rd miss drops it.
    refresher = _make_refresher([[make_train("1001", latitude=0.3)], [], [], []])

    refresher.refresh()
    assert _trips(refresher) == {"1001"}

    refresher.refresh()  # miss 1 -> served
    assert _trips(refresher) == {"1001"}
    refresher.refresh()  # miss 2 -> served
    assert _trips(refresher) == {"1001"}
    refresher.refresh()  # miss 3 -> dropped
    assert _trips(refresher) == set()

    # Exactly one info-level drop line across the whole scenario, naming the trip.
    drop_logs = [
        r
        for r in caplog.records
        if r.levelno == logging.INFO and DROP_LOG_FRAGMENT in r.getMessage() and "1001" in r.getMessage()
    ]
    assert len(drop_logs) == 1

    # The old per-cycle missing-trip WARNING spam is gone entirely.
    assert OLD_MISSING_WARNING not in capsys.readouterr().out


def test_reappearance_within_previous_segment_keeps_prev_next_stops() -> None:
    # On the synthetic Milton line (UN@0.0, KP@0.5, ML@1.0), a FROM_UNION train at
    # distance 0.3 sits in the UN..KP segment: prev=KP, next=UN. After a one-cycle
    # flicker it reappears at 0.6 -- just past the KP boundary in its direction of
    # travel. The keep-segment path preserves KP/UN; a from-scratch recompute would
    # instead yield ML/KP. Asserting KP/UN proves the carried-forward state fed the
    # keep-segment path (and that cross-cycle segment memory is consulted at all).
    refresher = _make_refresher(
        [
            [make_train("1001", latitude=0.3)],
            [],
            [make_train("1001", latitude=0.6)],
        ]
    )

    refresher.refresh()
    before = _state_of(refresher, "1001")
    assert (before.prev_stop_code, before.next_stop_code) == ("KP", "UN")

    refresher.refresh()  # flicker
    refresher.refresh()  # reappear at 0.6

    after = _state_of(refresher, "1001")
    # Preserved via keep-segment -- NOT recomputed to ("ML", "KP").
    assert (after.prev_stop_code, after.next_stop_code) == ("KP", "UN")


def test_completed_train_afterlife_is_unchanged_by_grace_logic() -> None:
    # A completed (stopped-at-last-stop) train present, then absent for several
    # cycles. It must linger via the TTL afterlife as a completed marker, and must
    # NOT be tracked by the live-train missed-cycle counter.
    refresher = _make_refresher([[_completed_train("1001")], [], [], []])

    refresher.refresh()
    refresher.refresh()

    served = _state_of(refresher, "1001")
    assert served.progress == 1.0
    assert served.prev_stop_code == "ML"
    assert served.next_stop_code == "ML"
    assert served.stopped_at_stop_code == "ML"
    assert served.in_motion is False

    # The completed train is never entered into the grace counter...
    counters = refresher.manager.train_manager._missed_cycles
    assert "1001" not in counters

    # ...and it keeps lingering across further absent cycles (TTL afterlife), well
    # past the 3-miss point at which a live train would have been dropped.
    refresher.refresh()
    refresher.refresh()
    assert _state_of(refresher, "1001").progress == 1.0


def test_escalated_cycle_neither_consumes_grace_nor_wipes_memory() -> None:
    # c1: train A succeeds. c2: an all-Class-B non-empty feed escalates (raises
    # NoTrainsMappedError, caught by DataRefresher as a failed cycle). c3, c4:
    # successful empty cycles where A is absent.
    all_class_b = [make_train("2001", modified_date=""), make_train("2002", modified_date="")]
    refresher = _make_refresher([[make_train("1001", latitude=0.3)], all_class_b, [], []])

    refresher.refresh()
    snapshot_after_success = refresher._snapshot
    assert _trips(refresher) == {"1001"}

    # Escalated cycle: previous snapshot retained (memory intact), and A's grace
    # counter is untouched -- an escalated cycle is a failure, not a missed cycle.
    refresher.refresh()
    assert refresher._snapshot is snapshot_after_success
    assert _trips(refresher) == {"1001"}
    assert refresher.manager.train_manager._missed_cycles == {}

    # A's grace only starts counting now, on the first genuinely successful cycle
    # in which it is absent. Two successful absent cycles = misses 1 and 2, both
    # within grace. Had the escalated cycle wrongly consumed grace, the second of
    # these would be the 3rd miss and A would be dropped.
    refresher.refresh()  # miss 1
    assert _trips(refresher) == {"1001"}
    refresher.refresh()  # miss 2
    assert _trips(refresher) == {"1001"}
    assert MISSING_GRACE_CYCLES == 2
