"""Shared identifiers and table indexing for map, Excel and validation adapters."""
from copy import deepcopy
from hashlib import sha256
import json

NODE_SETS = {
    'ProductionPads': 'ProductionPad', 'CompletionsPads': 'CompletionsPad',
    'NetworkNodes': 'NetworkNode', 'SWDSites': 'DisposalSite',
    'StorageSites': 'StorageSite', 'TreatmentSites': 'TreatmentSite',
    'ExternalWaterSources': 'ExternalWaterSource', 'ReuseOptions': 'ReuseOption',
}
OPTION_SETS = ('PipelineDiameters', 'StorageCapacities', 'TreatmentCapacities',
               'InjectionCapacities', 'TreatmentTechnologies', 'WaterQualityComponents', 'AirEmissionsComponents')
FORECASTS = {
    'PadRates': ('ProductionPads',), 'CompletionsDemand': ('CompletionsPads',),
    'FlowbackRates': ('CompletionsPads',), 'WellPressure': ('ProductionPads', 'CompletionsPads'),
    'ReuseMinimum': ('ReuseOptions',), 'ReuseCapacity': ('ReuseOptions',),
    'ExtWaterSourcingAvailability': ('ExternalWaterSources',), 'DisposalOperatingCapacity': ('SWDSites',),
}
NODE_FIELDS = {
    'InitialDisposalCapacity', 'InitialStorageCapacity', 'CompletionsPadStorage',
    'PadOffloadingCapacity', 'NodeCapacities', 'DisposalOperationalCost', 'ReuseOperationalCost',
    'ExternalSourcingCost', 'TruckingHourlyCost', 'DesalinationSites', 'BeneficialReuseCost',
    'BeneficialReuseCredit', 'CompletionsPadOutsideSystem', 'Elevation', 'SWDDeep',
    'SWDAveragePressure', 'SWDProxPAWell', 'SWDProxInactiveWell', 'SWDProxEQ',
    'SWDProxFault', 'SWDProxHpOrLpWell',
}
PIPE_FIELDS = {'InitialPipelineCapacity': 'pipeline_capacity',
               'InitialPipelineDiameters': 'pipeline_diameter', 'PipelineExpansionDistance': 'pipeline_length'}
DEFAULT_UNITS = {'volume': 'bbl', 'distance': 'mile', 'diameter': 'inch', 'concentration': 'mg/liter',
                 'currency': 'USD', 'time': 'day', 'pressure': 'psi', 'elevation': 'foot',
                 'decision period': 'week', 'mass': 'g'}

def dimension_count(headers):
    """Match the reader's leading index columns, including duplicate NODES headers."""
    names = {s.lower() for s in (*NODE_SETS, *OPTION_SETS, 'TimePeriods')}
    names.update(('nodes', 'pads', 'index', 'time', 'quantity', 'freshwatersources'))
    count = 0
    for header in headers:
        if str(header).split('.')[0].lower() not in names:
            break
        count += 1
    return min(max(1, count), max(1, len(headers) - 1))

def table_cells(table):
    """Yield (index tuple, value) from a frontend column or matrix table."""
    if not isinstance(table, dict) or not table:
        return
    headers = list(table)
    count = dimension_count(headers)
    size = max((len(values) for values in table.values() if isinstance(values, list)), default=0)
    scalar = len(headers) == count + 1 and str(headers[-1]).lower() == 'value'
    for row in range(size):
        keys = tuple(table[h][row] if row < len(table.get(h, [])) else '' for h in headers[:count])
        for header in headers[count:]:
            values = table.get(header, [])
            yield (*keys, *((header,) if not scalar else ())), values[row] if row < len(values) else ''

def flat_table(table):
    if not isinstance(table, dict) or any(not isinstance(values, list) for values in table.values()):
        return {}
    return {keys: value for keys, value in table_cells(table)}

def input_revision(scenario):
    data = scenario.get('data_input') or {}
    payload = {k: data.get(k, {}) for k in ('df_sets', 'df_parameters', 'units')}
    payload['optimization'] = scenario.get('optimization', {})
    payload['override_values'] = scenario.get('override_values', {})
    return sha256(json.dumps(payload, sort_keys=True, separators=(',', ':'), allow_nan=False).encode()).hexdigest()

def with_horizon(data_input, periods):
    """Change all forecast columns together, preserving surviving periods by name."""
    if not isinstance(periods, list) or not periods or len(periods) > 520:
        raise ValueError('Choose between 1 and 520 planning periods.')
    if any(not isinstance(p, str) or not p.strip() or len(p) > 40 for p in periods):
        raise ValueError('Each planning period needs a short, nonempty name.')
    periods = [p.strip() for p in periods]
    if len(set(periods)) != len(periods):
        raise ValueError('Planning period names must be unique.')
    reserved = {name.lower() for name in (*NODE_SETS, *OPTION_SETS, 'TimePeriods', 'NODES', 'PADS', 'VALUE', 'INDEX', 'TIME', 'QUANTITY', 'FreshwaterSources')}
    if any(period.lower() in reserved for period in periods):
        raise ValueError('Period names cannot be reserved table headings. Use names such as T01 and T02.')
    result = deepcopy(data_input)
    result.setdefault('df_sets', {})['TimePeriods'] = periods
    tables = result.setdefault('df_parameters', {})
    for name, sets in FORECASTS.items():
        original = tables.get(name, {})
        old = flat_table(original)
        rows = [node for key in sets for node in result['df_sets'].get(key, [])]
        header = next(iter(original), sets[0])
        tables[name] = {header: rows, **{p: [old.get((node, p), '') for node in rows] for p in periods}}
    return result
