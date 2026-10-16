#!/usr/bin/env python3
"""Run hackathon baseline A, baseline B, and scheduled-outage Stage 2.

No external quantum service or token is needed. Requires NumPy and SciPy.
"""
import argparse
import json
from pathlib import Path

from quantum_erp.model import (baseline_a, baseline_b, milling_outage,
                               lower_bound, safe_upper_bound,
                               schedule_records, validate)
from quantum_erp.reference import exact_reference
from quantum_erp.qubo import build_qubo, solve_exact_qubo, ImpossibleHorizon
from quantum_erp.qaoa import solve_a_quantum
from quantum_erp.io import read_factory


def write_json(target, value):
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(value, indent=2) + '\n', encoding='utf8')


def run_a(output, factory):
    quantum = solve_a_quantum(factory)
    records = schedule_records(factory, quantum['starts'])
    completion = validate(factory, records)
    classical = exact_reference(factory)
    assert completion == quantum['makespan'] == classical['makespan'] == 4
    submission = {'instance': factory.name, 'method': quantum['method'],
                  'makespan': completion, 'schedule': records}
    write_json(output/'schedule_2x2.json', submission)
    write_json(output/'qubo_2x2.json', {
        'description': 'x=0: Z2 then Z1; x=1: Z1 then Z2',
        'variables': ['x'], 'constant': quantum['qubo_constant'],
        'linear': [quantum['qubo_linear']], 'quadratic': []})
    diagnostics = {k:v for k,v in quantum.items() if k != 'starts'}
    diagnostics['classical_reference'] = classical['makespan']
    diagnostics['quantum_result_validated'] = True
    return submission, diagnostics


def run_time_indexed(factory, output, filename):
    reference = exact_reference(factory)
    tests = []
    chosen = None
    for H in range(lower_bound(factory), safe_upper_bound(factory) + 1):
        try:
            qubo = build_qubo(factory, H)
        except ImpossibleHorizon as err:
            tests.append({'horizon': H, 'feasible': False, 'reason': str(err)})
            continue
        result = solve_exact_qubo(qubo)
        feasible = abs(result['energy']) <= 1e-7
        metrics = {
            'horizon': H,
            'feasible': feasible,
            'minimum_qubo_energy': result['energy'],
            'solver_status': result['status'],
            'mip_gap': result['mip_gap'],
            'raw_start_variables': qubo.raw_variables,
            'window_start_variables_before_outage': qubo.unpruned_window_variables,
            'start_variables_after_outage': len(qubo.variables),
            'qubo_quadratic_couplings': len(qubo.quadratic),
            'linearization_auxiliaries_not_qubo_variables': result['pair_variables']
        }
        tests.append(metrics)
        if feasible:
            starts = qubo.starts(result['bits'])
            records = schedule_records(factory, starts)
            actual = validate(factory, records)
            if actual > H:
                raise AssertionError('Time-indexed decoding exceeds horizon')
            chosen = {'instance': factory.name,
                      'method': 'Time-indexed QUBO (exact classical HiGHS MILP linearization)',
                      'makespan': actual, 'schedule': records}
            if actual != reference['makespan'] or H != reference['makespan']:
                raise AssertionError('QUBO optimum disagrees with independent exhaustive reference')
            write_json(output/filename, chosen)
            write_json(output/f'qubo_{factory.name}_H{H}.json', {
                'formulation': 'Fixed-horizon feasibility QUBO',
                'horizon': H, 'constant': qubo.constant,
                'variables': [dict(job=factory.jobs[j], machine=factory.machines[k], start=t)
                              for j, k, t in qubo.variables],
                'linear': [int(v) for v in qubo.linear],
                'quadratic': [[int(i), int(j), int(q)]
                              for (i, j), q in sorted(qubo.quadratic.items())],
                'energy_at_optimum': result['energy']
            })
            break
    if chosen is None:
        raise RuntimeError('Failed to find a feasible bounded-horizon QUBO')
    return chosen, {'exact_classical_reference_makespan': reference['makespan'],
                    'enumerated_machine_order_combinations': reference['enumerated_machine_orders'],
                    'tested_horizons': tests,
                    'outages': {key: intervals for key, intervals in factory.outages},
                    'formulation': 'Penalty QUBO: exactly-once squares + invalid precedence pairs + overlapping-machine pairs',
                    'search': 'Find first feasible horizon starting at certified lower bound',
                    'objective_guarantee': 'Zero QUBO energy iff feasible at the tested horizon'}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parent/'results')
    parser.add_argument('--inputs', type=Path, default=Path(__file__).resolve().parent/'inputs')
    args = parser.parse_args()
    result_dir = args.output.resolve()
    result_dir.mkdir(exist_ok=True, parents=True)

    a, diag_a = run_a(result_dir, read_factory(args.inputs/'instance_2x2.json'))
    b, diag_b = run_time_indexed(read_factory(args.inputs/'instance_3x3.json'), result_dir, 'schedule_3x3.json')
    ext, diag_ext = run_time_indexed(read_factory(args.inputs/'extension_milling_outage.json'), result_dir, 'schedule_extension.json')
    write_json(result_dir/'diagnostics.json', {
        'instance_A': diag_a, 'instance_B': diag_b, 'stage2': diag_ext,
        'important_note': 'A uses a true 1-qubit QAOA simulator; B and Stage 2 use an exact classical QUBO solver. No quantum advantage is claimed.'
    })
    print('Instance A :', a['makespan'], 'hours (quantum state-vector simulation)')
    print('Instance B :', b['makespan'], 'hours (QUBO optimum + independent reference)')
    print('Stage 2    :', ext['makespan'], 'hours (milling unavailable [2,4))')
    for tag, case in [('B', diag_b), ('Stage 2', diag_ext)]:
        for row in case['tested_horizons']:
            if 'minimum_qubo_energy' in row:
                print(f"  {tag}, H={row['horizon']}: min QUBO energy={row['minimum_qubo_energy']:.8g}, "
                      f"start bits={row['start_variables_after_outage']}, "
                      f"couplings={row['qubo_quadratic_couplings']}")
    print('Output:', result_dir)


if __name__ == '__main__':
    main()
