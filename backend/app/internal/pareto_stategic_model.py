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
import time
import datetime
import logging
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
    DesalinationModel
)
from pyomo.opt import TerminationCondition
from pareto.utilities.results import generate_report, OutputUnits, is_feasible, nostdout
from pareto.utilities.model_modifications import fix_vars

from app.internal.get_data import get_input_lists, get_data
from app.internal.scenario_handler import (
    scenario_handler,
)

from app.internal.model_diagnostics import scan_constraint_violations, unavailable_constraint_scan
from app.internal.model_compatibility import prepare_model_for_ui

_log = logging.getLogger(__name__)


def run_strategic_model(input_file, output_file, id, modelParameters, overrideValues={}):
    start_time = datetime.datetime.now()
    scenario = scenario_handler.get_scenario(int(id))
    run_revision = scenario.get('input_revision')
    scenario["results"] = {"data": {}, "status": "Building model", "input_revision": run_revision,
                           "constraints_violations": unavailable_constraint_scan()}
    scenario_handler.update_scenario(scenario)

    [set_list, parameter_list] = get_input_lists()
    
    _log.info(f"getting data from excel sheet")
    [df_sets, df_parameters, _] = get_data(input_file, set_list, parameter_list)

    _log.info(f"creating model")
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
            "desalination_model": DesalinationModel[modelParameters["desalination_model"]],
            # "build_units": BuildUnits[modelParameters["build_units"]]
    }
    strategic_model = create_model(
        df_sets,
        df_parameters,
        default=default
    )
    prepare_model_for_ui(strategic_model)
    
    scenario = scenario_handler.get_scenario(int(id))
    results = {"data": {}, "status": "Solving model", "input_revision": run_revision}
    scenario["results"] = results
    scenario_handler.update_scenario(scenario)
    try:
        optimality_gap = int(modelParameters["optimalityGap"])/100
    except:
        optimality_gap = 0
        
    options = {
        "deactivate_slacks": modelParameters["deactivate_slacks"],
        "scale_model": modelParameters["scale_model"],
        "scaling_factor": 1000,
        "running_time": modelParameters["runtime"],
        "gap": optimality_gap,
        "solver": modelParameters["solver"]
    }

    if options["solver"] not in ["cbc", "gurobi", "gurobi_direct"]:
        _log.info('deleting solver as it doesnt match any of the proper solver names')
        del options["solver"]

    _log.info(f"solving model with options: {options}")

    # check for any override values and fix those variables in the model before running solve
    _log.info(f"checking for override values: ")
    # _log.info(overrideValues)
    for variable in overrideValues:
        if len(overrideValues[variable]) > 0:
            for idx in overrideValues[variable]:
                override_object = overrideValues[variable][idx]
                _log.info(f"overriding {override_object['variable'].replace('_dict','')} with indexes {override_object['indexes']} and value {override_object['value']}")
                fix_vars(
                    model=strategic_model, 
                    vars_to_fix=[override_object['variable'].replace('_dict','')], 
                    indexes=tuple(override_object['indexes']), 
                    v_val=float(override_object['value'])
                )


    try:
        model_results = solve_model(model=strategic_model, options=options)
    except Exception:
        scenario = scenario_handler.get_scenario(int(id))
        scenario["results"]["constraints_violations"] = scan_constraint_violations(strategic_model)
        scenario_handler.update_scenario(scenario)
        raise
    termination_condition = model_results.solver.termination_condition
    constraint_violations = scan_constraint_violations(
        strategic_model,
        solution_state="solver_solution" if termination_condition == TerminationCondition.optimal else "current_model_values",
    )
    scenario = scenario_handler.get_scenario(int(id))
    scenario["results"].update(terminationCondition=str(termination_condition), constraints_violations=constraint_violations)
    scenario_handler.update_scenario(scenario)
    with nostdout():
        feasibility_status = is_feasible(strategic_model)
        _log.info(f"feasibility status is: {feasibility_status}")

    if not feasibility_status:
        _log.error(f"feasibility status check failed")
        termination_condition = model_results.solver.termination_condition
    else:
        print("\nModel results validated and found to pass feasibility tests\n" + "-" * 60)
        termination_condition = model_results.solver.termination_condition


    scenario = scenario_handler.get_scenario(int(id))
    results = {"data": {}, "status": "Generating output", "terminationCondition": str(termination_condition),
               'input_revision': run_revision,
               'solution_status': 'optimal' if feasibility_status and termination_condition == TerminationCondition.optimal else 'feasible' if feasibility_status else 'unverified',
               "constraints_violations": constraint_violations}
    scenario["results"] = results

    ## RESET override_values
    ## ADD them to a different key 
    # scenario['override_values'] = {
    #                 "vb_y_overview_dict": {},
    #                 "v_F_Piped_dict": {},
    #                 "v_F_Sourced_dict": {},
    #                 "v_F_Trucked_dict": {},
    #                 "v_L_Storage_dict": {},
    #                 "v_L_PadStorage_dict": {},
    #                 "vb_y_Pipeline_dict": {},
    #                 "vb_y_Disposal_dict": {},
    #                 "vb_y_Storage_dict": {},
    #                 "vb_y_Treatment_dict": {}
    #             }
    scenario['optimized_override_values'] = overrideValues

    scenario_handler.update_scenario(scenario)

    print("\nConverting to Output Units and Displaying Solution\n" + "-" * 60)
    """Valid values of parameters in the generate_report() call
    is_print: [PrintValues.detailed, PrintValues.nominal, PrintValues.essential]
    output_units: [OutputUnits.user_units, OutputUnits.unscaled_model_units]
    """
    [model, results_dict] = generate_report(
        strategic_model,
        results_obj=model_results,
        # is_print=[PrintValues.essential],
        output_units=OutputUnits.user_units,
        fname=output_file,
    )

    total_time = datetime.datetime.now() - start_time
    _log.info(f"total process took {total_time.seconds} seconds")

    return {
        "results_data": results_dict,
        "constraints_violations": constraint_violations,
    }

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

