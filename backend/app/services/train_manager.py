import logging
from enum import Enum
from datetime import datetime
from shapely import Point
from dataclasses import dataclass, replace

from app.services.metrolinx_service import GoTrain, MetrolinxFeedError
from app.utils.geometry import progress_between_points
from app.constants import LINE_CODES
from app.models.line import Line, LineStop


logger = logging.getLogger(__name__)


class NoTrainsMappedError(MetrolinxFeedError):
    """Raised when a non-empty feed maps zero trains yet at least one record hit a
    Class B mapping error (parse/geometry failure).

    This is the schema-drift guard: if a Metrolinx envelope change breaks the
    mapping of every record, the cycle would otherwise look like a legitimate "no
    trains running" and silently empty the served cache. Subclassing
    ``MetrolinxFeedError`` lets ``DataRefresher`` treat such a cycle exactly like a
    feed outage -- keep the previous snapshot, do not advance ``last_updated`` --
    while remaining a distinct type the refresher can catch precisely.

    A non-empty feed of *only* unknown line codes (zero mapped, zero Class B
    errors) is NOT this error: unmodeled services are a successful empty cycle.
    """


class Direction(Enum):
    TO_UNION = 0
    FROM_UNION = 1

# Frozen so a published state object can never be mutated after a reader holds
# it: updates go through dataclasses.replace() to produce a fresh object, which
# rules out torn reads (e.g. a new latitude paired with an old progress) at the
# type level.
@dataclass(frozen=True)
class TrainState:
    #static
    trip_number: str
    line_code: LINE_CODES
    direction: Direction
    first_stop_code: str
    last_stop_code: str
    start_time: datetime
    end_time: datetime

    #dynamic
    prev_stop_code: str 
    next_stop_code: str
    latitude: float
    longitude: float
    progress: float
    in_motion: bool
    modified_date: datetime
    stopped_at_stop_code: str

