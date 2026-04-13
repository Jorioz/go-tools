from shapely.geometry import LineString, Point
from geopandas import GeoDataFrame

"""
various utils to help "simulate" a trains position.
By projecting a trains lat/lon onto the train track shape we can accurately represent its location/progress/etc.
"""

def shape_to_linestring(shape_gdf: GeoDataFrame) -> LineString:
    ordered = shape_gdf.sort_values("shape_pt_sequence") if "shape_pt_sequence" in shape_gdf.columns else shape_gdf
    coords = list(zip(ordered["shape_pt_lon"], ordered["shape_pt_lat"]))
    return LineString(coords)

def project_point_onto_linestring(point: Point, line: LineString) -> Point:
    dist_along_line = line.project(point)
    return line.interpolate(dist_along_line)
    
def progress_between_points(station_next: Point, station_prev: Point, train_pos: Point, lineshape: LineString) -> float:
    dist_next = lineshape.project(station_next)
    dist_prev = lineshape.project(station_prev)
    dist_train = lineshape.project(train_pos)

    total = abs(dist_prev - dist_next)
    progress = abs(dist_train - dist_prev)
    if total == 0:
        return 0.0
    return min(max(progress / total, 0.0), 1.0)