def handle_run_strategic_model(input_file, output_file, id, modelParameters, overrideValues={}):

    # need to incorporate the override values back into the infrastructure table
    try:
        model_run_output = run_strategic_model(input_file, output_file, id, modelParameters, overrideValues)
        _log.info(f'successfully ran model for id #{id}, updating scenarios')
        scenario = scenario_handler.get_scenario(int(id))
        results = scenario["results"]
        results['data'] = model_run_output.get("results_data", {})
        results['constraints_violations'] = model_run_output.get("constraints_violations", unavailable_constraint_scan())
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
        elif results.get('solution_status') == 'unverified':
            results['status'] = 'failure'
            results['error'] = f"The solver stopped without a verified feasible solution ({results['terminationCondition']}). Review the inputs or allow more solver time."
        else:
            results['status'] = 'Optimized'
        scenario["results"] = results
        scenario_handler.update_scenario(scenario)
        scenario_handler.check_for_diagram(id)
    except Exception as e:
        _log.exception(f"unable to run strategic model: {e}")
        time.sleep(2)
        scenario = scenario_handler.get_scenario(int(id))
        previous_results = scenario.get("results") or {}
        results = {
            "data": {}, "status": "failure", "error": str(e),
            "terminationCondition": previous_results.get("terminationCondition"),
            "constraints_violations": previous_results.get("constraints_violations") or unavailable_constraint_scan(),
            'input_revision': previous_results.get('input_revision'),
            'solution_status': previous_results.get('solution_status'),
            'failure_stage': previous_results.get('status'),
        }
        scenario["results"] = results
        scenario_handler.update_scenario(scenario)
    try:
        _log.info(f'removing id {id} from background tasks')
        scenario_handler.remove_background_task(id)
    except Exception as e:
        _log.error(f"unable to remove id {id} from background tasks: {e}")
