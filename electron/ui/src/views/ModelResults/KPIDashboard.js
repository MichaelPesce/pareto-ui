import React from 'react';
import {useEffect, useState} from 'react';
import { Box, Grid, IconButton, Tooltip } from '@mui/material';
import ChangeCircleIcon from '@mui/icons-material/ChangeCircle';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import WaterIcon from '@mui/icons-material/Water';
import Plot from 'react-plotly.js';
import CustomChart from '../../components/CustomChart/CustomChart'
import FilterDropdown from '../../components/FilterDropdown/WaterQualityFilterDropdown';

export default function KPIDashboard(props) {
    const [ kpiData, setKpiData ] = useState(null)
    const [ filteredNodes, setFilteredNodes ] = useState({})
    const [ totalSet, setTotalSet ] = useState([])
    const [ filterSet, setFilterSet ] = useState([])
    const [ waterQualityData, setWaterQualityData ] = useState([])
    const isAllNodesSelected = totalSet.length > 0 && totalSet.length === filterSet.length;

    useEffect(()=>{
        try {
            // set data for water quality drop down filters
            let tempWaterQualityData = [props.waterQualityData[0]]
            for (var index = 1; index < props.waterQualityData.length; index++) {
                let item = props.waterQualityData[index]
                let nodeType = item[1]
                if (filterSet.includes(nodeType)) tempWaterQualityData.push(item)
            }
            setWaterQualityData(tempWaterQualityData)
        } catch (e) {
            console.log("error setting water quality data")
            console.log(e)
        }

    }, [filterSet]);

    useEffect(()=>{
        try {
            let tempNodes = new Set()
            let tempRowFilteredNodes = {}
            
            for (var index = 1; index < props.waterQualityData.length; index++) {
                let item = props.waterQualityData[index]
                let nodeType = item[1]
                tempNodes.add(nodeType)
                tempRowFilteredNodes[nodeType] = true
            }
            tempNodes = Array.from(tempNodes)
            setTotalSet(tempNodes)
            setFilterSet(tempNodes)
            setFilteredNodes(tempRowFilteredNodes)
        } catch(e) {
            console.log("error setting filtered nodes: ")
            console.log(e)
        }
        

    }, [props.waterQualityData]);

    useEffect(()=>{
        try {
            let tempData = {}
            // organize results dict data
            for (var index in props.overviewData) {
                let item = props.overviewData[index]
                let key = item[0]
                let description = item[1]
                let unit = item[2]
                let value = item[3]
                tempData[key] = {"description": description, "unit": unit, "value": value}
            }
            setKpiData(tempData)
        } catch(e) {
            console.log("error setting kpi data:")
            console.log(e)
        }

    }, [props]);

    const styles = {
          kpiBox: 
          {
            paddingTop:2, 
            boxShadow:3,
            height: "140px"
          },
          pieChartBox: 
          {
            paddingTop:2, 
            boxShadow:3,
          },
          areaChartBox: 
          {
            paddingTop:2, 
            boxShadow:3,
            paddingBottom: "50px" 
          },
          kpiTitle: {
            color:"#989698",
            fontSize: '25px',
            margin: "0",
            padding: "0"
          },
          kpiValue: {
            color:"black",
            fontSize: '25px',
            fontWeight:'bold',
            margin: "0",
            padding: "0"
          },
          icon: {
            backgroundColor: "#5A3E73",
            color:"#CEC7D7"
          },
          chartTitle: {
            color:"black",
            fontSize: '25px',
            margin: "0",
            padding: "0"
          }
      }

      const handleNodesFilter = (key) => {
        let tempFilteredNodes = {...filteredNodes}
        let tempFilterSet = [...filterSet]
        if(key === "all") {
            if(isAllNodesSelected) {
                tempFilterSet = []
                for (let key of Object.keys(tempFilteredNodes)) {
                    tempFilteredNodes[key] = false
                }
            } else {
                tempFilterSet = [...totalSet]
                for (let key of Object.keys(tempFilteredNodes)) {
                    tempFilteredNodes[key] = true
                }
            }
        } else {
            if(tempFilteredNodes[key]) {
                const index = tempFilterSet.indexOf(key);
                if (index > -1) {
                    tempFilterSet.splice(index, 1);
                }
            } else {
                tempFilterSet.push(key)
            }
            tempFilteredNodes[key] = !tempFilteredNodes[key]
        }
        
        setFilteredNodes(tempFilteredNodes)
        setFilterSet(tempFilterSet)

      }

  return ( 
    <Box>
    {kpiData && 
    <Grid container spacing={2} sx={{marginTop:2}}>

        <Grid item xs={4}>
        <Box style={{backgroundColor:'white'}} sx={styles.kpiBox}>
            <Grid container>
            <Grid item xs={12}>
                <Box sx={{display: 'flex', justifyContent: 'center'}}>
                <IconButton disabled><ChangeCircleIcon sx={{ color: "#947eaa" }}/></IconButton>
                <p style={styles.kpiTitle}>Recycling Rate</p>
                </Box>
            </Grid>
            <Grid item xs={12}>
                <Box sx={{display: 'flex', justifyContent: 'center'}}>
                <p style={styles.kpiValue}>{Math.round(kpiData.e_CompletionsReusedFrac?.value * 100)}%</p>
                </Box>
            </Grid>
            </Grid>
        </Box>
        </Grid>

        <Grid item xs={4}>
        <Box style={{backgroundColor:'white'}} sx={styles.kpiBox}>
            <Grid container>
            <Grid item xs={12}>
                <Box sx={{display: 'flex', justifyContent: 'center'}}>
                <IconButton disabled><RemoveCircleOutlineIcon sx={{ color: "#fc2414" }}/></IconButton>
                <p style={styles.kpiTitle}>Total Disposal</p>
                </Box>
            </Grid>
            <Grid item xs={12}>
                <Box sx={{display: 'flex', justifyContent: 'center'}}>
                <p style={styles.kpiValue}>{kpiData.v_F_TotalDisposed?.value.toLocaleString('en-US', {maximumFractionDigits:0})+" "+kpiData.v_F_TotalDisposed?.unit}</p>
                </Box>
            </Grid>
            </Grid>
        </Box>
        </Grid>

        <Grid item xs={4}>
        <Box style={{backgroundColor:'white'}} sx={styles.kpiBox}>
            <Grid container>
            <Grid item xs={12}>
                <Box sx={{display: 'flex', justifyContent: 'center'}}>
                <IconButton disabled><WaterIcon sx={{ color:"#59b8d6" }}/></IconButton>
                <p style={styles.kpiTitle}>Sourced Water</p>
                </Box>
            </Grid>
            <Grid item xs={12}>
                <Box sx={{display: 'flex', justifyContent: 'center'}}>
                <p style={styles.kpiValue}>{kpiData.v_F_TotalSourced.value.toLocaleString('en-US', {maximumFractionDigits:0})+" "+kpiData.v_F_TotalSourced.unit}</p>
                </Box>
            </Grid>
            </Grid>
        </Box>
        </Grid>

        <Grid item xs={6}>
        <Box style={{backgroundColor:'white'}} sx={styles.pieChartBox}>
            <Grid container>
            <Grid item xs={12}>
                <Box sx={{display: 'flex', justifyContent: 'center'}}>
                <p style={styles.chartTitle}>CAPEX</p>
                </Box>
            </Grid>
            <Grid item xs={12}>
                <Box sx={{display: 'flex', justifyContent: 'center', overflow: "scroll"}}>
                <Plot
                    data={[
                    {
                        type: "pie",
                        values: [
                            kpiData.v_C_StorageCapEx?.value, 
                            kpiData.v_C_TreatmentCapEx?.value, 
                            kpiData.v_C_DisposalCapEx?.value, 
                            kpiData.v_C_PipelineCapEx?.value],
                        labels: [
                            "Storage", 
                            "Treatment", 
                            "Disposal", 
                            "Pipeline"],
                        marker: {
                                colors: [
                                    'rgb(255, 127, 19)',
                                    'rgb(148, 103, 189)',
                                    'rgb(64, 159, 44)',
                                    'rgb(214, 39, 40)',
                                    // 'rgb(30, 119, 180)',
                                ]
                              },
                        textinfo: "percent",
                        // insidetextorientation: "radial"
                        }
                    ]}

                    layout={{
                        width: 450,
                        height: 450,
                        showlegend: true
                    }}
                />
                </Box>
            </Grid>
            </Grid>
        </Box>
        </Grid>

        <Grid item xs={6}>
        <Box style={{backgroundColor:'white'}} sx={styles.pieChartBox}>
            <Grid container>
            <Grid item xs={12}>
                <Box sx={{display: 'flex', justifyContent: 'center'}}>
                <p style={styles.chartTitle}>OPEX</p>
                </Box>
            </Grid>
            <Grid item xs={12}>
                <Box sx={{display: 'flex', justifyContent: 'center', overflow: "scroll"}}>
                <Plot
                    data={[
                    {
                        type: "pie",
                        values: [
                            kpiData.v_C_TotalSourced?.value >= 0 ? kpiData.v_C_TotalSourced?.value : 0, 
                            kpiData.v_C_TotalTreatment?.value >= 0 ? kpiData.v_C_TotalTreatment?.value : 0, 
                            kpiData.v_C_TotalDisposal?.value >= 0 ? kpiData.v_C_TotalDisposal?.value : 0, 
                            kpiData.v_C_TotalPiping?.value >= 0 ? kpiData.v_C_TotalPiping?.value : 0,
                            kpiData.v_C_TotalTrucking?.value >= 0 ? kpiData.v_C_TotalTrucking?.value : 0],
                        labels: [
                            "Source", 
                            "Treatment", 
                            "Disposal", 
                            "Piping",
                            "Trucking"],
                        marker: {
                            colors: [
                                'rgb(255, 127, 19)',
                                'rgb(148, 103, 189)',
                                'rgb(64, 159, 44)',
                                'rgb(214, 39, 40)',
                                'rgb(30, 119, 180)',
                            ]
                            },
                        textinfo: "percent",
                        }
                    ]}

                    layout={{
                        width: 450,
                        height: 450,
                        showlegend: true
                    }}
                />
                </Box>
            </Grid>
            </Grid>
        </Box>
        </Grid>
        
        <Grid item xs={12}>
        <Box style={{backgroundColor:'white'}} sx={styles.areaChartBox}>
            <Grid container>
            <Grid item xs={6}>
                <Box sx={{display: 'flex', justifyContent: 'center', overflow: "scroll"}}>
                <CustomChart
                    data={props.truckedData} 
                    title="Trucked Water Deliveries By Destination"
                    xaxis={{titletext: "Planning Horizon (weeks)"}}
                    yaxis={{titletext: "Amount of Water (bbl/week)"}}
                    labelIndex={1}
                    xindex={2}
                    yindex={3}
                    width={600}
                    height={500}
                    showlegend={true}
                    chartType={'area'}
                    stackgroup={"one"}
                />
                </Box>
            </Grid>
            <Grid item xs={6}>
                <Box sx={{display: 'flex', justifyContent: 'center', overflow: "scroll"}}>
                <CustomChart
                    data={props.pipedData} 
                    title="Piped Water Deliveries By Destination"
                    xaxis={{titletext: "Planning Horizon (weeks)"}}
                    yaxis={{titletext: "Amount of Water (bbl/week)"}}
                    labelIndex={1}
                    xindex={2}
                    yindex={3}
                    width={600}
                    height={500}
                    showlegend={true}
                    chartType={'area'}
                    stackgroup={"one"}
                />
                </Box>
            </Grid>
            </Grid>
        </Box>
        </Grid>

        <Grid item xs={12}>
            {props.waterQualityData && props.waterQualityData.length>1 &&
                <Box style={{backgroundColor:'white', marginBottom:"20px"}} sx={styles.areaChartBox}>
                    <Grid container>
                    <Grid item xs={1}></Grid>
                    <Grid item xs={10}>
                        <Box display="flex" justifyContent="center" sx={{overflow: "scroll"}}>
                            <CustomChart
                                data={waterQualityData} 
                                title="Water Quality by Node"
                                xaxis={{titletext: "Planning Horizon (weeks)"}}
                                yaxis={{titletext: "Amount of Water (bbl/week)"}}
                                labelIndex={0}
                                xindex={2}
                                yindex={3}
                                width={900}
                                height={500}
                                showlegend={true}
                                chartType={'line'}
                                stackgroup={false}
                                waterQuality
                                filterSet={filterSet}
                            />
                        </Box>
                    </Grid>
                    <Grid item xs={1}>
                        <Box display="flex" justifyContent="flex-end" sx={{marginRight:"10px"}}>
                            <FilterDropdown
                                width="220px"
                                maxHeight="300px"
                                filtered={filteredNodes}
                                total={totalSet}
                                isAllSelected={isAllNodesSelected}
                                handleFilter={handleNodesFilter}
                                filterSet={filterSet}
                            />
                        </Box>
                    </Grid>
                    
                    </Grid>
                </Box>
            }
        
            {props.hydraulicsData && props.hydraulicsData.length>1 &&
                <Box style={{backgroundColor:'white', marginBottom:"20px"}} sx={styles.areaChartBox}>
                    <Grid container>
                    <Grid item xs={1}></Grid>
                    <Grid item xs={10}>
                        <Box sx={{display: 'flex', justifyContent: 'center', overflow: "scroll"}}>
                        <CustomChart
                            data={props.hydraulicsData} 
                            title="Hydraulics Pressure by Node"
                            xaxis={{titletext: "Planning Horizon (weeks)"}}
                            yaxis={{titletext: "Pressure (psi)"}}
                            labelIndex={0}
                            xindex={1}
                            yindex={2}
                            width={900}
                            height={500}
                            showlegend={true}
                            chartType={'line'}
                            stackgroup={false}
                        />
                        </Box>
                    </Grid>
                    <Grid item xs={1}></Grid>
                    </Grid>
                </Box>
            }
        </Grid>

    </Grid>
    }
    
    </Box>
  );

}


