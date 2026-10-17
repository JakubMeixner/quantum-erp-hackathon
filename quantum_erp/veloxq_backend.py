"""Optional remote VeloxQ QUBO sampler.

VeloxQ is a physics-inspired classical optimizer, not a QPU.
The existing scheduling QUBO remains the source of truth.
Returned candidates are independently evaluated locally.
"""

from __future__ import annotations

import os
import numpy as np


def as_spin_bqm(qubo):
    """Convert the existing binary QUBO into an equivalent Ising BQM."""
    import dimod

    linear = {
        i: float(value)
        for i, value in enumerate(qubo.linear)
    }

    quadratic = {
        (int(i), int(j)): float(value)
        for (i, j), value in qubo.quadratic.items()
    }

    binary = dimod.BinaryQuadraticModel(
        linear,
        quadratic,
        float(qubo.constant),
        dimod.BINARY,
    )

    return binary.change_vartype(dimod.SPIN, inplace=False)


def verify_spin_encoding(qubo, trials=64, seed=2026):
    """Verify QUBO-to-Ising energy equivalence on test states."""
    bqm = as_spin_bqm(qubo)
    n = len(qubo.variables)

    rng = np.random.default_rng(seed)

    candidates = [
        np.zeros(n, dtype=int),
        np.ones(n, dtype=int),
    ]

    candidates.extend(
        rng.integers(0, 2, size=n)
        for _ in range(trials)
    )

    for bits in candidates:
        spins = {
            i: 2 * int(bits[i]) - 1
            for i in range(n)
        }

        e_ising = bqm.energy(spins)
        e_qubo = qubo.energy(bits)

        if abs(e_ising - e_qubo) > 1e-7:
            raise AssertionError(
                f"Energy mismatch: Ising={e_ising}, QUBO={e_qubo}"
            )

    return bqm



def _spin_at(sample, index):
    """Read a spin using integer or string variable labels."""
    if index in sample:
        value = sample[index]
    elif str(index) in sample:
        value = sample[str(index)]
    else:
        raise KeyError(
            f"Missing spin variable {index}; "
            f"available labels: {list(sample.keys())}"
        )

    spin = int(value)

    if spin not in (-1, 1):
        raise ValueError(f"Invalid Ising spin: {spin}")

    return spin


def read_samples(qubo, response, *, max_samples=1000):
    """Read SPIN samples and recompute original QUBO energies."""
    import dimod

    if response.vartype != dimod.SPIN:
        raise ValueError(
            f"Expected SPIN samples, received {response.vartype!r}"
        )

    n = len(qubo.variables)
    best = None
    scanned = 0

    for row in response.data(
        fields=["sample", "energy"],
        sorted_by="energy",
    ):
        spins = [
            int(_spin_at(row.sample, i))
            for i in range(n)
        ]

        if any(s not in (-1, 1) for s in spins):
            raise ValueError("Invalid spin value in response")

        bits = np.asarray(
            [(s + 1) // 2 for s in spins],
            dtype=int,
        )

        local_energy = qubo.energy(bits)

        if best is None or local_energy < best["energy"]:
            best = {
                "energy": float(local_energy),
                "bits": bits,
                "remote_reported_energy": float(row.energy),
            }

        scanned += 1

        if scanned >= max_samples:
            break

    if best is None:
        raise RuntimeError("VeloxQ returned no samples")

    best["samples_inspected"] = scanned
    best["feasible_horizon"] = abs(best["energy"]) < 1e-7

    return best


def sample_velox_qubo(qubo, *, max_samples=1000, solver=None):
    """Submit the QUBO to VeloxQ and validate returned energy."""
    if solver is None:
        if not os.environ.get("VELOX_TOKEN"):
            raise RuntimeError(
                "VELOX_TOKEN is not set in the environment"
            )

        from veloxq_sdk import VeloxQSolver
        solver = VeloxQSolver()

    spin_bqm = verify_spin_encoding(qubo)

    response = solver.sample(spin_bqm)

    return read_samples(
        qubo,
        response,
        max_samples=max_samples,
    )
