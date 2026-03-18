from shapely.geometry import Point, LineString
from pandas import DataFrame
from geopandas import GeoDataFrame
import matplotlib.pyplot as plt

from services.line_manager import LineManager
from services.metrolinx_service import GoTrain

from constants import LINE_CODES
from utils.geometry import shape_to_linestring, project_point_onto_linestring
from typing import Optional


class Line:
    def __init__(self, line_code: LINE_CODES, line_manager: LineManager):
        self.line_code: LINE_CODES = line_code
        self.raw_trains: list[GoTrain] = line_manager.get_trains_by_line(line_code)
        self.raw_shape: GeoDataFrame | None = line_manager.get_line_shape(line_code)
        self.raw_stops: DataFrame = line_manager.get_stops_for_line(line_code)
        
        if self.raw_shape is None or self.raw_shape.empty:
            raise ValueError(f"No shape found for line {line_code}")
        
        self.linestring: LineString = shape_to_linestring(self.raw_shape)
        self.stops = self._build_stops()
        self.trains = self._build_trains()
        
    def _build_stops(self) -> list[dict]:
        hydrated: list[dict] = []
        for _, stop in self.raw_stops.iterrows():
            raw_point = Point(float(stop["stop_lon"]), float(stop["stop_lat"]))
            projected_point = project_point_onto_linestring(raw_point, self.linestring)
            hydrated.append({
                "stop_id": stop["stop_id"],
                "stop_name": stop["stop_name"],
                "raw_point": raw_point,
                "projected_point": projected_point,
            })
        return hydrated
        
    def _build_trains(self) -> list[dict]:
        hydrated: list[dict] = []
        for train in self.raw_trains:
            raw_point = Point(float(train.longitude), float(train.latitude))
            projected_point = project_point_onto_linestring(raw_point, self.linestring)

            route_variant = None
            if self.line_code == LINE_CODES.LAKESHORE_WEST:
                route_variant = self._classify_route(train)

            hydrated.append({
                "train": train,
                "raw_point": raw_point,
                "projected_point": projected_point,
                "route_variant": route_variant,
            })
        return hydrated
    
    def _classify_route(self, train: GoTrain) -> str:
        if train.last_stop_code == "HA":
            return "short"
        else:
            return "full"
    
    def plot(self, show_raw: bool = False) -> None:
        fig, ax = plt.subplots(figsize=(10, 8))

        x_line, y_line = self.linestring.xy
        ax.plot(x_line, y_line, color="black", linewidth=2, label="Line shape")

        stop_x = [s["projected_point"].x for s in self.stops]
        stop_y = [s["projected_point"].y for s in self.stops]
        ax.scatter(stop_x, stop_y, color="tab:blue", s=40, label="Stations", zorder=3)

        for s in self.stops:
            ax.text(
                s["projected_point"].x,
                s["projected_point"].y,
                s["stop_id"],
                fontsize=8,
                ha="left",
                va="bottom",
            )

        train_x = [t["projected_point"].x for t in self.trains]
        train_y = [t["projected_point"].y for t in self.trains]
        ax.scatter(train_x, train_y, color="tab:red", s=60, marker="x", label="Live trains", zorder=4)

        if show_raw:
            raw_stop_x = [s["raw_point"].x for s in self.stops]
            raw_stop_y = [s["raw_point"].y for s in self.stops]
            raw_train_x = [t["raw_point"].x for t in self.trains]
            raw_train_y = [t["raw_point"].y for t in self.trains]
            ax.scatter(raw_stop_x, raw_stop_y, color="tab:cyan", s=20, alpha=0.5, label="Raw stops")
            ax.scatter(raw_train_x, raw_train_y, color="orange", s=20, alpha=0.5, label="Raw trains")

        ax.set_title(f"{self.line_code} line overview")
        ax.set_xlabel("Longitude")
        ax.set_ylabel("Latitude")
        ax.legend() 
        ax.grid(True, alpha=0.3)
        ax.set_aspect("equal", adjustable="datalim")
        plt.tight_layout()
        plt.show()
        
