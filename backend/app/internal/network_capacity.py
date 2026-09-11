"""Necessary capacity screening, with optimistic bounds for complex facilities."""
from collections import defaultdict, deque
import math
from .input_schema import NODE_SETS

def number(value, default=0):
    try:
        value = float(value)
        return value if math.isfinite(value) else default
    except (ValueError, TypeError):
        return default

def capacity_issues(sets, tables, edges, node_capacity=True):
    # Complex facilities are unlimited sinks and trucking is unlimited transport.
    # This relaxation cannot prove feasibility, but a bottleneck even under these
    # optimistic assumptions is also a bottleneck in the full model. Only pad
    # production is counted; ignoring flowback/external supply is conservative.
    relaxed_sinks = {n for key in ('CompletionsPads', 'StorageSites', 'TreatmentSites', 'ReuseOptions') for n in sets.get(key, [])}
    findings = []
    locations = [n for key in NODE_SETS for n in sets.get(key, [])]
    increment = max((number(v) for v in tables.get('PipelineCapacityIncrements', {}).values()), default=0)
    for period in sets.get('TimePeriods', []):
        supply = {p: number(tables.get('PadRates', {}).get((p, period))) for p in sets.get('ProductionPads', [])}
        required = sum(supply.values())
        if required <= 0:
            continue
        source, sink = ('source',), ('sink',)
        capacity, neighbors = defaultdict(float), defaultdict(set)
        original = {}
        def add(a, b, value, table=None, row=()):
            capacity[a, b] += max(0, value)
            neighbors[a].add(b); neighbors[b].add(a)
            if table:
                original[a, b] = (value, table, row)
        for node in locations:
            limit = number(tables.get('NodeCapacities', {}).get((node,)), required)
            if node not in sets.get('NetworkNodes', []) or not node_capacity or limit <= 0:
                limit = required
            add((node, 'in'), (node, 'out'), limit, 'NodeCapacities', (node,))
        for node, value in supply.items():
            add(source, (node, 'in'), value)
        for a, b, table in edges:
            limit = required if table.endswith('T') else number(tables.get('InitialPipelineCapacity', {}).get((a, b))) + increment
            add((a, 'out'), (b, 'in'), limit, table if table.endswith('T') else 'InitialPipelineCapacity', (a, b))
        for node in relaxed_sinks:
            add((node, 'out'), sink, required)
        for node in sets.get('SWDSites', []):
            initial = number(tables.get('InitialDisposalCapacity', {}).get((node,)))
            expansion = max((number(v) for key, v in tables.get('DisposalCapacityIncrements', {}).items() if key[0] == node), default=0) if initial == 0 else 0
            operating = number(tables.get('DisposalOperatingCapacity', {}).get((node, period)), 1)
            add((node, 'out'), sink, (initial + expansion) * operating, 'InitialDisposalCapacity', (node,))
        delivered = 0
        while delivered < required - 1e-8:
            parent, queue = {source: None}, deque([source])
            while queue and sink not in parent:
                a = queue.popleft()
                for b in neighbors[a]:
                    if b not in parent and capacity[a, b] > 1e-8:
                        parent[b] = a; queue.append(b)
            if sink not in parent:
                break
            amount, b = required - delivered, sink
            while parent[b] is not None:
                a = parent[b]; amount = min(amount, capacity[a, b]); b = a
            b = sink
            while parent[b] is not None:
                a = parent[b]; capacity[a, b] -= amount; capacity[b, a] += amount; b = a
            delivered += amount
        if delivered < required - 1e-6:
            reachable, queue = {source}, deque([source])
            while queue:
                a = queue.popleft()
                for b in neighbors[a]:
                    if b not in reachable and capacity[a, b] > 1e-8:
                        reachable.add(b); queue.append(b)
            cut = [(table, row) for (a, b), (limit, table, row) in original.items() if a in reachable and b not in reachable]
            findings.append({'period': period, 'required': required, 'capacity': delivered, 'cut': cut,
                             'relaxed': bool(relaxed_sinks) or any(t.endswith('T') for _, _, t in edges)})
    return findings
