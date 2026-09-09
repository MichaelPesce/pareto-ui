import math
import time
import functools

import logging

from pareto.utilities.process_data import (
    check_required_data,
    model_infeasibility_detection,
)
from pareto.strategic_water_management.strategic_produced_water_optimization import (
    create_model,
    Objectives,
    solve_model,
    PipelineCost,
    PipelineCapacity,
    Hydraulics,
    WaterQuality,
    RemovalEfficiencyMethod,
    InfrastructureTiming,
    SubsurfaceRisk,
    DesalinationModel,
    CONFIG,
)

from app.internal.get_data import get_input_lists, get_data

_log = logging.getLogger(__name__)
EARTH_RADIUS_MILES = 3958.7613

DEFAULT_UNITS = {
    "volume": "bbl",
    "distance":	"mile",
    "diameter":	"inch",
    "concentration": "mg/liter",
    "currency":	"USD",
    "time":	"day",
    "pressure":	"psi",
    "elevation": "foot",
    "decision_period": "week",
    "mass": "g"
}

ARC_TABLES = {
    "PNA": "ProductionPads",
    "CNA": "CompletionsPads",
    "CCA": "CompletionsPads",
    "NNA": "NetworkNodes",
    "NCA": "NetworkNodes",
    "NKA": "NetworkNodes",
    "NRA": "NetworkNodes",
    "NSA": "NetworkNodes",
    "FCA": "ExternalWaterSources",
    "RCA": "TreatmentSites",
    "RNA": "TreatmentSites",
    "RSA": "TreatmentSites",
    "SCA": "StorageSites",
    "SNA": "StorageSites",
    "ROA": "TreatmentSites",
    "RKA": "TreatmentSites",
    "SOA": "StorageSites",
    "NOA": "NetworkNodes",
    "PCT": "ProductionPads",
    "PKT": "ProductionPads",
    "FCT": "ExternalWaterSources",
    "CST": "CompletionsPads",
    "CCT": "CompletionsPads",
    "CKT": "CompletionsPads",
    "RST": "TreatmentSites",
    "ROT": "TreatmentSites",
    "SOT": "StorageSites",
    "RKT": "TreatmentSites",
}


