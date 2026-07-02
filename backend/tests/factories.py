"""Builders for synthetic test geometry and payloads.

The real GTFS shape/stop files are gitignored and absent from fresh clones/CI,
so tests never read them. Instead we hand-build tiny ``Line`` objects from a
straight synthetic linestring and construct ``GoTrain`` payloads directly.
"""
from __future__ import annotations

from typing import List

from shapely.geometry import LineString, Point

from app.constants import LINE_CODES
from app.models.line import Line
from app.services.metrolinx_service import GoTrain

# A straight south->north line (coords are lon, lat) with Union at the origin.
# Three stops spaced along it are plenty for the train manager's projection.
_UNION = ("UN", "Union", Point(0.0, 0.0))
_MID = ("KP", "Kipling", Point(0.0, 0.5))
_END = ("ML", "Milton", Point(0.0, 1.0))


def build_synthetic_line(line_code: LINE_CODES = LINE_CODES.MILTON) -> Line:
    """Return a minimal, fully in-memory ``Line`` with three stops."""
    linestring = LineString([(0.0, 0.0), (0.0, 0.5), (0.0, 1.0)])
    raw_stops = [_UNION, _MID, _END]
    return Line.build(line_code=line_code, linestring=linestring, raw_stops=raw_stops)


def make_train(
    trip_number: str,
    line_code: LINE_CODES = LINE_CODES.MILTON,
    latitude: float = 0.3,
    longitude: float = 0.0,
    first_stop_code: str = "UN",
    last_stop_code: str = "ML",
    modified_date: str = "2026-07-02 08:00:00",
) -> GoTrain:
    """Build a ``GoTrain`` positioned on the synthetic line.

    In-motion trains skip the station-anchoring logic, keeping the fixture simple.
    Datetime fields are non-empty and parseable (the train manager rejects empty).
    """
    return GoTrain(
        cars="6",
        trip_number=trip_number,
        start_time="2026-07-02 07:30:00",
        end_time="2026-07-02 09:00:00",
        line_code=str(line_code.value),
        route_number="MI",
        variant_dir="1",
        display="Milton",
        latitude=latitude,
        longitude=longitude,
        is_in_motion=True,
        delay_seconds=0,
        course=0,
        first_stop_code=first_stop_code,
        last_stop_code=last_stop_code,
        prev_stop_code="",
        next_stop_code="",
        at_station_code="",
        modified_date=modified_date,
    )


def normal_payload() -> List[GoTrain]:
    """A normal cycle: two trains at different positions on the synthetic line."""
    return [
        make_train("1001", latitude=0.3),
        make_train("1002", latitude=0.7),
    ]
