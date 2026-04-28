"""
Service to fetch train data from the GO API
sag = Service At Glance
"""
import requests
from dataclasses import dataclass
from typing import Dict, List, Any, Optional
import warnings
from datetime import datetime


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
            latitude=float(data.get("Latitude", 0)),
            longitude=float(data.get("Longitude", 0)),
            is_in_motion=bool(data.get("IsInMotion", False)),
            delay_seconds=int(data.get("DelaySeconds", 0)),
            course=int(data.get("Course", 0)),
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
        self._map_trains()

    def _fetch(self, endpoint: str):
        BASE_URL = "https://api.openmetrolinx.com/OpenDataAPI"
        url = f"{BASE_URL}/{endpoint}?key={self.api_key}"
        headers={"key": self.api_key,
                 "User-Agent": "Mozilla/5.0"}

        try:
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as req_err:
            raise RuntimeError(f"Failed to fetch GO API Data: {req_err}")

    def _fetch_sag_trains(self, endpoint = "api/V1/ServiceataGlance/Trains/All") -> List[Dict[str, Any]]:
        try:
            data = self._fetch(endpoint)
            return data["Trips"]["Trip"]
        except RuntimeError as fetch_err:
            print(f"Error getting SAG Trains Data. See Fetch Error -> {fetch_err}")
            return []

    def _map_trains(self):
        trips = self._fetch_sag_trains()
        if not trips:
            warnings.warn("No Trips found from API.", UserWarning)
            return
        self.trains = [GoTrain.from_dict(trip) for trip in trips]
        self.last_updated = datetime.now()

    def get_train_data(self) -> List[GoTrain]:
        try:
            print("Attemping to get live train data...")
            self._map_trains()
            print("Got Trains!")
            return self.trains
        except RuntimeError as e:
            print(f"Error getting trains: {e}")
            return []
        
    def get_last_updated(self) -> Optional[datetime]:
        try:
            print("Attemping to get last updated train data...")
            if not self.last_updated:
                print("Last updated is empty.")
                return None
            print("Got last updated train data!")
            return self.last_updated
        except LookupError as e:
            print(f"Error getting last updated train data: {e}")
            return None
        
    

