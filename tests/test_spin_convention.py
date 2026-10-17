import itertools
import unittest

import numpy as np
import dimod

from quantum_erp.model import (
    baseline_a,
    baseline_b,
    milling_outage,
)
from quantum_erp.qubo import build_qubo, solve_exact_qubo
from quantum_erp.veloxq_backend import (
    as_spin_bqm,
    read_samples,
)


class SpinConventionTests(unittest.TestCase):

    def test_energy_equivalence(self):
        cases = [
            (baseline_a(), 4),
            (baseline_b(), 8),
            (milling_outage(), 10),
        ]

        rng = np.random.default_rng(2026)

        for factory, horizon in cases:
            qubo = build_qubo(factory, horizon)
            bqm = as_spin_bqm(qubo)

            n = len(qubo.variables)

            if n <= 10:
                candidates = itertools.product((0, 1), repeat=n)
            else:
                candidates = [
                    np.zeros(n, dtype=int),
                    np.ones(n, dtype=int),
                    *[
                        rng.integers(0, 2, size=n)
                        for _ in range(256)
                    ],
                ]

            for candidate in candidates:
                bits = np.asarray(candidate, dtype=int)

                # Correct dimod convention
                spins = {
                    i: 2 * int(bits[i]) - 1
                    for i in range(n)
                }

                e_qubo = qubo.energy(bits)
                e_ising = bqm.energy(spins)

                self.assertAlmostEqual(
                    e_qubo,
                    e_ising,
                    places=7,
                )

    def test_sample_decoding(self):
        qubo = build_qubo(baseline_a(), 4)
        reference = solve_exact_qubo(qubo)

        bits = reference["bits"]

        spins = {
            i: 2 * int(bits[i]) - 1
            for i in range(len(bits))
        }

        samples = dimod.SampleSet.from_samples(
            [spins],
            vartype=dimod.SPIN,
            energy=[reference["energy"]],
        )

        decoded = read_samples(qubo, samples)

        np.testing.assert_array_equal(
            decoded["bits"],
            bits,
        )

        self.assertEqual(decoded["energy"], 0)
        self.assertTrue(decoded["feasible_horizon"])


if __name__ == "__main__":
    unittest.main()
