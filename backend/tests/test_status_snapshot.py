"""Per-line status rides the atomically-published snapshot (issue #26).

Proves the status map is served from the SAME snapshot as the train states and
obeys the same read-path staleness rule, failing open (all in service) when the
snapshot is stale, empty, or a line is absent.
"""
from __future__ import annotations

from datetime import datetime, timedelta

from app.constants import LINE_CODES
from app.jobs.data_refresher import STALE_AFTER_CYCLES, DataRefresher
from app.services.line_manager import LineManager
from app.services.schedule_status import ScheduleData, ScheduleStatusProvider

from tests.factories import build_synthetic_line, make_train
from tests.fakes import FakeMetrolinxService


class FakeClock:
    def __init__(self, start: datetime) -> None:
        self.now = start

    def __call__(self) -> datetime:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += timedelta(seconds=seconds)


def _make_refresher(script, *, clock, status_provider) -> DataRefresher:
    manager = LineManager(
        go_service=FakeMetrolinxService(script=script),
        lines={LINE_CODES.MILTON: build_synthetic_line(LINE_CODES.MILTON)},
        lakeshore_west_variants={},
    )
    return DataRefresher(
        refresh_interval=15,
        manager=manager,
        now=clock,
        status_provider=status_provider,
    )


def _provider_marking_le_out() -> ScheduleStatusProvider:
    # Weekday-only Lakeshore East service; on a Saturday it has zero trips -> out.
    # Every other line has an all-week service -> in. Lakeshore East is chosen
    # because the fake manager maps only Milton, so LE never carries a live train
    # and the live-train override (issue #27) can't flip it back in -- letting the
    # snapshot-plumbing assertions target a genuinely dimmed line. Loader returns
    # hand-built data.
    data = ScheduleData(
        calendar=(
            _service("le_weekday", (True,) * 5 + (False, False)),
            _service("others_everyday", (True,) * 7),
        ),
        trips_by_service={
            "le_weekday": {LINE_CODES.LAKESHORE_EAST},
            "others_everyday": {
                code for code in LINE_CODES if code != LINE_CODES.LAKESHORE_EAST
            },
        },
    )
    return ScheduleStatusProvider(loader=lambda: data)


def _service(service_id, weekdays):
    from datetime import date

    from app.services.schedule_status import CalendarService

    return CalendarService(
        service_id=service_id,
        weekdays=weekdays,
        start_date=date(2026, 1, 1),
        end_date=date(2026, 12, 31),
    )


def test_status_map_is_published_on_the_snapshot() -> None:
    # Saturday 2026-07-04.
    clock = FakeClock(datetime(2026, 7, 4, 9, 0, 0))
    refresher = _make_refresher(
        [[make_train("1001", latitude=0.3)]],
        clock=clock,
        status_provider=_provider_marking_le_out(),
    )
    refresher.refresh()

    statuses = refresher.get_statuses()
    assert statuses[LINE_CODES.LAKESHORE_EAST] is False
    assert statuses[LINE_CODES.LAKESHORE_WEST] is True
    # The status lives on the same snapshot object as the states.
    assert refresher._snapshot.statuses_by_line[LINE_CODES.LAKESHORE_EAST] is False


def test_stale_snapshot_fails_open_for_statuses() -> None:
    clock = FakeClock(datetime(2026, 7, 4, 9, 0, 0))
    refresher = _make_refresher(
        [[make_train("1001", latitude=0.3)]],
        clock=clock,
        status_provider=_provider_marking_le_out(),
    )
    refresher.refresh()
    assert refresher.get_statuses()[LINE_CODES.LAKESHORE_EAST] is False

    # Past the staleness cutoff: statuses fail open exactly as states go empty.
    clock.advance(refresher.refresh_interval * STALE_AFTER_CYCLES + 1)
    assert refresher.get_states(LINE_CODES.MILTON) == []
    assert all(refresher.get_statuses()[code] is True for code in LINE_CODES)


def test_initial_snapshot_before_refresh_fails_open() -> None:
    clock = FakeClock(datetime(2026, 7, 4, 9, 0, 0))
    refresher = _make_refresher(
        [[make_train("1001", latitude=0.3)]],
        clock=clock,
        status_provider=_provider_marking_le_out(),
    )
    # Nothing refreshed yet: the empty snapshot reads as all in service.
    assert all(refresher.get_statuses()[code] is True for code in LINE_CODES)


def _provider_marking_milton_out() -> ScheduleStatusProvider:
    # Weekday-only Milton service; on a Saturday it has zero trips -> schedule
    # says out of service.
    data = ScheduleData(
        calendar=(
            _service("milton_weekday", (True,) * 5 + (False, False)),
            _service("others_everyday", (True,) * 7),
        ),
        trips_by_service={
            "milton_weekday": {LINE_CODES.MILTON},
            "others_everyday": {
                code for code in LINE_CODES if code != LINE_CODES.MILTON
            },
        },
    )
    return ScheduleStatusProvider(loader=lambda: data)


def test_live_train_overrides_schedule_out_of_service() -> None:
    # Saturday 2026-07-04: the schedule says Milton is out (weekday-only service),
    # but a live Milton train is on the tracks -- the map can be wrong, a train
    # cannot -- so the override forces Milton in service on the snapshot.
    clock = FakeClock(datetime(2026, 7, 4, 9, 0, 0))
    refresher = _make_refresher(
        [[make_train("1001", latitude=0.3)]],
        clock=clock,
        status_provider=_provider_marking_milton_out(),
    )

    # Sanity: the pure provider (no override) still reports Milton out for the day.
    assert refresher._status_provider.get_statuses("20260704")[LINE_CODES.MILTON] is False

    refresher.refresh()

    # After the snapshot post-step, the live train wins.
    assert refresher.get_statuses()[LINE_CODES.MILTON] is True
    assert refresher._snapshot.statuses_by_line[LINE_CODES.MILTON] is True


def test_schedule_out_stands_when_no_live_train() -> None:
    # Same Saturday schedule, but an empty feed: with no live Milton train the
    # override does not fire and the line stays dimmed.
    clock = FakeClock(datetime(2026, 7, 4, 9, 0, 0))
    refresher = _make_refresher(
        [[]],
        clock=clock,
        status_provider=_provider_marking_milton_out(),
    )
    refresher.refresh()

    assert refresher.get_states(LINE_CODES.MILTON) == []
    assert refresher.get_statuses()[LINE_CODES.MILTON] is False
