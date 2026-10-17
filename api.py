"""FastAPI wrapper around the time-indexed QUBO solver from run_demo.py.

Place this file in the repository root (next to run_demo.py) and start it there:

    uv add fastapi "uvicorn[standard]"
    uv run uvicorn api:app --reload

POST /solver
    Body:     an input in the same JSON schema as the files in `inputs/`
              (what `quantum_erp.io.read_factory` reads).
    Response: the same structure as `results/schedule_3x3.json`:
              {"instance", "method", "makespan", "schedule"}.
"""

import json
import tempfile
from pathlib import Path
from typing import Any

from fastapi import Body, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from quantum_erp.io import read_factory
from run_demo import run_time_indexed

app = FastAPI(title="Productionionalizator 2000 solver")

# Origins of the Vite dev server (default port 5173).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["POST"],
    allow_headers=["*"],
)


# A plain `def` (not `async def`): the solver is CPU-bound and blocking,
# so FastAPI runs it in a worker thread instead of blocking the event loop.
@app.post("/solver")
def solver(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp)

        # read_factory takes a path, so the payload goes through a temp file.
        input_path = tmp_dir / "input.json"
        input_path.write_text(json.dumps(payload), encoding="utf8")

        try:
            factory = read_factory(input_path)
        except Exception as err:
            raise HTTPException(status_code=422, detail=f"Invalid solver input: {err}")

        # run_time_indexed builds output file names from factory.name,
        # so refuse names that are not a plain file-name component.
        name = str(factory.name)
        if name in ("", ".", "..") or Path(name).name != name:
            raise HTTPException(status_code=422, detail="Invalid instance name.")

        try:
            # Same call as run_demo.py uses for instance B and Stage 2.
            # It writes its files into the temp dir, which is deleted afterwards.
            schedule, _diagnostics = run_time_indexed(
                factory, tmp_dir / "out", "schedule.json"
            )
        except Exception as err:
            raise HTTPException(status_code=500, detail=f"Solver failed: {err}")

    return schedule

