import pandas as pd
import geopandas as gpd
from pathlib import Path
from typing import Optional

data_dir = Path(__file__).parent.parent / "data" / "gtfs"
shapes_dir =  data_dir / "shapes"

class ShapeManager:
    def __init__(self):
        self.shapes = {}
        self.load_all_shapes()

    def _csv_to_gdf(self, csv: Path) -> gpd.GeoDataFrame:
        shapes_df = pd.read_csv(csv, dtype={
            'shape_id': 'str',
            'shape_pt_lat': 'float',
            'shape_pt_lon': 'float',
            'shape_pt_sequence': 'Int64'
        })
        shapes_gdf = gpd.GeoDataFrame(shapes_df, geometry=gpd.points_from_xy(shapes_df.shape_pt_lon, shapes_df.shape_pt_lat)).set_crs(epsg=4326)
        return shapes_gdf

    def load_all_shapes(self) -> None:
        for csv_file in shapes_dir.glob("*.csv"):
            if not csv_file.stem.startswith("UN"):
                gdf = self._csv_to_gdf(csv_file)
                key = csv_file.stem
                self.shapes[key] = gdf
    
    def get_shape(self, prefix: str) -> Optional[gpd.GeoDataFrame]:
        """
        Takes in a prefix str that is to be the terminus of a route. Eg: "AD" will return shapes for ADUN 
        """
        for key in self.shapes:
            if key.startswith(prefix):
                return self.shapes[key]
        return None
