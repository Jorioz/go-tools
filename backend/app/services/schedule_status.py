"""Per-line scheduled-service status from the static GTFS extract (issue #26).

Answers one question per service day: does each GO line have *any* trip
scheduled today? A line with zero scheduled trips (e.g. Milton or Richmond Hill
on a weekend) is reported ``out of service`` so the map can dim it; every other
line is ``in service``.

Design notes
------------
* **Memoized per service date.** The schedule scan is pure for a given day, so
  the result is cached by ``YYYYMMDD`` and computed at most once per service
  date -- never per request or per refresh cycle.
* **Injected clock.** ``now`` mirrors the ``DataRefresher``/``TrainManager``
  seam so tests drive the service date with a ``FakeClock`` instead of the wall
  clock.
* **Fail open, always.** A line is *never* wrongly dimmed on missing/unreadable
  data. If the schedule can't be loaded, the service date is absent from the
  extract (a stale download), the date is unparseable, or the route->line
  mapping produced nothing usable, EVERY line reports in service.

The heavy lifting is split so tests never touch real GTFS files:

* :class:`ScheduleData` is a tiny in-memory view (calendar rows, calendar-date
  exceptions, and trips already resolved to ``LINE_CODES``). Tests build it by
  hand; the real-file loader lives in :func:`load_gtfs_schedule`.
* :class:`ScheduleStatusProvider` turns a service date into the per-line map and
  owns the memoization + fail-open policy.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Callable, Dict, Optional, Set, Tuple

from app.constants import LINE_CODES

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class CalendarService:
    """A ``calendar.txt`` row: a service_id running on given weekdays over a span."""

    service_id: str
    # Monday..Sunday, matching ``date.weekday()`` (0 = Monday).
    weekdays: Tuple[bool, bool, bool, bool, bool, bool, bool]
    start_date: date
    end_date: date

    def runs_on(self, day: date) -> bool:
        return self.start_date <= day <= self.end_date and self.weekdays[day.weekday()]


@dataclass(frozen=True)
class CalendarException:
    """A ``calendar_dates.txt`` row: add (type 1) or remove (type 2) a service on a date."""

    service_id: str
    day: date
    added: bool


@dataclass(frozen=True)
class ScheduleData:
    """An in-memory view of the schedule, already resolved to line codes.

    ``trips_by_service`` maps a service_id to the set of lines that have at least
    one trip on that service. Resolving route->line in the loader keeps this
    structure trivial to hand-build in tests (no ``routes.txt`` needed).
    """

    calendar: Tuple[CalendarService, ...] = ()
    exceptions: Tuple[CalendarException, ...] = ()
    trips_by_service: Dict[str, Set[LINE_CODES]] = field(default_factory=dict)

    def covers(self, day: date) -> bool:
        """Whether the extract has any schedule information for ``day`` at all.

        A date outside every calendar span with no calendar-date exception is
        treated as absent from the extract (a stale download) -- the caller then
        fails open rather than dimming every line.
        """
        if any(service.start_date <= day <= service.end_date for service in self.calendar):
            return True
        return any(exc.day == day for exc in self.exceptions)

    def active_service_ids(self, day: date) -> Set[str]:
        active = {service.service_id for service in self.calendar if service.runs_on(day)}
        # calendar_dates overrides calendar for that specific date.
        for exc in self.exceptions:
            if exc.day != day:
                continue
            if exc.added:
                active.add(exc.service_id)
            else:
                active.discard(exc.service_id)
        return active

    def running_line_codes(self, day: date) -> Set[LINE_CODES]:
        running: Set[LINE_CODES] = set()
        for service_id in self.active_service_ids(day):
            running |= self.trips_by_service.get(service_id, set())
        return running


# Real GTFS files live alongside the stops/shapes the other managers read.
_RAW_DIR = Path(__file__).parent.parent / "data" / "gtfs" / "raw" / "GO-GTFS"


class ScheduleStatusProvider:
    """Computes and memoizes the per-line in/out-of-service map per service date."""

    def __init__(
        self,
        loader: Callable[[], Optional[ScheduleData]] | None = None,
        now: Callable[[], datetime] = datetime.now,
    ) -> None:
        # Loader is an injection seam: tests pass a fake returning hand-built
        # ScheduleData (and can count calls to prove the once-per-date scan).
        self._loader = loader if loader is not None else load_gtfs_schedule
        self._now = now
        self._cache: Dict[str, Dict[LINE_CODES, bool]] = {}

    def get_statuses(self, service_date: str | None = None) -> Dict[LINE_CODES, bool]:
        """Return ``{line: is_in_service}`` for the given ``YYYYMMDD`` service date.

        Defaults to today's service date from the injected clock. Memoized: the
        underlying scan runs at most once per service date. Fails open (all lines
        in service) on any error or missing data.
        """
        if service_date is None:
            service_date = self._now().strftime("%Y%m%d")

        cached = self._cache.get(service_date)
        if cached is not None:
            return dict(cached)

        result = self._compute(service_date)
        # Cache even the fail-open result so a persistent data problem is scanned
        # at most once per service date rather than every refresh cycle.
        self._cache[service_date] = result
        return dict(result)

    def _compute(self, service_date: str) -> Dict[LINE_CODES, bool]:
        try:
            day = datetime.strptime(service_date, "%Y%m%d").date()
        except ValueError:
            logger.warning("Unparseable service date %r; failing open.", service_date)
            return self._all_in_service()

        try:
            data = self._loader()
        except Exception as exc:  # noqa: BLE001 -- any load failure fails open.
            logger.warning("Schedule load failed (%s); failing open.", exc)
            return self._all_in_service()

        if data is None or not data.trips_by_service:
            # No usable trips (missing files, unmapped routes): fail open rather
            # than dim every line on a mapping/parse problem.
            return self._all_in_service()

        if not data.covers(day):
            # Service date absent from the extract (stale download): fail open.
            logger.warning("Service date %s absent from GTFS extract; failing open.", service_date)
            return self._all_in_service()

        running = data.running_line_codes(day)
        return {code: code in running for code in LINE_CODES}

    @staticmethod
    def _all_in_service() -> Dict[LINE_CODES, bool]:
        return {code: True for code in LINE_CODES}


def _resolve_line_code(short_name: str, long_name: str) -> LINE_CODES | None:
    """Map a GTFS route to a modeled line, or ``None`` if it isn't one of ours.

    Tries the route's short name against the internal line codes first, then
    falls back to keyword-matching the long name. Unmatched routes (buses, UP
    Express, unfamiliar naming) resolve to ``None`` and are simply ignored.
    """
    code = (short_name or "").strip().upper()
    for line_code in LINE_CODES:
        if code == line_code.value:
            return line_code

    long_lower = (long_name or "").strip().lower()
    keyword_map = {
        "lakeshore west": LINE_CODES.LAKESHORE_WEST,
        "lakeshore east": LINE_CODES.LAKESHORE_EAST,
        "milton": LINE_CODES.MILTON,
        "kitchener": LINE_CODES.KITCHENER,
        "georgetown": LINE_CODES.KITCHENER,
        "barrie": LINE_CODES.BARRIE,
        "richmond hill": LINE_CODES.RICHMOND_HILL,
        "stouffville": LINE_CODES.STOUFFVILLE,
    }
    for keyword, line_code in keyword_map.items():
        if keyword in long_lower:
            return line_code
    return None


def load_gtfs_schedule(raw_dir: Path | None = None) -> Optional[ScheduleData]:
    """Load calendar/calendar_dates/trips/routes from the static GTFS extract.

    Returns ``None`` (fail open) when the files are absent -- the extract is
    gitignored and missing from fresh clones/CI, present only in a real
    deployment. Raises nothing the caller cares about: any parse failure is
    caught here and surfaced as ``None`` so the provider fails open.
    """
    import pandas as pd

    directory = raw_dir if raw_dir is not None else _RAW_DIR
    calendar_path = directory / "calendar.txt"
    calendar_dates_path = directory / "calendar_dates.txt"
    trips_path = directory / "trips.txt"
    routes_path = directory / "routes.txt"

    # trips + routes are required to know what runs; calendar/calendar_dates can
    # each be absent in a valid feed (a feed may use only one of the two).
    if not trips_path.exists() or not routes_path.exists():
        logger.info("GTFS trips/routes not present at %s; schedule status fails open.", directory)
        return None

    try:
        def _parse_date(value: str) -> date:
            return datetime.strptime(str(value).strip(), "%Y%m%d").date()

        calendar: list[CalendarService] = []
        if calendar_path.exists():
            cal_df = pd.read_csv(calendar_path, dtype=str).fillna("")
            for _, row in cal_df.iterrows():
                calendar.append(
                    CalendarService(
                        service_id=str(row["service_id"]).strip(),
                        weekdays=(
                            str(row.get("monday", "0")).strip() == "1",
                            str(row.get("tuesday", "0")).strip() == "1",
                            str(row.get("wednesday", "0")).strip() == "1",
                            str(row.get("thursday", "0")).strip() == "1",
                            str(row.get("friday", "0")).strip() == "1",
                            str(row.get("saturday", "0")).strip() == "1",
                            str(row.get("sunday", "0")).strip() == "1",
                        ),
                        start_date=_parse_date(row["start_date"]),
                        end_date=_parse_date(row["end_date"]),
                    )
                )

        exceptions: list[CalendarException] = []
        if calendar_dates_path.exists():
            cd_df = pd.read_csv(calendar_dates_path, dtype=str).fillna("")
            for _, row in cd_df.iterrows():
                exceptions.append(
                    CalendarException(
                        service_id=str(row["service_id"]).strip(),
                        day=_parse_date(row["date"]),
                        added=str(row["exception_type"]).strip() == "1",
                    )
                )

        routes_df = pd.read_csv(routes_path, dtype=str).fillna("")
        route_line: Dict[str, LINE_CODES] = {}
        for _, row in routes_df.iterrows():
            line_code = _resolve_line_code(
                row.get("route_short_name", ""),
                row.get("route_long_name", ""),
            )
            if line_code is not None:
                route_line[str(row["route_id"]).strip()] = line_code

        trips_df = pd.read_csv(trips_path, dtype=str).fillna("")
        trips_by_service: Dict[str, Set[LINE_CODES]] = {}
        for _, row in trips_df.iterrows():
            route_id = str(row["route_id"]).strip()
            line_code = route_line.get(route_id)
            if line_code is None:
                continue
            service_id = str(row["service_id"]).strip()
            trips_by_service.setdefault(service_id, set()).add(line_code)

        return ScheduleData(
            calendar=tuple(calendar),
            exceptions=tuple(exceptions),
            trips_by_service=trips_by_service,
        )
    except Exception as exc:  # noqa: BLE001 -- any parse failure fails open.
        logger.warning("Failed to parse GTFS schedule at %s (%s); failing open.", directory, exc)
        return None
