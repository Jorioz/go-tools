from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Callable, Dict, List
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


# A served snapshot is discarded once its age exceeds this many refresh
# intervals. At the current 15s interval that is 120s -- deliberately matching
# the completed-train TTL in TrainManager -- but it is expressed as a multiple of
# the configured interval so it scales automatically if that interval changes.
STALE_AFTER_CYCLES = 8


class DataRefresher():
    def __init__(
        self,
        refresh_interval,
        manager: LineManager | None = None,
        now: Callable[[], datetime] = datetime.now,
    ):
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
        # Injection seam for time. Used both to stamp snapshots in refresh() and to
        # judge staleness on the read path, so tests can advance a fake clock to
        # cross the cutoff without sleeping. Defaults to datetime.now (production
        # behavior unchanged).
        self._now = now

    @property
    def _stale_after(self) -> timedelta:
        """How old a snapshot may get before its states are treated as expired."""
        return timedelta(seconds=self.refresh_interval * STALE_AFTER_CYCLES)

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
            now = self._now()
            new_snapshot = Snapshot(states_by_line=states_by_line, last_updated=now)
            with self._lock:
                self._snapshot = new_snapshot
            print(f"[{now.strftime('%Y-%m-%d %H:%M:%S')}] Data refresh completed")
        except MetrolinxFeedError as exc:
            now = self._now().strftime('%Y-%m-%d %H:%M:%S')
            print(f"[{now}] WARNING - Data refresh failed, keeping previous cache: {exc}")

    @property
    def last_updated(self) -> datetime | None:
        # Read from the currently published snapshot so the timestamp always
        # matches the states served alongside it. This stays truthful even once
        # the snapshot's states have expired: it reports the real timestamp of the
        # last successful refresh so the X-Last-Updated header (and a future
        # frontend staleness indicator) can be honest about the data's age.
        return self._snapshot.last_updated

    def _is_stale(self, snapshot: Snapshot) -> bool:
        # A snapshot with no timestamp (nothing has refreshed yet) is not "stale"
        # in the outlived-its-cutoff sense; it just has no data to expire.
        if snapshot.last_updated is None:
            return False
        return self._now() - snapshot.last_updated > self._stale_after

    def get_states(self, line_code):
        # Resolve the current snapshot reference once (a lock-free atomic read),
        # then work with that consistent view.
        #
        # Read-path staleness expiry: once the snapshot has outlived the cutoff we
        # serve empty lists rather than misleading stale positions. The decision is
        # made here, purely from the snapshot's own timestamp, so it holds even if
        # the refresh loop is wedged on a hung connection or dead from an
        # unanticipated exception -- exactly the scenario this defends against.
        snapshot = self._snapshot
        if self._is_stale(snapshot):
            return []
        return snapshot.states_by_line.get(line_code, [])
