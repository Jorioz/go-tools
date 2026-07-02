from pathlib import Path
from app.services.metrolinx_service import MetrolinxService
from app.services.line_builder import LineBuilder
from app.services.train_manager import TrainManager
from app.constants import LINE_CODES, LAKESHORE_WEST_STOP_VARIANTS
from app.models.line import Line

data_dir = Path(__file__).parent.parent / "data"

class LineManager:
    def __init__(
        self,
        go_service: MetrolinxService | None = None,
        line_builder: LineBuilder | None = None,
        lines: dict[LINE_CODES, Line] | None = None,
        lakeshore_west_variants: dict[str, Line] | None = None,
    ):
        # Injection seams (all default to real behavior when omitted) so tests can
        # drive LineManager without a live feed, an API key, or GTFS data files.
        # line_builder stays lazy: it reads gitignored GTFS files at construction,
        # so it is only built when lines actually need building.
        self._line_builder = line_builder
        self.go_service = go_service if go_service is not None else self._build_default_service()
        self.lines: dict[LINE_CODES, Line] = lines if lines is not None else self._build_all_lines()
        self.lakeshore_west_variants = (
            lakeshore_west_variants
            if lakeshore_west_variants is not None
            else self._build_lakeshore_west_variants()
        )
        self.train_manager = TrainManager(self.lines, self.lakeshore_west_variants)

    def _build_default_service(self) -> MetrolinxService:
        # Imported here (not at module load) so importing LineManager does not run
        # app.config's import-time side effects (load_dotenv / ensure_shapes_populated).
        from app.config import GO_API_KEY
        return MetrolinxService(api_key=GO_API_KEY)

    @property
    def line_builder(self) -> LineBuilder:
        if self._line_builder is None:
            self._line_builder = LineBuilder()
        return self._line_builder

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
