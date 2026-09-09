import shutil
import os
from functools import lru_cache
from openpyxl import load_workbook
from openpyxl.utils import get_column_letter
from .input_schema import FORECASTS, OPTION_SETS
from .workbook_preservation import WorkbookPreservation

import logging
_log = logging.getLogger(__name__)

print_output = True
DEFAULT_TEMPLATE_LOCATION = f'{os.path.dirname(os.path.abspath(__file__))}/assets/pareto_input_template.xlsx'
HEADER_TEMPLATE_SKIP_SHEETS = {"Overview", "Schematic", "Units"}

def _print(output):
    if print_output:
        _log.info(output)

@lru_cache(maxsize=1)
def DeriveTemplateHeaderValues(template_location=DEFAULT_TEMPLATE_LOCATION):
    header_values = {}
    wb = load_workbook(template_location, data_only=True, read_only=True)
    try:
        for ws in wb.worksheets:
            if ws.title in HEADER_TEMPLATE_SKIP_SHEETS:
                continue
            header_values[ws.title] = {
                column: ws.cell(row=2, column=column).value
                for column in range(1, ws.max_column + 1)
                if ws.cell(row=2, column=column).value not in (None, "")
            }
    finally:
        wb.close()
    return header_values

def WriteMapDataToExcel(data, output_file_name, template_location=None, previous_map_data=None):
    """
    Write map_data to excel
    Accepts: map_data, output file name, template location (optional)
    """
    _log.info(f"WriteMapDataToExcel using {template_location}")
    if template_location is None:
        template_location = DEFAULT_TEMPLATE_LOCATION

    # some defaults:
    treatment_technologies = {
        "CB": {"TreatmentOperationalCost": 0.2, "TreatmentEfficiency": 0.95, "RemovalEfficiency": 0, "DesalinationTechnologies": 0, "TreatmentExpansionCost": 75},
        "CB-EV": {"TreatmentOperationalCost": 0.3, "TreatmentEfficiency": 0.95, "RemovalEfficiency": 0, "DesalinationTechnologies": 0, "TreatmentExpansionCost": 100},
        "MVC": {"TreatmentOperationalCost": 0.5, "TreatmentEfficiency": 0.5, "RemovalEfficiency": 0.99, "DesalinationTechnologies": 1, "TreatmentExpansionCost": 1000},
        "MD": {"TreatmentOperationalCost": 1.0, "TreatmentEfficiency": 0.5, "RemovalEfficiency": 0.99, "DesalinationTechnologies": 1, "TreatmentExpansionCost": 500},
        "OARO": {"TreatmentOperationalCost": 0.7, "TreatmentEfficiency": 0.5, "RemovalEfficiency": 0.99, "DesalinationTechnologies": 1, "TreatmentExpansionCost": 800}
    }

    treatment_capacities = {
        "J0": {"TreatmentExpansionLeadTime": 0, "TreatmentCapacityIncrements": 0},
        "J1": {"TreatmentExpansionLeadTime": 68, "TreatmentCapacityIncrements": 10000},
        "J2": {"TreatmentExpansionLeadTime": 70, "TreatmentCapacityIncrements": 20000},
        "J3": {"TreatmentExpansionLeadTime": 72, "TreatmentCapacityIncrements": 50000},
    }

    pipeline_diameters = {
        "D0": {"PipelineCapacityIncrements": 0, "PipelineDiameterValues": 0, "PipelineExpansionLeadTime_Capac": 0},
        "D4": {"PipelineCapacityIncrements": 14286, "PipelineDiameterValues": 4, "PipelineExpansionLeadTime_Capac": 1},
        "D6": {"PipelineCapacityIncrements": 35714, "PipelineDiameterValues": 6, "PipelineExpansionLeadTime_Capac": 2},
        "D8": {"PipelineCapacityIncrements": 42857, "PipelineDiameterValues": 8, "PipelineExpansionLeadTime_Capac": None},
        "D12": {"PipelineCapacityIncrements": 50000, "PipelineDiameterValues": 12, "PipelineExpansionLeadTime_Capac": None},
    }

    storage_capacities = {
        "C0": {"StorageCapacityIncrements": 0, "StorageExpansionLeadTime": 0, "StorageExpansionCost": 2},
        "C1": {"StorageCapacityIncrements": 50000, "StorageExpansionLeadTime": 88, "StorageExpansionCost": 2},
        "C2": {"StorageCapacityIncrements": 100000, "StorageExpansionLeadTime": 89, "StorageExpansionCost": 2},
        "C3": {"StorageCapacityIncrements": 350000, "StorageExpansionLeadTime": 90, "StorageExpansionCost": 2},
    }

    injection_capacities = {
        "I0": {"DisposalCapacityIncrements": 0, "DisposalExpansionLeadTime": 0, "DisposalExpansionCost": 0},
        "I1": {"DisposalCapacityIncrements": 7143, "DisposalExpansionLeadTime": 45, "DisposalExpansionCost": 1000},
        "I2": {"DisposalCapacityIncrements": 14286, "DisposalExpansionLeadTime": None, "DisposalExpansionCost": 1000},
        "I3": {"DisposalCapacityIncrements": 50000, "DisposalExpansionLeadTime": None, "DisposalExpansionCost": 1000},
    }

    defaults = {
        "TreatmentTechnologies": treatment_technologies,
        "TreatmentCapacities": treatment_capacities,
        "PipelineDiameters": pipeline_diameters,
        "StorageCapacities": storage_capacities,
        "InjectionCapacities": injection_capacities,
    }


    # input_path = "./assets/pareto_input_template.xlsx"
    excel_path = f'{output_file_name}.xlsx'
    _print(f'writing data to excel at {excel_path}')

    ## step 1: copy pareto_input_template to new file for writing
    if template_location != excel_path:
        shutil.copyfile(template_location, excel_path)

    ## step 2: open excel workbook
    wb = load_workbook(excel_path, data_only=True)
    template_header_values = DeriveTemplateHeaderValues(DEFAULT_TEMPLATE_LOCATION)
    preservation = WorkbookPreservation(wb, data, previous_map_data)
    for set_name, choices in defaults.items():
        original = [row[0] for row in wb[set_name].iter_rows(min_row=2, values_only=True) if row[0] not in (None, '')]
        if original:
            retained = {key: choices.get(key, {}) for key in original}
            choices.clear()
            choices.update(retained)

    def _clear_cells(ws, row_start, row_end, col_start, col_end):
        if row_start > row_end or col_start > col_end:
            return
        for row_ind in range(row_start, row_end + 1):
            for column_ind in range(col_start, col_end + 1):
                ws[f'{get_column_letter(column_ind)}{row_ind}'] = None

    def _clear_antiquated_rows(ws, start_row, key_columns, max_row=200, clear_from_col=1, clear_to_col=None, label="worksheet"):
        row = start_row
        clear_to_col = clear_to_col or ws.max_column
        while row <= max_row and any(ws[f'{get_column_letter(col)}{row}'].value is not None for col in key_columns):
            row += 1

        ending_row_index = row - 1
        if ending_row_index >= start_row:
            _print(f"{label} found antiquated rows from {start_row} through {ending_row_index}")
            _clear_cells(ws, start_row, ending_row_index, clear_from_col, clear_to_col)
        return row

    def _clear_antiquated_columns(ws, start_column, key_row, max_column=200, clear_from_row=1, clear_to_row=None, label="worksheet"):
        column = start_column
        clear_to_row = clear_to_row or ws.max_row
        while column <= max_column and ws[f'{get_column_letter(column)}{key_row}'].value is not None:
            column += 1

        ending_column_index = column - 1
        if ending_column_index >= start_column:
            _print(f"{label} found antiquated columns from {start_column} through {ending_column_index}")
            _clear_cells(ws, clear_from_row, clear_to_row, start_column, ending_column_index)
        return column

    def _sync_template_headers(ws, has_data):
        preservation.reset(ws)
        _clear_cells(ws, 2, 2, 1, ws.max_column)
        if has_data:
            for column, value in template_header_values.get(ws.title, {}).items():
                ws[f'{get_column_letter(column)}2'] = value

    def _write_expansion_matrix(tab, row_keys, column_keys, key_headers, default_value):
        """Preserve entered values by their identifiers, including when rows move."""
        ws = wb[tab]
        key_count = len(key_headers)
        existing = {}
        for row in ws.iter_rows(min_row=3, values_only=True):
            keys = tuple(row[:key_count])
            if any(key in (None, "") for key in keys):
                continue
            for column, cell_value in enumerate(row[key_count:], start=key_count + 1):
                capacity = ws.cell(2, column).value
                if capacity not in (None, "") and cell_value not in (None, ""):
                    existing[(*keys, capacity)] = cell_value

        # Rebuild the matrix so removed nodes and old columns cannot leave stale data.
        _clear_cells(ws, 2, ws.max_row, 1, ws.max_column)
        if not row_keys:
            return
        for column, header in enumerate([*key_headers, *column_keys], start=1):
            ws.cell(2, column, header)
        for row, keys in enumerate(row_keys, start=3):
            for column, key in enumerate(keys, start=1):
                ws.cell(row, column, key)
            for column, capacity in enumerate(column_keys, start=key_count + 1):
                ws.cell(row, column).value = existing.get(
                    (*keys, capacity), default_value(keys, capacity)
                )

    ## step 2.5: add TreatmentTechnologies table
    ws = wb["TreatmentTechnologies"]
    _sync_template_headers(ws, has_data=len(treatment_technologies) > 0)
    row = 2
    for technology in treatment_technologies:
        _print(f'TreatmentTechnologies: adding {technology}')
        cell_location = f'{get_column_letter(1)}{row}'
        ws[cell_location] = technology
        row += 1
    _clear_antiquated_rows(ws, row, [1], max_row=200, clear_from_col=1, clear_to_col=1, label="TreatmentTechnologies")

    ## step 3: add nodes
    node_keys = [
        'ProductionPads', 'CompletionsPads', 'SWDSites', 'ExternalWaterSources', 
        'StorageSites', 'TreatmentSites', 'NetworkNodes', "ReuseOptions"
    ]

    column = 1
    for node_key in node_keys:
        row = 2
        ws = wb[node_key]
        _sync_template_headers(ws, has_data=len(data.get(node_key, {})) > 0)
        for node in data.get(node_key, {}):
            _print(f'node_key {node_key}: adding {node}')
            cellLocation = f'{get_column_letter(column)}{row}'
            ws[cellLocation] = node
            row+=1
        _clear_antiquated_rows(ws, row, [1], max_row=200, clear_from_col=1, clear_to_col=1, label=node_key)

    ## step 4: add arcs
    piped_arcs = {
        "PNA": ["ProductionPads", "NetworkNodes"],
        "CNA": ["CompletionsPads", "NetworkNodes"],
        "CCA": ["CompletionsPads", "CompletionsPads"],
        "NNA": ["NetworkNodes", "NetworkNodes"],
        "NCA": ["NetworkNodes", "CompletionsPads"],
        "NKA": ["NetworkNodes", "SWDSites"],
        "NRA": ["NetworkNodes", "TreatmentSites"],
        "NSA": ["NetworkNodes", "StorageSites"],
        "NOA": ["NetworkNodes", "ReuseOptions"],
        "SNA": ["StorageSites", "NetworkNodes"],
        "SOA": ["StorageSites", "ReuseOptions"],
        "FCA": ["ExternalWaterSources", "CompletionsPads"],
        "RCA": ["TreatmentSites", "CompletionsPads"],
        "RSA": ["TreatmentSites", "StorageSites"],
        "SCA": ["StorageSites", "CompletionsPads"],
        "RNA": ["TreatmentSites", "NetworkNodes"],
        "ROA": ["TreatmentSites", "ReuseOptions"],
        "RKA": ["TreatmentSites", "SWDSites"],
    }

    for piped_arc in piped_arcs: ## assume all connections on map are for pipes
        ws = wb[piped_arc]
        piped_arc_node1 = piped_arcs[piped_arc][0]
        piped_arc_node2 = piped_arcs[piped_arc][1]
        source_nodes = list(data.get(piped_arc_node1, []))
        destination_nodes = list(data.get(piped_arc_node2, []))
        has_data = len(source_nodes) > 0 and len(destination_nodes) > 0
        _sync_template_headers(ws, has_data=has_data)

        if not has_data:
            _print(f'piped_arc {piped_arc}: clearing table because row or column nodes are empty')
            _clear_antiquated_rows(
                ws,
                3,
                [1],
                max_row=200,
                clear_from_col=1,
                clear_to_col=ws.max_column,
                label=piped_arc,
            )
            _clear_antiquated_columns(
                ws,
                2,
                2,
                max_column=200,
                clear_from_row=2,
                clear_to_row=ws.max_row,
                label=piped_arc,
            )
            continue
        else:
            row_nodes = source_nodes
            column_nodes = destination_nodes
            column = 1
            row = 3
            for node in row_nodes:
                cellLocation = f'{get_column_letter(column)}{row}'
                ws[cellLocation] = node
                row += 1

            column = 2
            row = 2
            for node in column_nodes:
                cellLocation = f'{get_column_letter(column)}{row}'
                ws[cellLocation] = node
                column += 1

            row = len(row_nodes) + 3
            column = len(column_nodes) + 2
            _clear_cells(ws, 3, row - 1, 2, column - 1)

            for column_ind, node in enumerate(column_nodes, start=2):
                for row_ind, row_node in enumerate(row_nodes, start=3):
                    if row_node in data["connections"]["all_connections"]:
                        if node in data["connections"]["all_connections"][row_node]:
                            cellLocation = f'{get_column_letter(column_ind)}{row_ind}'
                            ws[cellLocation] = 1

        ## After filling the arcs into the Excel table, it is possible that there
        ## are remnants from previous data that we want to remove. 
        ## For example, if we previously had 10 network nodes, and 
        ## we removed one, we will now fill in the first 9 columns (or rows, depending on the table)
        ## In this case, that 10th row/column needs to be cleared out.
        row = len(row_nodes) + 3
        
        _print(f"piped_arc {piped_arc} checking for antiquated rows, columns")

        starting_row_index = row

        cellLocation = f'{get_column_letter(1)}{row}'
        potential_antiquated_row_header = ws[cellLocation].value
        while potential_antiquated_row_header is not None and row < 50:
            ws[cellLocation] = None
            row += 1
            cellLocation = f'{get_column_letter(1)}{row}'
            potential_antiquated_row_header = ws[cellLocation].value
        ending_row_index = row


        starting_column_index = len(column_nodes) + 2
        cellLocation = f'{get_column_letter(column)}{2}'
        potential_antiquated_column_header = ws[cellLocation].value
        while potential_antiquated_column_header is not None and column < 50:
            ws[cellLocation] = None
            column += 1
            cellLocation = f'{get_column_letter(column)}{2}'
            potential_antiquated_column_header = ws[cellLocation].value
        ending_column_index = column
        

        if ending_row_index > starting_row_index:
            _print(f"{piped_arc} found antiquated rows from {starting_row_index} through {ending_row_index}")
            for row_ind in range(starting_row_index, ending_row_index):
                for column_ind in range(2, ending_column_index):
                    cellLocation = f'{get_column_letter(column_ind)}{row_ind}'
                    _print(f"clearing ({column_ind}:{row_ind})")
                    ws[cellLocation] = None

        if ending_column_index > starting_column_index:
            _print(f"{piped_arc} found antiquated columns from {starting_column_index} through {ending_column_index}")
            for column_ind in range(starting_column_index, ending_column_index):
                for row_ind in range(3, ending_row_index):
                    cellLocation = f'{get_column_letter(column_ind)}{row_ind}'
                    _print(f"clearing ({column_ind}:{row_ind})")
                    ws[cellLocation] = None


    trucked_arcs = {
        "PCT": ["ProductionPads", "CompletionsPads"],
        "FCT": ["ExternalWaterSources", "CompletionsPads"],
        "PKT": ["ProductionPads", "SWDSites"],
        "CKT": ["CompletionsPads", "SWDSites"],
        "CCT": ["CompletionsPads", "CompletionsPads"],
        "CST": ["CompletionsPads", "StorageSites"],
        "RST": ["TreatmentSites", "StorageSites"],
        "ROT": ["TreatmentSites", "ReuseOptions"],
        "SOT": ["StorageSites", "ReuseOptions"],
        "RKT": ["TreatmentSites", "SWDSites"],
    }

    for trucked_arc in trucked_arcs:
        ws = wb[trucked_arc]
        trucked_arc_node1 = trucked_arcs[trucked_arc][0]
        trucked_arc_node2 = trucked_arcs[trucked_arc][1]
        row_nodes = list(data.get(trucked_arc_node1, []))
        column_nodes = list(data.get(trucked_arc_node2, []))
        has_data = len(row_nodes) > 0 and len(column_nodes) > 0
        _sync_template_headers(ws, has_data=has_data)

        if not has_data:
            _print(f'trucked_arc {trucked_arc}: clearing table because row or column nodes are empty')
            _clear_antiquated_rows(
                ws,
                3,
                [1],
                max_row=200,
                clear_from_col=1,
                clear_to_col=ws.max_column,
                label=trucked_arc,
            )
            _clear_antiquated_columns(
                ws,
                2,
                2,
                max_column=200,
                clear_from_row=2,
                clear_to_row=ws.max_row,
                label=trucked_arc,
            )
        else:
            column = 1
            row = 3
            _print(f'trucked_arc {trucked_arc}: adding {trucked_arc_node1}')
            for node in row_nodes:
                cellLocation = f'{get_column_letter(column)}{row}'
                ws[cellLocation] = node
                row += 1

            column = 2
            row = 2
            _print(f'trucked_arc {trucked_arc}: adding {trucked_arc_node2}')
            for node in column_nodes:
                cellLocation = f'{get_column_letter(column)}{row}'
                ws[cellLocation] = node
                column += 1

            row = len(row_nodes) + 3
            column = len(column_nodes) + 2
            _clear_cells(ws, 3, row - 1, 2, column - 1)
            _clear_antiquated_rows(
                ws,
                row,
                [1],
                max_row=200,
                clear_from_col=1,
                clear_to_col=max(2, column - 1),
                label=trucked_arc,
            )
            _clear_antiquated_columns(
                ws,
                column,
                2,
                max_column=200,
                clear_from_row=2,
                clear_to_row=max(3, row - 1),
                label=trucked_arc,
            )

    ## step 5: add elevations:
    elevation_nodes = [
        'ProductionPads', 'CompletionsPads', 'SWDSites', 'ExternalWaterSources', 
        'StorageSites', 'TreatmentSites', 'ReuseOptions', 'NetworkNodes'
    ]

    column = 1
    row = 3
    ws = wb["Elevation"]
    elevation_has_data = any(len(data.get(node_key, {})) > 0 for node_key in elevation_nodes)
    _sync_template_headers(ws, has_data=elevation_has_data)
    for node_key in elevation_nodes:
        for node in data.get(node_key, {}):
            _print(f'node_key {node_key}: adding {node} elevation')
            nodeCellLocation = f'{get_column_letter(column)}{row}'
            valueCellLocation = f'{get_column_letter(column+1)}{row}'
            ws[nodeCellLocation] = node
            current_node = data[node_key][node]
            elevation = current_node.get("Elevation", None)
            if elevation is None:
                elevation = current_node.get("altitude", None)
            try:
                ws[valueCellLocation] = float(elevation)
            except:
                _print(f'unable to convert elevation to float. adding it as is: {elevation}')
                ws[valueCellLocation] = elevation
            row+=1
    _clear_antiquated_rows(ws, row, [1], max_row=500, clear_from_col=1, clear_to_col=2, label="Elevation")

    ## step 6: add forecasts (with empty values)
    forecast_tabs = {
        "CompletionsDemand": ["CompletionsPads"],
        "PadRates": ["ProductionPads"],
        "FlowbackRates": ["CompletionsPads"],
        "WellPressure": ["ProductionPads", "CompletionsPads"],
        "ReuseMinimum": ["ReuseOptions"],
        "ReuseCapacity": ["ReuseOptions"],
        "ExtWaterSourcingAvailability": ["ExternalWaterSources"],
        "DisposalOperatingCapacity": ["SWDSites"], ## AUTOFILL with ones?
    }

    column = 1
    for forecast_tab_key in forecast_tabs:
        ws = wb[forecast_tab_key]
        forecast_nodes = []
        for node_key in forecast_tabs[forecast_tab_key]:
            forecast_nodes.extend(list(data.get(node_key, {})))
        _sync_template_headers(ws, has_data=len(forecast_nodes) > 0)
        row = 3
        for node_key in forecast_tabs[forecast_tab_key]:
            _print(f'forecast_tab_key {forecast_tab_key}: adding {node_key}')
            nodes = data.get(node_key, {})
            for node in nodes:
                cellLocation = f'{get_column_letter(column)}{row}'
                ws[cellLocation] = node
                row+=1
        _clear_antiquated_rows(ws, row, [1], max_row=500, clear_from_col=1, clear_to_col=ws.max_column, label=forecast_tab_key)

    ## step 7: add initial pipelines, capacities, ...
    initial_pipeline_tabs = {
        "InitialPipelineCapacity": [
            ["ProductionPads", "CompletionsPads", "NetworkNodes", "StorageSites", "ExternalWaterSources", "TreatmentSites"], 
            ["NetworkNodes", "SWDSites", "TreatmentSites", "StorageSites", "ReuseOptions", "CompletionsPads"],
        ],
        "InitialPipelineDiameters": [
            ["ProductionPads", "CompletionsPads", "NetworkNodes", "StorageSites", "ExternalWaterSources", "TreatmentSites"], 
            ["NetworkNodes", "SWDSites", "TreatmentSites", "StorageSites", "ReuseOptions", "CompletionsPads"],
        ],
        "PipelineOperationalCost": [
            ["ProductionPads", "CompletionsPads", "NetworkNodes", "StorageSites", "ExternalWaterSources", "TreatmentSites"], 
            ["NetworkNodes", "SWDSites", "TreatmentSites", "StorageSites", "ReuseOptions", "CompletionsPads"],
        ],
        "PipelineExpansionDistance": [
            ["ProductionPads", "CompletionsPads", "NetworkNodes", "StorageSites", "ExternalWaterSources", "TreatmentSites"], 
            ["NetworkNodes", "SWDSites", "TreatmentSites", "StorageSites", "ReuseOptions", "CompletionsPads"],
        ],
        "TruckingTime": [
            ["ProductionPads", "CompletionsPads", "StorageSites", "TreatmentSites", "ExternalWaterSources"],
            ["CompletionsPads", "SWDSites", "StorageSites", "TreatmentSites", "ReuseOptions"],
        ],
    }
    
    for initial_pipeline_tab in initial_pipeline_tabs:
        ws = wb[initial_pipeline_tab]
        row_lookup = {}
        column_lookup = {}
        row_count = sum(len(data.get(node_key, {})) for node_key in initial_pipeline_tabs[initial_pipeline_tab][0])
        column_count = sum(len(data.get(node_key, {})) for node_key in initial_pipeline_tabs[initial_pipeline_tab][1])
        has_data = row_count > 0 and column_count > 0
        _sync_template_headers(ws, has_data=has_data)
        if not has_data:
            _clear_antiquated_rows(
                ws,
                3,
                [1],
                max_row=200,
                clear_from_col=1,
                clear_to_col=ws.max_column,
                label=initial_pipeline_tab,
            )
            _clear_antiquated_columns(
                ws,
                2,
                2,
                max_column=200,
                clear_from_row=2,
                clear_to_row=ws.max_row,
                label=initial_pipeline_tab,
            )
            continue

        # write row indexes
        column = 1
        row = 3
        node_keys = initial_pipeline_tabs[initial_pipeline_tab][0]
        for node_key in node_keys:
            _print(f'initial_pipeline_tab {initial_pipeline_tab}: adding {node_key}')
            for node in data.get(node_key, {}):
                cellLocation = f'{get_column_letter(column)}{row}'
                ws[cellLocation] = node
                row_lookup[node] = row
                row+=1
        
        # write column indexes
        node_keys = initial_pipeline_tabs[initial_pipeline_tab][1]
        column = 2
        row = 2
        for node_key in node_keys:
            _print(f'initial_pipeline_tab {initial_pipeline_tab}: adding {node_key}')
            for node in data.get(node_key, {}):
                cellLocation = f'{get_column_letter(column)}{row}'
                ws[cellLocation] = node
                column_lookup[node] = column
                column+=1

        ## After filling the initial pipeline table, old row/column headers from
        ## prior workbook contents can remain when the current dataset shrinks.
        ## Clear those antiquated headers and their corresponding matrix cells.
        row = len(row_lookup) + 3
        _print(f"initial_pipeline_tab {initial_pipeline_tab} checking for antiquated rows, columns")

        starting_row_index = row
        row = _clear_antiquated_rows(
            ws,
            row,
            [1],
            max_row=200,
            clear_from_col=1,
            clear_to_col=max(2, column - 1),
            label=initial_pipeline_tab,
        )
        ending_row_index = row

        starting_column_index = column
        column = _clear_antiquated_columns(
            ws,
            column,
            2,
            max_column=200,
            clear_from_row=2,
            clear_to_row=max(3, row - 1),
            label=initial_pipeline_tab,
        )
        ending_column_index = column

        # populate matrix values from connection metadata for relevant tabs
        metadata_key = None
        if initial_pipeline_tab == "InitialPipelineCapacity":
            metadata_key = "pipeline_capacity"
        elif initial_pipeline_tab == "InitialPipelineDiameters":
            metadata_key = "pipeline_diameter"
        elif initial_pipeline_tab == "PipelineExpansionDistance":
            metadata_key = "pipeline_length"

            

        if metadata_key is not None:
            _print(f"metadata_key: {metadata_key}")
            connection_metadata = data.get("connections", {}).get("connection_metadata", {})
            for connection_key, connection_values in connection_metadata.items():
                try:
                    node1_name, node2_name = connection_key.split("::", 1)
                except ValueError:
                    _print(f"unable to parse connection key for {initial_pipeline_tab}: {connection_key}")
                    continue

                if node1_name not in row_lookup or node2_name not in column_lookup:
                    continue

                value = connection_values.get(metadata_key)
                if value is None:
                    continue
                
                value_cell_location = f'{get_column_letter(column_lookup[node2_name])}{row_lookup[node1_name]}'
                ws[value_cell_location] = value

    initial_capacity_tabs = {
        "InitialDisposalCapacity": "SWDSites",
        "InitialStorageCapacity": "StorageSites",
        "CompletionsPadStorage": "CompletionsPads",
        "PadOffloadingCapacity": "CompletionsPads",
        "NodeCapacities": "NetworkNodes",
    }
    column = 1
    ## TODO: For other tabs, add the values like we did here:
    for initial_capacity_tab in initial_capacity_tabs:
        ws = wb[initial_capacity_tab]
        node_key = initial_capacity_tabs[initial_capacity_tab]
        _sync_template_headers(ws, has_data=len(data.get(node_key, {})) > 0)
        row = 3
        _print(f'initial_capacity_tab {initial_capacity_tab}: adding {node_key}')
        nodes = data.get(node_key, {})
        for node in nodes:
            nodevalues = nodes.get(node, {})
            cellLocation = f'{get_column_letter(column)}{row}'
            ws[cellLocation] = node
            value = nodevalues.get(initial_capacity_tab, None)
            cellValueLocation = f'{get_column_letter(column+1)}{row}'
            ws[cellValueLocation] = value
            row+=1
        _clear_antiquated_rows(ws, row, [1], max_row=500, clear_from_col=1, clear_to_col=2, label=initial_capacity_tab)

    single_value_tabs = {
        "DisposalOperationalCost": ["SWDSites"], ## AUTOFILL 0.35?
        "ReuseOperationalCost": ["CompletionsPads"],
        "ExternalSourcingCost": ["ExternalWaterSources"],
        "ExternalWaterQuality": ["ExternalWaterSources"],
        "TruckingHourlyCost": ["ProductionPads", "CompletionsPads", "ExternalWaterSources", "StorageSites", "TreatmentSites"],
        "DesalinationSites": ["TreatmentSites"],
        "BeneficialReuseCost": ["ReuseOptions"],
        "BeneficialReuseCredit": ["ReuseOptions"],
        "CompletionsPadOutsideSystem": ["CompletionsPads"],
    }

    column = 1
    for single_value_tab in single_value_tabs:
        ws = wb[single_value_tab]
        single_value_has_data = any(len(data.get(node_key, {})) > 0 for node_key in single_value_tabs[single_value_tab])
        _sync_template_headers(ws, has_data=single_value_has_data)
        row = 3
        for node_key in single_value_tabs[single_value_tab]:
            _print(f'single_value_tab {single_value_tab}: adding {node_key}')
            nodes = data.get(node_key, {})
            for node in nodes:
                nodevalues = nodes.get(node, {})
                cellLocation = f'{get_column_letter(column)}{row}'
                ws[cellLocation] = node
                value = nodevalues.get(single_value_tab, None)
                cellValueLocation = f'{get_column_letter(column+1)}{row}'
                ws[cellValueLocation] = value
                row+=1
        _clear_antiquated_rows(ws, row, [1], max_row=500, clear_from_col=1, clear_to_col=2, label=single_value_tab)

    water_quality_tabs = { ## AUTOFILL all these to ~150,000.00?
        "PadWaterQuality": ["ProductionPads", "CompletionsPads"],
        "StorageInitialWaterQuality": ["StorageSites"],
        "PadStorageInitialWaterQuality": ["CompletionsPads"],
    }

    column = 1
    for water_quality_tab in water_quality_tabs:
        ws = wb[water_quality_tab]
        water_quality_has_data = any(len(data.get(node_key, {})) > 0 for node_key in water_quality_tabs[water_quality_tab])
        _sync_template_headers(ws, has_data=water_quality_has_data)
        row = 3
        for node_key in water_quality_tabs[water_quality_tab]:
            _print(f'water_quality_tab {water_quality_tab}: adding {node_key}')
            nodes = data.get(node_key, {})
            for node in data.get(node_key, {}):
                nodevalues = nodes.get(node, {})
                cellLocation = f'{get_column_letter(column)}{row}'
                ws[cellLocation] = node
                # _print(f"writing to {water_quality_tab} cellLocation {cellLocation}: {node}")
                value = nodevalues.get(water_quality_tab, None)
                cellValueLocation = f'{get_column_letter(column+1)}{row}'
                ws[cellValueLocation] = value
                # _print(f"writing to {water_quality_tab} cellLocation {cellValueLocation}: {value}")
                row+=1
        _clear_antiquated_rows(ws, row, [1], max_row=500, clear_from_col=1, clear_to_col=2, label=water_quality_tab)


    ## step 8: add tabs that rely on TreatmentTechnologies, Capacities, Diameters
    expansion_tabs = {
        "DisposalExpansionCost": {"node": "SWDSites", "default": "InjectionCapacities"},
        "StorageExpansionCost": {"node": "StorageSites", "default": "StorageCapacities"},
        "DisposalExpansionLeadTime": {"node": "SWDSites", "default": "InjectionCapacities"},
        "StorageExpansionLeadTime": {"node": "StorageSites", "default": "StorageCapacities"},
    }

    for expansion_tab, config in expansion_tabs.items():
        node_key = config["node"]
        default_values = defaults[config["default"]]
        _write_expansion_matrix(
            expansion_tab,
            [(node,) for node in data.get(node_key, {})],
            list(default_values),
            [node_key],
            lambda keys, capacity: default_values[capacity].get(expansion_tab),
        )

    capacity_increments_tabs = {
        # "DisposalCapacityIncrements": {"default": "InjectionCapacities"},
        "StorageCapacityIncrements": {"default": "StorageCapacities"},
        "PipelineDiameterValues": {"default": "PipelineDiameters"},
        "PipelineCapacityIncrements": {"default": "PipelineDiameters"},
        "DesalinationTechnologies": {"default": "TreatmentTechnologies"},
    }

    for capacity_increments_tab in capacity_increments_tabs:
        ws = wb[capacity_increments_tab]
        default_values = defaults[capacity_increments_tabs[capacity_increments_tab]["default"]]
        _sync_template_headers(ws, has_data=len(default_values) > 0)
        row = 3
        try:
            for each in default_values:
                _print(f'capacity_increments_tab {capacity_increments_tab}: adding {each}')
                keyCellLocation = f'{get_column_letter(1)}{row}'
                valueCellLocation = f'{get_column_letter(2)}{row}'
                ws[keyCellLocation] = each
                ws[valueCellLocation] = default_values[each].get(capacity_increments_tab)
                row+=1
            _clear_antiquated_rows(ws, row, [1], max_row=200, clear_from_col=1, clear_to_col=2, label=capacity_increments_tab)
        except Exception as e:
            _print(f'unable to add {capacity_increments_tab}: {e}')

    capacity_increments_tabs = {
        "TreatmentCapacityIncrements": {"node": "SWDSites", "default": "TreatmentCapacities"},
    }

    for capacity_increments_tab in capacity_increments_tabs:
        ws = wb[capacity_increments_tab]
        node_key = capacity_increments_tabs[capacity_increments_tab]["node"]
        _sync_template_headers(ws, has_data=len(treatment_technologies) > 0)
        row = 3
        for tech in treatment_technologies:
            techCellLocation = f'{get_column_letter(1)}{row}'
            ws[techCellLocation] = tech
            default_values = defaults[capacity_increments_tabs[capacity_increments_tab]["default"]]
            column = 2
            for each in default_values:
                _print(f'{capacity_increments_tab}: adding {each}')

                # add header
                headerCellLocation = f'{get_column_letter(column)}{2}'
                ws[headerCellLocation] = each

                valueCellLocation = f'{get_column_letter(column)}{row}'
                ws[valueCellLocation] = default_values[each].get(capacity_increments_tab)
                column+=1
            row+=1
        _clear_antiquated_rows(ws, row, [1], max_row=200, clear_from_col=1, clear_to_col=column - 1, label=capacity_increments_tab)

    disposal_capacity_tab = "DisposalCapacityIncrements"
    ws = wb[disposal_capacity_tab]
    disposal_capacity_has_data = len(data.get("SWDSites", {})) > 0
    _sync_template_headers(ws, has_data=disposal_capacity_has_data)
    if not disposal_capacity_has_data:
        _clear_antiquated_rows(ws, 3, [1], max_row=500, clear_from_col=1, clear_to_col=ws.max_column, label=disposal_capacity_tab)
    else:

        # header row: SWDSites + injection capacity levels (I0, I1, ...)
        ws[f'{get_column_letter(1)}{2}'] = "SWDSites"
        column = 2
        for capacity_key in injection_capacities:
            header_cell_location = f'{get_column_letter(column)}{2}'
            ws[header_cell_location] = capacity_key
            column += 1

        # one row per SWD site, with values copied from injection_capacities for each level
        row = 3
        for swd_site in data.get("SWDSites", {}):
            swd_cell_location = f'{get_column_letter(1)}{row}'
            ws[swd_cell_location] = swd_site

            column = 2
            for capacity_key, capacity_values in injection_capacities.items():
                value_cell_location = f'{get_column_letter(column)}{row}'
                ws[value_cell_location] = capacity_values.get("DisposalCapacityIncrements", None)
                column += 1

            row += 1
        _clear_antiquated_rows(ws, row, [1], max_row=500, clear_from_col=1, clear_to_col=column - 1, label=disposal_capacity_tab)



    ## CODE TO GET TREATMENT TECHNOLOGIES. WE ARE DEFAULTING TO CB, CB-EV, MVC, and MD; so hard code those with corresponding values for now

    # treatment_technologies = []
    # ws = wb["TreatmentTechnologies"]
    # column = 1
    # row = 2
    # cellLocation = f'{get_column_letter(column)}{row}'
    # technology = ws[cellLocation].value
    # while technology is not None and technology != "" and row < 100: # just wanna make sure this doesnt get caught in an infinite loop
    #     _print(f'adding technology: {technology}')
    #     treatment_technologies.append(technology)
    #     row += 1
    #     cellLocation = f'{get_column_letter(column)}{row}'
    #     technology = ws[cellLocation].value

    tabs = {
        "InitialTreatmentCapacity": "TreatmentSites"
    }
    
    treatment_technology_keys = list(treatment_technologies.keys())
    for tab in tabs:
        ws = wb[tab]
        node_key = tabs[tab]
        _sync_template_headers(ws, has_data=len(data.get(node_key, {})) > 0)
        if len(data.get(node_key, {})) == 0:
            _clear_antiquated_rows(ws, 3, [1], max_row=500, clear_from_col=1, clear_to_col=ws.max_column, label=tab)
            continue
        # add column header
        column = 2
        for tech in treatment_technologies:
            columnHeaderCellLocation = f'{get_column_letter(column)}{2}'
            ws[columnHeaderCellLocation] = tech
            column+=1
        row = 3
        _print(f'tab {tab}: adding {node_key}')
        treatment_nodes = data.get(node_key, {})
        for node_name in treatment_nodes:
            node = treatment_nodes[node_name]
            _print(f"InitialTreatmentCapacity: {node_name}")
            cellLocation = f'{get_column_letter(1)}{row}'
            ws[cellLocation] = node_name

            capacity = node.get("Capacity", None)
            treatment_technology = node.get("TreatmentTechnology", None)
            if treatment_technology in treatment_technology_keys and capacity is not None:
                technology_index = treatment_technology_keys.index(treatment_technology)
                
                ## Start at the second column because the first column is the node names
                capacityColumn = technology_index + 2
                capacityCellLocation = f'{get_column_letter(capacityColumn)}{row}'
                ws[capacityCellLocation] = capacity

            row+=1
        _clear_antiquated_rows(ws, row, [1], max_row=500, clear_from_col=1, clear_to_col=column - 1, label=tab)
    
    tabs = {
        "TreatmentOperationalCost": "TreatmentSites",
        "TreatmentEfficiency": "TreatmentSites",
        "RemovalEfficiency": "TreatmentSites",
    }
    column = 2
    for tab in tabs:
        ws = wb[tab]
        node_key = tabs[tab]
        has_data = len(data.get(node_key, {})) > 0 and len(treatment_technologies) > 0
        _sync_template_headers(ws, has_data=has_data)
        row = 3
        for technology in treatment_technologies:
            value = treatment_technologies[technology].get(tab)
            _print(f'tab {tab}: adding {technology}')
            for node in data.get(node_key, {}):
                treatmentCellLocation = f'{get_column_letter(column-1)}{row}'
                technologyCellLocation = f'{get_column_letter(column)}{row}'
                valueCellLocation = f'{get_column_letter(column+1)}{row}'
                ws[treatmentCellLocation] = node
                ws[technologyCellLocation] = technology
                ws[valueCellLocation] = value
                row+=1
        _clear_antiquated_rows(ws, row, [1, 2], max_row=1000, clear_from_col=1, clear_to_col=3, label=tab)

    treatment_rows = [
        (node, technology)
        for technology in treatment_technologies
        for node in data.get("TreatmentSites", {})
    ]
    for tab in ("TreatmentExpansionLeadTime", "TreatmentExpansionCost"):
        _write_expansion_matrix(
            tab, treatment_rows, list(treatment_capacities),
            ["TreatmentSites", "TreatmentTechnologies"],
            lambda keys, capacity: (
                treatment_capacities[capacity].get(tab)
                if tab == "TreatmentExpansionLeadTime"
                else treatment_technologies[keys[1]].get(tab)
            ),
        )

    pipeline_rows = list(dict.fromkeys(
        (source, destination)
        for source, destinations in data.get("connections", {}).get("all_connections", {}).items()
        for destination in destinations
        if source != destination
    ))
    for tab in ("PipelineCapexCapacityBased", "PipelineExpansionLeadTime_Capac"):
        _write_expansion_matrix(
            tab, pipeline_rows, list(pipeline_diameters), ["NODES", "NODES"],
            lambda keys, capacity: pipeline_diameters[capacity].get(tab),
        )

    disposal_tabs = {
        "SWDDeep": "SWDSites",
        "SWDAveragePressure": "SWDSites",
        "SWDProxPAWell": "SWDSites",
        "SWDProxInactiveWell": "SWDSites",
        "SWDProxEQ": "SWDSites",
        "SWDProxFault": "SWDSites",
        "SWDProxHpOrLpWell": "SWDSites",
    }

    column = 1
    for disposal_tab in disposal_tabs:
        ws = wb[disposal_tab]
        node_key = disposal_tabs[disposal_tab]
        _sync_template_headers(ws, has_data=len(data.get(node_key, {})) > 0)
        row = 3
        _print(f'disposal_tab {disposal_tab}: adding {node_key}')
        nodes = data.get(node_key, {})
        for node in nodes:
            nodevalues = nodes.get(node, {})
            cellLocation = f'{get_column_letter(column)}{row}'
            ws[cellLocation] = node
            value = nodevalues.get(disposal_tab, None)
            cellValueLocation = f'{get_column_letter(column+1)}{row}'
            ws[cellValueLocation] = value
            row+=1
        _clear_antiquated_rows(ws, row, [1], max_row=500, clear_from_col=1, clear_to_col=2, label=disposal_tab)

    ## final step: Save and close
    preservation.restore()
    wb.save(excel_path)
    wb.close()
    return True

