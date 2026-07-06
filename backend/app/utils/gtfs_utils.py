import shutil
import tempfile
import zipfile
from pathlib import Path

import pandas as pd
import requests

data_dir = Path(__file__).parent.parent / "data" / "gtfs"
raw_dir = data_dir / "raw" / "GO-GTFS"

# The published GO Transit GTFS bundle. Refreshing this extract is what keeps the
# schedule-derived line status (issue #26/#27) accurate: an expired feed no longer
# covers today's service date, so status computation fails open and nothing dims.
GO_GTFS_URL = "https://assets.metrolinx.com/raw/upload/Documents/Metrolinx/Open%20Data/GO-GTFS.zip"


def download_gtfs_extract(
    url: str = GO_GTFS_URL,
    dest: Path = raw_dir,
    *,
    regenerate_shapes: bool = True,
    timeout: int = 120,
) -> list[str]:
    """Download the GO GTFS zip and extract its ``.txt`` files into ``dest``.

    Overwrites the existing extract in place and returns the extracted filenames.
    The zip is streamed to a temp file rather than held in memory (``stop_times.txt``
    alone is ~100 MB uncompressed). Only ``.txt`` members are taken, by basename,
    so a zip that nests files under a folder still lands flat where the managers
    expect them and no archive path can escape ``dest``.

    After a refresh the split per-shape CSVs are regenerated from the new
    ``shapes.txt`` (they are derived data and would otherwise be stale).
    """
    dest.mkdir(parents=True, exist_ok=True)
    print(f"Downloading GO GTFS from {url} ...")

    tmp_path: Path | None = None
    try:
        with requests.get(url, stream=True, timeout=timeout) as response:
            response.raise_for_status()
            with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as tmp:
                tmp_path = Path(tmp.name)
                for chunk in response.iter_content(chunk_size=1 << 16):
                    tmp.write(chunk)

        extracted: list[str] = []
        with zipfile.ZipFile(tmp_path) as archive:
            for member in archive.infolist():
                if member.is_dir():
                    continue
                name = Path(member.filename).name
                if not name.endswith(".txt"):
                    continue
                with archive.open(member) as src, open(dest / name, "wb") as out:
                    shutil.copyfileobj(src, out)
                extracted.append(name)
    finally:
        if tmp_path is not None:
            tmp_path.unlink(missing_ok=True)

    print(f"Extracted {len(extracted)} .txt files into {dest}")

    if regenerate_shapes:
        _regenerate_shapes()

    return extracted


def _regenerate_shapes() -> None:
    """Rebuild the split per-shape CSVs from the current ``shapes.txt``.

    Clears the derived ``shapes/`` CSVs first so a refreshed extract doesn't leave
    stale shape files behind, then re-splits.
    """
    shapes_dir = data_dir / "shapes"
    if shapes_dir.exists():
        for csv in shapes_dir.glob("*.csv"):
            csv.unlink()
    separate_shapes()


def ensure_shapes_populated() -> None:
    shapes_dir = data_dir / "shapes"
    shapes_dir.mkdir(parents=True, exist_ok=True)
    if any(shapes_dir.glob("*.csv")):
        return

    print("Shapes directory is empty; generating shape CSV files.")
    separate_shapes()

def separate_shapes() -> None:
    shapes_data_file = raw_dir / "shapes.txt"
    shapes_df = pd.read_csv(shapes_data_file, sep=",", dtype={"shape_id": str})
    shapes_df = shapes_df[~shapes_df["shape_id"].str.match(r"^\d+$", na=False)]
    shape_groups = {shape_id: group for shape_id, group in shapes_df.groupby("shape_id")}

    output_dir = data_dir / "shapes"
    output_dir.mkdir(parents=True, exist_ok=True)
    for shape_id, group_df in shape_groups.items():
        output_path = output_dir / f"{shape_id}.csv"
        group_df.to_csv(output_path, index=False)
        print(f"Saved: {output_path}")


if __name__ == "__main__":
    # Refresh the local GTFS extract: `python -m app.utils.gtfs_utils`
    download_gtfs_extract()