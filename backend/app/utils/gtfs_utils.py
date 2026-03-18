from pathlib import Path
import pandas as pd

data_dir = Path(__file__).parent.parent / "data" / "gtfs"
raw_dir = data_dir / "raw" / "GO-GTFS"

def separate_shapes():
    shapes_data_file = data_dir / raw_dir / "shapes.txt"
    shapes_df = pd.read_csv(shapes_data_file, sep=",", dtype={'shape_id': str})
    shapes_df = shapes_df[~shapes_df['shape_id'].str.match(r'^\d+$', na=False)] # Filter out non trains
    shape_groups = {shape_id: group for shape_id, group in shapes_df.groupby('shape_id')}

    #output each to csv file
    output_dir = data_dir / "shapes"
    output_dir.mkdir(parents=True, exist_ok=True)
    for shape_id, group_df in shape_groups.items():
        output_path = output_dir / f"{shape_id}.csv"
        group_df.to_csv(output_path, index=False)
        print(f"Saved: {output_path}")