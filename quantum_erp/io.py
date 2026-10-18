"""Strict parsing for canonical and compact scheduling inputs."""

import json
from pathlib import Path
from .model import Factory


def _positive_int(value, label):
    if type(value) is not int or value <= 0:
        raise ValueError(f'{label} must be a positive integer')
    return value


def _nonnegative_int(value, label):
    if type(value) is not int or value < 0:
        raise ValueError(f'{label} must be a nonnegative integer')
    return value


def _unique_names(values, label):
    if not isinstance(values, (list, tuple)) or not values:
        raise ValueError(f'{label} must be a nonempty list')
    if any(not isinstance(v, str) or not v for v in values):
        raise ValueError(f'{label} must contain nonempty strings')
    if len(set(values)) != len(values):
        raise ValueError(f'{label} contains duplicates')
    return tuple(values)


def factory_from_payload(data, name='input'):
    """Accept official hackathon JSON or compact jobs/machines/durations JSON."""

    if not isinstance(data, dict):
        raise ValueError('Expected a JSON object')

    if data.get('problem', 'erp_scheduling') != 'erp_scheduling':
        raise ValueError('Unsupported problem type')

    rows = data.get('jobs')
    if not isinstance(rows, list) or not rows:
        raise ValueError('jobs must be a nonempty list')

    if all(isinstance(row, str) for row in rows):
        jobs = _unique_names(rows, 'jobs')
        machines = _unique_names(data.get('machines'), 'machines')
        supplied = data.get('durations')

        if not isinstance(supplied, dict) or set(supplied) != set(jobs):
            raise ValueError('durations must contain exactly the specified jobs')

        durations = []
        for job in jobs:
            duration_row = supplied[job]
            if not isinstance(duration_row, dict) or set(duration_row) != set(machines):
                raise ValueError(f'Invalid durations for job {job}')

            durations.append(tuple(
                _positive_int(duration_row[mk], f'{job}/{mk}')
                for mk in machines
            ))

    elif all(isinstance(row, dict) for row in rows):
        jobs = _unique_names([r.get('id') for r in rows], 'job IDs')
        first_ops = rows[0].get('operations')

        if not isinstance(first_ops, list) or not first_ops:
            raise ValueError('Operations must be nonempty')

        machines = _unique_names(
            [op.get('machine') for op in first_ops if isinstance(op, dict)],
            'machines'
        )

        durations = []
        for row in rows:
            operations = row.get('operations')

            if (
                not isinstance(operations, list)
                or len(operations) != len(machines)
                or any(not isinstance(op, dict) for op in operations)
            ):
                raise ValueError(f'Invalid operations for job {row["id"]}')

            if tuple(op.get('machine') for op in operations) != machines:
                raise ValueError('Every job must follow the same machine order')

            durations.append(tuple(
                _positive_int(
                    op.get('duration'),
                    f'{row["id"]}/{op.get("machine")}'
                )
                for op in operations
            ))
    else:
        raise ValueError('Invalid or mixed job representations')

    given = data.get('outages', [])
    if not isinstance(given, list):
        raise ValueError('outages must be an array')

    by_machine = {}

    for ix, outage in enumerate(given):
        if not isinstance(outage, dict):
            raise ValueError(f'outages[{ix}] must be an object')

        machine = outage.get('machine')
        if machine not in machines:
            raise ValueError(f'Unknown outage machine: {machine!r}')

        start = _nonnegative_int(
            outage.get('start'), f'outages[{ix}].start'
        )
        end = _positive_int(
            outage.get('end'), f'outages[{ix}].end'
        )

        if end <= start:
            raise ValueError('Outage must satisfy start < end')

        by_machine.setdefault(machine, []).append((start, end))

    outages = []

    for machine in machines:
        intervals = sorted(by_machine.get(machine, []))

        for (a, b), (c, d) in zip(intervals, intervals[1:]):
            if b > c:
                raise ValueError(f'Overlapping outages on {machine}')

        if intervals:
            outages.append((machine, tuple(intervals)))

    return Factory(
        name, jobs, machines, tuple(durations), tuple(outages)
    )


def read_factory(file):
    file = Path(file)
    data = json.loads(file.read_text(encoding='utf8'))
    return factory_from_payload(data, file.stem)
