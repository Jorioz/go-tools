import time
from datetime import datetime

from services.line_manager import LineManager
from constants import LINE_CODES
from jobs.data_refresher import DataRefresher

def main():
    refresher = DataRefresher()
    refresher.start()
    last_updated = None

    try:
        while True:
            updated = refresher.last_updated
            if updated is not None and updated != last_updated:
                last_updated = updated
                for code in LINE_CODES:
                    states = refresher.get_states(code)
                    print(f"\n[{datetime.now().strftime('%H:%M:%S')}] cache updated at {updated} | count={len(states)}")
                    for state in states:
                        print(state)
            time.sleep(1)
    finally:
        refresher.stop()

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nStopped.")