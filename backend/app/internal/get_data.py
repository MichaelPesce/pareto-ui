#####################################################################################################
# PARETO was produced under the DOE Produced Water Application for Beneficial Reuse Environmental
# Impact and Treatment Optimization (PARETO), and is copyright (c) 2021 by the software owners: The
# Regents of the University of California, through Lawrence Berkeley National Laboratory, et al. All
# rights reserved.
#
# NOTICE. This Software was developed under funding from the U.S. Department of Energy and the
# U.S. Government consequently retains certain rights. As such, the U.S. Government has been granted
# for itself and others acting on its behalf a paid-up, nonexclusive, irrevocable, worldwide license
# in the Software to reproduce, distribute copies to the public, prepare derivative works, and perform
# publicly and display publicly, and to permit other to do so.
#####################################################################################################

import warnings
import pandas as pd
import numpy as np
from pareto.utilities.get_data import (
    set_tabs_operational_model,
    set_tabs_strategic_model,
    set_tabs_all_models,
    parameter_tabs_operational_model,
    parameter_tabs_strategic_model,
    parameter_tabs_critical_mineral_model,
    parameter_tabs_all_models,
    get_valid_input_set_tab_names,
    get_valid_input_parameter_tab_names,
    _sheets_to_dfs,
    _cleanup_data,
    _df_to_param
)



try:
    _dataframe_map = pd.DataFrame.map
except AttributeError:
    # compatibility with pandas 2.0.x
    _dataframe_map = pd.DataFrame.applymap

try:
    pd.set_option("future.no_silent_downcasting", True)
except pd.errors.OptionError:
    # future.no_silent_downcasting not available for pandas 2.0,
    # which is the latest available for Python 3.8
    pass