## TODO:
# - Handle Elevation in this function. Elevation is its own table in the Excel
def WriteJSONToExcel(data, output_file_name, template_location = None):
    """
        - This function takes our JSON formatted data and writes it to excel.
        - If an excel file location is provided, use that 
            (this usually means we are updating rather than creating a scenario)
        - If not, use the default input template

    :param data: Data from our df_parameters and df_sets
    :param output_file_name: Location of scenario Excel file
    :param template_location: Template to use as initial scenario Excel file, if provided
    """
    _log.info(f"writing json to excel at {output_file_name}")
    try:
        provided_template = template_location is not None

        excel_path = f'{output_file_name}.xlsx'
        _print(f'writing data to excel at {excel_path}')

        # copy template to new file for writing
        if provided_template:
            shutil.copyfile(template_location, excel_path)

        # open excel workbook
        wb = load_workbook(excel_path, data_only=True)

        for table_key, updatedTable in data.items():
            if table_key not in wb.sheetnames or table_key.lower() == "units":
                _log.warning(f"unable to find sheet for {table_key}; skipping")
                continue

            ws = wb[table_key]
            ## TODO: Test that our table clearing works as intended
            if not provided_template:
                for row in ws.iter_rows(min_row=2, max_row=ws.max_row, max_col=ws.max_column):
                    for cell in row:
                        cell.value = None
            if isinstance(updatedTable, list):
                row = 2
                for cellValue in updatedTable:
                    cellLocation = f'{get_column_letter(1)}{row}'
                    ws[cellLocation] = None if cellValue == "" else cellValue
                    row += 1
                continue

            if not isinstance(updatedTable, dict):
                _log.warning(f"unexpected table data for {table_key}; skipping")
                continue

            # update excel sheet, include headers
            column = 1
            for column_key in updatedTable:
                headerLocation = f'{get_column_letter(column)}{2}'
                ws[headerLocation] = column_key
                row = 3
                for cellValue in updatedTable[column_key]:
                    cellLocation = f'{get_column_letter(column)}{row}'
                    ws[cellLocation] = None if cellValue == "" else cellValue
                    row += 1
                column += 1

        # save and close workbook
        wb.save(excel_path)
        wb.close()
        return True
    except Exception as e:
        _log.error(f"Unable to WriteJSONToExcel: {e}")
        return False

