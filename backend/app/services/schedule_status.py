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
from datetime import date, datetime, time, timedelta
from pathlib import Path
from typing import Callable, Dict, Optional, Set, Tuple

from app.constants import LINE_CODES

logger = logging.getLogger(__name__)

# Grace period past a line's last scheduled arrival before it is considered out
# of service. Covers late-running trains so a line is not dimmed the instant the
# timetable says its last train should have arrived.
DEFAULT_GRACE = timedelta(minutes=30)

# A modeled line's service window on a given service date, as absolute datetimes:
# (first scheduled departure, last scheduled arrival). The arrival may fall on
# the following calendar day for trips with GTFS times past 24:00.
Window = Tuple[datetime, datetime]


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
class TripWindow:
    """One trip reduced to its line, service, and time span within its service day.

    ``start``/``end`` are whole seconds from the *service date's* midnight -- the
    trip's earliest departure and latest arrival. They are deliberately allowed
    to exceed ``86400`` (24h): a GTFS ``25:10:00`` arrival is ``90600`` here and
    resolves to 01:10 on the following calendar day, which is exactly how a
    past-midnight train stays attributed to the previous service date.
    """

    line: LINE_CODES
    service_id: str
    start: int
    end: int


@dataclass(frozen=True)
class ScheduleData:
    """An in-memory view of the schedule, already resolved to line codes.

    ``trips_by_service`` maps a service_id to the set of lines that have at least
    one trip on that service. Resolving route->line in the loader keeps this
    structure trivial to hand-build in tests (no ``routes.txt`` needed).

    ``trip_windows`` carries the per-trip time spans (from ``stop_times.txt``)
    needed to derive each line's daily service window. It is optional: when empty
    (e.g. #26-era data, or a feed whose stop_times could not be read) the provider
    falls back to the "any trip today" rule and never time-dims a line.
    """

    calendar: Tuple[CalendarService, ...] = ()
    exceptions: Tuple[CalendarException, ...] = ()
    trips_by_service: Dict[str, Set[LINE_CODES]] = field(default_factory=dict)
    trip_windows: Tuple[TripWindow, ...] = ()

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

    def service_windows(self, day: date) -> Dict[LINE_CODES, Window]:
        """Per-line ``(first departure, last arrival)`` for ``day``'s service.

        A pure function of this data and the service date: anchors each active
        trip's second-offsets to ``day``'s midnight and folds them per line into a
        single span. Lines with no trip windows on ``day`` are simply absent from
        the result. Offsets past 86400s naturally roll the arrival into the next
        calendar day, so a ``25:10`` trip's window closes at 01:10 the day after.
        """
        active = self.active_service_ids(day)
        midnight = datetime.combine(day, time.min)
        windows: Dict[LINE_CODES, Window] = {}
        for trip in self.trip_windows:
            if trip.service_id not in active:
                continue
            start = midnight + timedelta(seconds=trip.start)
            end = midnight + timedelta(seconds=trip.end)
            current = windows.get(trip.line)
            if current is None:
                windows[trip.line] = (start, end)
            else:
                windows[trip.line] = (min(current[0], start), max(current[1], end))
        return windows


# Real GTFS files live alongside the stops/shapes the other managers read.
_RAW_DIR = Path(__file__).parent.parent / "data" / "gtfs" / "raw" / "GO-GTFS"


# Sentinel cached for a service date whose schedule could not be resolved (load
# error, unparseable/absent date, no usable trips). Its presence in the cache
# means "fail open for this date" and, crucially, that the heavy scan already ran
# and must not run again this date -- the fail-open path is memoized too.
_FAIL_OPEN = object()


@dataclass(frozen=True)
class _DateEntry:
    """The once-per-service-date, clock-independent scan result.

    Everything here is derived from a *single* loader call. ``yesterday_windows``
    come from the same loaded extract as ``today_windows`` (the extract is
    date-independent), so consulting yesterday around midnight costs no extra
    schedule scan. ``running_today`` backs the #26 fallback for lines that run
    today but carry no usable window timing.
    """

    today_windows: Dict[LINE_CODES, Window]
    yesterday_windows: Dict[LINE_CODES, Window]
    running_today: Set[LINE_CODES]


