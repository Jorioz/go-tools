from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List
import threading
import time

from app.services.line_manager import LineManager
from app.services.metrolinx_service import MetrolinxFeedError
from app.constants import LINE_CODES
from app.services.train_manager import TrainState


@dataclass(frozen=True)
class Snapshot:
    """An immutable, atomically-published view of the served data.

    Bundling the per-line states with the timestamp they were produced at means a
    reader can never pair a fresh cache with a stale ``last_updated`` (or vice
    versa): both come from the same frozen object, swapped in a single reference
    assignment at the end of a successful refresh cycle.
    """
    states_by_line: Dict[LINE_CODES, List[TrainState]] = field(default_factory=dict)
    last_updated: datetime | None = None


class DataRefresher():
    def __init__(self, refresh_interval, manager: LineManager | None = None):
        self.refresh_interval = refresh_interval
        # The single published snapshot. Reads resolve this reference lock-free;
        # a successful cycle swaps in a brand-new Snapshot.
        self._snapshot = Snapshot()
        self._lock = threading.Lock()
        self._stop_event = threading.Event()
        self._thread = threading.Thread(target=self._refresh_loop, daemon=True)
        # Injection seam: tests pass a LineManager wired to a fake feed so they can
        # drive refresh() directly without a real service, an API key, or a thread.
        self.manager = manager if manager is not None else LineManager()

    def start(self):
        self._thread.start()

    def stop(self):
        self._stop_event.set()
        self._thread.join()

    def _refresh_loop(self):
        while not self._stop_event.is_set():
            self.refresh()
            time.sleep(self.refresh_interval)

    def refresh(self):
        # Single catch point for feed failures. A failed cycle leaves the previous
        # snapshot in place, so an outage is never confused with "no trains
        # running". A successful cycle -- including a legitimately empty feed --
        # builds a fresh snapshot and publishes it in one atomic swap.
        #
        # The fetch and geometry work below run with no lock a reader contends on,
        # so API responses never stall behind an in-flight refresh; only the final
        # reference swap is guarded.
        try:
            self.manager.refresh_trains()
            states_by_line = {
                line_code: self.manager.get_train_states_for_line(line_code)
                for line_code in LINE_CODES
            }
            now = datetime.now()
            new_snapshot = Snapshot(states_by_line=states_by_line, last_updated=now)
            with self._lock:
                self._snapshot = new_snapshot
            print(f"[{now.strftime('%Y-%m-%d %H:%M:%S')}] Data refresh completed")
        except MetrolinxFeedError as exc:
            now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            print(f"[{now}] WARNING - Data refresh failed, keeping previous cache: {exc}")

    @property
    def last_updated(self) -> datetime | None:
        # Read from the currently published snapshot so the timestamp always
        # matches the states served alongside it.
        return self._snapshot.last_updated

    def get_states(self, line_code):
        # Resolve the current snapshot reference once (a lock-free atomic read),
        # then work with that consistent view.
        snapshot = self._snapshot
        return snapshot.states_by_line.get(line_code, [])
