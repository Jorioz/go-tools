from services.metrolinx_service import MetrolinxService
from services.line_builder import LineBuilder
from services.train_manager import TrainManager
from pathlib import Path
from constants import LINE_CODES, LAKESHORE_WEST_STOP_VARIANTS
from models.line import Line

data_dir = Path(__file__).parent.parent / "data"

class LineManager:
    def __init__(self):
        self.go_service = MetrolinxService()
        self.line_builder = LineBuilder()
        self.lines: dict[LINE_CODES, Line] = self._build_all_lines()
        self.lakeshore_west_variants = self._build_lakeshore_west_variants()
        self.train_manager = TrainManager(self.lines, self.lakeshore_west_variants)

    def _build_all_lines(self) -> dict[LINE_CODES,Line]:
        lines = {}
        for line_code in LINE_CODES:
            try:
                lines[line_code] = self.line_builder.build(line_code)
            except ValueError as e:
                print(f"Failed to build line: {line_code}: {e}")
        return lines

    def _build_lakeshore_west_variants(self) -> dict[str, Line]:
        variants: dict[str, Line] = {}
        try:
            normal_stop_ids = [stop.value for stop in LAKESHORE_WEST_STOP_VARIANTS["normal"]]
            variants["normal"] = self.line_builder.build(
                line_code=LINE_CODES.LAKESHORE_WEST,
                stop_ids=normal_stop_ids,
                shape_prefix="NI",
            )
        except ValueError:
            print("Failed to build Lakeshore West normal variant.")

        try:
            hamilton_stop_ids = [stop.value for stop in LAKESHORE_WEST_STOP_VARIANTS["extension"]]
            variants["extension"] = self.line_builder.build(
                line_code=LINE_CODES.LAKESHORE_WEST,
                stop_ids=hamilton_stop_ids,
                shape_prefix="HA",
            )
        except ValueError:
            print("Failed to build Lakeshore West Hamilton variant.")

        return variants
    
    def refresh_trains(self) -> None:
        raw_trains = self.go_service.get_train_data()
        self.train_manager.upsert_many(raw_trains)

    def get_train_states_for_line(self, line_code: LINE_CODES):
        return [
            state for state in self.train_manager.states.values()
            if state.line_code == line_code
        ]
