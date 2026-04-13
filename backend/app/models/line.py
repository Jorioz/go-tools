from shapely.geometry import LineString, Point
from dataclasses import dataclass, field
from constants import LINE_CODES

@dataclass(frozen=True)
class LineStop:
    stop_id: str
    stop_name: str
    point: Point
    distance_on_line: float

@dataclass(frozen=True)
class Line:
    line_code: LINE_CODES
    linestring: LineString
    stops: tuple[LineStop, ...]
    stops_by_id: dict[str, LineStop] = field(default_factory=dict)

    @staticmethod
    def build(line_code: LINE_CODES, linestring: LineString, raw_stops: list[tuple[str, str, Point]]) -> Line:
        hydrated: list[LineStop] = []
        for stop_id, stop_name, stop_point in raw_stops:
            stop_dist = linestring.project(stop_point)
            hydrated.append(LineStop(
                stop_id = stop_id,
                stop_name = stop_name,
                point = stop_point,
                distance_on_line = stop_dist
            ))

        hydrated.sort(key=lambda s: s.distance_on_line)
        by_id = {s.stop_id: s for s in hydrated}

        return Line(
            line_code = line_code,
            linestring = linestring,
            stops = tuple(hydrated),
            stops_by_id = by_id
        )