def UpdateExcel(excel_path, table_key, updatedTable):
        try:
            wb = load_workbook(excel_path, data_only=True)
            _log.info(f'loaded workbook from path: {excel_path}')
            x = 1
            y = 3
            ws = wb[table_key]

            # update excel sheet
            _log.info(f'updating table: {updatedTable}')
            for column in updatedTable:
                y = 3
                for cellValue in updatedTable[column]:
                    cellLocation = f'{get_column_letter(x)}{y}'
                    originalValue = ws[cellLocation].value
                    if cellValue == "":
                        newValue = None
                    else:
                        newValue = cellValue
                    if originalValue != newValue:
                        _log.info(f'updating {cellLocation} to {newValue}')
                        ws[cellLocation] = newValue
                    y+=1
                x+=1
            wb.save(excel_path)
            wb.close()
            _log.info(f'saved workbook')

        except Exception as e:
            _log.error(f"Unable to update excel: {e}")
            return False

        return True


def determineConnectionsFromArcs(data, pipeline_diameter_values, pipeline_capacity_increments):
    """
    Derives connections from 'arcs' data.
    Accepts: map_data output from parsed .kmz, .shp
    Returns
      - dict updated with connections data

    Notes:
    map_data.arcs contains a list of objects, one for each pipeline.
    each pipeline object is in the following format:
        - name: str
        - node_type: path
        - nodes: list of connecting nodes containing the following:
            - name: str
            - coordinates: list of coords (location of this node)
            - outgoing_nodes: list of nodes that this node transfers water to

    In this function, we convert map_data.arcs into a "connections" object for writing to excel.
    This connections object is a dictionary containing the following:
        - {node_name}: {list of outgoing nodes}
    """
    arcs = data.get("arcs", {})
    connections = {
        "all_connections": {},
        "connection_metadata": {},
    }
    data["connections"] = connections
    for arc_key in arcs:
        arc = arcs[arc_key]
        nodes = arc.get("nodes")
        diameter = arc.get("diameter")
        pipeline_lengths = arc.get("lengths", [])
        for connecting_node in nodes:
            connecting_node_name = connecting_node["name"]
            outgoing_nodes = connecting_node.get("outgoing_nodes", [])
            current_outgoing_nodes = connections["all_connections"].get(connecting_node_name, [])
            current_outgoing_nodes.extend(n for n in outgoing_nodes if n != connecting_node_name and n not in current_outgoing_nodes)
            connections["all_connections"][connecting_node_name] = current_outgoing_nodes

        # Capacity and distance belong to each enabled direction of a segment.
        for idx, pipeline_length in enumerate(pipeline_lengths[:max(0, len(nodes) - 1)]):
            if pipeline_length is None or pipeline_length < 0:
                continue
            source, target = nodes[idx], nodes[idx + 1]
            for start, end in ((source, target), (target, source)):
                if start["name"] == end["name"] or end["name"] not in start.get("outgoing_nodes", []):
                    continue
                connections["connection_metadata"][f'{start["name"]}::{end["name"]}'] = {
                    "pipeline_length": pipeline_length,
                    "pipeline_diameter": pipeline_diameter_values.get(diameter),
                    "pipeline_capacity": pipeline_capacity_increments.get(diameter),
                }

    return data

