#####################################################################################################
# PARETO was produced under the DOE Produced Water Application for Beneficial Reuse Environmental
# Impact and Treatment Optimization (PARETO), and is copyright (c) 2021-2024 by the software owners:
# The Regents of the University of California, through Lawrence Berkeley National Laboratory, et al.
# All rights reserved.
#
# NOTICE. This Software was developed under funding from the U.S. Department of Energy and the U.S.
# Government consequently retains certain rights. As such, the U.S. Government has been granted for
# itself and others acting on its behalf a paid-up, nonexclusive, irrevocable, worldwide license in
# the Software to reproduce, distribute copies to the public, prepare derivative works, and perform
# publicly and display publicly, and to permit others to do so.
#####################################################################################################
import json
import os
import time
import datetime
import logging
from pareto.operational_water_management.operational_produced_water_optimization_model import (
    WaterQuality,
    create_model,
    ProdTank,
    postprocess_water_quality_calculation,
)
from pareto.utilities.get_data import get_data
from pareto.utilities.results import (
    generate_report,
    PrintValues,
    OutputUnits,
    is_feasible,
    nostdout,
)
from pareto.utilities.solvers import get_solver, set_timeout
from importlib import resources
from pareto.utilities.model_modifications import fix_vars

import idaes.logger as idaeslog
from app.internal.get_data import get_input_lists
from app.internal.scenario_handler import (
    scenario_handler,
)


# _log = idaeslog.getLogger(__name__)
_log = logging.getLogger(__name__)


def run_operational_model(input_file, output_file, id, modelParameters, overrideValues={}):
    start_time = datetime.datetime.now()

    [set_list, parameter_list] = get_input_lists(_model_type="operational")
    
    _log.info(f"getting data from excel sheet")
    [df_sets, df_parameters] = get_data(input_file, set_list, parameter_list)

    # Additional input data
    df_parameters["MinTruckFlow"] = 0  # barrels/day
    df_parameters["MaxTruckFlow"] = 259000  # barrels/day

    _log.info(f"creating model")

    default={
        "has_pipeline_constraints": True,
        "production_tanks": ProdTank.equalized,
        "water_quality": WaterQuality.false,
    },
    operational_model = create_model(
        df_sets,
        df_parameters,
        default=default,
    )
    _log.info("created model")
    scenario = scenario_handler.get_scenario(int(id))
    results = {"data": {}, "status": "Solving model"}
    scenario["results"] = results
    scenario_handler.update_scenario(scenario)

    if modelParameters["solver"] not in ["cbc", "gurobi", "gurobi_direct"]:
        _log.info('deleting solver as it doesnt match any of the proper solver names')
        del modelParameters["solver"]

    # _log.info(f"solving model with options: {modelParameters}")

    # check for any override values and fix those variables in the model before running solve
    _log.info(f"skipping override values for now")
    # for variable in overrideValues:
    #     if len(overrideValues[variable]) > 0:
    #         for idx in overrideValues[variable]:
    #             override_object = overrideValues[variable][idx]
    #             _log.info(f"overriding {override_object['variable'].replace('_dict','')} with indexes {override_object['indexes']} and value {override_object['value']}")
    #             fix_vars(
    #                 model=operational_model, 
    #                 vars_to_fix=[override_object['variable'].replace('_dict','')], 
    #                 indexes=tuple(override_object['indexes']), 
    #                 v_val=float(override_object['value'])
    #             )

    # initialize pyomo solver
    opt = get_solver(modelParameters.get("solver", "cbc"))
    set_timeout(opt, timeout_s=60)

    # solve mathematical model
    model_results = opt.solve(operational_model, tee=True)
    model_results.write()

    with nostdout():
        feasibility_status = is_feasible(operational_model)

    if not feasibility_status:
        _log.error(f"feasibility status check failed, setting termination condition to infeasible")
        termination_condition = "infeasible"
    else:
        print("\nModel results validated and found to pass feasibility tests\n" + "-" * 60)
        termination_condition = model_results.solver.termination_condition


    if operational_model.config.water_quality is WaterQuality.post_process:
        operational_model = postprocess_water_quality_calculation(
            operational_model, df_sets, df_parameters, opt
        )
    
    scenario = scenario_handler.get_scenario(int(id))
    results = {"data": {}, "status": "Generating output", "terminationCondition": termination_condition}
    scenario["results"] = results

    scenario['optimized_override_values'] = overrideValues

    scenario_handler.update_scenario(scenario)

    # Generate report and display results #
    """Valid values of parameters in the generate_report() call
    is_print: [PrintValues.detailed, PrintValues.nominal, PrintValues.essential]
    output_units: [OutputUnits.user_units, OutputUnits.unscaled_model_units]
    """
    [model, results_dict] = generate_report(
        operational_model,
        is_print=PrintValues.essential,
        output_units=OutputUnits.user_units,
        fname=output_file,
    )

    total_time = datetime.datetime.now() - start_time
    _log.info(f"total process took {total_time.seconds} seconds")

    return results_dict

