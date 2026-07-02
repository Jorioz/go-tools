## go-tools/backend

Instructions on how to setup will be here eventually :)

### Running the tests

Dev-only dependencies live in `app/requirements-dev.txt` (separate from the
runtime `app/requirements.txt`). Install them into the project venv, then run
pytest **from this `backend/` directory** so that `app.*` imports resolve:

```sh
# from backend/
./app/.venv/Scripts/python.exe -m pip install -r app/requirements-dev.txt
./app/.venv/Scripts/python.exe -m pytest
```

The suite uses no network, no API key, and no GTFS data files: the Metrolinx
feed is replaced by a scripted fake (`tests/fakes.py`) and geometry is built from
synthetic coordinates (`tests/factories.py`).
