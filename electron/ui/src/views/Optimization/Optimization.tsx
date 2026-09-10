import React from 'react';
import { useState } from 'react';
import { Box, Grid, InputAdornment, Checkbox, FormControlLabel, FormControl, Button } from '@mui/material';
import { MenuItem, Select, IconButton, Tooltip, Collapse, OutlinedInput, Radio, RadioGroup } from '@mui/material';
import type { OptimizationProps } from '../../types';
import type { SelectChangeEvent } from '@mui/material/Select';
import InfoIcon from '@mui/icons-material/Info';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { descriptions } from './Descriptions';
import { advancedOptions } from './AdvancedOptions';


export default function Optimization(props: OptimizationProps) {
  // const [ disabled, setDisabled ] = useState(false)
  const [ showAdvancedOptions, setShowAdvancedOptions ] = useState<boolean>(false)
  const columnWidths = [5,7]
  const defaultRuntimes = {"cbc": 900, "gurobi": 180}
  const defaultScaleModel = {"cbc": true, "gurobi": false}
  const defaults = {
    scale_model: true,
    pipeline_capacity: "input",
    pipeline_cost: "capacity_based",
    node_capacity: true,
    infrastructure_timing: "false",
    subsurface_risk: "false",
    removal_efficiency_method: "concentration_based",
    desalination_model: "false"
  }
  const styles = {
    objectiveSelection: 
      {
        m:3, 
        padding:2, 
        boxShadow:3, 
        border:"solid 2px #a0c6d6", 
        borderRadius: "6px"
      },
      optimizationSettings: 
      {
        m:3, 
        boxShadow:3,
        maxHeight: "74vh",
        overflow: "scroll"
      },
      gridContainer: {
        marginBottom: "100px",
      }, 
      gridItems: {
        marginTop: "5px"
      },
      advancedOptions: {
        color: "#0083b5",
      },
      filled: {
        backgroundColor: '#01678f',
        '&:hover': {
            backgroundColor: '#01678f',
            opacity: 0.9
        },
      },
      settingName: {
        display: 'flex', justifyContent: 'flex-start', marginLeft:'40px'
      },
      settingDropdown: {
        m: 1, width: "25ch"
      }
  }


   const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | SelectChangeEvent<any>) => {
     const name = (event.target as any).name as string
     const value = (event.target as any).value
     if ( (name === "runtime" || name === "optimalityGap") && Number.isNaN(Number(value)) ) {
      console.log('tried entering nonnumerical characters for runtime or optimality gap')
     }
     /*
      update runtime and scalemodel settings when changing solver
     */
     else if (name === "solver"){
      if(value === "cbc") {
        const tempScenario = {...props.scenario, optimization: {...props.scenario.optimization}}
        tempScenario.optimization[name] = value
        tempScenario.optimization.runtime = defaultRuntimes["cbc"]
        tempScenario.optimization.scale_model = defaultScaleModel["cbc"]
        props.updateScenario(tempScenario)
      } else if (value === "gurobi_direct") {
        const tempScenario = {...props.scenario, optimization: {...props.scenario.optimization}}
        tempScenario.optimization[name] = value
        tempScenario.optimization.runtime = defaultRuntimes["gurobi"]
        tempScenario.optimization.scale_model = defaultScaleModel["gurobi"]
        props.updateScenario(tempScenario)
      }
     }
     else {
      const tempScenario = {...props.scenario, optimization: {...props.scenario.optimization}}
      // coerce numeric fields to numbers
      if (name === 'runtime' || name === 'optimalityGap') {
        tempScenario.optimization[name] = Number(value);
      } else {
        tempScenario.optimization[name] = value
      }
      props.updateScenario(tempScenario)
     }
   }

  return ( 
    <Grid container spacing={2} style={styles.gridContainer}>
      <Grid item xs={2.5}>

      </Grid>

      <Grid item xs={7}>
      <Box style={{backgroundColor:'white'}} sx={styles.optimizationSettings}>
        <Grid container>
          <Grid item xs={12} style={{backgroundColor:'#6094bc', color:"white", fontWeight:"bold"}} >
          <Box sx={{display: 'flex', justifyContent: 'flex-start', marginLeft:'50px'}}>
            <p>OPTIMIZATION SETTINGS</p>
          </Box>
          </Grid>
          <Grid item xs={columnWidths[0]} style={styles.gridItems}>
            <Box sx={styles.settingName}>
              <p>
                Objective Selection
                <Tooltip title={descriptions.objective} placement="right-start"><IconButton><InfoIcon fontSize='small'/></IconButton></Tooltip>
                </p>
            </Box>
          </Grid>
          <Grid item xs={columnWidths[1]} style={styles.gridItems}>
          <FormControl sx={styles.settingDropdown} size="small" disabled={props.disabled}>
            <Select
              name="objective"
              value={props.scenario.optimization.objective}
              onChange={handleChange}
              sx={{color:'#0b89b9', fontWeight: "bold"}}
            >
              <MenuItem value={"cost"}>Minimize Cost</MenuItem>
              <MenuItem value={"reuse"}>Maximize Reuse</MenuItem>
              {props.scenario.optimization.desalination_model && <MenuItem value={"cost_surrogate"}>Minimize Cost Surrogate</MenuItem>}
              <MenuItem value={"subsurface_risk"}>Minimize Subsurface Risk</MenuItem>
              <MenuItem value={"environmental"}>Minimize Emissions</MenuItem>
            </Select>
            </FormControl>
          </Grid>

          <Grid item xs={columnWidths[0]} style={styles.gridItems}>
            <Box sx={styles.settingName}>
              <p>Solver
              <Tooltip title={descriptions.solver} placement="right-start"><IconButton><InfoIcon fontSize='small'/></IconButton></Tooltip>
              </p>
            </Box>
          </Grid>
          <Grid item xs={columnWidths[1]} style={styles.gridItems}>
          <FormControl sx={styles.settingDropdown} size="small" disabled={props.disabled}>
            <Select
              name="solver"
              value={props.scenario.optimization.solver}
              onChange={handleChange}
              sx={{color:'#0b89b9', fontWeight: "bold"}}
            >
              <MenuItem value={"cbc"}>CBC (Free)</MenuItem>
              <MenuItem value={"gurobi_direct"}>Gurobi (Commercial)</MenuItem>
            </Select>
            </FormControl>
          </Grid>

          <Grid item xs={columnWidths[0]} style={styles.gridItems}>
            <Box sx={styles.settingName}>
              <p>Maximum Runtime
              <Tooltip title={descriptions.runtime} placement="right-start"><IconButton><InfoIcon fontSize='small'/></IconButton></Tooltip>
              </p>
            </Box>
          </Grid>
          <Grid item xs={columnWidths[1]} style={styles.gridItems}>
          <FormControl sx={{ m: 1, width: '25ch' }} variant="outlined" size="small" disabled={props.disabled}>
            <OutlinedInput
              name="runtime"  
              id="outlined-adornment-sec"
              value={props.scenario.optimization.runtime}
              onChange={handleChange}
              endAdornment={<InputAdornment position="end">sec</InputAdornment>}
              aria-describedby="outlined-weight-helper-text"
              inputProps={{
                'aria-label': 'sec',
              }}
            />
          </FormControl>
          </Grid>

          <Grid item xs={columnWidths[0]} style={styles.gridItems}>
            <Box sx={styles.settingName}>
              <p>Optimality Gap
              <Tooltip title={descriptions.optimalityGap} placement="right-start"><IconButton><InfoIcon fontSize='small'/></IconButton></Tooltip>
              </p>
            </Box>
          </Grid>
          <Grid item xs={columnWidths[1]} style={styles.gridItems}>
          <FormControl sx={{ m: 1, width: '25ch' }} variant="outlined" size="small" disabled={props.disabled}>
            <OutlinedInput
              name="optimalityGap"
              id="outlined-adornment-sec"
              value={props.scenario.optimization.optimalityGap}
              onChange={handleChange}
              endAdornment={<InputAdornment position="end">%</InputAdornment>}
              aria-describedby="outlined-weight-helper-text"
              inputProps={{
                'aria-label': 'sec',
              }}
            />
          </FormControl>
          </Grid>

          <Grid item xs={columnWidths[0]} style={styles.gridItems}>
            <Box sx={styles.settingName}>
              <p>Water Quality
              <Tooltip title={descriptions.waterQuality} placement="right-start"><IconButton><InfoIcon fontSize='small'/></IconButton></Tooltip>
              </p>
            </Box>
          </Grid>
          <Grid item xs={columnWidths[1]} style={styles.gridItems}>
          <FormControl sx={styles.settingDropdown} size="small" disabled={props.disabled}>
            <Select
              name="waterQuality"
              value={props.scenario.optimization.waterQuality}
              onChange={handleChange}
              sx={{color:'#0b89b9', fontWeight: "bold"}}
            >
              <MenuItem value={"false"}>False</MenuItem>
              <MenuItem value={"post_process"}>Post Process</MenuItem>
              <MenuItem value={"discrete"}>Discrete</MenuItem>
            </Select>
            </FormControl>
          </Grid>

          <Grid item xs={columnWidths[0]} style={styles.gridItems}>
            <Box sx={styles.settingName}>
              <p>Hydraulics
              <Tooltip title={descriptions.hydraulics} placement="right-start"><IconButton><InfoIcon fontSize='small'/></IconButton></Tooltip>
              </p>
            </Box>
          </Grid>
          <Grid item xs={columnWidths[1]} style={styles.gridItems}>
          <FormControl sx={styles.settingDropdown} size="small" disabled={props.disabled}>
            <Select
              name="hydraulics"
              value={props.scenario.optimization.hydraulics}
              onChange={handleChange}
              sx={{color:'#0b89b9', fontWeight: "bold"}}
            >
              <MenuItem value={"false"}>False</MenuItem>
              <MenuItem value={"post_process"}>Post Process</MenuItem>
              <MenuItem value={"co_optimize"}>Co-Optimize</MenuItem>
              <MenuItem value={"co_optimize_linearized"}>Co-Optimize Linearized</MenuItem>
            </Select>
            </FormControl>
          </Grid>

          <Grid item xs={columnWidths[0]} style={styles.gridItems}>
            <Box sx={styles.settingName}>
              <p style={styles.advancedOptions}>
                Advanced User Options 
                <IconButton onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}>{showAdvancedOptions ? <ExpandLess /> : <ExpandMore />}</IconButton>
              </p>
            </Box>
          </Grid>
          <Grid item xs={columnWidths[1]} style={styles.gridItems}>
          </Grid>
          <Grid item xs={columnWidths[0]} style={styles.gridItems}>
          <Collapse in={showAdvancedOptions} timeout="auto" unmountOnExit>
            {
              Object.entries(advancedOptions).map(([ key, data ]) => (
                <Box key={key} sx={styles.settingName}>
                  <p>{data.displayName}</p>
                  <Tooltip title={descriptions[key]} placement="right-start"><IconButton><InfoIcon fontSize='small'/></IconButton></Tooltip>
                </Box>
              ))
            }
            </Collapse>
          </Grid>
          <Grid item xs={columnWidths[1]} style={styles.gridItems}>
          <Collapse in={showAdvancedOptions} timeout="auto" unmountOnExit>
            {
              Object.entries(advancedOptions).map(([ key, data ]) => (
                <Box key={key}>
                <FormControl sx={styles.settingDropdown} size="small" disabled={props.disabled}>
                  <Select
                    name={key}
                    value={[null, undefined].includes(props.scenario.optimization[key]) ? data.defaultValue : props.scenario.optimization[key]}
                    onChange={handleChange}
                    sx={{color:'#0b89b9', fontWeight: "bold"}}
                  >
                    {Object.entries(data.options).map(([displayText, optionValue]) => (
                      <MenuItem key={optionValue} value={optionValue}>{displayText}</MenuItem>
                    ))}
                  </Select>
                  </FormControl>
                </Box>
              ))
            }
          </Collapse>
          </Grid>
        </Grid>
        <Grid item xs={12} style={styles.gridItems}>
            <Box sx={{display: 'flex', justifyContent: 'flex-end', marginRight:'40px', paddingTop: '25px',paddingBottom: '25px'}}>
            <Button 
              onClick={props.handleRunModel} 
              sx={styles.filled} 
              variant="contained" 
              size="large" 
              disabled={props.backgroundTasks.length > 0 || props.disabled || props.saving}
              endIcon={<ArrowForwardIcon />}> 
              Optimize 
            </Button>
            </Box>
        </Grid>

      </Box>
      </Grid>
      
      <Grid item xs={2.5}>
      </Grid>
    </Grid>
  );

}