OVERRIDE_PRESET_VALUES = {
  "vb_y_Pipeline_dict": {
      "row_name": "Pipeline Construction",
      "input_table": "PipelineDiameterValues",
      "indexes": [1, 2],
      "unit": "in",
  },
  "vb_y_Storage_dict": {
      "row_name": "Storage Facility",
      "input_table": "StorageCapacityIncrements",
      "indexes": [1],
      "unit": "bbl",
  },
  "vb_y_Disposal_dict": {
      "row_name": "Disposal Facility",
      "input_table": "TreatmentCapacityIncrements",
      "indexes": [1],
      "unit": "bbl/d",
  },
  "vb_y_Treatment_dict": {
      "row_name": "Treatment Facility",
      "input_table": "TreatmentCapacityIncrements",
      "indexes": [1,5],
      "unit": "bbl/d",
  },
}

def handle_run_operational_model(input_file, output_file, id, modelParameters, overrideValues={}):

    # need to incorporate the override values back into the infrastructure table
    try:
        results_dict = run_operational_model(input_file, output_file, id, modelParameters, overrideValues)
        _log.info(f'successfully ran model for id #{id}, updating scenarios')
        scenario = scenario_handler.get_scenario(int(id))
        results = scenario["results"]
        results['data'] = results_dict
        # _log.info('optimized_override_values')
        # _log.info(scenario['optimized_override_values'])

        #ONLY DESIGNED FOR INFRASTRUCTURE BUILDOUT
        overrideValues = scenario['optimized_override_values']
        try:
            for variable in overrideValues:
                if len(overrideValues[variable]) > 0:
                    for idx in overrideValues[variable]:
                        # if value is from infrastructure buildout
                        if variable == "vb_y_overview_dict":
                            # _log.info(variable)
                            override_object = overrideValues[variable][idx]
                            if override_object["isZero"]:
                                override_variable = override_object['variable']
                                indexes = override_object['indexes']
                                value = override_object['value']
                                
                                row_name = OVERRIDE_PRESET_VALUES[override_variable]['row_name']
                                unit = OVERRIDE_PRESET_VALUES[override_variable]['unit']
                                indexes_idx = 0
                                new_row = [row_name, '--', '--', '', unit, '--']
                                for row_idx in OVERRIDE_PRESET_VALUES[override_variable]['indexes']:
                                    new_row[row_idx] = indexes[indexes_idx]
                                    indexes_idx += 1
                                new_row[3] = 0
                                _log.info('new row')
                                _log.info(new_row)
                                results['data']["vb_y_overview_dict"].append(tuple(new_row))

                        # else if from another table

        except Exception as e:
            _log.error('unable to add infrastructure rows back in')
        

        if results['terminationCondition'] == "infeasible":
            results['status'] = 'Infeasible'
        else:
            results['status'] = 'Optimized'
        scenario["results"] = results
        scenario_handler.update_scenario(scenario)
        scenario_handler.check_for_diagram(id)
    except Exception as e:
        _log.error(f"unable to run operational model: {e}")
        time.sleep(2)
        scenario = scenario_handler.get_scenario(int(id))
        results = {"data": {}, "status": "failure", "error": str(e)}
        scenario["results"] = results
        scenario_handler.update_scenario(scenario)
    try:
        _log.info(f'removing id {id} from background tasks')
        scenario_handler.remove_background_task(id)
    except Exception as e:
        _log.error(f"unable to remove id {id} from background tasks: {e}")
