"""Per-line scheduled-service status computation (issue #26).

Exercises :class:`ScheduleStatusProvider` over hand-built ``ScheduleData`` (real
GTFS files are absent in tests) and an injected clock, following the existing
``FakeClock`` seam. Proves the three behaviours the feature rests on:

* a line with zero scheduled trips today is out of service while others are in,
* a service date absent from the extract fails open (every line in service), and
* the schedule scan runs at most once per service date (memoization).
"""
from __future__ import annotations

from datetime import date, datetime, timedelta

from app.constants import LINE_CODES
from app.services.schedule_status import (
    CalendarException,
    CalendarService,
    ScheduleData,
    ScheduleStatusProvider,
)


class FakeClock:
    """Hand-advanced stand-in for ``datetime.now`` -- no wall-clock sleeping."""

    def __init__(self, start: datetime) -> None:
        self.now = start

    def __call__(self) -> datetime:
        return self.now

    def advance(self, days: int) -> None:
        self.now += timedelta(days=days)


# 2026-07-04 is a Saturday; 2026-07-06 is a Monday. Weekday indices match
# date.weekday() (Monday = 0).
_WEEKDAYS_ONLY = (True, True, True, True, True, False, False)
_WEEKEND_ONLY = (False, False, False, False, False, True, True)
_EVERY_DAY = (True, True, True, True, True, True, True)

_SPAN_START = date(2026, 1, 1)
_SPAN_END = date(2026, 12, 31)


def _weekday_service(service_id: str, weekdays) -> CalendarService:
    return CalendarService(
        service_id=service_id,
        weekdays=weekdays,
        start_date=_SPAN_START,
        end_date=_SPAN_END,
    )


def _counting_loader(data: ScheduleData):
    """Return a loader closing over a call counter, to prove scan-once-per-date."""
    calls = {"count": 0}

    def loader() -> ScheduleData:
        calls["count"] += 1
        return data

    return loader, calls


def test_zero_trip_line_is_out_of_service_while_others_are_in() -> None:
    # Weekday service runs Milton + Lakeshore West; a weekend-only service runs
    # only on Saturday/Sunday. On a Saturday, weekday-only lines have zero trips.
    data = ScheduleData(
        calendar=(
            _weekday_service("weekday", _WEEKDAYS_ONLY),
            _weekday_service("weekend", _WEEKEND_ONLY),
        ),
        trips_by_service={
            "weekday": {LINE_CODES.MILTON, LINE_CODES.LAKESHORE_WEST},
            "weekend": {LINE_CODES.LAKESHORE_WEST, LINE_CODES.LAKESHORE_EAST},
        },
    )
    provider = ScheduleStatusProvider(loader=lambda: data)

    # Saturday: only the weekend service is active -> LW + LE run, Milton does not.
    statuses = provider.get_statuses("20260704")

    assert statuses[LINE_CODES.MILTON] is False
    assert statuses[LINE_CODES.LAKESHORE_WEST] is True
    assert statuses[LINE_CODES.LAKESHORE_EAST] is True
    # Every modeled line has an explicit answer.
    assert set(statuses.keys()) == set(LINE_CODES)
    # A line no service touches at all is out of service, not missing.
    assert statuses[LINE_CODES.BARRIE] is False


def test_weekday_service_puts_the_line_in_service() -> None:
    data = ScheduleData(
        calendar=(_weekday_service("weekday", _WEEKDAYS_ONLY),),
        trips_by_service={"weekday": {LINE_CODES.MILTON}},
    )
    provider = ScheduleStatusProvider(loader=lambda: data)

    # 2026-07-06 is a Monday: the weekday service is active.
    assert provider.get_statuses("20260706")[LINE_CODES.MILTON] is True


def test_calendar_dates_exception_adds_service_on_a_date() -> None:
    # An added-exception (type 1) turns a line on for a specific date even though
    # its weekly pattern would exclude it.
    data = ScheduleData(
        calendar=(_weekday_service("weekday", _WEEKDAYS_ONLY),),
        exceptions=(
            CalendarException(service_id="weekday", day=date(2026, 7, 4), added=True),
        ),
        trips_by_service={"weekday": {LINE_CODES.MILTON}},
    )
    provider = ScheduleStatusProvider(loader=lambda: data)

    # Saturday, normally excluded, but the exception adds the service.
    assert provider.get_statuses("20260704")[LINE_CODES.MILTON] is True