def time_it(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.perf_counter()
        result = func(*args, **kwargs)
        end_time = time.perf_counter()
        elapsed_time = end_time - start_time
        _log.info(f"Function '{func.__name__}' executed in {elapsed_time:.2f} seconds")
        return result

    return wrapper

def calculate_distance(coord1, coord2):
        # print(f'calculating distance from {coord1} to {coord2}')
        distance = math.sqrt(((float(coord1[0]) - float(coord2[0]))**2) + ((float(coord1[1]) - float(coord2[1]))**2))
        return distance

def classifyNode(data, default_node):
    if default_node == "ProductionPad":
        data["node_type"] = "ProductionPad"
    elif default_node == "CompletionsPad":
        data["node_type"] = "CompletionsPad"
    elif default_node == "NetworkNode":
        data["node_type"] = "NetworkNode"
    elif default_node == "DisposalSite":
        data["node_type"] = "DisposalSite"
    elif default_node == "TreatmentSite":
        data["node_type"] = "TreatmentSite"
        # storage_site_key = key.replace('R','S').replace('r','S')
        # storage_sites[storage_site_key] = data
        # connections["all_connections"][key] = [storage_site_key]
        # connections["all_connections"][storage_site_key] = [key]
    elif default_node == "StorageSite":
        data["node_type"] = "StorageSite"
    elif default_node == "NetworkNode":
        data["node_type"] = "NetworkNode"
    elif default_node == "ReuseOption":
        data["node_type"] = "ReuseOption"
    else:
        data["node_type"] = "NetworkNode"

def _to_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _get_table_row_count(table_data):
    if not isinstance(table_data, dict):
        return 0

    for values in table_data.values():
        if isinstance(values, list):
            return len(values)

    return 0


def _coerce_numeric_or_zero(value):
    if value in (None, ""):
        return 0.0

    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _forecast_table_has_valid_rows(table_data, allow_zero=False, require_all_cells_numeric=False):
    row_count = _get_table_row_count(table_data)
    if row_count == 0:
        return False

    period_columns = [
        key for key, values in table_data.items()
        if key.startswith("T") and isinstance(values, list)
    ]

    if not period_columns:
        list_columns = [
            key for key, values in table_data.items()
            if isinstance(values, list)
        ]
        period_columns = list_columns[1:]

    if not period_columns:
        return False

    for row_idx in range(row_count):
        if allow_zero:
            for column in period_columns:
                column_values = table_data.get(column, [])
                value = column_values[row_idx] if row_idx < len(column_values) else None
                if value in (None, ""):
                    if require_all_cells_numeric:
                        return False
                    continue
                numeric_value = _to_float(value)
                if numeric_value is None or numeric_value < 0:
                    return False
            if require_all_cells_numeric:
                continue

            has_numeric_value = any(
                _to_float(table_data.get(column, [])[row_idx]) is not None
                for column in period_columns
                if row_idx < len(table_data.get(column, [])) and table_data.get(column, [])[row_idx] not in (None, "")
            )
            if not has_numeric_value:
                return False
        else:
            row_total = sum(
                _coerce_numeric_or_zero(table_data.get(column, [])[row_idx] if row_idx < len(table_data.get(column, [])) else 0)
                for column in period_columns
            )
            if row_total <= 0:
                return False

    return True


def _value_table_has_valid_rows(table_data, allow_zero=False):
    row_count = _get_table_row_count(table_data)
    if row_count == 0:
        return False

    values = table_data.get("VALUE")
    if not isinstance(values, list):
        return False

    for row_idx in range(row_count):
        value = values[row_idx] if row_idx < len(values) else None
        numeric_value = _to_float(value)
        if numeric_value is None:
            return False
        if allow_zero:
            if numeric_value < 0:
                return False
        elif numeric_value <= 0:
            return False

    return True

def calculate_distance_from_coordinates(start_coords, end_coords):
    """
    Great-circle distance (miles) between two [lon, lat] coordinates.
    Mirrors frontend `calculateDistanceFromCoordinates`.
    """
    lon1 = _to_float(start_coords[0]) if isinstance(start_coords, (list, tuple)) and len(start_coords) >= 2 else None
    lat1 = _to_float(start_coords[1]) if isinstance(start_coords, (list, tuple)) and len(start_coords) >= 2 else None
    lon2 = _to_float(end_coords[0]) if isinstance(end_coords, (list, tuple)) and len(end_coords) >= 2 else None
    lat2 = _to_float(end_coords[1]) if isinstance(end_coords, (list, tuple)) and len(end_coords) >= 2 else None

    if None in (lon1, lat1, lon2, lat2):
        return 0

    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)

    a = (
        math.sin(d_lat / 2) * math.sin(d_lat / 2) +
        math.cos(lat1_rad) * math.cos(lat2_rad) *
        math.sin(d_lon / 2) * math.sin(d_lon / 2)
    )
    # Guard against floating-point drift outside [0, 1].
    a = max(0, min(1, a))
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return EARTH_RADIUS_MILES * c

def calculatePipelineLenghts(arcs):
    """
    For each arc, derive segment lengths in miles such that:
      lengths[i] is distance between nodes[i] and nodes[i + 1].
    """
    if not isinstance(arcs, dict):
        return arcs

    for arc in arcs.values():
        nodes = arc.get("nodes", [])
        if not isinstance(nodes, list) or len(nodes) < 2:
            arc["lengths"] = []
            continue

        lengths = []
        for idx in range(len(nodes) - 1):
            start_coords = (nodes[idx] or {}).get("coordinates", [])
            end_coords = (nodes[idx + 1] or {}).get("coordinates", [])
            lengths.append(calculate_distance_from_coordinates(start_coords, end_coords))
        arc["lengths"] = lengths

    return arcs