class ScheduleStatusProvider:
    """Per-line in/out-of-service status, split into two cleanly separated halves.

    * **Heavy, cached, pure per service date** -- :meth:`_entry_for` runs the
      schedule scan (including the large ``stop_times`` reduction) at most once
      per ``YYYYMMDD`` and memoizes a :class:`_DateEntry` of precomputed windows.
    * **Cheap, clock-dependent, per call** -- :meth:`get_statuses` turns those
      windows into a live ``{line: is_in_service}`` map for the current instant,
      considering both today's and yesterday's windows so a past-midnight train
      keeps its line lit until that trip's window (plus grace) truly closes.

    The live-train override is deliberately *not* here: it depends on runtime
    train state, so the ``DataRefresher`` applies it as a cheap post-step when
    building the snapshot, keeping this per-date scan pure and cacheable.
    """

    def __init__(
        self,
        loader: Callable[[], Optional[ScheduleData]] | None = None,
        now: Callable[[], datetime] = datetime.now,
        grace: timedelta = DEFAULT_GRACE,
    ) -> None:
        # Loader is an injection seam: tests pass a fake returning hand-built
        # ScheduleData (and can count calls to prove the once-per-date scan).
        self._loader = loader if loader is not None else load_gtfs_schedule
        self._now = now
        self._grace = grace
        self._cache: Dict[str, object] = {}

    def get_statuses(self, service_date: str | None = None) -> Dict[LINE_CODES, bool]:
        """Return ``{line: is_in_service}`` for the current instant.

        ``service_date`` defaults to today's date from the injected clock. The
        per-date window scan is memoized (at most once per service date); the
        status itself is recomputed each call from the injected clock, so a line
        flips out of service as the day's last train (plus grace) passes without
        any new scan. Fails open (all lines in service) on any error/missing data.
        """
        now = self._now()
        if service_date is None:
            service_date = now.strftime("%Y%m%d")

        entry = self._entry_for(service_date)
        if entry is _FAIL_OPEN:
            return self._all_in_service()
        assert isinstance(entry, _DateEntry)

        return {
            code: self._line_in_service(code, entry, now) for code in LINE_CODES
        }

    def _line_in_service(
        self, code: LINE_CODES, entry: _DateEntry, now: datetime
    ) -> bool:
        # In service if the current instant sits inside today's window or, around
        # midnight, still inside yesterday's window (a past-24:00 train).
        if self._within(entry.today_windows.get(code), now) or self._within(
            entry.yesterday_windows.get(code), now
        ):
            return True
        # Fail open: scheduled to run today but no usable window timing (the #26
        # "any trip today" case, or a line whose stop_times could not be read) ->
        # never time-dim it. A line with real window timing that has closed for
        # the day, or one with no trips at all today, is out of service.
        if code in entry.running_today and entry.today_windows.get(code) is None:
            return True
        return False

    def _within(self, window: Optional[Window], now: datetime) -> bool:
        if window is None:
            return False
        start, end = window
        return start <= now <= end + self._grace

    def _entry_for(self, service_date: str) -> object:
        cached = self._cache.get(service_date)
        if cached is not None:
            return cached
        entry = self._compute_entry(service_date)
        # Cache even the fail-open sentinel so a persistent data problem (or a
        # legitimately absent date) is scanned at most once per service date.
        self._cache[service_date] = entry
        return entry

    def _compute_entry(self, service_date: str) -> object:
        try:
            day = datetime.strptime(service_date, "%Y%m%d").date()
        except ValueError:
            logger.warning("Unparseable service date %r; failing open.", service_date)
            return _FAIL_OPEN

        try:
            data = self._loader()
        except Exception as exc:  # noqa: BLE001 -- any load failure fails open.
            logger.warning("Schedule load failed (%s); failing open.", exc)
            return _FAIL_OPEN

        if data is None or not data.trips_by_service:
            # No usable trips (missing files, unmapped routes): fail open rather
            # than dim every line on a mapping/parse problem.
            return _FAIL_OPEN

        if not data.covers(day):
            # Service date absent from the extract (stale download): fail open.
            logger.warning("Service date %s absent from GTFS extract; failing open.", service_date)
            return _FAIL_OPEN

        # Both windows come from this single loaded extract; yesterday's is needed
        # only to keep a past-midnight train's line lit and never triggers its own
        # scan.
        return _DateEntry(
            today_windows=data.service_windows(day),
            yesterday_windows=data.service_windows(day - timedelta(days=1)),
            running_today=data.running_line_codes(day),
        )

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


