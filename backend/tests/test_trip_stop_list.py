"""Per-trip stop-list fetching for the route-path feature (issue #19).

Two layers are pinned here:

* ``MetrolinxService.get_trip_stop_codes`` -- the Schedule/Trip client. Like the
  existing envelope tests it monkeypatches ``_fetch`` so no HTTP happens, and it
  proves the contract: a well-formed envelope yields ordered stop codes (cached
  per service day), while any fetch/shape failure degrades to ``[]`` WITHOUT
  caching so a later cycle can recover.
* The end-to-end path through ``DataRefresher`` -> ``LineManager`` ->
  ``TrainManager``: a resolvable trip lands its ordered ``stop_codes`` on the
  served ``TrainState``, and an unresolvable trip falls back to an empty list
  while the cycle still succeeds.
"""
from __future__ import annotations

import pytest

from app.constants import LINE_CODES
from app.jobs.data_refresher import DataRefresher
from app.services.line_manager import LineManager
from app.services.metrolinx_service import MetrolinxFeedError, MetrolinxService

from tests.factories import build_synthetic_line, make_train
from tests.fakes import FakeMetrolinxService


def _service_returning(payload) -> MetrolinxService:
    """Build a service whose ``_fetch`` returns ``payload`` (no network)."""
    service = MetrolinxService(api_key="test")
    service._fetch = lambda endpoint: payload  # type: ignore[method-assign]
    return service


def _trip_envelope(stops) -> dict:
    return {"Trip": {"Stops": {"Stop": stops}}}


# --- MetrolinxService.get_trip_stop_codes -------------------------------------


def test_ordered_stop_codes_extracted() -> None:
    service = _service_returning(
        _trip_envelope(
            [
                {"Order": 1, "Code": "UN"},
                {"Order": 2, "Code": "KP"},
                {"Order": 3, "Code": "ML"},
            ]
        )
    )

    assert service.get_trip_stop_codes("1001", "20260702") == ["UN", "KP", "ML"]


def test_stops_sorted_by_order_when_out_of_sequence() -> None:
    service = _service_returning(
        _trip_envelope(
            [
                {"Order": 3, "Code": "ML"},
                {"Order": 1, "Code": "UN"},
                {"Order": 2, "Code": "KP"},
            ]
        )
    )

    assert service.get_trip_stop_codes("1001", "20260702") == ["UN", "KP", "ML"]


def test_express_trip_lists_only_served_stops() -> None:
    # An express Milton run skipping Kipling: the schedule simply omits it, so the
    # resolved list carries only the stops the trip actually serves.
    service = _service_returning(
        _trip_envelope([{"Order": 1, "Code": "UN"}, {"Order": 2, "Code": "ML"}])
    )

    assert service.get_trip_stop_codes("1001", "20260702") == ["UN", "ML"]


def test_single_stop_dict_is_wrapped() -> None:
    service = _service_returning(_trip_envelope({"Order": 1, "Code": "UN"}))

    assert service.get_trip_stop_codes("1001", "20260702") == ["UN"]


def test_blank_codes_are_dropped() -> None:
    service = _service_returning(
        _trip_envelope([{"Code": "UN"}, {"Code": ""}, {"Code": "ML"}])
    )

    assert service.get_trip_stop_codes("1001", "20260702") == ["UN", "ML"]


def test_empty_stops_is_resolvable_empty() -> None:
    service = _service_returning(_trip_envelope([]))

    assert service.get_trip_stop_codes("1001", "20260702") == []


def test_absent_trip_container_is_empty() -> None:
    service = _service_returning({"SomethingElse": {}})

    assert service.get_trip_stop_codes("1001", "20260702") == []


def test_blank_trip_number_short_circuits_without_fetching() -> None:
    service = MetrolinxService(api_key="test")

    def _boom(endpoint):  # pragma: no cover - must never run
        raise AssertionError("should not fetch for a blank trip number")

    service._fetch = _boom  # type: ignore[method-assign]

    assert service.get_trip_stop_codes("", "20260702") == []


