from services.metrolinx_service import MetrolinxService, GoTrain
from services.shape_manager import ShapeManager
from services.stop_manager import StopManager
from pathlib import Path
from constants import LINE_CODES, LINE_STOPS
from typing import Any, Optional
from geopandas import GeoDataFrame
from pandas import DataFrame

data_dir = Path(__file__).parent.parent / "data"

class LineManager:
    def __init__(self):
        self.go_service = MetrolinxService()
        self.shape_manager = ShapeManager()
        self.stop_manager = StopManager()
        self.trains: list[GoTrain] = self.go_service.trains
        self.shapes = self.shape_manager.shapes
        self.lines = LINE_STOPS

    def get_trains_by_line(self, line_code: LINE_CODES) -> list[GoTrain]:
        return [train for train in self.trains if train.line_code == line_code]
    
    def get_line_shape(self, line_code: LINE_CODES) ->Optional[GeoDataFrame]:
        # Terminus is used to lookup a lines train track shape. (eg. MIUN (milton -> union), we use MI (Milton) for lookup)
        terminus = list(self.lines[line_code])[0].value
        return self.shape_manager.get_shape(terminus)
    
    def get_stops_for_line(self, line_code: LINE_CODES) -> DataFrame:
        stop_enum = self.lines[line_code]
        stop_ids = [stop.value for stop in stop_enum]
        return self.stop_manager.get_stops_by_ids(stop_ids)