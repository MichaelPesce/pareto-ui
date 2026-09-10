"""Deterministic scenario requirements and separately qualified solver evidence."""
from collections import Counter, defaultdict, deque
from copy import deepcopy
from dataclasses import dataclass
from importlib.metadata import version
from itertools import product
import math
import re
import threading

from pareto.utilities.process_data import get_valid_piping_arc_list, get_valid_trucking_arc_list
from .input_schema import NODE_SETS, OPTION_SETS, FORECASTS, flat_table, dimension_count, input_revision
from .util import prepare_config
from .validation_help import network_help

CATALOG_VERSION = 3
MODEL_LOCK = threading.Lock()
ARC_SETS = dict(zip('PCNKSRFO', ('ProductionPads', 'CompletionsPads', 'NetworkNodes', 'SWDSites',
                                 'StorageSites', 'TreatmentSites', 'ExternalWaterSources', 'ReuseOptions')))
PIPES = get_valid_piping_arc_list()
TRUCKS = get_valid_trucking_arc_list()
SECTION_NAMES = {'network': 'Network', 'forecasts': 'Planning periods and forecasts',
                 'capacity': 'Capacity', 'costs': 'Costs and assumptions', 'settings': 'Optimization settings'}

@dataclass(frozen=True)
class Requirement:
    table: str
    node_set: str
    section: str
    default: str = ''
    minimum: float = 0
    maximum: float = math.inf

REQUIREMENTS = (
    Requirement('InitialDisposalCapacity', 'SWDSites', 'capacity'),
    Requirement('DisposalOperationalCost', 'SWDSites', 'costs'),
    Requirement('InitialStorageCapacity', 'StorageSites', 'capacity'),
    Requirement('InitialStorageLevel', 'StorageSites', 'capacity', '0'),
    Requirement('CompletionsPadStorage', 'CompletionsPads', 'capacity', '0'),
    Requirement('NodeCapacities', 'NetworkNodes', 'capacity', 'unrestricted'),
    Requirement('CompletionsPadOutsideSystem', 'CompletionsPads', 'capacity', '0 (inside the system)', maximum=1),
    Requirement('DesalinationSites', 'TreatmentSites', 'capacity', maximum=1),
    Requirement('ExternalSourcingCost', 'ExternalWaterSources', 'costs'),
    Requirement('ReuseOperationalCost', 'CompletionsPads', 'costs', 'the parent model fallback cost'),
    Requirement('BeneficialReuseCost', 'ReuseOptions', 'costs', '0'),
    Requirement('BeneficialReuseCredit', 'ReuseOptions', 'costs', '0'),
)

def numeric(value):
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (TypeError, ValueError):
        return None

