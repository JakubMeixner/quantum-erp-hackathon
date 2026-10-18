"""FastAPI endpoint for time-indexed QUBO scheduling."""

import logging
import tempfile
from pathlib import Path
from typing import Any

from fastapi import Body, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from quantum_erp.io import factory_from_payload
from quantum_erp.model import validate
from run_demo import run_time_indexed


logger = logging.getLogger("uvicorn.error")

app = FastAPI(title="Productionionalizator 2000 solver")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_methods=["POST"],
    allow_headers=["*"],
)


@app.post("/solver")
def solver(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    try:
        factory = factory_from_payload(payload, name="input")
    except (ValueError, TypeError, KeyError) as err:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid solver input: {err}",
        ) from err

    logger.info(
        "POST /solver parsed outages: %s",
        factory.outages,
    )

    with tempfile.TemporaryDirectory() as temp:
        try:
            schedule, _diagnostics = run_time_indexed(
                factory,
                Path(temp),
                "schedule.json",
            )

            actual = validate(
                factory,
                schedule["schedule"],
            )

            if actual != schedule["makespan"]:
                raise AssertionError(
                    "Reported makespan differs from validated makespan"
                )

        except Exception as err:
            logger.exception("Solver or validation failed")
            raise HTTPException(
                status_code=500,
                detail=f"Solver failed: {err}",
            ) from err

    return schedule
