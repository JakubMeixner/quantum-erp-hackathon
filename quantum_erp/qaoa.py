"""Real single-qubit QAOA state-vector simulation for the 2x2 permutation QUBO.

The one bit x encodes a VALID complete permutation schedule:
  x=0 -> (Z2,Z1), makespan=4
  x=1 -> (Z1,Z2), makespan=5
QUBO E(x)=4+x. BOTH bitstrings are feasible schedules.
Quantum cost unitary exp(-i gamma diag(E)), mixer exp(-i beta X).
"""
import numpy as np
from .model import Factory
from .reference import earliest_for_orders


def qaoa_state(energies, gamma, beta):
    state = np.exp(-1j * gamma * np.asarray(energies, dtype=float)) / np.sqrt(2)
    c, s = np.cos(beta), np.sin(beta)
    return c*state - 1j*s*state[::-1]


def solve_a_quantum(factory: Factory, seed: int = 2026, grid_steps: int = 64):
    if factory.n != 2 or factory.m != 2 or factory.outages:
        raise ValueError('This exact two-permutation QAOA example is restricted to baseline A')
    orders = [(1, 0), (0, 1)]
    energies = np.array([earliest_for_orders(factory, (p, p))[0] for p in orders])
    # This is an actual one-bit QUBO: E(x)=c+q*x, no invalid binary states.
    constant, linear = int(energies[0]), int(energies[1] - energies[0])
    best = None
    for gamma in np.linspace(0, 2*np.pi, grid_steps, endpoint=False):
        for beta in np.linspace(0, np.pi, grid_steps, endpoint=False):
            state = qaoa_state(energies, gamma, beta)
            probabilities = np.abs(state)**2
            expected_energy = float(np.dot(probabilities, energies))
            if best is None or expected_energy < best[0] - 1e-12:
                best = (expected_energy, float(gamma), float(beta), probabilities)
    expectation, gamma, beta, probabilities = best
    rng = np.random.default_rng(seed)
    counts = np.bincount(rng.choice(2, size=1024, p=probabilities), minlength=2)
    winner = int(np.argmax(counts))
    makespan, starts = earliest_for_orders(factory, (orders[winner],)*factory.m)
    return {
        'makespan': makespan, 'starts': starts, 'qaoa_expected_energy': expectation,
        'gamma': gamma, 'beta': beta,
        'probabilities': [float(x) for x in probabilities],
        'shots': 1024, 'counts': [int(x) for x in counts],
        'bitstring': winner, 'qubo_constant': constant, 'qubo_linear': linear,
        'num_logical_qubits': 1,
        'method': 'QAOA p=1 (NumPy state-vector simulator, 1-qubit permutation QUBO)'
    }
