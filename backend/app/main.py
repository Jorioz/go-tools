import time
from datetime import datetime

from services.line_manager import LineManager
from constants import LINE_CODES, LINE_STOPS

def main():
    manager = LineManager()

    while True:
        print(f"\n[{datetime.now().strftime('%H:%M:%S')}] Refreshing trains...")
        manager.refresh_trains()

        states = manager.get_train_states_for_line(LINE_CODES.LAKESHORE_WEST)
        print(f"Train count: {len(states)}")

        for state in states:
            stop_enum = LINE_STOPS[state.line_code]
            prev_stop_name = stop_enum(state.prev_stop_code).name if state.prev_stop_code else "N/A"
            next_stop_name = stop_enum(state.next_stop_code).name if state.next_stop_code else "N/A"
            stopped_at_name = stop_enum(state.stopped_at_stop_code).name if state.stopped_at_stop_code else "N/A"
            print(
                f"{state.direction.name} Moving: {state.in_motion} | "
                f"{prev_stop_name} -> {next_stop_name}: {state.progress:.2f} | "
                f"stopped_at={stopped_at_name} | "
                f"code = {state.trip_number} | "
                f"start = {state.start_time}"
            )

        time.sleep(45)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nStopped.")