def determineArcsAndConnections(data):
    """Map line vertices to connections, retaining bends without self-connections."""
    arcs = data.get("arcs", {})
    all_nodes = data.get("all_nodes", {})
    connections = {"all_connections": {}}
    data["connections"] = connections
    for arc in arcs.values():
        # Existing arcs already contain their directions and geometry when an
        # additional map is imported. Only derive newly imported polylines.
        if "coordinates" not in arc:
            for node in arc.get("nodes", []):
                outgoing = connections["all_connections"].setdefault(node["name"], [])
                outgoing.extend(n for n in node.get("outgoing_nodes", []) if n not in outgoing)
            continue
        coordinates = arc.pop("coordinates")
        selected = []
        for idx, coords in enumerate(coordinates):
            closest = min(all_nodes, key=lambda name: calculate_distance(coords, all_nodes[name]["coordinates"]), default=None)
            if closest is not None and (not selected or selected[-1][0] != closest):
                selected.append((closest, idx))
        if len(selected) > 1:
            selected[-1] = (selected[-1][0], len(coordinates) - 1)
        nodes = [{"name": name, "coordinates": coordinates[idx], "outgoing_nodes": []} for name, idx in selected]
        lengths = []
        for idx, node in enumerate(nodes):
            outgoing = connections["all_connections"].setdefault(node["name"], [])
            if idx + 1 >= len(nodes):
                continue
            target = nodes[idx + 1]["name"]
            node["outgoing_nodes"] = [target]
            if target not in outgoing:
                outgoing.append(target)
            segment = coordinates[selected[idx][1]:selected[idx + 1][1] + 1]
            node["segment_coordinates"] = segment
            lengths.append(sum(calculate_distance_from_coordinates(a, b) for a, b in zip(segment, segment[1:])))
        arc["nodes"] = nodes
        arc["lengths"] = lengths
    return data