def validate_inputs(scenario, *, fill_targets=None):
    data = scenario.get('data_input') or {}
    sets, tables = data.get('df_sets') or {}, data.get('df_parameters') or {}
    periods = sets.get('TimePeriods', [])
    units = data.get('units') or {}
    flat = {key: flat_table(table) for key, table in tables.items()}
    issues, counts, error_tables = [], Counter(), set()
    # Collect every eligible cell, independently of the displayed issue limit.
    targets = fill_targets if fill_targets is not None else {}
    legacy_excel = data.get('origin', 'map' if data.get('map_data') else 'excel') == 'excel'
    rate_unit = f"{units.get('volume', 'bbl')}/{units.get('time', 'day')}"

    def issue(code, section, message, table=None, row=(), period=None, severity='error', actual=None, expected=None):
        counts[(section, severity)] += 1
        if severity == 'error' and table:
            error_tables.add(table)
        if len(issues) >= 250 and severity == 'error':
            warning = next((i for i, item in enumerate(issues) if item['severity'] == 'warning'), None)
            if warning is not None:
                issues.pop(warning)
        if len(issues) < 250:
            issues.append({'code': code, 'section': section, 'severity': severity, 'message': message,
                           'table': table, 'row': list(row), 'period': period, 'actual': actual,
                           'expected': expected, 'area': 'map' if section == 'network' else 'table',
                           'help': network_help(code, table, row, sets)})

    def require(table, keys, section, default='', minimum=0, maximum=math.inf, period=None):
        value = flat.get(table, {}).get(tuple(keys), '')
        number = numeric(value)
        invalid_reuse = table == 'ReuseCapacity' and number is not None and -1 < number < 0
        if number is None or not minimum <= number <= maximum or invalid_reuse:
            targets[(table, tuple(keys))] = {'table': table, 'keys': tuple(keys), 'section': section,
                                            'minimum': minimum, 'maximum': maximum}
        if value in ('', None):
            issue('default_used' if default else 'missing_value', section,
                  f"{table}: {' / '.join(keys)} is blank. " + (f"The model uses {default}; review this assumption." if default else 'Enter a value, including an explicit zero when appropriate.'),
                  table, keys[:1] if period else keys, period, 'warning' if default else 'error')
            return None
        if number is None or not minimum <= number <= maximum:
            expected = f'a finite number ≥ {minimum}' if maximum == math.inf else f'a number from {minimum} to {maximum}'
            issue('invalid_value', section, f"{table}: {' / '.join(keys)} must be {expected}.", table, keys[:1] if period else keys,
                  period, actual=value, expected=expected)
            return None
        return number

    try:
        config = prepare_config(scenario, 'modelParameters')
        prepare_config(scenario)
    except (ValueError, KeyError, TypeError) as error:
        config = prepare_config({'optimization': {}}, 'modelParameters')
        issue('invalid_configuration', 'settings', f'Review optimization settings: {error}')
    if not periods:
        issue('missing_horizon', 'forecasts', 'Choose the planning periods before entering forecasts.', 'TimePeriods')
    elif len(set(periods)) != len(periods) or any(not isinstance(t, str) or not t.strip() for t in periods):
        issue('invalid_horizon', 'forecasts', 'Planning periods must have unique, nonempty names.', 'TimePeriods')
    elif periods != sorted(periods):
        issue('period_order', 'forecasts', 'The installed model checks storage using alphabetically sorted periods. Use ordered names such as T01, T02, …, T10.', 'TimePeriods', severity='warning')

    for name in ('volume', 'time', 'decision period', 'currency', 'distance', 'diameter', 'concentration', 'pressure', 'elevation', 'mass'):
        if name not in units or not re.fullmatch(r'[A-Za-z][A-Za-z0-9_]*(/[A-Za-z][A-Za-z0-9_]*)?', str(units.get(name, ''))):
            issue('invalid_units', 'settings', f'The input workbook needs a valid {name} unit.', 'Units', (name,))
    locations = {}
    for name in (*NODE_SETS, *OPTION_SETS):
        values = sets.get(name, [])
        if len(values) != len(set(values)):
            issue('duplicate_identifier', 'network', f'{name} contains duplicate identifiers.', name)
        if name in NODE_SETS:
            for node in values:
                if node in locations or not isinstance(node, str) or not node.strip():
                    issue('invalid_identifier', 'network', f'{node!r} must identify exactly one facility.', name, (str(node),))
                locations[node] = name
    if not any(sets.get(s) for s in ('ProductionPads', 'CompletionsPads')):
        issue('missing_production_source', 'network', 'Classify at least one production or flowback pad. The installed model cannot solve with zero total produced water.')
    if not any(sets.get(s) for s in ('CompletionsPads', 'SWDSites', 'StorageSites', 'ReuseOptions')):
        issue('missing_destination', 'network', 'Classify a destination for the produced water, such as a disposal site or completions pad.')

    # Structural checks apply even to optional tables, so bad indices never hide
    # behind defaults. Configuration-specific domains are checked below.
    all_ids = set(locations)
    for table, columns in tables.items():
        if not isinstance(columns, dict) or any(not isinstance(v, list) for v in columns.values()):
            issue('invalid_table', 'forecasts', f'{table} must contain columns of values.', table)
            continue
        if len({len(v) for v in columns.values()}) > 1:
            issue('unequal_columns', 'forecasts', f'{table} has columns with different row counts.', table)
        headers = list(columns)
        for keys, value in flat.get(table, {}).items():
            if value not in ('', None) and numeric(value) is None:
                issue('nonnumeric_value', 'settings', f'{table} contains a nonnumeric or nonfinite value.', table, keys, actual=str(value))
        for header in headers[:dimension_count(headers)]:
            base = header.split('.')[0]
            domain = set(sets[base]) if base in sets and table != 'TreatmentCapacityIncrements' else None
            if base.lower() in ('nodes', 'pads'):
                domain = all_ids
            if domain is not None:
                for value in columns[header]:
                    if value not in domain and value not in ('', None):
                        issue('unknown_identifier', 'network', f'{table} refers to unknown {base} identifier {value}.', table, (str(value),))

    for table in ('PadRates', 'CompletionsDemand', 'FlowbackRates', 'ExtWaterSourcingAvailability', 'ReuseMinimum', 'ReuseCapacity', 'DisposalOperatingCapacity'):
        table_sets = FORECASTS[table]
        rows = [n for s in table_sets for n in sets.get(s, [])]
        if not rows:
            continue
        default = '1 (100% operating capacity)' if table == 'DisposalOperatingCapacity' else ''
        if legacy_excel and table in ('PadRates', 'CompletionsDemand', 'FlowbackRates'):
            default = '0, following the imported Excel convention'
        for node, period in product(rows, periods):
            number = require(table, (node, period), 'capacity' if table == 'DisposalOperatingCapacity' else 'forecasts', default,
                    minimum=-1 if table == 'ReuseCapacity' else 0,
                    maximum=1 if table == 'DisposalOperatingCapacity' else math.inf, period=period)
            if table == 'ReuseCapacity' and number is not None and -1 < number < 0:
                issue('invalid_value', 'forecasts', 'ReuseCapacity must be nonnegative, or -1 for unrestricted capacity.', table, (node,), period)
        for keys in flat.get(table, {}):
            if len(keys) != 2 or keys[1] not in periods:
                issue('forecast_period', 'forecasts', f'{table} contains a period outside the planning horizon.', table, keys[:1], str(keys[-1]))
    if periods and sum(numeric(v) or 0 for table in ('PadRates', 'FlowbackRates') for v in flat.get(table, {}).values()) <= 0:
        issue('zero_produced_water', 'forecasts', 'Enter the production or flowback forecast. This model requires positive total produced water.', 'PadRates')

    for requirement in REQUIREMENTS:
        if requirement.table == 'NodeCapacities' and not config['node_capacity']:
            continue
        for node in sets.get(requirement.node_set, []):
            require(requirement.table, (node,), requirement.section, requirement.default, requirement.minimum, requirement.maximum)
    for field in ('discount_rate', 'CAPEX_lifetime'):
        require('Economics', (field,), 'costs')
    if config['pipeline_cost'] == 'distance_based':
        require('PipelineCapexDistanceBased', ('pipeline_expansion_cost',), 'costs')
    for name, sites in (('InjectionCapacities', 'SWDSites'), ('StorageCapacities', 'StorageSites'), ('TreatmentCapacities', 'TreatmentSites'), ('TreatmentTechnologies', 'TreatmentSites')):
        if sets.get(sites) and not sets.get(name):
            issue('missing_options', 'capacity', f'{sites} requires {name}, including a zero-capacity option when no construction is intended.', name)
    for node in sets.get('StorageSites', []):
        initial = numeric(flat.get('InitialStorageLevel', {}).get((node,), 0))
        capacity = numeric(flat.get('InitialStorageCapacity', {}).get((node,)))
        if initial is not None and capacity is not None and initial > capacity:
            issue('initial_storage_capacity', 'capacity', f'{node} starts with more water than its initial storage capacity.', 'InitialStorageLevel', (node,))
    for site, tech in product(sets.get('TreatmentSites', []), sets.get('TreatmentTechnologies', [])):
        require('TreatmentEfficiency', (site, tech), 'capacity', maximum=1)
        require('TreatmentOperationalCost', (site, tech), 'costs')
    for tech in sets.get('TreatmentTechnologies', []) if sets.get('TreatmentSites') else []:
        require('DesalinationTechnologies', (tech,), 'capacity', maximum=1)

    edges, adjacency = [], defaultdict(set)
    for table in (*PIPES, *TRUCKS):
        origin_set, destination_set = ARC_SETS[table[0]], ARC_SETS[table[1]]
        for keys, value in flat.get(table, {}).items():
            if value in ('', None, 0, '0'):
                continue
            if len(keys) != 2 or keys[0] not in sets.get(origin_set, []) or keys[1] not in sets.get(destination_set, []):
                issue('invalid_arc', 'network', f'{table} must connect {origin_set} to {destination_set}.', table, keys)
                continue
            if numeric(value) not in ((1, 2) if table.startswith('R') else (1,)):
                issue('arc_value', 'network', f'{table}: use 1 for an enabled route' + (' or 2 for residual water.' if table.startswith('R') else '.'), table, keys)
                continue
            a, b = keys
            adjacency[a].add(b)
            edges.append((a, b, table))
            if table in PIPES:
                require('InitialPipelineCapacity', keys, 'capacity', '0 (new construction required)')
                require('PipelineExpansionDistance', keys, 'costs')
                require('PipelineOperationalCost', keys, 'costs', '0.01 USD/bbl')
                if config['pipeline_cost'] == 'capacity_based':
                    for option in sets.get('PipelineDiameters', []):
                        require('PipelineCapexCapacityBased', (*keys, option), 'costs')
            else:
                require('TruckingTime', keys, 'costs', '12 hours' if legacy_excel else '')
                costs = [numeric(v) for v in flat.get('TruckingHourlyCost', {}).values()]
                costs = [v for v in costs if v is not None]
                fallback = f'{max(costs) * 100 if costs else 15000:g} {units.get("currency", "USD")}/hour'
                require('TruckingHourlyCost', (a,), 'costs', fallback if legacy_excel else '')
    if any(table in PIPES for _, _, table in edges):
        if not sets.get('PipelineDiameters'):
            issue('missing_pipeline_options', 'capacity', 'Add pipeline size options, including a zero increment when no construction is intended.', 'PipelineDiameters')
        for diameter in sets.get('PipelineDiameters', []):
            require('PipelineDiameterValues', (diameter,), 'capacity')
            if config['pipeline_capacity'] == 'input':
                require('PipelineCapacityIncrements', (diameter,), 'capacity')
    sinks = set(n for s in ('CompletionsPads', 'SWDSites', 'ReuseOptions') for n in sets.get(s, []))
    # The installed model fixes final storage inventory to zero. Evaporation is
    # possible only with a CB-EV treatment option and a treatment-to-storage pipe.
    evaporation_storage = {b for a, b, table in edges if table == 'RSA'} if 'CB-EV' in sets.get('TreatmentTechnologies', []) else set()
    sinks.update(evaporation_storage)
    for node in (*sets.get('ProductionPads', []), *sets.get('CompletionsPads', [])):
        supply = sum(numeric(v) or 0 for table in ('PadRates', 'FlowbackRates') for key, v in flat.get(table, {}).items() if key[0] == node)
        if supply <= 0:
            continue
        seen, pending = set(), [node]
        while pending:
            current = pending.pop()
            if current not in seen:
                seen.add(current)
                pending.extend(adjacency[current] - seen)
        if not (seen - {node}) & sinks:
            storage = sorted(seen & set(sets.get('StorageSites', [])))
            if storage:
                issue('storage_only_destination', 'network',
                      f'{node} can reach storage ({", ".join(storage)}) but no final destination. Storage must end empty; add an onward route to disposal, completions demand or beneficial reuse.', row=(node,))
            else:
                issue('unreachable_destination', 'network', f'{node} produces water but has no directed route to a destination. Review the connections and flow directions.', row=(node,))
    for site in sets.get('TreatmentSites', []):
        streams = {numeric(flat[t].get((a, b))) for a, b, t in edges if a == site}
        if 2 not in streams:
            issue('residual_boundary', 'capacity', f'{site} has no residual-water route. The parent model omits that stream balance; review whether residual water should leave the modeled network.', severity='warning', row=(site,))

    if config['pipeline_capacity'] == 'input' and not any(counts[(section, 'error')] for section in ('forecasts', 'capacity')):
        from .network_capacity import capacity_issues
        for finding in capacity_issues(sets, flat, edges, config['node_capacity']):
            table, row = finding['cut'][0] if finding['cut'] else ('InitialDisposalCapacity', ())
            issue('network_capacity', 'capacity',
                  f"{finding['period']}: production is {finding['required']:g} {rate_unit}, but the connected network can deliver at most {finding['capacity']:g} {rate_unit} to {'destinations, even treating storage, treatment, completions and reuse as unrestricted' if finding['relaxed'] else 'disposal'}, including eligible expansion. Review {table} ({' / '.join(row)}) or another route.",
                  table, row, finding['period'], actual=finding['capacity'], expected=finding['required'])

    # Additional configurations remain available; their inputs are checked before
    # construction and solver compatibility is reported explicitly.
    extra = []
    if config['hydraulics'] != 'false':
        extra += ['Hydraulics', 'Elevation', 'WellPressure', 'InitialPipelineDiameters']
    if config['pipeline_capacity'] == 'calculated':
        extra += ['Hydraulics']
    if config['water_quality'] != 'false':
        extra += ['PadWaterQuality']
        if sets.get('StorageSites'): extra += ['StorageInitialWaterQuality']
        if sets.get('ExternalWaterSources'): extra += ['ExternalWaterQuality']
    if config['desalination_model'] != 'false' or config['objective'] == 'cost_surrogate':
        extra += ['DesalinationSurrogate']
    if config['objective'] == 'environmental':
        extra += ['AirEmissionCoefficients', 'TreatmentEmissionCoefficients']
    if config['subsurface_risk'] != 'false' or config['objective'] == 'subsurface_risk':
        extra += ['SWDDeep', 'SWDAveragePressure', 'SWDProxPAWell', 'SWDProxInactiveWell', 'SWDProxEQ', 'SWDProxFault', 'SWDProxHpOrLpWell', 'SWDRiskFactors']
    for table in dict.fromkeys(extra):
        if not any(numeric(value) is not None for value in flat.get(table, {}).values()):
            issue('configuration_data', 'settings', f'The selected optimization settings require {table}.', table)
    if config['hydraulics'] == 'co_optimize' and config['solver'] == 'cbc':
        issue('solver_compatibility', 'settings', 'CBC cannot solve nonlinear co-optimized hydraulics. Choose a compatible formulation and solver.')
    if config['infrastructure_timing'] != 'false':
        issue('timing_assumption', 'settings', 'The installed model calculates infrastructure schedules after optimization. Review required lead-time tables; a feasible flow plan does not establish construction availability.', severity='warning')

    errors = sum(n for (section, severity), n in counts.items() if severity == 'error')
    warnings = sum(n for (section, severity), n in counts.items() if severity == 'warning')
    return {'valid': errors == 0, 'state': 'inputs_complete' if errors == 0 else 'needs_input',
            'revision': input_revision(scenario), 'catalog_version': CATALOG_VERSION,
            'model_version': version('project-pareto'), 'issues': issues, 'error_count': errors,
            'warning_count': warnings, 'truncated': errors + warnings > len(issues),
            'tables_with_issues': sorted(error_tables),
            'sections': [{'id': section, 'title': title, 'error_count': counts[(section, 'error')],
                          'warning_count': counts[(section, 'warning')],
                          'fillable_count': sum(t['section'] == section for t in targets.values())}
                         for section, title in SECTION_NAMES.items()],
            'units': units, 'periods': periods, 'model_check': 'not_run', 'feasibility': 'not_run'}

