"""Per-record error isolation with schema-drift escalation (issue #11).

Drives ``DataRefresher.refresh()`` directly (no thread, no network, no API key)
with scripted fake feeds to prove the two-class isolation policy:

* Class A -- an unknown line code (e.g. UP Express reporting as ``UP``): the
  record is skipped and logged ONCE per code for the manager's lifetime; other
  records are still served.
* Class B -- a parse/geometry failure (e.g. an empty/garbage ``ModifiedDate``):
  the record is skipped and logged (with its trip number) per occurrence; other
  records are still served.
* Escalation -- a non-empty feed that maps zero trains *because* of Class B
  errors is a failed cycle: the previous snapshot is retained and
  ``last_updated`` does not advance, exactly like a feed outage. A feed of only
  unknown line codes is instead a successful, empty cycle.
"""
from __future__ import annotations

import dataclasses
import logging

from app.constants import LINE_CODES
from app.jobs.data_refresher import DataRefresher
from app.services.line_manager import LineManager

from tests.factories import build_synthetic_line, make_train
from tests.fakes import FakeMetrolinxService

UNSUPPORTED_LINE_LOG = "Ignoring unsupported line code UP"


def _make_refresher(script) -> DataRefresher:
    """Wire a DataRefresher to a fake feed driven by the given per-cycle script."""
    fake_service = FakeMetrolinxService(script=script)
    manager = LineManager(
        go_service=fake_service,
        lines={LINE_CODES.MILTON: build_synthetic_line(LINE_CODES.MILTON)},
        lakeshore_west_variants={},
    )
    return DataRefresher(refresh_interval=15, manager=manager)


def _up_express_train(trip_number: str) -> object:
    """A GoTrain whose line code (``UP``) is a deliberately unmodeled service."""
    return dataclasses.replace(make_train(trip_number), line_code="UP")


def _trips(refresher: DataRefresher) -> set[str]:
    return {s.trip_number for s in refresher.get_states(LINE_CODES.MILTON)}


def test_bad_timestamp_record_is_skipped_others_served(caplog) -> None:
    caplog.set_level(logging.WARNING)
    # Two good trains plus one with garbage ModifiedDate that cannot be parsed.
    bad = make_train("9001", modified_date="not-a-date")
    refresher = _make_refresher([[make_train("1001"), make_train("1002"), bad]])

    refresher.refresh()

    # Good trains are served; the unparseable record is dropped, not fatal.
    assert _trips(refresher) == {"1001", "1002"}
    # The warning names the offending trip number so the log is actionable.
    warnings = [r.getMessage() for r in caplog.records if r.levelno == logging.WARNING]
    assert any("9001" in msg for msg in warnings)


def test_unknown_line_code_skipped_and_logged_once_across_cycles(caplog) -> None:
    caplog.set_level(logging.WARNING)
    # Two cycles, each carrying a good Milton train and an UP Express train.
    refresher = _make_refresher(
        [
            [make_train("1001"), _up_express_train("7001")],
            [make_train("1002"), _up_express_train("7002")],
        ]
    )

    refresher.refresh()
    assert _trips(refresher) == {"1001"}

    refresher.refresh()
    # 1001 is absent from cycle 2 but carried forward one cycle by the dropout
    # grace (issue #12), so both the freshly mapped 1002 and the grace-held 1001
    # are served. The point of this test -- log-once for the unknown code -- is
    # unaffected.
    assert _trips(refresher) == {"1001", "1002"}

    # The unsupported-code message is emitted exactly once despite UP trains in
    # both cycles -- per-cycle repetition would train people to ignore warnings.
    unsupported = [
        r.getMessage() for r in caplog.records if UNSUPPORTED_LINE_LOG in r.getMessage()
    ]
    assert len(unsupported) == 1


def test_all_class_b_escalates_and_retains_previous_snapshot() -> None:
    # Cycle 1 succeeds. Cycle 2 is non-empty but EVERY record fails to map
    # (empty ModifiedDate) -> escalation: keep previous snapshot, freeze timestamp.
    all_bad = [
        make_train("1001", modified_date=""),
        make_train("1002", modified_date=""),
    ]
    refresher = _make_refresher([[make_train("1001"), make_train("1002")], all_bad])

    refresher.refresh()
    snapshot_after_success = refresher._snapshot
    states_after_success = refresher.get_states(LINE_CODES.MILTON)
    last_updated_after_success = refresher.last_updated
    assert {s.trip_number for s in states_after_success} == {"1001", "1002"}
    assert last_updated_after_success is not None

    # The escalated cycle must behave exactly like a feed outage.
    refresher.refresh()

    assert refresher._snapshot is snapshot_after_success
    assert _trips(refresher) == {"1001", "1002"}
    assert refresher.last_updated is last_updated_after_success


def test_only_unknown_line_codes_is_a_successful_empty_cycle() -> None:
    # Cycle 1 seeds a normal snapshot. Cycle 2 carries ONLY UP Express trains:
    # zero mapped, zero Class B errors -> a legitimate empty success, NOT an
    # escalation. A fresh snapshot is published and the timestamp advances (an
    # escalation would instead freeze both). Because this cycle SUCCEEDS, the
    # missing-trip handling runs and 1001 -- absent this cycle -- is carried
    # forward by the dropout grace (issue #12) rather than dropped instantly.
    refresher = _make_refresher(
        [[make_train("1001")], [_up_express_train("7001"), _up_express_train("7002")]]
    )

    refresher.refresh()
    snapshot_after_success = refresher._snapshot
    last_updated_after_success = refresher.last_updated
    assert _trips(refresher) == {"1001"}

    refresher.refresh()

    # Success: a new snapshot, timestamp advanced (contrast with escalation, which
    # keeps the previous snapshot object and freezes the timestamp). 1001 lingers
    # via grace, evidence the successful missing-trip path ran.
    assert refresher._snapshot is not snapshot_after_success
    assert _trips(refresher) == {"1001"}
    assert refresher.last_updated is not None
    assert refresher.last_updated >= last_updated_after_success


def test_partial_mapping_is_a_success_serving_mapped_trains(caplog) -> None:
    caplog.set_level(logging.WARNING)
    # Some records map, one is Class B: no escalation, mapped trains are served.
    refresher = _make_refresher(
        [[make_train("1001"), make_train("1002"), make_train("9001", modified_date="")]]
    )

    refresher.refresh()

    assert _trips(refresher) == {"1001", "1002"}
    assert refresher.last_updated is not None
    warnings = [r.getMessage() for r in caplog.records if r.levelno == logging.WARNING]
    assert any("9001" in msg for msg in warnings)
