"""Unit tests for physical feasibility, exactness, and counterexamples."""
import unittest
import numpy as np

from quantum_erp.model import (baseline_a, baseline_b, milling_outage,
                               schedule_records, validate, lower_bound)
from quantum_erp.reference import exact_reference, earliest_for_orders
from quantum_erp.qubo import build_qubo, solve_exact_qubo
from quantum_erp.qaoa import solve_a_quantum, qaoa_state


class HackathonTests(unittest.TestCase):
    def test_known_optima_independent_reference(self):
        self.assertEqual(exact_reference(baseline_a())['makespan'], 4)
        self.assertEqual(exact_reference(baseline_b())['makespan'], 8)
        self.assertEqual(exact_reference(milling_outage())['makespan'], 10)

    def test_lower_bound(self):
        self.assertEqual(lower_bound(baseline_a()), 4)
        self.assertEqual(lower_bound(baseline_b()), 8)

    def test_qaoa_quantum_state_and_measured_order(self):
        model = baseline_a()
        sol = solve_a_quantum(model)
        self.assertEqual(sol['num_logical_qubits'], 1)
        self.assertEqual(sol['qubo_constant'], 4)
        self.assertEqual(sol['qubo_linear'], 1)
        self.assertAlmostEqual(float(np.sum(np.abs(qaoa_state([4, 5], sol['gamma'], sol['beta']))**2)), 1)
        self.assertEqual(validate(model, schedule_records(model, sol['starts'])), 4)
        self.assertGreater(sol['probabilities'][0], 1-1e-10)

    def test_pruned_baseline_qubo_exact(self):
        factory = baseline_b()
        qubo = build_qubo(factory, 8)
        self.assertEqual(qubo.raw_variables, 72)
        self.assertEqual(qubo.unpruned_window_variables, 39)
        self.assertEqual(len(qubo.variables), 39)
        result = solve_exact_qubo(qubo)
        self.assertEqual(result['mip_gap'], 0)
        self.assertAlmostEqual(result['energy'], 0)
        self.assertEqual(validate(factory, schedule_records(factory, qubo.starts(result['bits']))), 8)

    def test_outage_qubo_exact_and_lower_horizon_impossible(self):
        factory = milling_outage()
        for H in (8, 9):
            q = build_qubo(factory, H)
            self.assertGreater(solve_exact_qubo(q)['energy'], 0.5)
        q = build_qubo(factory, 10)
        self.assertEqual(q.unpruned_window_variables, 57)
        self.assertEqual(len(q.variables), 50)
        bits = solve_exact_qubo(q)['bits']
        self.assertEqual(validate(factory, schedule_records(factory, q.starts(bits))), 10)

    def test_validator_rejects_overlap_and_outage(self):
        model = baseline_a()
        reference = exact_reference(model)
        valid = schedule_records(model, reference['starts'])
        self.assertEqual(validate(model, valid), 4)
        tampered = [x.copy() for x in valid]
        for rec in tampered:
            if rec['job'] == 'Z1' and rec['machine'] == 'T':
                rec['start'] = 0
                rec['end'] = 2
        with self.assertRaises(ValueError):
            validate(model, tampered)
        bad = [x.copy() for x in schedule_records(milling_outage(), exact_reference(milling_outage())['starts'])]
        for rec in bad:
            if rec['machine'] == 'F' and rec['job'] == 'Z1':
                rec['start'], rec['end'] = 2, 3
        with self.assertRaises(ValueError):
            validate(milling_outage(), bad)

    def test_permutation_vs_all_machine_orders(self):
        factory = baseline_b()
        ref = exact_reference(factory)
        self.assertEqual(ref['enumerated_machine_orders'], 216)
        orders = ((1, 0, 2),) * 3
        permutation_value = earliest_for_orders(factory, orders)[0]
        self.assertEqual(permutation_value, 8)


if __name__ == '__main__':
    unittest.main()
