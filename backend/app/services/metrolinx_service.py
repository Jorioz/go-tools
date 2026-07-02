"""
Service to fetch train data from the GO API
sag = Service At Glance
"""
import requests
from dataclasses import dataclass
from typing import Dict, List, Any, Optional
from datetime import datetime


class MetrolinxFeedError(Exception):
    """Raised when the GO feed cannot be fetched or its envelope is malformed.

    Covers every failure mode of a feed cycle: network error, non-200 response,
    malformed JSON, or an unexpected envelope shape (missing/mis-typed ``Trips``
    container, or a ``Trip`` value that is neither a list nor a dict). It is
    deliberately distinct so the refresher can catch feed failures precisely and
    leave its cache untouched, rather than treating an outage as "no trains".

    Note: a well-formed envelope with an empty or absent ``Trip`` list is a
    *success* (returns ``[]``), not a feed error -- GO trains stop overnight.
    """


@dataclass
class GoTrain:
    cars: str
    trip_number: str
    start_time: str
    end_time: str
    line_code: str
    route_number: str
    variant_dir: str
    display: str
    latitude: float
    longitude: float
    is_in_motion: bool
    delay_seconds: int
    course: int
    first_stop_code: str
    last_stop_code: str
    prev_stop_code: str
    next_stop_code: str
    at_station_code: str
    modified_date: str

    @staticmethod
    def _safe_float(value: Any, default: float = 0.0) -> float:
        try:
            return float(value)
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _safe_int(value: Any, default: int = 0) -> int:
        try:
            return int(value)
        except (TypeError, ValueError):
            return default

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> GoTrain:
        return GoTrain(
            cars=data.get("Cars", ""),
            trip_number=data.get("TripNumber", ""),
            start_time=data.get("StartTime", ""),
            end_time=data.get("EndTime", ""),
            line_code=data.get("LineCode", ""),
            route_number=data.get("RouteNumber", ""),
            variant_dir=data.get("VariantDir", ""),
            display=data.get("Display", ""),
            latitude=GoTrain._safe_float(data.get("Latitude", 0)),
            longitude=GoTrain._safe_float(data.get("Longitude", 0)),
            is_in_motion=bool(data.get("IsInMotion", False)),
            delay_seconds=GoTrain._safe_int(data.get("DelaySeconds", 0)),
            course=GoTrain._safe_int(data.get("Course", 0)),
            first_stop_code=data.get("FirstStopCode", ""),
            last_stop_code=data.get("LastStopCode", ""),
            prev_stop_code=data.get("PrevStopCode", ""),
            next_stop_code=data.get("NextStopCode", ""),
            at_station_code=data.get("AtStationCode", ""),
            modified_date=data.get("ModifiedDate", ""),
        )

class MetrolinxService:
    def __init__(self, api_key: str | None):
        self.api_key = api_key
        if not self.api_key:
            raise ValueError(
                "GO_API_KEY not found. Set it in an .env file."
            )
        self.trains: List[GoTrain] = []
        self.last_updated: Optional[datetime] = None

    def _fetch(self, endpoint: str):
        BASE_URL = "https://api.openmetrolinx.com/OpenDataAPI"
        url = f"{BASE_URL}/{endpoint}?key={self.api_key}"
        headers={"key": self.api_key,
                 "User-Agent": "Mozilla/5.0"}

        try:
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            return response.json()
        except (requests.RequestException, ValueError) as fetch_err:
            # RequestException covers network errors and non-200 responses;
            # ValueError covers malformed JSON (requests' JSONDecodeError).
            raise MetrolinxFeedError(f"Failed to fetch GO API data: {fetch_err}") from fetch_err

    def _fetch_sag_trains(self, endpoint = "api/V1/ServiceataGlance/Trains/All") -> List[Dict[str, Any]]:
        data = self._fetch(endpoint)
        if not isinstance(data, dict):
            raise MetrolinxFeedError(f"Unexpected feed envelope: expected a dict, got {type(data).__name__}")

        if "Trips" not in data:
            raise MetrolinxFeedError("Unexpected feed envelope: missing 'Trips' container")

        trips_container = data["Trips"]
        # An empty/absent Trips container is a legitimate "no trains" success.
        if trips_container is None:
            return []
        if not isinstance(trips_container, dict):
            raise MetrolinxFeedError(
                f"Unexpected feed envelope: 'Trips' is {type(trips_container).__name__}, expected a dict"
            )

        # A well-formed envelope with an absent or empty 'Trip' is a success (no
        # trains running), returning []. Only a mis-typed 'Trip' is shape drift.
        trips = trips_container.get("Trip", [])
        if trips is None:
            return []

        if isinstance(trips, list):
            return [trip for trip in trips if isinstance(trip, dict)]

        if isinstance(trips, dict):
            return [trips]

        raise MetrolinxFeedError(
            f"Unexpected feed envelope: 'Trip' is {type(trips).__name__}, expected a list or dict"
        )

    def _map_trains(self):
        trips = self._fetch_sag_trains()
        self.trains = [GoTrain.from_dict(trip) for trip in trips]
        self.last_updated = datetime.now()

    def get_train_data(self) -> List[GoTrain]:
        """Fetch and return the current live trains.

        Raises :class:`MetrolinxFeedError` on any fetch or parse failure. A
        well-formed feed with no trains returns an empty list (a success).
        """
        self._map_trains()
        return self.trains

    def get_last_updated(self) -> Optional[datetime]:
        return self.last_updated


