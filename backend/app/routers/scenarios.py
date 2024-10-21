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
import io
import os
import aiofiles
from fastapi import Body, Request, APIRouter, HTTPException, File, UploadFile, BackgroundTasks
from fastapi.responses import StreamingResponse, FileResponse

import logging
import idaes.logger as idaeslog

from app.internal.pareto_stategic_model import handle_run_strategic_model
from app.internal.pareto_operational_model import handle_run_operational_model
from app.internal.scenario_handler import (
    scenario_handler,
)
from app.internal.KMZParser import ParseKMZ, WriteDataToExcel

# _log = idaeslog.getLogger(__name__)
_log = logging.getLogger(__name__)

router = APIRouter(
    prefix="",
    tags=["scenarios"],
    responses={404: {"description": "Scenario not found"}},
)

@router.get("/get_project_name")
async def get_scenario_list():
    """
    Get project name.
    """
    return "pareto"

@router.get("/get_scenario_list")
async def get_scenario_list():
    """
    Get basic information about all saved scenarios.
    """
    scenarios = scenario_handler.get_list()
    return {'data' : scenarios}

@router.post("/update")
async def update(request: Request):
    """Update a given scenario.

    Args:
        request.json()['updatedScenario']: Scenario to be updated

    Returns:
        Updated scenario
    """
    data = await request.json()
    updated_scenario = data['updatedScenario']
    scenario_handler.update_scenario(updated_scenario)

    return {"data": updated_scenario}

@router.post("/upload/{scenario_name}/{model_type}")
async def upload(scenario_name: str, model_type: str, file: UploadFile = File(...)):
    """Upload an excel sheet or KMZ map file and create corresponding scenario.

    Args:
        file: excel sheet to be uploaded

    Returns:
        New scenario data
    """
    new_id = scenario_handler.get_next_id()
    file_extension = file.filename.split('.')[-1].lower()
    # check if file is excel or KMZ
    if file_extension == 'kmz' or file_extension == 'kml':
        kmz_path = f"{scenario_handler.excelsheets_path}/{new_id}.{file_extension}"
        excel_path = f"{scenario_handler.excelsheets_path}/{new_id}"
        try: # get file contents
            async with aiofiles.open(kmz_path, 'wb') as out_file:
                content = await file.read()  # async read
                await out_file.write(content) 
            kmz_data = ParseKMZ(kmz_path)
            _log.info(f'got kmz_data')
            # template_location = f'{os.path.dirname(os.path.abspath(__file__))}/../internal/assets/pareto_input_template.xlsx'
            WriteDataToExcel(kmz_data, excel_path)
            _log.info('finished writing data to excel')
            return scenario_handler.upload_excelsheet(output_path=f'{excel_path}.xlsx', scenarioName=scenario_name, filename=file.filename, kmz_data=kmz_data, model_type=model_type)
        except Exception as e:
            _log.error(f"error on file upload: {str(e)}")
            raise HTTPException(400, detail=f"File upload failed: {e}")
        
    elif file_extension == 'xlsx':
        output_path = f"{scenario_handler.excelsheets_path}/{new_id}.xlsx"
        try: # get file contents
            async with aiofiles.open(output_path, 'wb') as out_file:
                content = await file.read()  # async read
                await out_file.write(content) 
            return scenario_handler.upload_excelsheet(output_path=output_path, scenarioName=scenario_name, filename=file.filename, model_type=model_type)

        except Exception as e:
            _log.error(f"error on file upload: {str(e)}")
            raise HTTPException(400, detail=f"File upload failed: {e}")
        
@router.post("/replace/{scenario_id}")
async def replace_excel(scenario_id: int, file: UploadFile = File(...)):
    """Upload an excel sheet or KMZ map file and create corresponding scenario.

    Args:
        file: excel sheet to be uploaded

    Returns:
        New scenario data
    """
        
    output_path = f"{scenario_handler.excelsheets_path}/{scenario_id}.xlsx"
    try: # get file contents
        async with aiofiles.open(output_path, 'wb') as out_file:
            content = await file.read()  # async read
            await out_file.write(content) 
        return scenario_handler.replace_excelsheet(output_path=output_path, id=scenario_id)

    except Exception as e:
        _log.error(f"error on file upload: {str(e)}")
        raise HTTPException(400, detail=f"File upload failed: {e}")

@router.post("/delete_scenario")
async def delete_scenario(request: Request):
    """Delete a given scenario.

    Args:
        request.json()['id']: id of scenario to be deleted

    Returns:
        List of remaining scenarios
    """
    data = await request.json()
    
    scenario_handler.delete_scenario(data['id'])

    return {'data' : scenario_handler.get_list()}
    