def check_model(scenario, path, result, solve=False):
    from .get_data import get_data
    from pareto.strategic_water_management.strategic_produced_water_optimization import create_model, scale_model
    from pareto.utilities.solvers import get_solver, set_timeout
    from pareto.utilities.model_modifications import fix_vars
    from pyomo.environ import Objective, value, TransformationFactory
    from pyomo.opt import TerminationCondition
    from .model_diagnostics import scan_constraint_violations, solution_is_feasible, SOLUTION_RELATIVE_TOLERANCE
    from .solvers import solver_name
    result = deepcopy(result)
    if not MODEL_LOCK.acquire(blocking=False):
        return {**result, 'valid': False, 'state': 'not_determined', 'error': 'Another model check is running. Try again after it finishes.'}
    try:
        sets, params, _ = get_data(str(path))
        model = create_model(sets, params, default=prepare_config(scenario))
        from .model_compatibility import prepare_model_for_ui
        prepare_model_for_ui(model)
        for entries in scenario.get('override_values', {}).values():
            for entry in entries.values():
                fix_vars(model, [entry['variable'].replace('_dict', '')], tuple(entry['indexes']), float(entry['value']))
        result['model_check'] = 'passed'
        result['state'] = 'model_built'
        if not solve:
            return result
        options = prepare_config(scenario, 'modelParameters')
        if any(options[key] != 'false' for key in ('hydraulics', 'water_quality', 'desalination_model', 'subsurface_risk')) or options['objective'] not in ('cost', 'reuse', 'environmental'):
            return {**result, 'state': 'not_determined', 'feasibility': 'not_supported',
                    'error': 'The quick feasibility check supports the basic network formulation. Inputs were checked; use the selected optimization to evaluate advanced modes.'}
        for name in ('v_C_Slack', 'v_S_FracDemand', 'v_S_Production', 'v_S_Flowback', 'v_S_PipelineCapacity',
                     'v_S_StorageCapacity', 'v_S_DisposalCapacity', 'v_S_TreatmentCapacity', 'v_S_BeneficialReuseCapacity'):
            getattr(model, name).fix(0)
        scaled = scale_model(model, scaling_factor=1000)
        # Find a feasible incumbent without spending the budget proving a cost optimum.
        for objective in scaled.component_objects(Objective, active=True):
            objective.deactivate()
        scaled.feasibility_objective = Objective(expr=0)
        solver = get_solver(solver_name(options['solver'] or 'cbc'))
        set_timeout(solver, timeout_s=20)
        solved = solver.solve(scaled, load_solutions=False)
        result['termination_condition'] = str(solved.solver.termination_condition)
        if solved.solver.termination_condition == TerminationCondition.infeasible:
            return {**result, 'valid': False, 'state': 'infeasible', 'feasibility': 'infeasible'}
        if len(solved.solution):
            scaled.solutions.load_from(solved)
            scan = scan_constraint_violations(scaled, relative_tol=SOLUTION_RELATIVE_TOLERANCE)
            if solution_is_feasible(scaled, scan=scan):
                return {**result, 'state': 'feasible', 'feasibility': 'feasible', 'slacks_disabled': True}
        return {**result, 'state': 'not_determined', 'feasibility': 'not_determined',
                'error': 'No verified feasible plan was found within the check budget. This is not proof of infeasibility.'}
    except Exception as error:
        stage = 'model' if result['model_check'] != 'passed' else 'solver'
        result.update(valid=False if stage == 'model' else result['valid'], state='build_failed' if stage == 'model' else 'not_determined',
                      model_check='failed' if stage == 'model' else 'passed', error=str(error)[:2000])
        return result
    finally:
        MODEL_LOCK.release()