def test_malformed_envelope_degrades_to_empty() -> None:
    # A mis-typed 'Stop' is shape drift: _parse raises MetrolinxFeedError, which
    # get_trip_stop_codes swallows into [] so one bad trip is never fatal.
    service = _service_returning({"Trip": {"Stops": {"Stop": 42}}})

    assert service.get_trip_stop_codes("1001", "20260702") == []


def test_fetch_failure_degrades_to_empty() -> None:
    service = MetrolinxService(api_key="test")

    def _fail(endpoint):
        raise MetrolinxFeedError("network down")

    service._fetch = _fail  # type: ignore[method-assign]

    assert service.get_trip_stop_codes("1001", "20260702") == []


# --- caching ------------------------------------------------------------------


def test_resolved_list_is_cached_per_day() -> None:
    service = MetrolinxService(api_key="test")
    calls = {"n": 0}

    def _counting(endpoint):
        calls["n"] += 1
        return _trip_envelope([{"Order": 1, "Code": "UN"}, {"Order": 2, "Code": "ML"}])

    service._fetch = _counting  # type: ignore[method-assign]

    first = service.get_trip_stop_codes("1001", "20260702")
    second = service.get_trip_stop_codes("1001", "20260702")

    assert first == second == ["UN", "ML"]
    assert calls["n"] == 1  # second call served from cache, no refetch

    # A different service day is a distinct key and does fetch again.
    service.get_trip_stop_codes("1001", "20260703")
    assert calls["n"] == 2


def test_failure_is_not_cached_so_a_later_cycle_recovers() -> None:
    service = MetrolinxService(api_key="test")
    outcomes = [MetrolinxFeedError("blip"), _trip_envelope([{"Code": "UN"}, {"Code": "ML"}])]

    def _flaky(endpoint):
        outcome = outcomes.pop(0)
        if isinstance(outcome, BaseException):
            raise outcome
        return outcome

    service._fetch = _flaky  # type: ignore[method-assign]

    assert service.get_trip_stop_codes("1001", "20260702") == []  # transient failure
    assert service.get_trip_stop_codes("1001", "20260702") == ["UN", "ML"]  # recovered


def test_cached_list_is_copied_not_shared() -> None:
    service = _service_returning(_trip_envelope([{"Code": "UN"}, {"Code": "ML"}]))

    first = service.get_trip_stop_codes("1001", "20260702")
    first.append("MUTATED")
    second = service.get_trip_stop_codes("1001", "20260702")

    assert second == ["UN", "ML"]


# --- end-to-end through the manager -------------------------------------------


def _make_refresher(stop_codes_by_trip=None) -> DataRefresher:
    fake_service = FakeMetrolinxService(
        script=[[make_train("1001", latitude=0.3)]],
        stop_codes_by_trip=stop_codes_by_trip,
    )
    manager = LineManager(
        go_service=fake_service,
        lines={LINE_CODES.MILTON: build_synthetic_line(LINE_CODES.MILTON)},
        lakeshore_west_variants={},
    )
    return DataRefresher(refresh_interval=15, manager=manager)


def test_resolvable_trip_lands_stop_codes_on_state() -> None:
    refresher = _make_refresher({"1001": ["UN", "KP", "ML"]})

    refresher.refresh()

    (state,) = refresher.get_states(LINE_CODES.MILTON)
    assert state.stop_codes == ("UN", "KP", "ML")


def test_unresolvable_trip_falls_back_to_empty_and_cycle_succeeds() -> None:
    refresher = _make_refresher(stop_codes_by_trip=None)

    refresher.refresh()

    (state,) = refresher.get_states(LINE_CODES.MILTON)
    assert state.stop_codes == ()
    # The train still maps and is served -- an unresolvable stop list is not fatal.
    assert state.trip_number == "1001"
