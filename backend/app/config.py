import os
from dotenv import load_dotenv

from app.utils.gtfs_utils import ensure_shapes_populated

load_dotenv()

ensure_shapes_populated()

REFRESH_INTERVAL = int(os.getenv("REFRESH_INTERVAL", 15))
GO_API_KEY = os.getenv("GO_API_KEY")