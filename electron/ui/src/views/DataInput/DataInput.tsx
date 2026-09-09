import './DataInput.css';
import React from 'react';
import {useEffect, useState} from 'react';
import type { DataInputProps, Scenario } from '../../types';
import type { SelectChangeEvent } from '@mui/material/Select';
import { Grid, Box, FormControl, MenuItem, Select, Button, Typography } from '@mui/material';
import CustomChart from '../../components/CustomChart/CustomChart'
import FilterDropdown from '../../components/FilterDropdown/FilterDropdown';
import ErrorBar from '../../components/ErrorBar/ErrorBar'
import InputSummary from '../../components/InputSummary/InputSummary'
import NetworkDiagram from '../../components/NetworkDiagram/NetworkDiagram';
import DataTable from '../../components/DataTable/DataTable';
import {useScenario} from '../../context/ScenarioContext';
import ForecastFill from '../../components/ScenarioCompletion/ForecastFill';

export default function DataInput(props: DataInputProps) {
  const {inputFocus, isSaving} = useScenario();
  const { 
    updateScenario,
    category,
    handleSetCategory,
    syncScenarioData,
    handleUpdateExcel,
    handleEditInput,
    edited,
    scenario: incomingScenario,
  } = props;
  const [ scenario, setScenario] = useState<Scenario>({...incomingScenario})
  const [ editDict, setEditDict ] = useState<Record<string, boolean>>({})
  const [ columnNodesMapping, setColumnNodesMapping ] = useState<string[]>([]) // the column mapping; set once and remains the same
  const [ columnNodes, setColumnNodes ] = useState<Record<string, boolean>>({}) // dictionary with true false values for each column
  const [ filteredColumnNodes, setFilteredColumnNodes ] = useState<string[]>([]) // list of active columns
  const [ columnFilterSet, setColumnFilterSet ] = useState<Record<string, {amt:number,checked:boolean}>>({}) // dictionary containing all unique columns and the corresponding amount of each column
  const [ rowNodesMapping, setRowNodesMapping ] = useState<string[]>([]) 
  const [ rowNodes, setRowNodes ] = useState<Record<string, boolean>>({})
  const [ filteredRowNodes, setFilteredRowNodes ] = useState<string[]>([])
  const [ rowFilterSet, setRowFilterSet ] = useState<Record<string, {amt:number,checked:boolean}>>({})
  const [ plotCategory, setPlotCategory ] = useState<string>("CompletionsDemand")
  const [ showError, setShowError ] = useState<boolean>(false)
  const isAllColumnsSelected = columnNodesMapping.length > 0 && filteredColumnNodes.length === columnNodesMapping.length;
  const isAllRowsSelected = rowNodesMapping.length > 0 && filteredRowNodes.length === rowNodesMapping.length;
  const plotCategoryDictionary  = {
    "CompletionsDemand": "CompletionsPads",
    "PadRates": "ProductionPads",
    "FlowbackRates": "CompletionsPads"
  }
  var keyIndexMapping = {}

  useEffect(()=>{
    /*
      when category is changed, reset the nodes for filtering (columns and rows of current table)
    */
    try {
      if (category !== "Plots" && category !== "Network Diagram" && category !== "Input Summary") {
        let tempEditDict = {}
        let tempColumnNodes = {}
        let tempColumnNodesMapping = []
        let tempRowNodes = {}
        let tempRowNodesMapping = []
        let tempColumnFilterSet = {}
        let tempRowFilterSet =  {}


        // determine unique row and column keys for row and column filter sets
        let grabbedRowList = false
        for(let colKey of Object.keys(scenario.data_input.df_parameters[category])) {

          // first key:value pair contains all the row names
          if (!grabbedRowList) {
            let tempRowList = scenario.data_input.df_parameters[category][colKey]
            for (let rowKey of tempRowList) {
              if(Object.keys(tempRowFilterSet).includes(`${rowKey}`)) tempRowFilterSet[rowKey].amt = tempRowFilterSet[rowKey].amt + 1
              else tempRowFilterSet[rowKey] = {amt: 1, checked: true}
            }
            grabbedRowList = true
          }
          if(Object.keys(tempColumnFilterSet).includes(colKey)) tempColumnFilterSet[colKey].amt = tempColumnFilterSet[colKey].amt + 1
          else tempColumnFilterSet[colKey] = {amt: 1, checked: true}
        }
        
        // determing mappings between index/values and rows+columns
        Object.entries(scenario.data_input.df_parameters[category]).map( ([key, value], ind) => {
          if (ind === 0) {
            // tempRowNodesMapping = value
            value.map ((v,i) => {
              tempRowNodesMapping.push(`${i}::${v}`)
              tempRowNodes[`${i}::${v}`] = true
              return 1
            })
          } else {
            tempColumnNodesMapping.push(`${ind}::${key}`)
            tempColumnNodes[`${ind}::${key}`] = true
          }
          scenario.data_input.df_parameters[category][key].map( (value, index) => {
            tempEditDict[`${ind}:${index}`] = false
            return 1
          })
          return 1
        })
        setEditDict(tempEditDict)
        setColumnNodes(tempColumnNodes)
        setRowNodes(tempRowNodes)
        setFilteredColumnNodes(tempColumnNodesMapping)
        setFilteredRowNodes(tempRowNodesMapping)
        setColumnNodesMapping(tempColumnNodesMapping)
        setRowNodesMapping(tempRowNodesMapping) 
        setRowFilterSet(tempRowFilterSet)
        setColumnFilterSet(tempColumnFilterSet)
      }
    } catch (e) {
      console.error('unable to set edit dictionary: ',e)
    }
    setScenario({...incomingScenario})
    
  }, [category, props.scenario, scenario.data_input.df_parameters]);

  
  const handlePlotCategoryChange = (event: SelectChangeEvent<string>) =>{
   setPlotCategory(event.target.value as string)
  }

  const handleSaveChanges = async () => {
    //api call to save changes on backend
    const saved = await handleUpdateExcel(scenario.id, category, scenario.data_input.df_parameters[category]);
    if (saved === false) return;
    handleEditInput(false)
    let tempEditDict = {}
    Object.entries(scenario.data_input.df_parameters[category]).map( ([key, value], ind) => {
      scenario.data_input.df_parameters[category][key].map( (value, index) => {
        tempEditDict[`${ind}:${index}`] = false
        return 1
      })
      return 1
    })
    setEditDict(tempEditDict)
   }

   const handleColumnFilter = (col) => {
    var tempCols
    let tempColumnNodes = {...columnNodes}
    let tempColumnFilterSet = {...columnFilterSet}
    if (col === 'all') {
      tempCols = filteredColumnNodes.length === columnNodesMapping.length ? [] : columnNodesMapping
      if (filteredColumnNodes.length === columnNodesMapping.length) {
        for (const key of Object.keys(tempColumnNodes)) {
          tempColumnNodes[key] = false
        }
      } else {
        for (const key of Object.keys(tempColumnNodes)) {
          tempColumnNodes[key] = true
        }
      }

      setColumnNodes(tempColumnNodes)
      setFilteredColumnNodes(tempCols);

      // handle column filter set
      let allChecked = true
      for (let key of Object.keys(tempColumnFilterSet)) {
        if(!tempColumnFilterSet[key].checked) allChecked = false
      }
      if (allChecked) {
        for (let key of Object.keys(tempColumnFilterSet)) {
          tempColumnFilterSet[key].checked = false
        }
      } else {
        for (let key of Object.keys(tempColumnFilterSet)) {
          tempColumnFilterSet[key].checked = true
        }
      }
      setColumnFilterSet(tempColumnFilterSet)

    }
    else {
      tempCols = [...filteredColumnNodes]
      const index = tempCols.indexOf(col);
      if (index > -1) {
        tempCols.splice(index, 1); // 2nd parameter means remove one item only
      } else{
        tempCols.push(col)
      }

      // handle column filter set
      for (let key of Object.keys(tempColumnNodes)) {
        if(key.includes(col)) {
          tempColumnNodes[key] = !tempColumnNodes[key]
        }
      }
      tempColumnFilterSet[col].checked = !tempColumnFilterSet[col].checked
      setColumnFilterSet(tempColumnFilterSet)

      tempColumnNodes[col] = !tempColumnNodes[col]
      setColumnNodes(tempColumnNodes)
      setFilteredColumnNodes(tempCols)
    }
}

const handleRowFilter = (row) => {
    var tempRows
    let tempRowNodes = {...rowNodes}
    let tempRowFilterSet = {...rowFilterSet}
    if (row === 'all') {
      tempRows = filteredRowNodes.length === rowNodesMapping.length ? [] : rowNodesMapping
      if (filteredRowNodes.length === rowNodesMapping.length) {
        for (const key of Object.keys(tempRowNodes)) {
          tempRowNodes[key] = false
        }
      } else {
        for (const key of Object.keys(tempRowNodes)) {
          tempRowNodes[key] = true
        }
      }
      setRowNodes(tempRowNodes)
      setFilteredRowNodes(tempRows);

      // handle row filter set 
      let allChecked = true
      for (let key of Object.keys(tempRowFilterSet)) {
        if(!tempRowFilterSet[key].checked) allChecked = false
      }
      if (allChecked) {
        for (let key of Object.keys(tempRowFilterSet)) {
          tempRowFilterSet[key].checked = false
        }
      } else {
        for (let key of Object.keys(tempRowFilterSet)) {
          tempRowFilterSet[key].checked = true
        }
      }
      setRowFilterSet(tempRowFilterSet)
    }
    else {
      tempRows = [...filteredRowNodes]
        const index = tempRows.indexOf(row);
        if (index > -1) {
          tempRows.splice(index, 1);
        } else{
          tempRows.push(row)
        }

        // handle row filter set
        for (let key of Object.keys(tempRowNodes)) {
          if(key.includes(row)) {
            tempRowNodes[key] = !tempRowNodes[key]
          }
        }
        tempRowFilterSet[row].checked = !tempRowFilterSet[row].checked
        setRowFilterSet(tempRowFilterSet)

        tempRowNodes[row] = !tempRowNodes[row]
        setRowNodes(tempRowNodes)
        setFilteredRowNodes(tempRows)
    }
}

  const renderInputCategory = () => {
    try {
      /*
        if category is plots, return input plots
      */
      if(category === "Plots") {
          return (
            <Box style={{backgroundColor:'white'}} sx={{m:3, padding:2, boxShadow:3}}>
              <Box display="flex" justifyContent="center" sx={{marginBottom:"20px"}}>
                <FormControl sx={{ width: "30ch" }} size="small">
                    <Select
                    value={plotCategory}
                    onChange={handlePlotCategoryChange}
                    sx={{color:'#0b89b9', fontWeight: "bold"}}
                    >
                    <MenuItem key={0} value={"CompletionsDemand"}>Completion Pad Demand</MenuItem>
                    <MenuItem key={1} value={"PadRates"}>Production Forecast</MenuItem>
                    <MenuItem key={2} value={"FlowbackRates"}>Flowback Forecast</MenuItem>
                    </Select>
                </FormControl>
            </Box>
                <CustomChart
                  input
                  category={plotCategoryDictionary[plotCategory]}
                  data={scenario.data_input.df_parameters[plotCategory]} 
                  title={plotCategory}
                  xaxis={{titletext: "Planning Horizon (weeks)"}}
                  yaxis={{titletext: "Amount of Water (bbl/week)"}}
                  width={750}
                  height={500}
                  showlegend={true}
                  chartType={'area'}
                  stackgroup={"one"}
                />
            </Box>
            )
      }
      /*
        if category is network diagram, return demo image
      */
        else if(category === "Network Diagram"){
          return (
            <Box style={{backgroundColor:'white'}} sx={{m:3, padding:2, boxShadow:3, overflow: "scroll"}}>
              <NetworkDiagram 
                scenario={props.scenario}
                type={"input"}
                syncScenarioData={syncScenarioData}
                {...props}
              />
            </Box>
          )
        }
      /*
        if category is input summary, return input summary tables
      */
        else if(category === "Input Summary"){
          return (
            <Box style={{backgroundColor:'white'}} sx={{m:3, padding:2, boxShadow:3, overflow: "scroll"}}>
              <InputSummary 
                completionsDemand={scenario.data_input.df_parameters['CompletionsDemand']}
                padRates={scenario.data_input.df_parameters['PadRates']}
                flowbackRates={scenario.data_input.df_parameters['FlowbackRates']}
                initialDisposalCapacity={scenario.data_input.df_parameters['InitialDisposalCapacity']}
                initialTreatmentCapacity={scenario.data_input.df_parameters['InitialTreatmentCapacity']}
                scenario={scenario}
                handleSetCategory={handleSetCategory} 
                updateScenario={updateScenario}
              />
            </Box>
          )
        }
      /*
        else, return table for input category dictionary
      */
      else {
        return (
          <Box style={{backgroundColor:'white'}} sx={{m:3, padding:2, boxShadow:3}}>
        {['PadRates', 'CompletionsDemand', 'FlowbackRates', 'ExtWaterSourcingAvailability', 'ReuseMinimum', 'ReuseCapacity', 'DisposalOperatingCapacity'].includes(category) &&
          <ForecastFill key={`${category}-${scenario.input_revision}`} name={category} table={scenario.data_input.df_parameters[category]}
            periods={scenario.data_input.df_sets.TimePeriods || []} unit={category === 'DisposalOperatingCapacity' ? 'fraction, 0–1' : scenario.data_input.display_units[category] || 'bbl/day'}
            disabled={edited || isSaving} onSave={async table => (await handleUpdateExcel(scenario.id, category, table)) !== false} />}
        <Grid container>
          <Grid item xs={0.5}>
            <Box sx={{display: 'flex', justifyContent: 'flex-start', marginLeft:'10px'}}>
              {edited && <h3><Button style={{color:"#0884b4"}} onClick={handleSaveChanges}><Typography noWrap>Save Changes</Typography></Button></h3> }
            </Box>
          </Grid>
          <Grid item xs={11}>
            <DataTable
              key={category}
              validationFocus={inputFocus}
              section="input"
              editDict={editDict}
              setEditDict={setEditDict}
              scenario={scenario}
              setScenario={setScenario}
              columnNodesMapping={columnNodesMapping}
              columnNodes={columnNodes}
              filteredColumnNodes={filteredColumnNodes}
              rowNodesMapping={rowNodesMapping}
              rowNodes={rowNodes}
              filteredRowNodes={filteredRowNodes}
              setShowError={setShowError}
              category={category}
              handleEditInput={handleEditInput}
              data={props.scenario.data_input.df_parameters}
            />
          </Grid>
          <Grid item xs={0.5}>
            <Box sx={{display: 'flex', justifyContent: 'flex-end', marginLeft:'10px'}}>
            <FilterDropdown
                width="300px"
                maxHeight="300px"
                option1="Column"
                filtered1={filteredColumnNodes}
                total1={columnNodesMapping}
                isAllSelected1={isAllColumnsSelected}
                handleFilter1={handleColumnFilter}
                option2="Row"
                filtered2={filteredRowNodes}
                total2={rowNodesMapping}
                isAllSelected2={isAllRowsSelected}
                handleFilter2={handleRowFilter}
                rowFilterSet={rowFilterSet}
                columnFilterSet={columnFilterSet}
              />
            </Box>
          </Grid>
        </Grid>
        {
            showError && <ErrorBar duration={2000} margin setOpen={setShowError} severity="error" errorMessage="Unable to edit values while optimization is running" />
        }
        </Box>
        )
      }
      
    } catch (e) {
      console.error("unable to render input category: ",e)
    }
}
  return ( 
    renderInputCategory()
  );

}

