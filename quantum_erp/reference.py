"""Independent exact reference: enumerate machine orders, evaluate precedence DAGs.

This enumeration is ONLY a verification/reference method, not the QUBO solver.
For n jobs and m machines, at most (n!)**m machine-order tuples are examined.
"""
from itertools import permutations, product
import heapq
from .model import Factory


def earliest_for_orders(factory: Factory, orders):
    n, m = factory.n, factory.m
    nodes = [(j, k) for j in range(n) for k in range(m)]
    successors = {node: [] for node in nodes}
    predecessors = {node: [] for node in nodes}

    def arc(a, b):
        successors[a].append(b)
        predecessors[b].append(a)

    for j in range(n):
        for k in range(m-1): arc((j, k), (j, k+1))
    for k, order in enumerate(orders):
        for j, nextj in zip(order, order[1:]): arc((j, k), (nextj, k))

    indegree = {v: len(predecessors[v]) for v in nodes}
    queue = [v for v in nodes if indegree[v] == 0]
    heapq.heapify(queue)
    starts, ends = {}, {}
    count = 0
    while queue:
        j, k = heapq.heappop(queue)
        count += 1
        start = max((ends[pred] for pred in predecessors[j, k]), default=0)
        duration = factory.durations[j][k]
        for a, b in factory.downtime(k):
            if start < b and a < start + duration:
                start = b
        starts[j, k] = start
        ends[j, k] = start + duration
        for v in successors[j, k]:
            indegree[v] -= 1
            if indegree[v] == 0: heapq.heappush(queue, v)
    if count != len(nodes):
        return None  # cyclic machine-order tuple is not feasible
    return max(ends[j, m-1] for j in range(n)), starts


def exact_reference(factory: Factory):
    permutations_ = list(permutations(range(factory.n)))
    best = None
    valid_orders = 0
    for orders in product(permutations_, repeat=factory.m):
        res = earliest_for_orders(factory, orders)
        if res is not None:
            valid_orders += 1
            value, starts = res
            if best is None or value < best[0]:
                best = (value, starts, orders)
    if best is None:
        raise RuntimeError('No possible ordering')
    return {'makespan': best[0], 'starts': best[1], 'orders': best[2],
            'valid_machine_orders': valid_orders,
            'enumerated_machine_orders': len(permutations_) ** factory.m}