def _column_table_to_dict(table_data, key_column="PipelineDiameters", value_column="VALUE"):
    """
    Convert a two-column table-like dict into a key-value dict.
    Example input:
      {"PipelineDiameters": ["D0", "D4"], "VALUE": [0, 4]}
    Example output:
      {"D0": 0, "D4": 4}
    """
    if not isinstance(table_data, dict):
        return {}

    keys = table_data.get(key_column, [])
    values = table_data.get(value_column, [])
    if not isinstance(keys, list) or not isinstance(values, list):
        return {}

    if len(keys) != len(values):
        _log.warning(
            f"mismatched column lengths for {key_column}/{value_column}: "
            f"{len(keys)} keys vs {len(values)} values"
        )

    result = {}
    for key, value in zip(keys, values):
        if key in [None, ""]:
            continue
        result[key] = value
    return result

def PreprocessMapData(data_input):
    """
    Preprocess map_data. 
        - On the frontend, we only update 'all_nodes' and 'arcs'
        - For WriteToExcel, we want nodes separated into different keys.
        - This function takes the nodes and splits them into their categories.
        - It also updates the 'connections' from the 'arcs'.
    Accepts: map_data dict
    Returns
      - dict updated with updated ProductionPads, CompletionsPads..., connections
    """
    map_data = data_input.get("map_data", None)
    all_nodes = map_data.get("all_nodes", {})
    default_node_type = map_data.get("defaultNode", "NetworkNode") ## default to network node if we don't have a default node type

    excel_data = {
        **map_data,
        'all_nodes': all_nodes,
        'arcs': map_data.get("arcs", {}),
        'polygons': map_data.get("polygons", {}),
        'ProductionPads': {},
        'CompletionsPads': {},
        'NetworkNodes': {},
        'SWDSites': {},
        'TreatmentSites': {},
        'StorageSites': {},
        'ExternalWaterSources': {},
        'ReuseOptions': {},
        'connections': {}
    }
    if 'TimePeriods' in data_input.get('df_sets', {}):
        excel_data['time_periods'] = data_input['df_sets']['TimePeriods']

    node_types = {
        'ProductionPad': 'ProductionPads',
        'CompletionsPad': 'CompletionsPads',
        'NetworkNode': 'NetworkNodes',
        'DisposalSite': 'SWDSites',
        'TreatmentSite': 'TreatmentSites',
        'StorageSite': 'StorageSites',
        'ExternalWaterSource': 'ExternalWaterSources',
        'ReuseOption': 'ReuseOptions'
    }

    for node in all_nodes:
        node_data = all_nodes[node]
        node_type = node_data.get("node_type", default_node_type)
        excel_key = node_types.get(node_type, None)
        if excel_key is None:
            _print(f"found faulty node type: {node_type}")
            continue
        excel_data[excel_key][node] = node_data

        ## PARETO's get_data() / read_data() / _sheets_to_dfs() fails if disposal sites is empty
    
    _print(f"finished adding nodes to excel data")

    df_parameters = data_input.get("df_parameters", {})
    pipeline_diameter_values = _column_table_to_dict(df_parameters.get("PipelineDiameterValues", {}))
    pipeline_capacity_increments = _column_table_to_dict(df_parameters.get("PipelineCapacityIncrements", {}))

    data = determineConnectionsFromArcs(excel_data, pipeline_diameter_values, pipeline_capacity_increments)

    return data



# sample_arcs = {
#     "p2": {
#         "styleUrl": "#m_ylw-pushpin",
#         "tessellate": "1",
#         "coordinates": [
#             ["-103.8539378936199", "34.53213547776518", "0"],
#             ["-103.8473422508395", "34.49228306568203", "0"],
#             ["-103.8223048221497", "34.49098515301236", "0"],
#         ],
#         "LineString": "",
#         "node_type": "path",
#         "node_list": ["N01", "K01", "K01"],
#         "nodes": [
#             {
#                 "name": "N01",
#                 "outgoing_nodes": ["K01"],
#                 "coordinates": ["-103.8539378936199", "34.53213547776518", "0"],
#             },
#             {
#                 "name": "K01",
#                 "outgoing_nodes": ["K02", "N01"],
#                 "coordinates": ["-103.8473422508395", "34.49228306568203", "0"],
#             },
#             {
#                 "name": "K02",
#                 "outgoing_nodes": ["K01"],
#                 "coordinates": ["-103.8223048221497", "34.49098515301236", "0"],
#             },
#         ],
#     },

# }

# data_with_connections = determineConnectionsFromArcs({"arcs": sample_arcs})
# print(data_with_connections)