@router.post("/run_model")
async def run_model(request: Request, background_tasks: BackgroundTasks):
    """Runs strategic model for given scenario.
        The optimization of the model is added as a background task
        and run asynchronously.

    Args:
        request.json()['scenario']: scenario to be optimized

    Returns:
        Given scenario with updated status
    """
    data = await request.json()
    _log.info(f"running model on : \n{data['scenario']['id']}")
    try:
        excel_path = "{}/{}.xlsx".format(scenario_handler.excelsheets_path,data['scenario']['id'])
        output_path = "{}/{}.xlsx".format(scenario_handler.outputs_path,data['scenario']['id'])
        optimizationSettings = data['scenario']['optimization']
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

        _log.info(f"modelParameters: {modelParameters}")

        
        try:
            overrideValues = data['scenario']['override_values']
        except:
            _log.error(f'unable to find override values')
            overrideValues = {}

        model_type = data['scenario'].get("model_type", "strategic")
        if model_type == "strategic":
            print("RUNNING STRATEGIC MODEL BOII")
            background_tasks.add_task(
                handle_run_strategic_model, 
                input_file=excel_path,
                output_file=output_path,
                id=data['scenario']['id'],
                modelParameters=modelParameters,
                overrideValues=overrideValues
            )
        elif model_type == "operational":
            print("RUNNING OPERATIONAL MODEL BOII")
            background_tasks.add_task(
                handle_run_operational_model, 
                input_file=excel_path,
                output_file=output_path,
                id=data['scenario']['id'],
                modelParameters=modelParameters,
                # overrideValues=overrideValues
            )

        
        # add id to scenario handler task list to keep track of running tasks
        scenario_handler.add_background_task(data['scenario']['id'])
        scenario = data['scenario']
        results = {"data": {}, "status": "Initializing"}
        scenario["results"] = results
        scenario_handler.update_scenario(scenario)
    except Exception as e:
        _log.error(f"unable to find and run given excel sheet id{data['scenario']['id']}: {e}")
        raise HTTPException(
            500, f"unable to find and run given excel sheet id: {data['scenario']['id']}: {e}"
        )
    return scenario

@router.get("/check_tasks")
async def check_tasks():
    """Get list of currently running background tasks

    Returns:
        List of scenario ids that are currently being optimized. 
    """
    return {'tasks' : scenario_handler.get_background_tasks()}

@router.get("/copy/{scenario_id}/{new_scenario_name}")
async def copy(scenario_id: int, new_scenario_name: str):
    """Create a copy of scenario for given scenario id

    Args:
        scenario_id: scenario id for given completions demand plot

    Returns:
        Newly created scenario. 
    """
    scenarios, new_id = scenario_handler.copy_scenario(scenario_id, new_scenario_name)
    return {"scenarios": scenarios, "new_id": new_id}

@router.post("/update_excel")
async def update_excel(request: Request):
    """Update excel sheet for given scenario and accompanying table.

    Args:
        request.json()['id']: scenario id to be updated
        request.json()['tableKey']: key for table to be updated inside scenario
        request.json()['updatedTable']: dictionary containing updated values

    Returns:
        Given scenario with updated status
    """
    data = await request.json()
    try:
        return scenario_handler.update_excel(data['id'], data['tableKey'], data['updatedTable'])
        
    except Exception as e:
        _log.error(f"unable to find and run given excel sheet id{data['id']}: {e}")
        raise HTTPException(
            500, f"unable to find and run given excel sheet id: {data['id']}: {e}"
        )
    
@router.get("/get_diagram/{diagram_type}/{id}")
async def get_diagram(diagram_type: str, id: int):
    """Fetch network diagram

    Args:
        id: scenario id
        diagram_type: input or output

    Returns:
        Network diagram
    """
    data = scenario_handler.get_diagram(diagram_type, id)
    return {"data":data}
    # return StreamingResponse(io.BytesIO(data), media_type=f"image/{diagramFileType}")

@router.get("/get_template/{id}")
async def get_template(id: int):
    """Fetch excel template

    Args:
        id: scenario id

    Returns:
        Path to excel template
    """
    path = scenario_handler.get_excelsheet_path(id)
    return FileResponse(path)

@router.post("/upload_diagram/{diagram_type}/{id}")
async def upload_diagram(diagram_type: str, id: int, file: UploadFile = File(...)):
    """Upload a network diagram.

    Args:
        file: diagram to be uploaded

    Returns:
        New scenario data
    """
    diagram_extension = file.filename.split('.')[-1]
    if diagram_type == "input":
        output_path = f"{scenario_handler.input_diagrams_path}/{id}.{diagram_extension}"
    elif diagram_type == "output":
        output_path = f"{scenario_handler.output_diagrams_path}/{id}.{diagram_extension}"
    try:
    # get file contents
        async with aiofiles.open(output_path, 'wb') as out_file:
            content = await file.read()  # async read
            await out_file.write(content) 
        return scenario_handler.upload_diagram(output_path=output_path, id=id, diagram_type=diagram_type)

    except Exception as e:
        _log.error(f"error on file upload: {str(e)}")
        raise HTTPException(400, detail=f"File upload failed: {e}")

@router.get("/delete_diagram/{diagram_type}/{id}")
async def delete_diagram(diagram_type: str, id: int):
    """Delete network diagram

    Args:
        id: scenario id

    Returns:
        Scenario
    """
    data = scenario_handler.delete_diagram(diagram_type, id)
    return {"data":data}

@router.get("/get_excel_file/{filename}")
async def delete_diagram(filename: str):
    """Fetch excel input file

    Args:
        filename: name of excel file

    Returns:
        Excel file
    """
    assets_path = scenario_handler.get_assets_dir()
    excel_path = assets_path / filename
    return FileResponse(excel_path)