## TODO: we must handle elevation
def build_map_data_from_json(data_input):
    """
    Build map_data from JSON data_input (df_sets/df_parameters), preserving
    coordinates from any existing map_data when possible.
    """
    df_sets = data_input.get("df_sets", {}) or {}
    df_parameters = data_input.get("df_parameters", {}) or {}
    existing_map_data = data_input.get("map_data", {}) or {}
    existing_all_nodes = existing_map_data.get("all_nodes", {}) or {}

    def normalize_coords(coords):
        if not isinstance(coords, (list, tuple)) or len(coords) < 2:
            return [0, 0]
        return [coords[0], coords[1]]

    node_type_by_set = {
        "ProductionPads": "ProductionPad",
        "CompletionsPads": "CompletionsPad",
        "NetworkNodes": "NetworkNode",
        "SWDSites": "DisposalSite",
        "TreatmentSites": "TreatmentSite",
        "StorageSites": "StorageSite",
        "ReuseOptions": "ReuseOption",
        "ExternalWaterSources": "ExternalWaterSource",
        "FreshwaterSources": "ExternalWaterSource",
    }

    all_nodes = {}
    for set_name, node_type in node_type_by_set.items():
        node_list = df_sets.get(set_name)
        if not node_list:
            continue
        for node_name in node_list:
            existing_node = existing_all_nodes.get(node_name, {})
            coords = normalize_coords(existing_node.get("coordinates"))
            node_data = {
                **existing_node,
                "name": node_name,
                "node_type": existing_node.get("nodeType", node_type),
                "nodeType": existing_node.get("nodeType", node_type),
                "coordinates": coords,
            }
            all_nodes[node_name] = node_data

    arc_table_sets = {
        "PNA": ("ProductionPads", "NetworkNodes"),
        "CNA": ("CompletionsPads", "NetworkNodes"),
        "CCA": ("CompletionsPads", "CompletionsPads"),
        "NNA": ("NetworkNodes", "NetworkNodes"),
        "NCA": ("NetworkNodes", "CompletionsPads"),
        "NKA": ("NetworkNodes", "SWDSites"),
        "NRA": ("NetworkNodes", "TreatmentSites"),
        "NSA": ("NetworkNodes", "StorageSites"),
        "NOA": ("NetworkNodes", "ReuseOptions"),
        "SNA": ("StorageSites", "NetworkNodes"),
        "SOA": ("StorageSites", "ReuseOptions"),
        "FCA": ("ExternalWaterSources", "CompletionsPads"),
        "RCA": ("TreatmentSites", "CompletionsPads"),
        "RSA": ("TreatmentSites", "StorageSites"),
        "SCA": ("StorageSites", "CompletionsPads"),
        "RNA": ("TreatmentSites", "NetworkNodes"),
        "ROA": ("TreatmentSites", "ReuseOptions"),
        "RKA": ("TreatmentSites", "SWDSites"),
        "PCT": ("ProductionPads", "CompletionsPads"),
        "FCT": ("ExternalWaterSources", "CompletionsPads"),
        "PKT": ("ProductionPads", "SWDSites"),
        "CKT": ("CompletionsPads", "SWDSites"),
        "CCT": ("CompletionsPads", "CompletionsPads"),
        "CST": ("CompletionsPads", "StorageSites"),
        "RST": ("TreatmentSites", "StorageSites"),
        "ROT": ("TreatmentSites", "ReuseOptions"),
        "SOT": ("StorageSites", "ReuseOptions"),
        "RKT": ("TreatmentSites", "SWDSites"),
    }

    def is_connected(value):
        if value in (None, "", False):
            return False
        try:
            return float(value) != 0
        except (TypeError, ValueError):
            return True

    connections = {"all_connections": {}}
    edge_set = set()

    def add_connection(node_a, node_b):
        connections["all_connections"].setdefault(node_a, [])
        connections["all_connections"].setdefault(node_b, [])
        if node_b not in connections["all_connections"][node_a]:
            connections["all_connections"][node_a].append(node_b)
        if node_a not in connections["all_connections"][node_b]:
            connections["all_connections"][node_b].append(node_a)

    for table_key, (row_set, col_set) in arc_table_sets.items():
        table_data = df_parameters.get(table_key)
        if not isinstance(table_data, dict):
            continue
        row_key = row_set if row_set in table_data else None
        if row_key is None and row_set == "ExternalWaterSources" and "FreshwaterSources" in table_data:
            row_key = "FreshwaterSources"
        if row_key is None:
            continue

        row_nodes = table_data.get(row_key) or []
        row_allowed = set(df_sets.get(row_key, []) or [])
        col_allowed = set(df_sets.get(col_set, []) or [])
        if not row_nodes:
            continue

        for col_node, col_values in table_data.items():
            if col_node == row_key:
                continue
            if col_node not in col_allowed or not isinstance(col_values, list):
                continue
            for idx, value in enumerate(col_values):
                if idx >= len(row_nodes):
                    break
                row_node = row_nodes[idx]
                if row_node not in row_allowed:
                    continue
                if not is_connected(value):
                    continue
                edge_key = tuple(sorted((row_node, col_node)))
                edge_set.add(edge_key)
                add_connection(row_node, col_node)

    existing_arcs = existing_map_data.get("arcs", {}) or {}
    existing_arc_by_edge = {}
    for arc in existing_arcs.values():
        nodes = arc.get("nodes") or []
        if len(nodes) < 2:
            continue
        start = nodes[0].get("name")
        end = nodes[-1].get("name")
        if start and end:
            existing_arc_by_edge[tuple(sorted((start, end)))] = arc

    arcs = {}
    for edge_key in edge_set:
        node_a, node_b = edge_key
        existing_arc = existing_arc_by_edge.get(edge_key)
        if existing_arc:
            arc = existing_arc.copy()
            arc["nodes"] = [n.copy() for n in existing_arc.get("nodes", [])]
            arc_name = arc.get("name") or f"{node_a}_{node_b}"
        else:
            coords_a = all_nodes.get(node_a, {}).get("coordinates", [0, 0])
            coords_b = all_nodes.get(node_b, {}).get("coordinates", [0, 0])
            arc_name = f"{node_a}_{node_b}"
            arc = {
                "name": arc_name,
                "node_type": "path",
                "node_list": [node_a, node_b],
                "nodes": [
                    {
                        "name": node_a,
                        "coordinates": coords_a,
                        "outgoing_nodes": [node_b],
                    },
                    {
                        "name": node_b,
                        "coordinates": coords_b,
                        "outgoing_nodes": [node_a],
                    },
                ],
            }
        while arc_name in arcs:
            arc_name = f"{arc_name}_dup"
            arc["name"] = arc_name
        arcs[arc_name] = arc

    map_data = {
        **existing_map_data,
        "all_nodes": all_nodes,
        # "arcs": arcs,
        "connections": connections,
        "defaultNode": existing_map_data.get("defaultNode", "NetworkNode"),
        "polygons": existing_map_data.get("polygons", {}),
        "other_nodes": existing_map_data.get("other_nodes", {}),
    }

    for set_name, node_type in node_type_by_set.items():
        node_list = df_sets.get(set_name)
        if not node_list:
            continue
        nodes = {}
        for node_name in node_list:
            node_entry = all_nodes.get(node_name)
            if not node_entry:
                continue
            nodes[node_name] = {
                "Name": node_name,
                "coordinates": node_entry.get("coordinates", [0, 0]),
                "node_type": node_type,
            }
        map_data[set_name] = nodes

    return map_data