class TrainManager:
    def __init__(self, line_contexts: dict[LINE_CODES, Line], lw_route_contexts: dict[str, Line] | None = None)-> None:
        self.line_contexts = line_contexts
        self.lw_route_contexts = lw_route_contexts or {}
        self.states: dict[str, TrainState] = {}
        self._ttl_ms = 120000
        # Unknown line codes (e.g. UP Express reporting as "UP") appear every
        # cycle forever, so we log each one only on its first sighting for the
        # lifetime of this manager -- per-cycle repetition would just train people
        # to ignore warnings.
        self._unknown_line_codes_seen: set[str] = set()

    def upsert_many(self, trains: list[GoTrain]) -> None:
        now = datetime.now()
        prev_states = dict(self.states)
        found_trip_numbers = {train.trip_number for train in trains if train.trip_number}

        self.states = {}
        # Per-record isolation: one bad record must never abort the whole cycle.
        # Two failure classes, handled differently:
        #   * Class A -- unknown line code (deliberately unmodeled service): skip,
        #     logged once per code (see _note_unknown_line_code).
        #   * Class B -- any other error raised while mapping (parse/geometry):
        #     skip, warn per occurrence with the trip number.
        class_b_errors = 0
        for train in trains:
            if not self._is_known_line_code(train.line_code):
                self._note_unknown_line_code(train.line_code)
                continue
            try:
                self._upsert_one(train)
            except Exception as exc:
                class_b_errors += 1
                logger.warning(
                    "Skipping trip %s due to mapping error: %s",
                    train.trip_number,
                    exc,
                )

        # Escalation guard against schema drift: a non-empty feed that mapped zero
        # trains *because* records failed to map (at least one Class B error) is a
        # failed cycle, not "no trains running". Fail loudly so DataRefresher keeps
        # the previous snapshot instead of emptying the served cache. Unknown-code
        # skips do NOT count -- a feed of only unmodeled services is a legitimate
        # empty success. len(self.states) here is exactly this cycle's live map
        # count (states was reset above; missing-trip re-adds happen below).
        if trains and len(self.states) == 0 and class_b_errors > 0:
            raise NoTrainsMappedError(
                f"Feed delivered {len(trains)} trip(s) but mapped 0 trains with "
                f"{class_b_errors} mapping error(s); treating cycle as failed."
            )

        missing_trip_numbers = set(prev_states.keys()) - found_trip_numbers
        for trip_number in missing_trip_numbers:
            state = prev_states[trip_number]
            # verify that missing train could have finished its route, or warn if no longer getting update
            if not self._is_completed_state(state) and not self._is_implied_completed(state):
                print(f"WARNING - Missing trip: {trip_number} on new cycle. State not updated.")
                continue
            
            completed_state = self._get_completed_state(state)
            if self._age_ms(completed_state.modified_date, now) <= self._ttl_ms:
                self.states[trip_number] = completed_state

    def _init_state(self, train: GoTrain, line_code: LINE_CODES, direction: Direction, prev_stop_code: str, next_stop_code: str, progress: float, stopped_at_stop_code: str) -> TrainState:
        return TrainState(
            trip_number = train.trip_number,
            line_code = line_code,
            direction = direction,
            first_stop_code = train.first_stop_code,
            last_stop_code = train.last_stop_code,
            start_time = self._parse_datetime(train.start_time),
            end_time = self._parse_datetime(train.end_time),
            prev_stop_code = prev_stop_code,
            next_stop_code = next_stop_code,
            latitude = float(train.latitude),
            longitude = float(train.longitude),
            progress = progress,
            in_motion = bool(train.is_in_motion),
            modified_date = self._parse_datetime(train.modified_date),
            stopped_at_stop_code = stopped_at_stop_code
        )

    def _update_state(self, state: TrainState, prev_stop_code: str, next_stop_code: str, latitude: float, longitude: float, progress: float, in_motion: bool, modified_date: str, stopped_at_stop_code: str) -> TrainState:
        # Copy-on-write: return a fresh TrainState rather than mutating the one
        # passed in, which may still be reachable by an API reader serializing it.
        return replace(
            state,
            prev_stop_code=prev_stop_code,
            next_stop_code=next_stop_code,
            latitude=latitude,
            longitude=longitude,
            progress=progress,
            in_motion=in_motion,
            modified_date=self._parse_datetime(modified_date),
            stopped_at_stop_code=stopped_at_stop_code,
        )

    def _is_known_line_code(self, line_code: str) -> bool:
        try:
            LINE_CODES(line_code)
        except ValueError:
            return False
        return True

    def _note_unknown_line_code(self, line_code: str) -> None:
        if line_code in self._unknown_line_codes_seen:
            return
        self._unknown_line_codes_seen.add(line_code)
        logger.warning("Ignoring unsupported line code %s", line_code)

    def _upsert_one(self, train: GoTrain) -> None:
        line_code = LINE_CODES(train.line_code)
        line = self._resolve_line_context(train, line_code)
        if line is None:
            return
        direction = self._get_direction(train.first_stop_code)
        existing = self.states.get(train.trip_number)

        train_point = Point(float(train.longitude), float(train.latitude))
        projected = line.linestring.interpolate(line.linestring.project(train_point))
        train_dist = line.linestring.project(projected)
        is_in_motion = bool(train.is_in_motion)
        anchored_prev_stop, anchored_next_stop = self._anchor_train_pos(train.at_station_code, direction, line.stops) if not is_in_motion else (None, None)
        anchored_stop_code = ""
        if anchored_prev_stop and anchored_next_stop:
            anchored_stop_code = anchored_prev_stop.stop_id if direction == Direction.FROM_UNION else anchored_next_stop.stop_id
        stopped_at_stop_code = self._get_stopped_at_stop_code(
            line,
            train_dist,
            in_motion=is_in_motion,
            at_station_code=train.at_station_code,
            anchored_stop_code=anchored_stop_code,
        )
        
        resolved_anchor_stop_code = train.at_station_code
        if not is_in_motion and not resolved_anchor_stop_code and stopped_at_stop_code:
            resolved_anchor_stop_code = stopped_at_stop_code

        prev_stop, next_stop = self._find_prev_next(
            line,
            train_dist,
            direction,
            at_station_code=resolved_anchor_stop_code,
            in_motion=is_in_motion,
            existing_state=existing,
        )

        progress = 0.0
        if prev_stop is not None and next_stop is not None:
            progress = progress_between_points(
                station_next = next_stop.point,
                station_prev = prev_stop.point,
                train_pos = projected,
                lineshape = line.linestring
            )

        stopped_at_stop_code = self._reconcile_stopped_at_stop_code(
            in_motion=is_in_motion,
            stopped_at_stop_code=stopped_at_stop_code,
            prev_stop=prev_stop,
            next_stop=next_stop,
            progress=progress,
        )

        
        prev_stop_code = prev_stop.stop_id if prev_stop else ""
        next_stop_code = next_stop.stop_id if next_stop else ""

        if existing is None:
            existing = self._init_state(
                train = train,
                line_code = line_code,
                direction = direction,
                prev_stop_code = prev_stop_code,
                next_stop_code = next_stop_code,
                progress = progress,
                stopped_at_stop_code = stopped_at_stop_code
            )
        else:
            existing = self._update_state(
                state=existing,
                prev_stop_code=prev_stop_code,
                next_stop_code=next_stop_code,
                latitude=float(train.latitude),
                longitude=float(train.longitude),
                progress=progress,
                in_motion=bool(train.is_in_motion),
                modified_date=train.modified_date,
                stopped_at_stop_code=stopped_at_stop_code,
            )

        self.states[train.trip_number] = existing

    def _resolve_line_context(self, train: GoTrain, line_code: LINE_CODES) -> Line | None:
        default_line = self.line_contexts.get(line_code)
        if line_code != LINE_CODES.LAKESHORE_WEST:
            return default_line

        is_hamilton_variant = train.first_stop_code == "HA" or train.last_stop_code == "HA"
        if is_hamilton_variant:
            return self.lw_route_contexts.get("extension") or default_line
        return self.lw_route_contexts.get("normal") or default_line
    
    def _is_implied_completed(self, state: TrainState) -> bool:
        threshold = 0.95 
        if state.stopped_at_stop_code == state.last_stop_code:
            return True
        
        is_approaching_dest = state.next_stop_code == state.last_stop_code
        return is_approaching_dest and (state.progress >= threshold)

    def _get_completed_state(self, state: TrainState) -> TrainState:
        # Copy-on-write: `state` here is a *previous-cycle* object still reachable
        # by readers via the prior snapshot, so we must not mutate it. Build a
        # fresh completed state instead.
        modified_date = state.modified_date
        if not self._is_completed_state(state):
            modified_date = datetime.now() # capture modified date one final time
        return replace(
            state,
            prev_stop_code=state.last_stop_code,
            next_stop_code=state.last_stop_code,
            progress=1.0,
            in_motion=False,
            stopped_at_stop_code=state.last_stop_code,
            modified_date=modified_date,
        )
    
    def _is_completed_state(self, state: TrainState) -> bool:
        return (
            state.prev_stop_code == state.last_stop_code
            and state.next_stop_code == state.last_stop_code
            and state.progress == 1.0
            and not state.in_motion
            and state.stopped_at_stop_code == state.last_stop_code
        )
    
    def _find_prev_next(
        self,
        line: Line,
        train_dist: float,
        direction: Direction,
        at_station_code: str = "",
        in_motion: bool = True,
        existing_state: TrainState | None = None,
    ):  
        segment_tolerance = 0.0001
        stops = line.stops
        if not stops:
            return None, None

        anchored_prev_stop, anchored_next_stop = self._anchor_train_pos(at_station_code, direction, stops) if not in_motion and at_station_code else (None, None)
        if anchored_prev_stop and anchored_next_stop:
            return anchored_prev_stop, anchored_next_stop

        kept_prev_stop, kept_next_stop = self._try_keep_segment(existing_state, line, train_dist, segment_tolerance, direction)
        if kept_prev_stop and kept_next_stop:
            return kept_prev_stop, kept_next_stop

        return self._find_prev_next_by_distance(stops, train_dist, direction)
    
    def _anchor_train_pos(self, at_station_code: str, direction: Direction, stops: tuple[LineStop, ...]):
        for _, stop in enumerate(stops):
            if stop.stop_id == at_station_code:
                return self._find_prev_next_by_distance(stops, stop.distance_on_line, direction)
        return None, None
    
    def _try_keep_segment(self, existing_state: TrainState | None, line: Line, train_dist: float, segment_tolerance: float, direction: Direction):
        if not existing_state or not existing_state.prev_stop_code or not existing_state.next_stop_code:
            return None, None

        prev_stop = line.stops_by_id.get(existing_state.prev_stop_code)
        next_stop = line.stops_by_id.get(existing_state.next_stop_code)
        if not prev_stop or not next_stop:
            return None, None

        low = min(prev_stop.distance_on_line, next_stop.distance_on_line)
        high = max(prev_stop.distance_on_line, next_stop.distance_on_line)
        if low - segment_tolerance <= train_dist <= high + segment_tolerance:
            return prev_stop, next_stop

        if direction == Direction.FROM_UNION and train_dist > high + segment_tolerance:
            return prev_stop, next_stop

        if direction == Direction.TO_UNION and train_dist < low - segment_tolerance:
            return prev_stop, next_stop

        return None, None

    def _find_prev_next_by_distance(self, stops: tuple[LineStop, ...], train_dist: float, direction: Direction):
        if not stops:
            return None, None

        if len(stops) == 1:
            only_stop = stops[0]
            return only_stop, only_stop

        if direction == Direction.FROM_UNION:
            prev_candidates = [s for s in stops if s.distance_on_line >= train_dist]
            next_candidates = [s for s in stops if s.distance_on_line < train_dist]
            if not prev_candidates:
                return stops[-1], stops[-2]
            if not next_candidates:
                return stops[0], stops[1]
            prev_stop = prev_candidates[0]
            next_stop = next_candidates[-1]
            return prev_stop, next_stop

        prev_candidates = [s for s in stops if s.distance_on_line <= train_dist]
        next_candidates = [s for s in stops if s.distance_on_line > train_dist]
        if not prev_candidates:
            return stops[0], stops[1]
        if not next_candidates:
            return stops[-2], stops[-1]
        prev_stop = prev_candidates[-1]
        next_stop = next_candidates[0]
        return prev_stop, next_stop

    def _get_stopped_at_stop_code(
        self,
        line: Line,
        train_dist: float,
        in_motion: bool,
        at_station_code: str,
        anchored_stop_code: str = "",
    ) -> str:
        proximity_threshold = 0.08
        if in_motion:
            return ""

        if anchored_stop_code:
            return anchored_stop_code

        if at_station_code and at_station_code in line.stops_by_id:
            return at_station_code

        if not line.stops:
            return ""

        nearest_stop = min(
            line.stops,
            key=lambda stop: abs(stop.distance_on_line - train_dist),
        )
        distance_to_nearest = abs(nearest_stop.distance_on_line - train_dist)

        if distance_to_nearest <= proximity_threshold:
            return nearest_stop.stop_id
        return ""

    def _reconcile_stopped_at_stop_code(self, in_motion: bool, stopped_at_stop_code: str, prev_stop: LineStop | None, next_stop: LineStop | None, progress: float) -> str:
        if in_motion or prev_stop is None or next_stop is None:
            return stopped_at_stop_code

        clamp_threshold = 0.15
        if progress <= clamp_threshold:
            return prev_stop.stop_id
        if progress >= (1.0 - clamp_threshold):
            return next_stop.stop_id

        return stopped_at_stop_code
    
    def _get_direction(self, first_stop_code) -> Direction:
        return Direction.FROM_UNION if first_stop_code == "UN" else Direction.TO_UNION
    
    def _parse_datetime(self, value: str) -> datetime:
        value = (value or "").strip()
        if not value:
            raise ValueError("Cannot parse empty datetime value")

        full_formats = ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M")
        for fmt in full_formats:
            try:
                return datetime.strptime(value, fmt)
            except ValueError:
                pass

        time_formats = ("%H:%M:%S", "%H:%M")
        for fmt in time_formats:
            try:
                parsed_time = datetime.strptime(value, fmt).time()
                return datetime.combine(datetime.now().date(), parsed_time)
            except ValueError:
                pass

        raise ValueError(f"Unsupported datetime format: {value!r}")
    
    def _age_ms(self, dt: datetime, now: datetime) -> int:
        return int((now - dt).total_seconds() * 1000)
