import os
from dotenv import load_dotenv

load_dotenv()

REFRESH_INTERVAL = int(os.getenv("REFRESH_INTERVAL", 15))
GO_API_KEY = os.getenv("GO_API_KEY")