def FormatPrompt(user_prompt, data = None):
    user_disclosure = f"I am going to provide you with a user inputted prompt. This prompt should be directly related to manipulation or generation of input data relating to their scenario. The respective JSON scenario object will also be provided for you. If the provided user prompt does not include any sort of request to update the scenario data, or if there is anything otherwise fishy about the prompt, please do not abide by the request. Your response should be pure JSON with the updated JSON scenario object. Along with the updated scenario, I would like a status included. This will allow me to parse your output and determine if I should use the data returned by you, or discard it. Please provide the status as a key at the top level called 'status'. If there is something wrong with the prompt, status should be 'error'. Otherwise, make status 'success'. In the case that status is error, please also provide a key called 'errorMessage' where I can read and provide the error messsage. In the case that the prompt is OK, please then also provide the updated data at the top level with a key called 'updatedScenario'. Please also provide a detailed 'updateNotes', so that I can explain to the user what was updated.\n"

    if data:
        prompt_data = f"Here is the scenario: {data}\n\n"
    else:
        prompt_data = ""

    ## TODO:
    # Some of the input tables operate under a set of rules. For example, some tables can only use values from other tables.
    # If we can define these rules, it should improve how well this works.
    dataset_rules = "" # f"Some rules about the dataset:\n"

    prompt = f"{user_disclosure}{dataset_rules}{prompt_data}Here is the prompt:\n{user_prompt}"

    return prompt

