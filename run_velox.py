#!/usr/bin/env python3
"""Run existing ERP QUBOs using the remote VeloxQ solver."""

import argparse
import json
from pathlib import Path
from time import perf_counter

from quantum_erp.model import (
    baseline_a,
    baseline_b,
    milling_outage,
    schedule_records,
    validate,
)
from quantum_erp.qubo import build_qubo
from quantum_erp.reference import exact_reference
from quantum_erp.veloxq_backend import sample_velox_qubo


CASES = {
    "a": (
        baseline_a,
        4,
        "schedule_2x2_veloxq.json",
    ),
    "b": (
        baseline_b,
        8,
        "schedule_3x3_veloxq.json",
    ),
    "outage": (
        milling_outage,
        10,
        "schedule_extension_veloxq.json",
    ),
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--case",
        choices=["a", "b", "outage", "all"],
        default="a",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parent / "results",
    )
    args = parser.parse_args()

    args.output.mkdir(parents=True, exist_ok=True)

    failures = 0

    selected_cases = (
        CASES if args.case == "all" else [args.case]
    )

    for key in selected_cases:
        factory_builder, horizon, filename = CASES[key]
        factory = factory_builder()

        qubo = build_qubo(factory, horizon)

        print(
            f"{key}: submitting {len(qubo.variables)} variables, "
            f"{len(qubo.quadratic)} couplings, H={horizon}",
            flush=True,
        )

        start_time = perf_counter()
        result = sample_velox_qubo(qubo)
        elapsed = perf_counter() - start_time

        print("Local QUBO energy:", result["energy"])
        print("Samples inspected:", result["samples_inspected"])
        print("Client wall time (s):", round(elapsed, 3))

        if not result["feasible_horizon"]:
            print(
                "No feasible candidate found. "
                "This does NOT prove infeasibility."
            )
            failures += 1
            continue

        starts = qubo.starts(result["bits"])
        records = schedule_records(factory, starts)

        makespan = validate(factory, records)
        reference = exact_reference(factory)["makespan"]

        if makespan != reference:
            raise AssertionError(
                f"Reference makespan={reference}, "
                f"VeloxQ schedule makespan={makespan}"
            )

        output = {
            "instance": factory.name,
            "method": (
                "VeloxQ physics-inspired remote QUBO solver "
                "(not a QPU)"
            ),
            "makespan": makespan,
            "schedule": records,
        }

        path = args.output / filename
        path.write_text(
            json.dumps(output, indent=2) + "\n",
            encoding="utf-8",
        )

        print("Verified makespan:", makespan)
        print("Saved:", path)

    if failures:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