def _read_data(_fname, _set_list, _parameter_list, _model_type="strategic", raises: bool = True,):
    """
    This methods uses Pandas methods to read from an Excel spreadsheet and output a data frame
    Two data frames are created, one that contains all the Sets: _df_sets, and another one that
    contains all the parameters in raw format: _df_parameters
    """
    frontend_parameters = {}
    pareto_input_set_tab_names = get_valid_input_set_tab_names(_model_type)
    pareto_input_parameter_tab_names = get_valid_input_parameter_tab_names(_model_type)

    if _set_list is not None:
        _set_list = list(_set_list)
        valid_set_tab_names = pareto_input_set_tab_names.copy()
        valid_set_tab_names.extend(_set_list)
        # De-duplicate
        valid_set_tab_names = list(set(valid_set_tab_names))
    else:
        valid_set_tab_names = pareto_input_set_tab_names
    if _parameter_list is not None:
        _parameter_list = list(_parameter_list)
        valid_parameter_tab_names = pareto_input_parameter_tab_names.copy()
        valid_parameter_tab_names.extend(_parameter_list)
        # De-duplicate
        valid_parameter_tab_names = list(set(valid_parameter_tab_names))
    else:
        valid_parameter_tab_names = pareto_input_parameter_tab_names

    # Check all names available in the input sheet
    # If the sheet name is unused (not a valid Set or Parameter tab, not "Overview", and not "Schematic"), raise a warning.
    unused_tab_list = []
    df = pd.ExcelFile(_fname)
    sheet_list = df.sheet_names
    for name in sheet_list:
        if (
            name not in valid_set_tab_names
            and name not in valid_parameter_tab_names
            and name != "Overview"
            and name != "Schematic"
        ):
            unused_tab_list.append(name)

    if len(unused_tab_list) > 0:
        warning_message = (
            f"Invalid PARETO input has been provided. Check that the input tab names match valid PARETO input. If you'd like to read custom tabs (e.g., PARETO output files), please pass a list of the custom tab names to get_data(). The following tabs are not standard PARETO inputs for the selected model type: "
            + str(unused_tab_list)
        )
        warnings.warn(
            warning_message,
            UserWarning,
            stacklevel=3,
        )
    _df_sets = {}
    _df_parameters = {}
    _data_column = ["value"]
    proprietary_data = False
    # Read all tabs in the input file
    _df_sets = _sheets_to_dfs(
        _fname,
        raises=raises,
        header=0,
        index_col=None,
        usecols="A",
        dtype="string",
        keep_default_na=False,
    )

    # Filter for sets - remove tabs that are not specified as sets by user and
    # are not valid PARETO inputs
    _df_sets = {
        key: value for key, value in _df_sets.items() if key in valid_set_tab_names
    }

    # Cleaning Sets. Checking for empty entries, and entries with the keyword: PROPRIETARY DATA
    for df in _df_sets:
        for idx, i in enumerate(_df_sets[df]):
            if i.lower() == "proprietary data":
                _df_sets[df][idx] = ""
        _df_sets[df].replace("", np.nan, inplace=True)
        _df_sets[df].dropna(inplace=True)

    _df_parameters = _sheets_to_dfs(
        _fname,
        raises=raises,
        header=1,
        index_col=None,
        usecols=None,
        keep_default_na=False,
    )

    # Remove tabs that are not specified by user and are not valid PARETO inputs
    _df_parameters = {
        key: value
        for key, value in _df_parameters.items()
        if key in valid_parameter_tab_names
    }

    # Cleaning Parameters.
    # A parameter can be defined in column format or table format.
    # Detect if columns which will be used to reshape the dataframe by defining
    # what columns are Sets or generic words

    # If _model_type is "none" and _df_sets is empty, it is assumed that a parameter in column format is being read.
    # _df_sets is created based on the DataFrame column names, except for the last name,
    # which is used as the data column name. See test_plot_scatter.py for an example of this use case.
    if len(_df_sets.keys()) == 0:
        for i in _df_parameters:
            valid_set_tab_names.extend(list(_df_parameters[i].columns)[:-1])
            _data_column.append(list(_df_parameters[i].columns)[-1])

    valid_set_tab_names = list(set(valid_set_tab_names))
    _data_column = list(set(_data_column))
    generic_words = ["index", "nodes", "time", "pads", "quantity"]
    remove_columns = ["unnamed", "proprietary data"]
    keyword_strings = ["PROPRIETARY DATA", "proprietary data", "Proprietary Data"]
    for i in _df_parameters:
        if proprietary_data is False:
            proprietary_data = any(
                x in _df_parameters[i].values.astype(str) for x in keyword_strings
            )
            if proprietary_data is False:
                proprietary_data = any(
                    x in _df_parameters[i].columns for x in keyword_strings
                )
        # Checking for tabs, new lines and entries with the keyword "PROPRIETARY DATA" and replacing them for an empty string
        _df_parameters[i].replace(
            to_replace=keyword_strings,
            value="",
            inplace=True,
        )
        _df_parameters[i].replace(
            to_replace=[r"\\t|\\n|\\r", "\t|\n|\r"], value="", regex=True, inplace=True
        )
        # Removing whitespaces
        _df_parameters[i] = _dataframe_map(
            _df_parameters[i], lambda x: x.strip() if isinstance(x, str) else x
        )
        # Removing all the columns that contain only empty strings
        # _df_parameters[i] = _df_parameters[i][_df_parameters[i].columns[~_df_parameters[i].eq('').all(0)]]
        # Removing columns that are unnamed or have the keyword "proprietary data" as column name
        drop_col = [
            i
            for i in _df_parameters[i].columns
            if any(x in str(i).lower() for x in remove_columns)
        ]
        _df_parameters[i].drop(columns=drop_col, inplace=True)
        # Removing all the rows that contain only empty strings
        _df_parameters[i] = _df_parameters[i][~_df_parameters[i].eq("").all(1)]

        frontend_parameters[i] = _df_parameters[i].fillna('').to_dict('list')

        index_col = []
        for j in _df_parameters[i].columns:
            # If a column name is in the set_list or in the list of keywords, it is assumed the column is an index and saved in index_col
            if str(j).split(".")[0].lower() in [
                s.lower() for s in valid_set_tab_names
            ] or any(x in str(j).lower() for x in generic_words):
                index_col.append(j)

        # If the number of index_col is equal to the total columns of the dataframe
        # it means that this is a parameter in column format. Therefore, the indices are defined for all
        # the columns of the dataframe except for the last column which contains the data
        if len(index_col) != 0 and (len(index_col) == len(_df_parameters[i].columns)):
            data_column = index_col.pop()
    
        if len(index_col) != 0:
            _df_parameters[i].set_index(index_col, inplace=True)

    # Creating a DataFrame that contains a boolean for proprietary_data. This is used as a "flag" in
    # generate_report() to output warnings if the report contains proprietary data.
    _df_parameters["proprietary_data"] = pd.DataFrame(
        [proprietary_data], columns=["Value"]
    )

    return [_df_sets, _df_parameters, _data_column, frontend_parameters]