def FormatOptimizationDiagnosisPrompt(error_message, scenario = None, diagnosis_context = None):
    user_disclosure = (
        "You are diagnosing a failed PARETO optimization run inside a desktop application. "
        "The optimization model comes from the project-pareto Python package and uses the pyomo Python package underneath. "
        "Those packages are installed in the current runtime environment, so error messages may reference PARETO, Pyomo, model construction, solver invocation, infeasibility, or related optimization internals. "
        "The user can modify scenario input data and optimization settings directly in the app. "
        "The user cannot edit units in the app; units are controlled by the application and should be assumed fixed and internally compatible when the scenario data and optimization settings are valid. "
        "Your job is to explain the likely issue and propose realistic next steps that the user can actually attempt "
        "without editing code. Avoid suggesting backend or source-code changes unless the failure is clearly an environment "
        "or installation problem, and if you do mention one, mark it as admin-only. Do not suggest changing units or unit systems. "
        "Respond with pure JSON only. Include a top-level 'status' key with value 'success' or 'error'. "
        "For success, include: "
        "'summary' (string), "
        "'likelyCauses' (array of short strings), "
        "'nextSteps' (array of objects with keys 'title', 'instruction', optional 'reason', optional 'appArea'), "
        "and optional 'cautionNotes' (array of short strings). "
        "The next steps should be ordered from most practical to least practical, and should focus on edits to input data, "
        "network assumptions, bounds, capacities, demand/supply values, treatment/disposal/reuse settings, overrides, and optimization settings like runtime, optimality gap, solver-adjacent settings already exposed in the app. "
        "Use the constraint residuals and sampled input tables as clues for practical table-level changes. "
        "Respect the supplied diagnostic limitations: current values may be initial values, and residuals do not prove which constraints cause infeasibility. "
        "Distinguish observations from hypotheses, acknowledge missing evidence, and do not invent unseen input values or promise feasibility. "
        "If you cannot diagnose from the provided information, return status 'error' and include 'errorMessage'.\n"
    )

    scenario_data = f"Scenario context:\n{scenario}\n\n" if scenario else ""
    diagnosis_data = f"Diagnosis context:\n{diagnosis_context}\n\n" if diagnosis_context else ""
    return f"{user_disclosure}{scenario_data}{diagnosis_data}Optimization failure message:\n{error_message}"

def summarize_long_text(text, start_chars=6000, end_chars=4000):
    if text is None:
        return ""

    text = str(text)
    max_length = start_chars + end_chars
    if len(text) <= max_length:
        return text

    omitted_chars = len(text) - max_length
    return (
        f"{text[:start_chars]}\n\n"
        f"... [{omitted_chars} characters omitted for brevity] ...\n\n"
        f"{text[-end_chars:]}"
    )

def deriveConnections(input_data: dict):
    ## From Arc tables, derive a dictionary of node -> [list of nodes] connections
    # _log.info(f"deriving connections")
    params = input_data.get("df_parameters")
    connections = {}
    for arc_table_name in ARC_TABLES:
        try:
            i = 0
            arc_table_key = ARC_TABLES[arc_table_name]
            arc_table = params.get(arc_table_name, [])
            vertical_nodes = arc_table[arc_table_key]
            for col in arc_table:
                if i > 0: # skip first column
                    ## col = arc_table_key
                    values = arc_table[col]
                    horizontal_node = col
                    for j in range(len(values)):
                        val = values[j]
                        if val is not None and val != "":
                            vertical_node = vertical_nodes[j]

                            vertical_node_connections = connections.get(vertical_node, [])
                            vertical_node_connections.append(horizontal_node)
                            connections[vertical_node] = vertical_node_connections
                            ## TODO: Add reverse connection as well?
                i += 1
        except Exception as e:
            _log.info(f"failed to derive connections from table {arc_table_name}: {e}")
    _log.info(f"connections: {connections}")
    return connections

def checkArcValues(input_table: dict, connections: dict, input_table_key: str = "NODES") -> bool:
    # _log.info(f"checking arc values")
    
    if input_table_key not in input_table:
        _log.info(f"missing input_table_key '{input_table_key}' in input_table")
        return False

    row_labels = input_table.get(input_table_key, [])
    if not isinstance(row_labels, list):
        _log.info(f"input_table_key '{input_table_key}' is not a list")
        return False

    row_index = {label: i for i, label in enumerate(row_labels)}
    missing_any = False

    for row_label, expected_cols in connections.items():
        if row_label not in row_index:
            _log.info(f"missing row '{row_label}' in input_table '{input_table_key}'")
            missing_any = True
            continue

        if not isinstance(expected_cols, list):
            expected_cols = [expected_cols]

        row_i = row_index[row_label]
        for col_label in expected_cols:
            if col_label not in input_table:
                _log.info(f"missing column '{col_label}' for row '{row_label}'")
                missing_any = True
                continue

            col_values = input_table.get(col_label, [])
            if row_i >= len(col_values):
                _log.info(
                    f"missing value at row '{row_label}' (index {row_i}) column '{col_label}': column shorter than rows"
                )
                missing_any = True
                continue

            val = col_values[row_i]
            if val is None or val == "":
                _log.info(f"missing connection value at row '{row_label}' column '{col_label}' (index {row_i})")
                missing_any = True

    return not missing_any