def _gtfs_time_to_seconds(value: object) -> Optional[int]:
    """Parse a GTFS ``HH:MM:SS`` time to seconds-from-service-midnight, or ``None``.

    GTFS deliberately allows hours >= 24 to express trips past midnight on the
    same service day (``25:10:00`` is 01:10 the next calendar day). Naive
    ``%H:%M:%S`` parsing rejects those, so this computes the offset arithmetically
    and only guards the minute/second fields. Anything malformed returns ``None``
    (the trip contributes no window bound rather than a wrong one).
    """
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    parts = text.split(":")
    if len(parts) != 3:
        return None
    try:
        hours, minutes, seconds = (int(part) for part in parts)
    except ValueError:
        return None
    if hours < 0 or not (0 <= minutes < 60) or not (0 <= seconds < 60):
        return None
    return hours * 3600 + minutes * 60 + seconds


def _load_trip_windows(
    path: Path, trip_line_service: Dict[str, Tuple[LINE_CODES, str]]
) -> Tuple[TripWindow, ...]:
    """Reduce ``stop_times.txt`` to one time span per modeled trip, lenient/fail-open.

    Reads only the three columns needed, maps each time through
    :func:`_gtfs_time_to_seconds` (so >= 24:00 is handled), and folds per trip to
    ``(earliest departure, latest arrival)``. Any absence or parse failure yields
    an empty tuple: the provider then falls back to the "any trip today" rule and
    never time-dims a line -- exactly the fail-open discipline #26 established.
    """
    if not path.exists() or not trip_line_service:
        return ()

    import pandas as pd

    try:
        wanted = {"trip_id", "arrival_time", "departure_time"}
        df = pd.read_csv(
            path, dtype=str, usecols=lambda c: c in wanted
        ).fillna("")
        if "trip_id" not in df.columns:
            return ()

        arrival = df.get("arrival_time")
        departure = df.get("departure_time")
        arr_secs = arrival.map(_gtfs_time_to_seconds) if arrival is not None else None
        dep_secs = departure.map(_gtfs_time_to_seconds) if departure is not None else None

        # start basis = departure (fall back to arrival); end basis = arrival
        # (fall back to departure) so a row missing one time still contributes.
        if dep_secs is None:
            start_basis = arr_secs
        elif arr_secs is None:
            start_basis = dep_secs
        else:
            start_basis = dep_secs.where(dep_secs.notna(), arr_secs)
        if arr_secs is None:
            end_basis = dep_secs
        elif dep_secs is None:
            end_basis = arr_secs
        else:
            end_basis = arr_secs.where(arr_secs.notna(), dep_secs)

        if start_basis is None or end_basis is None:
            return ()

        frame = pd.DataFrame(
            {"trip_id": df["trip_id"].astype(str).str.strip(),
             "_start": start_basis, "_end": end_basis}
        ).dropna(subset=["_start", "_end"], how="all")
        grouped = frame.groupby("trip_id")
        starts = grouped["_start"].min()
        ends = grouped["_end"].max()

        windows: list[TripWindow] = []
        for trip_id, (line_code, service_id) in trip_line_service.items():
            start = starts.get(trip_id)
            end = ends.get(trip_id)
            if start is None or end is None or pd.isna(start) or pd.isna(end):
                continue
            windows.append(
                TripWindow(
                    line=line_code,
                    service_id=service_id,
                    start=int(start),
                    end=int(end),
                )
            )
        return tuple(windows)
    except Exception as exc:  # noqa: BLE001 -- any parse failure fails open.
        logger.warning("Failed to parse stop_times at %s (%s); windows unavailable.", path, exc)
        return ()


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
        # trip_id -> (line, service_id) for trips on modeled lines, used to attach
        # the stop_times time span to a line and service date.
        trip_line_service: Dict[str, Tuple[LINE_CODES, str]] = {}
        for _, row in trips_df.iterrows():
            route_id = str(row["route_id"]).strip()
            line_code = route_line.get(route_id)
            if line_code is None:
                continue
            service_id = str(row["service_id"]).strip()
            trips_by_service.setdefault(service_id, set()).add(line_code)
            trip_id = str(row.get("trip_id", "")).strip()
            if trip_id:
                trip_line_service[trip_id] = (line_code, service_id)

        trip_windows = _load_trip_windows(directory / "stop_times.txt", trip_line_service)

        return ScheduleData(
            calendar=tuple(calendar),
            exceptions=tuple(exceptions),
            trips_by_service=trips_by_service,
            trip_windows=trip_windows,
        )
    except Exception as exc:  # noqa: BLE001 -- any parse failure fails open.
        logger.warning("Failed to parse GTFS schedule at %s (%s); failing open.", directory, exc)
        return None
