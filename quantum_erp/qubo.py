"""Actual time-indexed feasibility QUBOs and a certified exact QUBO solver.

QUBO E(x)=constant + sum c_i*x_i + sum_{i<j} q_ij*x_i*x_j.
All q_ij produced here are positive conflict penalties. The MILP solver uses
an EXACT positive-monomial linearization. A HiGHS 'optimal' certificate
therefore certifies a global minimum of the original QUBO, not an MILP proxy.
"""
from dataclasses import dataclass
from itertools import combinations
import numpy as np
from scipy.optimize import milp, Bounds, LinearConstraint
from scipy.sparse import lil_matrix
from .model import Factory


@dataclass
class QUBO:
    variables: list[tuple[int, int, int]]
    linear: np.ndarray
    quadratic: dict[tuple[int, int], int]
    constant: int
    windows: dict[tuple[int, int], list[int]]
    horizon: int
    raw_variables: int
    unpruned_window_variables: int

    def energy(self, bits):
        return float(self.constant + np.dot(self.linear, bits)
                     + sum(q * bits[i] * bits[j] for (i, j), q in self.quadratic.items()))

    def starts(self, bits):
        return {(j, k): t for (j, k, t), value in zip(self.variables, bits) if value > 0.5}


class ImpossibleHorizon(Exception):
    """An operation has no start time inside the requested horizon."""


def build_qubo(factory: Factory, horizon: int) -> QUBO:
    variables, windows = [], {}
    window_count = 0
    for j in range(factory.n):
        row = factory.durations[j]
        for k in range(factory.m):
            earliest = sum(row[:k])
            latest = horizon - sum(row[k:])
            raw_times = list(range(earliest, latest+1))
            window_count += len(raw_times)
            allowed = [t for t in raw_times
                       if factory.operation_is_available(k, t, row[k])]
            if not allowed:
                raise ImpossibleHorizon(f'{factory.jobs[j]} / {factory.machines[k]} cannot fit in H={horizon}')
            windows[j, k] = allowed
            variables.extend((j, k, t) for t in allowed)
    n = len(variables)
    ids = {var: i for i, var in enumerate(variables)}
    linear = np.zeros(n, dtype=np.int64)
    quadratic = {}
    constant = 0

    def pair(a, b, coefficient):
        if a == b:
            linear[a] += coefficient  # x^2=x for a binary variable
        else:
            key = tuple(sorted((a, b)))
            quadratic[key] = quadratic.get(key, 0) + coefficient

    # (sum_t x[j,k,t] - 1)^2 = 1 - sum_t x + 2*sum_{t<u} x_t*x_u.
    for j in range(factory.n):
        for k in range(factory.m):
            indices = [ids[j, k, t] for t in windows[j, k]]
            constant += 1
            for i in indices:
                linear[i] -= 1
            for i, other in combinations(indices, 2):
                pair(i, other, 2)

    # Forbidden technological predecessor-successor start pairs.
    for j, k, t in variables:
        if k < factory.m-1:
            for u in windows[j, k+1]:
                if u < t + factory.durations[j][k]:
                    pair(ids[j, k, t], ids[j, k+1, u], 1)

    # Forbidden overlaps between distinct jobs on the same machine.
    for k in range(factory.m):
        for i, j in combinations(range(factory.n), 2):
            for t in windows[i, k]:
                for u in windows[j, k]:
                    if t < u+factory.durations[j][k] and u < t+factory.durations[i][k]:
                        pair(ids[i, k, t], ids[j, k, u], 1)
    return QUBO(variables, linear, quadratic, constant, windows, horizon,
                factory.n*factory.m*horizon, window_count)


def solve_exact_qubo(qubo: QUBO, time_limit: float = 60):
    """Minimize the QUBO, with a strict HiGHS optimality certificate.

    For q>0, introduce y_ij in [0,1] with y_ij >= x_i+x_j-1.
    Since min q*y favors the smallest possible y, y=max(0,x_i+x_j-1)
    at the optimum. x binary => y=x_i*x_j. This is an EXACT reduction.
    """
    n = len(qubo.variables)
    pairs = list(qubo.quadratic)
    if not all(qubo.quadratic[p] > 0 for p in pairs):
        raise ValueError('Only positive-pair penalty QUBOs supported by this exact linearization')
    count = len(pairs)
    A = lil_matrix((count, n + count), dtype=float)
    for v, (i, j) in enumerate(pairs):
        A[v, i] = 1
        A[v, j] = 1
        A[v, n+v] = -1
    coefficients = np.concatenate((qubo.linear.astype(float),
                                   np.array([qubo.quadratic[p] for p in pairs], dtype=float)))
    result = milp(c=coefficients,
                  integrality=np.concatenate((np.ones(n), np.zeros(count))),
                  bounds=Bounds(np.zeros(n+count), np.ones(n+count)),
                  constraints=LinearConstraint(A.tocsr(),
                                               -np.inf * np.ones(count),
                                               np.ones(count)),
                  options={'time_limit': time_limit, 'mip_rel_gap': 0.0})
    if result.status != 0 or result.x is None or result.mip_gap > 1e-8:
        raise RuntimeError(f'No exact QUBO certificate: {result.message}')
    bits = np.rint(result.x[:n]).astype(int)
    energy = qubo.energy(bits)
    if abs((result.fun + qubo.constant) - energy) > 1e-6:
        raise AssertionError('QUBO energy does not match linearized MILP objective')
    return {'energy': energy, 'bits': bits, 'mip_gap': float(result.mip_gap),
            'pair_variables': count, 'status': 'proven globally optimal'}
