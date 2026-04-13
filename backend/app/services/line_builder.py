from shapely.geometry import Point

from app.constants import LINE_CODES, LINE_STOPS
from app.models.line import Line
from app.services.shape_manager import ShapeManager
from app.services.stop_manager import StopManager
from app.utils.geometry import shape_to_linestring

class LineBuilder:
    def __init__(self, 
                 shape_manager: ShapeManager | None = None, 
                 stop_manager: StopManager | None = None) -> None:
        self.shape_manager = shape_manager or ShapeManager()
        self.stop_manager = stop_manager or StopManager()
        self._cache: dict[tuple[LINE_CODES, str, tuple[str, ...]], Line] = {}

    def build(
        self,
        line_code: LINE_CODES,
        stop_ids: list[str] | None = None,
        shape_prefix: str | None = None,
    ) -> Line:
        """
        Returns a Line that includes all stops and its linestring.
        """
        resolved_stop_ids = stop_ids
        if resolved_stop_ids is None:
            stop_enum = LINE_STOPS[line_code]
            resolved_stop_ids = [stop.value for stop in stop_enum]

        resolved_shape_prefix = shape_prefix or resolved_stop_ids[0]
        cache_key = (line_code, resolved_shape_prefix, tuple(resolved_stop_ids))
        if cache_key in self._cache:
            return self._cache[cache_key]

        raw_stops_df = self.stop_manager.get_stops_by_ids(resolved_stop_ids)
        shape_gdf = self.shape_manager.get_shape(resolved_shape_prefix)
        if shape_gdf is None or shape_gdf.empty:
            raise ValueError(f"No shape found for line {line_code}")
        
        linestring = shape_to_linestring(shape_gdf)
        raw_stops: list[tuple[str, str, Point]] = []

        for _, row in raw_stops_df.iterrows():
            stop_point = Point(float(row["stop_lon"]), float(row["stop_lat"]))
            raw_stops.append((str(row["stop_id"]), str(row["stop_name"]), stop_point))
        
        built = Line.build(line_code = line_code,
                           linestring = linestring,
                           raw_stops = raw_stops)
        self._cache[cache_key] = built
        return built