from datetime import datetime
from typing import Dict, List
import threading
import time

from app.services.line_manager import LineManager
from app.constants import LINE_CODES
from app.services.train_manager import TrainState


class DataRefresher():
    def __init__(self, refresh_interval = 45):
        self.last_updated = None
        self.refresh_interval = refresh_interval
        self._cache: Dict[LINE_CODES, List[TrainState]] = {}
        self._lock = threading.Lock()
        self._stop_event = threading.Event()
        self._thread = threading.Thread(target=self._refresh_loop, daemon=True)
        self.manager = LineManager()

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
        try:
            with self._lock:
                self.manager.refresh_trains()
                for line_code in LINE_CODES:
                    self._cache[line_code] = self.manager.get_train_states_for_line(line_code)
                self.last_updated = datetime.now()
                print(f"[{self.last_updated.strftime('%Y-%m-%d %H:%M:%S')}] Data refresh completed")
        except Exception as exc:
            now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            print(f"[{now}] WARNING - Data refresh failed: {exc}")

    def get_states(self, line_code):
        with self._lock:
            return self._cache.get(line_code, [])
    