def get_data(
  fname,
  set_list=None,
  parameter_list=None,
  model_type="strategic",
  sum_repeated_indexes=False,
  raises: bool = False,
):
    """
    This method uses Pandas methods to read data for Sets and Parameters from excel spreadsheets.
    - Sets are assumed to not have neither a header nor an index column. In addition, the data
      should be placed in column A, row 2
    - Parameters can be in either table or column format. Table format: Requires a header
      (usually time periods) and an index column whose elements should be contained in a Set.
      The header should start in row 2, and the index column should start in cell A3.
      Column format: Does not require a header. Each set should be placed in one column,
      starting from column A and row 3. Data should be provided in the last column.
    - set_list and parameter_list are optional parameters. When they are not given, tabs with
      valid PARETO labels are read. Otherwise, the specified tabs in set_list and
      parameter_list are read in addition to valid PARETO input tabs.
    - model_type is an additional optional parameter which indicates why type of model data is being read for.
      Valid inputs: 'strategic', 'operational', 'critical_mineral', 'none'. The default is 'strategic'.

    By default, errors encountered while performing data pre-processing are collected and displayed as warnings.
    If ``raises=True``, an exception will be raised instead.

    Outputs:
    The method returns one dictionary that contains a list for each set, and one dictionary that
    contains parameters in format {`param1`:{(set1, set2): value}, `param1`:{(set1, set2): value}}

    To use this method:

    set_list = [list of tabs that contain sets]
    parameter_list = [list of tabs that contain parameters]
    [df_sets, df_parameters] = get_data(fname='path\\to\\excel\\file\\INPUT_DATA.xlsx',
                                        set_list, parameter_list)

        ###############################################################################
                                     SET DEFINITION
        ###############################################################################
        model.p = Set(initialize=_df_sets['ProductionPads'].values,
                        doc='Production Pads')
        model.c = Set(initialize=_df_sets['CompletionsPads'].values,
                        doc='Completions Pads')
        model.d = Set(initialize=_df_sets['SWDSites'].values,
                        doc='SWD Sites')
        model.t = Set(initialize=_df_sets['TimePeriods'].values,
                        doc='planning weeks')
        model.l = Set(initialize=model.p | model.c | model.d,
                        doc='Superset that contains all locations')

        ###############################################################################
        #                           PARAMETER DEFINITION
        ###############################################################################
        model.drive_times = Param(model.l, model.l,
                                    initialize=df_parameters['DriveTimes'],
                                    doc="Driving times between locations")
        model.completion_demand = Param(model.c, model.t,
                                        initialize=df_parameters['CompletionsDemand'],
                                        doc="Water demand for completion operations")
        model.flowback_rates = Param(model.c, model.t,
                                        initialize=df_parameters['FlowbackRates'],
                                     doc="Water flowback rate")

    It is worth highlighting that the Set for time periods "model.s_T" is derived by the
    method based on the Parameter: CompletionsDemand which is indexed by T

    Similarly, the Set for Water Quality Index "model.s_QC" is derived by the method based
    on the input tab: PadWaterQuality which is indexed by QC and the Set for Air Quality Index
    "model.s_AQ" is derived by the method based on the input tab AirEmissionCoefficients.
    """
    # Call _read_data with the correct model type
    if model_type in ["strategic", "operational", "critical_mineral", "none"]:
        # Reading raw data, two data frames are output, one for Sets, and another one for Parameters
        [_df_sets, _df_parameters, data_column, frontend_parameters] = _read_data(
            fname, set_list, parameter_list, model_type, raises=raises
        )
    else:
        # Invalid model type provided, raise warning and use default (strategic)
        warning_message = f"An invalid model type has been provided. Strategic model type has been assumed. If you would like to run as a different model type, please re-run with one of the following model types: 'strategic', 'operational', 'extra_models', 'none'"
        warnings.warn(
            warning_message,
            UserWarning,
            stacklevel=3,
        )
        # Reading raw data, two data frames are output, one for Sets, and another one for Parameters
        [_df_sets, _df_parameters, data_column] = _read_data(
            fname, set_list, parameter_list, _model_type="strategic", raises=raises
        )

    # Parameters are cleaned up, e.g. blank cells are replaced by NaN
    _df_parameters = _cleanup_data(_df_parameters)

    # The set for time periods is defined based on the columns of the parameter for
    # Completions Demand. This is done so the user does not have to add an extra tab
    # in the spreadsheet for the time period set
    if "CompletionsDemand" in _df_parameters.keys():
        _df_sets["TimePeriods"] = _df_parameters[
            "CompletionsDemand"
        ].columns.to_series()
    # The data frame for Parameters is preprocessed to match the format required by Pyomo
    _df_parameters = _df_to_param(_df_parameters, data_column, sum_repeated_indexes)
    return [_df_sets, _df_parameters, frontend_parameters]


def get_input_lists(_model_type="strategic"):
    set_list = set_tabs_all_models
    parameter_list = parameter_tabs_all_models
    if _model_type == "strategic":
        set_list = set_list + set_tabs_strategic_model
        parameter_list = parameter_list + parameter_tabs_strategic_model
    elif _model_type == "operational":
        set_list = set_list + set_tabs_operational_model
        parameter_list = parameter_list + parameter_tabs_operational_model

    return [set_list, parameter_list]


operational_set_list = [
    "ProductionPads",
    "CompletionsPads",
    "ProductionTanks",
    "ExternalWaterSources",
    "WaterQualityComponents",
    "StorageSites",
    "SWDSites",
    "TreatmentSites",
    "ReuseOptions",
    "NetworkNodes",
]
operational_parameter_list = [
    "Units",
    "RCA",
    "FCA",
    "PCT",
    "FCT",
    "CCT",
    "PKT",
    "PRT",
    "CKT",
    "CRT",
    "PAL",
    "CompletionsDemand",
    "PadRates",
    "TankFlowbackRates",
    "FlowbackRates",
    "ProductionTankCapacity",
    "DisposalCapacity",
    "CompletionsPadStorage",
    "TreatmentCapacity",
    "ExtWaterSourcingAvailability",
    "PadOffloadingCapacity",
    "TruckingTime",
    "DisposalOperationalCost",
    "TreatmentOperationalCost",
    "ReuseOperationalCost",
    "PadStorageCost",
    "PipelineOperationalCost",
    "TruckingHourlyCost",
    "ExternalSourcingCost",
    "ProductionRates",
    "TreatmentEfficiency",
    "ExternalWaterQuality",
    "PadWaterQuality",
    "StorageInitialWaterQuality",
]