from fastapi import FastAPI, HTTPException
from contextlib import asynccontextmanager
from dataclasses import asdict

from app.constants import LINE_CODES
from app.jobs.data_refresher import DataRefresher

refresher = DataRefresher()

@asynccontextmanager
async def lifespan(app: FastAPI):
    refresher.start()
    yield
    refresher.stop()

app = FastAPI(lifespan=lifespan)

@app.get("/")
def read_root():
    return {"message": "FastAPI server is running!"}

@app.get("/api/trains")
def get_all_trains():
    data = {
        line_code.value: [asdict(state) for state in refresher.get_states(line_code)] for line_code in LINE_CODES
    }
    return {
        "last_updated": refresher.last_updated,
        "lines": data
    }

@app.get("/api/trains/{line_code}")
def get_trains_for_line(line_code: str):
    normalized_line_code = (line_code or "").strip().upper()
    try:
        parsed_line_code = LINE_CODES(normalized_line_code)
    except ValueError:
        allowed_values = [code.value for code in LINE_CODES]
        raise HTTPException(
            status_code=400,
            detail={
                "error": "Invalid line_code",
                "provided": line_code,
                "allowed": allowed_values,
            },
        )

    states = refresher.get_states(parsed_line_code)
    
    return {
        "last_updated": refresher.last_updated,
        "line_code": parsed_line_code.value,
        "count": len(states),
        "states": [asdict(state) for state in states]
    }

