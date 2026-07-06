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
    TripWindow,
    _gtfs_time_to_seconds,
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


# --- Issue #27: dim a line after its last scheduled train of the day ----------

# A single Milton trip running the weekday service, departing 06:00 and arriving
# 23:00 (whole seconds from the service date's midnight).
_H = 3600
_MILTON_WEEKDAY_TRIP = TripWindow(
    line=LINE_CODES.MILTON, service_id="weekday", start=6 * _H, end=23 * _H
)


def _windowed_data(*trips: TripWindow) -> ScheduleData:
    return ScheduleData(
        calendar=(_weekday_service("weekday", _WEEKDAYS_ONLY),),
        trips_by_service={"weekday": {LINE_CODES.MILTON}},
        trip_windows=trips,
    )


def _provider_at(when: datetime, *trips: TripWindow) -> ScheduleStatusProvider:
    data = _windowed_data(*trips)
    return ScheduleStatusProvider(loader=lambda: data, now=lambda: when)


def test_line_in_service_during_its_window() -> None:
    # Monday 2026-07-06, 12:00 -- squarely inside Milton's 06:00-23:00 window.
    provider = _provider_at(datetime(2026, 7, 6, 12, 0), _MILTON_WEEKDAY_TRIP)
    assert provider.get_statuses()[LINE_CODES.MILTON] is True


def test_line_out_of_service_after_last_arrival_plus_grace() -> None:
    # Monday 23:45 -- past the 23:00 arrival plus the 30-minute grace (23:30).
    provider = _provider_at(datetime(2026, 7, 6, 23, 45), _MILTON_WEEKDAY_TRIP)
    assert provider.get_statuses()[LINE_CODES.MILTON] is False


def test_grace_boundary_just_inside_then_just_outside() -> None:
    # 23:29 is within the 23:00 + 30min grace; 23:31 is past it.
    inside = _provider_at(datetime(2026, 7, 6, 23, 29), _MILTON_WEEKDAY_TRIP)
    outside = _provider_at(datetime(2026, 7, 6, 23, 31), _MILTON_WEEKDAY_TRIP)
    assert inside.get_statuses()[LINE_CODES.MILTON] is True
    assert outside.get_statuses()[LINE_CODES.MILTON] is False


def test_line_out_of_service_before_first_departure() -> None:
    # Monday 05:00 -- service has not plausibly started (first departure 06:00).
    provider = _provider_at(datetime(2026, 7, 6, 5, 0), _MILTON_WEEKDAY_TRIP)
    assert provider.get_statuses()[LINE_CODES.MILTON] is False


def test_past_midnight_trip_keeps_line_lit_across_midnight() -> None:
    # A late Milton trip departs 22:00 and arrives 25:10 (01:10 the NEXT calendar
    # day) on the Monday service. Just after midnight (Tuesday 00:30) the line is
    # still lit off Monday's window; by 02:00 (past 01:10 + grace) it has closed
    # and Tuesday's own service has not started (first departure 06:00).
    late_trip = TripWindow(
        line=LINE_CODES.MILTON,
        service_id="weekday",
        start=6 * _H,
        end=25 * _H + 10 * 60,  # 25:10:00
    )
    just_after_midnight = _provider_at(datetime(2026, 7, 7, 0, 30), late_trip)
    well_after = _provider_at(datetime(2026, 7, 7, 2, 0), late_trip)

    # Service date rolls to Tuesday; yesterday's (Monday) window keeps it lit.
    assert just_after_midnight.get_statuses()[LINE_CODES.MILTON] is True
    assert well_after.get_statuses()[LINE_CODES.MILTON] is False


def test_window_scan_runs_at_most_once_per_service_date() -> None:
    # Reading the same date at many different clock times must not rescan; a new
    # service date scans exactly once more.
    data = _windowed_data(_MILTON_WEEKDAY_TRIP)
    loader, calls = _counting_loader(data)
    clock = FakeClock(datetime(2026, 7, 6, 8, 0))
    provider = ScheduleStatusProvider(loader=loader, now=clock)

    for hour in (8, 12, 20, 23):
        clock.now = datetime(2026, 7, 6, hour, 0)
        provider.get_statuses()
    assert calls["count"] == 1

    clock.now = datetime(2026, 7, 7, 9, 0)
    provider.get_statuses()
    assert calls["count"] == 2


def test_gtfs_time_to_seconds_handles_hours_past_24() -> None:
    assert _gtfs_time_to_seconds("06:00:00") == 6 * _H
    assert _gtfs_time_to_seconds("23:00:00") == 23 * _H
    # 25:10:00 is a valid GTFS past-midnight time, not a clock time.
    assert _gtfs_time_to_seconds("25:10:00") == 25 * _H + 10 * 60
    # Malformed / empty values contribute no bound rather than a wrong one.
    assert _gtfs_time_to_seconds("") is None
    assert _gtfs_time_to_seconds("not-a-time") is None
    assert _gtfs_time_to_seconds("12:60:00") is None
