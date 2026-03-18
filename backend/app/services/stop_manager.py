import pandas as pd
from pathlib import Path

data_dir = Path(__file__).parent.parent / "data" / "gtfs" / "raw" / "GO-GTFS"

class StopManager:
    def __init__(self):
        self.stops_df = pd.read_csv(data_dir / "stops.txt", dtype={
            "stop_id": "str",
            "stop_name": "str",
            "stop_lat": "float",
            "stop_lon": "float"
        })

    def get_stops_by_ids(self, stop_ids: list) -> pd.DataFrame:
        cols = ["stop_id", "stop_name", "stop_lat", "stop_lon"]
        return self.stops_df[self.stops_df["stop_id"].isin(stop_ids)][cols].copy()