@time_it
def check_for_infeasibility(scenario, excel_path):
    ## TODO: this fails on get_data
    ## we may need to create our own function to check for valid tables
    modelParameters = prepare_config(scenario, expected_response="modelParameters")
    default={
        "objective": Objectives[modelParameters["objective"]],
        "pipeline_cost": PipelineCost[modelParameters["pipeline_cost"]],
        "pipeline_capacity": PipelineCapacity[modelParameters["pipeline_capacity"]],
        "node_capacity": modelParameters["node_capacity"],
        "water_quality": WaterQuality[modelParameters["water_quality"]],
        "hydraulics": Hydraulics[modelParameters["hydraulics"]],
        "removal_efficiency_method": RemovalEfficiencyMethod[modelParameters["removal_efficiency_method"]],
        "infrastructure_timing": InfrastructureTiming[modelParameters["infrastructure_timing"]],
        "subsurface_risk": SubsurfaceRisk[modelParameters["subsurface_risk"]],
        "desalination_model": DesalinationModel[modelParameters["desalination_model"]]
    }

    [set_list, parameter_list] = get_input_lists()
    
    [df_sets, df_parameters, _] = get_data(excel_path, set_list, parameter_list)

    strategic_model = create_model(
        df_sets,
        df_parameters,
        default=default
    )

    try:
        _log.info(f"calling model_infeasibility_detection")
        strategic_model = model_infeasibility_detection(strategic_model)
        return True
    except Exception as e:
        _log.info(f"Exception during check_for_infeasibility: {e}")
        return False


def check_for_minimum_required_tables(scenario):
    required_tables = [
        "ProductionPads",
        "CompletionsPads",
        "StorageSites",
        "SWDSites",
        "ExternalWaterSources",
    ]

    data_input = scenario.get("data_input", {})
    df_sets = data_input.get("df_sets", {})
    df_parameters = data_input.get("df_parameters", {})

    missing_tables = []

    for table_name in required_tables:
        table = df_sets.get(table_name, [])
        if len(table) == 0:
            missing_tables.append(table_name)

    
    ## The following lists of tables must have values > 0 for each row in each table
    forecast_tables = [
        {"table_name": "CompletionsDemand", "allow_zero": False},
        {"table_name": "PadRates", "allow_zero": False},
        {"table_name": "FlowbackRates", "allow_zero": False},
    ]

    capacity_tables = [
        {"table_name": "InitialDisposalCapacity", "allow_zero": False},
        # "InitialTreatmentCapacity" TODO: this one is different
    ]
    capacity_tables.extend([
        {"table_name": "InitialStorageCapacity", "allow_zero": True},
        {"table_name": "CompletionsPadStorage", "allow_zero": True},
    ])

    operational_cost_tables = [
        {"table_name": "DisposalOperationalCost", "allow_zero": False},
    ]

    # Beneficial reuse is optional. When present, zero minimum flow, cost, or
    # credit is valid; negative or nonnumeric values are not.
    beneficial_reuse_tables = []
    if df_sets.get("ReuseOptions"):
        forecast_tables.append({"table_name": "ReuseMinimum", "allow_zero": True, "require_all_cells_numeric": True})
        beneficial_reuse_tables = [
            {"table_name": "BeneficialReuseCost", "allow_zero": True},
            {"table_name": "BeneficialReuseCredit", "allow_zero": True},
        ]

    ## TODO: Trucking Time, Trucking Hours, External Water Sourcing
    ## - do we need these?
    ## FCT, CKT, also seem to be necessary

    for table_config in forecast_tables:
        table_name = table_config["table_name"]
        if not _forecast_table_has_valid_rows(
            df_parameters.get(table_name),
            allow_zero=table_config["allow_zero"],
            require_all_cells_numeric=table_config.get("require_all_cells_numeric", False),
        ):
            missing_tables.append(table_name)

    for table_config in capacity_tables:
        table_name = table_config["table_name"]
        if not _value_table_has_valid_rows(df_parameters.get(table_name), allow_zero=table_config["allow_zero"]):
            missing_tables.append(table_name)

    for table_config in operational_cost_tables:
        table_name = table_config["table_name"]
        if not _value_table_has_valid_rows(df_parameters.get(table_name), allow_zero=table_config["allow_zero"]):
            missing_tables.append(table_name)

    for table_config in beneficial_reuse_tables:
        table_name = table_config["table_name"]
        if not _value_table_has_valid_rows(df_parameters.get(table_name), allow_zero=table_config["allow_zero"]):
            missing_tables.append(table_name)
    
    return missing_tables