def test_calendar_dates_exception_removes_service_on_a_date() -> None:
    data = ScheduleData(
        calendar=(_weekday_service("everyday", _EVERY_DAY),),
        exceptions=(
            CalendarException(service_id="everyday", day=date(2026, 7, 6), added=False),
        ),
        trips_by_service={"everyday": {LINE_CODES.MILTON}},
    )
    provider = ScheduleStatusProvider(loader=lambda: data)

    # Monday would normally run, but the removal exception cancels it.
    assert provider.get_statuses("20260706")[LINE_CODES.MILTON] is False


def test_missing_service_date_fails_open_all_in_service() -> None:
    # The extract only covers January; a July date is absent (stale download).
    data = ScheduleData(
        calendar=(
            CalendarService(
                service_id="weekday",
                weekdays=_WEEKDAYS_ONLY,
                start_date=date(2026, 1, 1),
                end_date=date(2026, 1, 31),
            ),
        ),
        trips_by_service={"weekday": {LINE_CODES.MILTON}},
    )
    provider = ScheduleStatusProvider(loader=lambda: data)

    statuses = provider.get_statuses("20260706")

    assert all(statuses[code] is True for code in LINE_CODES)


def test_loader_failure_fails_open() -> None:
    def boom() -> ScheduleData:
        raise OSError("schedule file unreadable")

    provider = ScheduleStatusProvider(loader=boom)

    statuses = provider.get_statuses("20260706")
    assert all(statuses[code] is True for code in LINE_CODES)


def test_no_usable_trips_fails_open() -> None:
    # Files loaded but nothing mapped (e.g. route->line mapping produced nothing):
    # fail open rather than dim every line.
    data = ScheduleData(
        calendar=(_weekday_service("weekday", _WEEKDAYS_ONLY),),
        trips_by_service={},
    )
    provider = ScheduleStatusProvider(loader=lambda: data)

    statuses = provider.get_statuses("20260706")
    assert all(statuses[code] is True for code in LINE_CODES)


def test_unparseable_service_date_fails_open() -> None:
    data = ScheduleData(
        calendar=(_weekday_service("weekday", _WEEKDAYS_ONLY),),
        trips_by_service={"weekday": {LINE_CODES.MILTON}},
    )
    provider = ScheduleStatusProvider(loader=lambda: data)

    statuses = provider.get_statuses("not-a-date")
    assert all(statuses[code] is True for code in LINE_CODES)


def test_scan_runs_at_most_once_per_service_date() -> None:
    data = ScheduleData(
        calendar=(_weekday_service("weekday", _WEEKDAYS_ONLY),),
        trips_by_service={"weekday": {LINE_CODES.MILTON}},
    )
    loader, calls = _counting_loader(data)
    provider = ScheduleStatusProvider(loader=loader)

    # Many reads for the same service date -> exactly one scan.
    for _ in range(5):
        provider.get_statuses("20260706")
    assert calls["count"] == 1

    # A different service date triggers exactly one more scan.
    provider.get_statuses("20260707")
    assert calls["count"] == 2


def test_service_date_derives_from_injected_clock() -> None:
    data = ScheduleData(
        calendar=(_weekday_service("weekday", _WEEKDAYS_ONLY),),
        trips_by_service={"weekday": {LINE_CODES.MILTON}},
    )
    loader, calls = _counting_loader(data)
    # Saturday 2026-07-04: the weekday-only Milton service does not run.
    clock = FakeClock(datetime(2026, 7, 4, 9, 0, 0))
    provider = ScheduleStatusProvider(loader=loader, now=clock)

    assert provider.get_statuses()[LINE_CODES.MILTON] is False

    # Advancing the clock to Monday flips Milton in, and is scanned once more.
    clock.advance(2)
    assert provider.get_statuses()[LINE_CODES.MILTON] is True
    assert calls["count"] == 2
