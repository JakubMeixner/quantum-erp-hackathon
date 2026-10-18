"""Factory model, parsing, exact feasibility checks, and horizon bounds."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, Tuple


@dataclass(frozen=True)
class Factory:
    name: str
    jobs: tuple[str, ...]
    machines: tuple[str, ...]
    durations: tuple[tuple[int, ...], ...]
    # Each entry: machine name -> tuple of unavailable [start,end) intervals.
    outages: tuple[tuple[str, tuple[tuple[int, int], ...]], ...] = ()

    def __post_init__(self):
        if (
            not self.jobs
            or len(set(self.jobs)) != len(self.jobs)
            or len(self.jobs) != len(self.durations)
        ):
            raise ValueError('Invalid job list or processing matrix')

        if not self.machines or len(set(self.machines)) != len(self.machines):
            raise ValueError('Machine names must be nonempty and unique')

        for row in self.durations:
            if len(row) != len(self.machines):
                raise ValueError('Incorrect number of operations')

            if any(type(d) is not int or d <= 0 for d in row):
                raise ValueError('Durations must be positive integers')

        seen = set()

        for machine, intervals in self.outages:
            if machine not in self.machines or machine in seen:
                raise ValueError('Invalid or duplicated outage machine')

            seen.add(machine)

            for a, b in intervals:
                if (
                    type(a) is not int
                    or type(b) is not int
                    or not (0 <= a < b)
                ):
                    raise ValueError('Invalid outage interval')

            for (a, b), (c, d) in zip(intervals, intervals[1:]):
                if b > c:
                    raise ValueError('Outage intervals overlap or are unsorted')

    def downtime(self, machine_index: int):
        return dict(self.outages).get(self.machines[machine_index], ())

    def operation_is_available(
        self, machine_index: int, start: int, duration: int
    ) -> bool:
        """Whether an uninterrupted operation avoids every outage."""
        return all(
            start + duration <= a or start >= b
            for a, b in self.downtime(machine_index)
        )

    @property
    def n(self): return len(self.jobs)

    @property
    def m(self): return len(self.machines)


def baseline_a():
    return Factory('instance_2x2', ('Z1', 'Z2'), ('T', 'F'), ((2, 1), (1, 2)))


def baseline_b():
    return Factory('instance_3x3', ('Z1', 'Z2', 'Z3'), ('T', 'F', 'S'),
                   ((2, 1, 2), (1, 2, 1), (2, 2, 1)))


def milling_outage():
    b = baseline_b()
    return Factory('extension_milling_outage', b.jobs, b.machines, b.durations,
                   (('F', ((2, 4),)),))


def lower_bound(factory: Factory) -> int:
    """Job workload, machine workload and first/last-job machine-pipeline bounds."""
    p = factory.durations
    bound = max(max(map(sum, p)), max(sum(p[j][k] for j in range(factory.n))
                                     for k in range(factory.m)))
    for k in range(factory.m):
        before = min(sum(row[:k]) for row in p)
        during = sum(row[k] for row in p)
        after = min(sum(row[k+1:]) for row in p)
        bound = max(bound, before + during + after)
    return bound


def safe_upper_bound(factory: Factory) -> int:
    """Sequentially process everything after all outages: a constructive bound."""
    last_outage = max((b for k in range(factory.m) for a, b in factory.downtime(k)), default=0)
    return last_outage + sum(map(sum, factory.durations))


def schedule_records(factory: Factory, starts: Dict[Tuple[int, int], int]):
    return [dict(job=factory.jobs[j], machine=factory.machines[k], start=starts[j,k],
                 end=starts[j,k]+factory.durations[j][k])
            for j in range(factory.n) for k in range(factory.m)]


def validate(factory: Factory, records: list[dict]):
    """Raises ValueError for ANY missing, duplicated, overlapping, or invalid operation."""
    expected = {(j, k) for j in factory.jobs for k in factory.machines}
    if len(records) != len(expected):
        raise ValueError('Wrong number of operation records')
    ops = {}
    for row in records:
        key = (row['job'], row['machine'])
        if key not in expected or key in ops:
            raise ValueError(f'Unexpected/duplicated operation {key}')
        start, end = row['start'], row['end']
        if not isinstance(start, int) or not isinstance(end, int) or start < 0:
            raise ValueError(f'Invalid time for {key}')
        i, k = factory.jobs.index(key[0]), factory.machines.index(key[1])
        if end - start != factory.durations[i][k]:
            raise ValueError(f'Incorrect duration for {key}')
        if not factory.operation_is_available(
            k, start, factory.durations[i][k]
        ):
            raise ValueError(f'Machine outage violated by {key}')
        ops[key] = (start, end)
    if set(ops) != expected:
        raise ValueError('Missing operation')
    for job in factory.jobs:
        for k in range(factory.m-1):
            if ops[job, factory.machines[k]][1] > ops[job, factory.machines[k+1]][0]:
                raise ValueError(f'Technological precedence violated: {job}')
    for machine in factory.machines:
        ordered = sorted((start, end, job) for (job, mk), (start, end) in ops.items() if mk == machine)
        for (_, end, _), (next_start, _, _) in zip(ordered, ordered[1:]):
            if next_start < end:
                raise ValueError(f'Machine overlap: {machine}')
    return max(ops[job, factory.machines[-1]][1] for job in factory.jobs)
