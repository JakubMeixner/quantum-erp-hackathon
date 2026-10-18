"""FastAPI wrapper around the time-indexed QUBO solver from run_demo.py.

Place this file in the repository root (next to run_demo.py) and start it there:

    uv add fastapi "uvicorn[standard]"
    uv run uvicorn api:app --reload

POST /solver
    Body:     an input in the same JSON schema as the files in `inputs/`
              (what `quantum_erp.io.read_factory` reads), including the optional
              "outages" array of the Stage 2 extension.
    Response: the same structure as `results/schedule_3x3.json`:
              {"instance", "method", "makespan", "schedule"}.
"""

import json
import logging
import tempfile
from pathlib import Path
from typing import Any

from fastapi import Body, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from quantum_erp.io import read_factory
from run_demo import run_time_indexed

logger = logging.getLogger("uvicorn.error")

app = FastAPI(title="Productionionalizator 2000 solver")

# Origins of the Vite dev server (default port 5173).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["POST"],
    allow_headers=["*"],
)


def _sent_outages(payload: dict[str, Any]) -> list[dict[str, Any]]:
    """The outage entries of the request, as {"machine", "start", "end"} dicts."""
    outages = payload.get("outages")
    if not isinstance(outages, list):
        return []
    return [o for o in outages if isinstance(o, dict)]


def _outage_violations(
    schedule: list[dict[str, Any]], outages: list[dict[str, Any]]
) -> list[str]:
    """Operations of the result that overlap an outage [start, end) of their machine."""
    violations = []
    for outage in outages:
        for op in schedule:
            if (
                op["machine"] == outage.get("machine")
                and op["start"] < outage["end"]
                and outage["start"] < op["end"]
            ):
                violations.append(
                    f"{op['job']} on {op['machine']} [{op['start']}, {op['end']})"
                    f" overlaps the outage [{outage['start']}, {outage['end']})"
                )
    return violations


# A plain `def` (not `async def`): the solver is CPU-bound and blocking,
# so FastAPI runs it in a worker thread instead of blocking the event loop.
@app.post("/solver")
def solver(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    sent_outages = _sent_outages(payload)
    logger.info("POST /solver: outages in the request: %s", sent_outages)

    with tempfile.TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp)

        # read_factory takes a path, so the payload goes through a temp file.
        input_path = tmp_dir / "input.json"
        input_path.write_text(json.dumps(payload), encoding="utf8")

        try:
            factory = read_factory(input_path)
        except Exception as err:
            raise HTTPException(status_code=422, detail=f"Invalid solver input: {err}")

        # run_demo.py reads the outages of a factory as (key, intervals) pairs.
        # If some were sent but the factory has none, they were not recognised:
        # fail loudly instead of solving the model without them.
        factory_has_outages = any(intervals for _key, intervals in factory.outages)
        logger.info("factory.outages after read_factory: %s", list(factory.outages))
        if sent_outages and not factory_has_outages:
            raise HTTPException(
                status_code=422,
                detail="Outages were sent, but read_factory did not load any of them.",
            )

        # run_time_indexed builds output file names from factory.name,
        # so refuse names that are not a plain file-name component.
        name = str(factory.name)
        if name in ("", ".", "..") or Path(name).name != name:
            raise HTTPException(status_code=422, detail="Invalid instance name.")

        try:
            # Same call run_demo.py makes for the Stage 2 (milling outage) model.
            # It writes its files into the temp dir, which is deleted afterwards.
            schedule, _diagnostics = run_time_indexed(
                factory, tmp_dir / "out", "schedule.json"
            )
        except Exception as err:
            raise HTTPException(status_code=500, detail=f"Solver failed: {err}")

    # The result must not use a machine while it is out of service.
    violations = _outage_violations(schedule["schedule"], sent_outages)
    if violations:
        raise HTTPException(
            status_code=500,
            detail="The solver result ignores an outage: " + "; ".join(violations),
        )

    logger.info("makespan returned: %s", schedule["makespan"])
    return schedule