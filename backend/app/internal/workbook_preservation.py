"""Preserve table-owned inputs when the geometry adapter rebuilds a workbook."""
from .input_schema import NODE_SETS, OPTION_SETS, FORECASTS, NODE_FIELDS, PIPE_FIELDS, dimension_count

def worksheet_cells(ws):
    headers = [cell.value for cell in ws[2]]
    while headers and headers[-1] is None:
        headers.pop()
    count = dimension_count(headers)
    values = {}
    for row in ws.iter_rows(min_row=3, values_only=True):
        keys = tuple(row[:count])
        if any(key in (None, '') for key in keys):
            continue
        for col, header in enumerate(headers[count:], start=count):
            if header is not None:
                values[(*keys, header)] = row[col] if col < len(row) else None
    return values

class WorkbookPreservation:
    def __init__(self, wb, data, previous_map=None):
        self.wb, self.data, self.previous_map = wb, data, previous_map
        self.cells = {ws.title: worksheet_cells(ws) for ws in wb if ws.title not in (*NODE_SETS, *OPTION_SETS, 'TimePeriods')}
        self.old_periods = [c.value for c in wb['CompletionsDemand'][2][1:] if c.value is not None]
        self.periods = data.get('time_periods', self.old_periods)
        self.changed = set()
        self.previous_edges = {(node['name'], target)
            for arc in (previous_map or {}).get('arcs', {}).values()
            for node in arc.get('nodes', []) for target in node.get('outgoing_nodes', [])}

    def reset(self, ws):
        if ws.title in (*NODE_SETS, *OPTION_SETS):
            return
        self.changed.add(ws.title)
        for row in ws.iter_rows(min_row=3):
            for cell in row:
                cell.value = None

    def map_owns(self, table, keys):
        node = keys[0]
        current = self.data.get('all_nodes', {}).get(node)
        if current is None:
            current = next((nodes[node] for name, nodes in self.data.items()
                            if name in NODE_SETS and node in nodes), {})
        old = (self.previous_map or {}).get('all_nodes', {}).get(node, {})
        if table in NODE_FIELDS:
            return table in current and (self.previous_map is None or current.get(table) != old.get(table))
        if table == 'InitialTreatmentCapacity':
            return keys[-1] == current.get('TreatmentTechnology') and (
                self.previous_map is None or any(current.get(k) != old.get(k) for k in ('Capacity', 'TreatmentTechnology')))
        if table in PIPE_FIELDS:
            return (tuple(keys[:2]), PIPE_FIELDS[table]) in self.data.get('_changed_pipe_fields', set())
        return False

    def restore(self):
        for name in self.changed:
            ws = self.wb[name]
            if name in ('PadWaterQuality', 'ExternalWaterQuality', 'StorageInitialWaterQuality', 'PadStorageInitialWaterQuality'):
                components = [r[0] for r in self.wb['WaterQualityComponents'].iter_rows(min_row=2, values_only=True) if r[0] not in (None, '')]
                for col in range(2, max(ws.max_column, len(components) + 1) + 1):
                    ws.cell(2, col).value = components[col - 2] if col - 2 < len(components) else None
            headers = [c.value for c in ws[2]]
            count = dimension_count([h for h in headers if h is not None])
            original = self.cells.get(name, {})
            for row in ws.iter_rows(min_row=3):
                keys = tuple(c.value for c in row[:count])
                if any(k in (None, '') for k in keys):
                    continue
                for col, cell in enumerate(row[count:], start=count):
                    header = headers[col]
                    if header is None:
                        continue
                    key = (*keys, header)
                    if key not in original or original[key] in (None, '') or self.map_owns(name, key):
                        continue
                    # Geometry controls enabled pipe directions; a surviving treatment
                    # direction keeps its treated/residual stream classification.
                    if len(name) == 3 and name.endswith('A') and cell.value is None and (
                            self.previous_map is None or key in self.previous_edges):
                        continue
                    cell.value = original[key]

        # Empty CP sets still carry the compatibility headers used by PARETO.
        for name, node_sets in FORECASTS.items():
            ws = self.wb[name]
            original = self.cells.get(name, {})
            for row in ws:
                if row[0].row >= 2:
                    for cell in row:
                        cell.value = None
            rows = [n for s in node_sets for n in self.data.get(s, {})]
            ws.cell(2, 1).value = node_sets[0]
            for col, period in enumerate(self.periods, 2):
                ws.cell(2, col).value = period
                for row, node in enumerate(rows, 3):
                    ws.cell(row, col).value = original.get((node, period))
            for row, node in enumerate(rows, 3):
                ws.cell(row, 1).value = node
        ws = self.wb['TimePeriods'] if 'TimePeriods' in self.wb else self.wb.create_sheet('TimePeriods')
        ws.delete_rows(1, ws.max_row)
        ws.cell(1, 1).value = 'TimePeriods'
        for row, period in enumerate(self.periods, 2):
            ws.cell(row, 1).value = period