def check_for_missing_tables(scenario):
    conf = prepare_config(scenario)
    data_input = scenario.get("data_input")
    df_sets = data_input.get("df_sets", {})
    df_parameters = data_input.get("df_parameters", {})
    display_units = data_input.get("display_units", {})
    df_parameters["Units"] = display_units
    try:
        _log.info(f"calling check_required_data")
        check_required_data(df_sets, df_parameters, conf)
        _log.info(f"no error thrown")
        return {
            "result": True,
        }
    except Exception as e:
        _log.info(f"{e}")
        return {
            "result": False,
            "e": e,
        }

def prepare_config(scenario, expected_response="conf"):
    _log.info(f"preparing config: ")
    optimizationSettings = scenario.get('optimization')
    modelParameters = {
        "objective": optimizationSettings.get('objective',"cost"),
        "runtime": optimizationSettings.get('runtime',900),
        "pipeline_cost": optimizationSettings.get("pipeline_cost", "distance_based"),
        "pipeline_capacity": optimizationSettings.get("pipeline_capacity", "input"),
        "node_capacity": optimizationSettings.get("node_capacity", True),
        "water_quality": optimizationSettings.get("waterQuality", "false"),
        "solver": optimizationSettings.get('solver',None),
        "build_units": optimizationSettings.get('build_units',"user_units"),
        "optimalityGap": optimizationSettings.get("optimalityGap", 5),
        "scale_model": optimizationSettings.get("scale_model", True),
        "hydraulics": optimizationSettings.get('hydraulics',"false"),
        "removal_efficiency_method": optimizationSettings.get('removal_efficiency_method',"concentration_based"),
        "desalination_model": optimizationSettings.get("desalination_model", "false"),
        "infrastructure_timing": optimizationSettings.get("infrastructure_timing", "false"),
        "subsurface_risk": optimizationSettings.get("subsurface_risk", "false"),
        "deactivate_slacks": optimizationSettings.get("deactivate_slacks", True),
    }

    default = {
        "objective": modelParameters["objective"],
        "pipeline_cost": modelParameters["pipeline_cost"],
        "pipeline_capacity": modelParameters["pipeline_capacity"],
        "hydraulics": modelParameters["hydraulics"],
        "node_capacity": modelParameters["node_capacity"],
        "water_quality": modelParameters["water_quality"],
        "removal_efficiency_method": modelParameters["removal_efficiency_method"],
        "infrastructure_timing": modelParameters["infrastructure_timing"],
    }

    if expected_response == "conf":
        return CONFIG(default)
    elif expected_response == "modelParameters":
        return modelParameters
    else:
        return CONFIG(default)
