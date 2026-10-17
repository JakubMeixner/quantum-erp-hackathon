import unittest

import dimod
import numpy as np

from quantum_erp.model import baseline_a
from quantum_erp.qubo import build_qubo, solve_exact_qubo
from quantum_erp.veloxq_backend import read_samples


class VeloxQLabelTests(unittest.TestCase):

    def test_integer_and_string_labels(self):
        qubo = build_qubo(baseline_a(), 4)

        exact = solve_exact_qubo(qubo)
        bits = exact["bits"]

        self.assertEqual(exact["energy"], 0)

        for string_labels in (False, True):
            sample = {}

            for i, bit in enumerate(bits):
                label = str(i) if string_labels else i
                sample[label] = 2 * int(bit) - 1

            # Deliberately incorrect remote energy:
            # the adapter must recompute the actual QUBO energy.
            sampleset = dimod.SampleSet.from_samples(
                [sample],
                vartype=dimod.SPIN,
                energy=[999.0],
            )

            decoded = read_samples(qubo, sampleset)

            np.testing.assert_array_equal(
                decoded["bits"],
                bits,
            )

            self.assertEqual(decoded["energy"], 0)
            self.assertTrue(decoded["feasible_horizon"])


if __name__ == "__main__":
    unittest.main()
