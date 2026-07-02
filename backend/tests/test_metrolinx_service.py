"""Envelope-handling contract for ``MetrolinxService``.

These are true unit tests: they monkeypatch the service's ``_fetch`` method so no
real HTTP request is ever made. They pin the boundary between *shape drift*
(malformed envelope -> raise ``MetrolinxFeedError``) and a legitimately empty
feed (well-formed, no trains -> return ``[]``).
"""
from __future__ import annotations

import pytest

from app.services.metrolinx_service import MetrolinxFeedError, MetrolinxService


def _service_returning(payload) -> MetrolinxService:
    """Build a service whose ``_fetch`` returns ``payload`` (no network)."""
    service = MetrolinxService(api_key="test")
    service._fetch = lambda endpoint: payload  # type: ignore[method-assign]
    return service


def test_construction_does_not_hit_the_network() -> None:
    # If __init__ still fetched eagerly, this would raise on the fake api key.
    service = MetrolinxService(api_key="test")
    assert service.trains == []
    assert service.last_updated is None


def test_missing_trips_container_raises() -> None:
    service = _service_returning({"SomethingElse": {}})
    with pytest.raises(MetrolinxFeedError):
        service.get_train_data()


def test_trips_not_a_dict_raises() -> None:
    service = _service_returning({"Trips": ["not", "a", "dict"]})
    with pytest.raises(MetrolinxFeedError):
        service.get_train_data()


def test_non_dict_envelope_raises() -> None:
    service = _service_returning(["unexpected", "top", "level"])
    with pytest.raises(MetrolinxFeedError):
        service.get_train_data()


def test_trip_wrong_type_raises() -> None:
    service = _service_returning({"Trips": {"Trip": "not a list or dict"}})
    with pytest.raises(MetrolinxFeedError):
        service.get_train_data()


def test_absent_trip_is_empty_success() -> None:
    service = _service_returning({"Trips": {}})
    assert service.get_train_data() == []
    assert service.last_updated is not None


def test_empty_trip_list_is_empty_success() -> None:
    service = _service_returning({"Trips": {"Trip": []}})
    assert service.get_train_data() == []


def test_null_trips_container_is_empty_success() -> None:
    service = _service_returning({"Trips": None})
    assert service.get_train_data() == []


def test_single_trip_dict_returns_one_train() -> None:
    trip = {"TripNumber": "1001", "LineCode": "MI"}
    service = _service_returning({"Trips": {"Trip": trip}})

    trains = service.get_train_data()

    assert len(trains) == 1
    assert trains[0].trip_number == "1001"


def test_trip_list_returns_all_trains() -> None:
    service = _service_returning(
        {"Trips": {"Trip": [{"TripNumber": "1001"}, {"TripNumber": "1002"}]}}
    )

    trains = service.get_train_data()

    assert {t.trip_number for t in trains} == {"1001", "1002"}
