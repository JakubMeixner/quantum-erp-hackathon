"""Read benchmark-compatible factory JSON, with an optional Stage-2 outages key."""
import json
from pathlib import Path
from .model import Factory


def read_factory(file):
    file = Path(file)
    data = json.loads(file.read_text(encoding='utf8'))
    if data['problem'] != 'erp_scheduling':
        raise ValueError('Unsupported problem type')
    jobs = tuple(row['id'] for row in data['jobs'])
    machines = tuple(op['machine'] for op in data['jobs'][0]['operations'])
    durations = []
    for job in data['jobs']:
        operations = job['operations']
        if tuple(op['machine'] for op in operations) != machines:
            raise ValueError('Each job must follow the common machine order')
        durations.append(tuple(op['duration'] for op in operations))
    outages_by_machine = {}
    for item in data.get('outages', []):
        outages_by_machine.setdefault(item['machine'], []).append((item['start'], item['end']))
    outages = tuple((mk, tuple(sorted(intervals))) for mk, intervals in sorted(outages_by_machine.items()))
    return Factory(file.stem, jobs, machines, tuple(durations), outages)
