import React, { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableRow, TableContainer } from '@mui/material';
import CategoryNames from '../../assets/CategoryNames.json'

export default function ComparisonTable(props) {
    const { scenarios, scenarioIndex, secondaryScenarioIndex } = props;
    const [ indices, setIndices ] = useState([scenarioIndex, secondaryScenarioIndex])
    const [ isInput, setIsInput ] = useState(false)
    const [ inputCategory, setInputCategory ] = useState(null)
    const category = "v_F_Overview_dict"
    const styles ={
        firstCol: {
          backgroundColor: "#f4f4f4", 
          border:"1px solid #ddd",
          position: 'sticky',
          left: 0,
    
        },
        other: {
          minWidth: 100,
          border:"1px solid #ddd"
        }
      }


    useEffect(() => {
        setIndices([scenarioIndex, secondaryScenarioIndex])
    }, [scenarioIndex, secondaryScenarioIndex])

    

    const getPercentDifference = (value1, value2) => {
      let result = ((value1 - value2) / value1) * 100
      if (isNaN(result)) return 0
      else if(value1 > value2) return "+" + (Math.round(result * 10) / 10)
      else return Math.round(result * 10) / 10
    }
    
    const getDifferenceStyling = (value1, value2) => {
      let style = {}
      if (value1 > value2) style.color = "green"
      else if (value2 > value1) style.color = "red"
      return style
    }

    const renderOutputTable = () => {

        try {
            return (
              <TableContainer>
              <h3>Results Comparison</h3>
              <TableContainer sx={{overflowX:'auto'}}>
              <Table style={{border:"1px solid #ddd"}} size='small'>
                <TableHead style={{backgroundColor:"#6094bc", color:"white"}}>
                <TableRow key={`headrow`}>
                    <TableCell style={{backgroundColor:"#6094bc", color:"white", width:"20%"}}>KPI</TableCell> 
                    <TableCell style={{backgroundColor:"#6094bc", color:"white",  width:"20%"}}>Units</TableCell> 
                    <TableCell style={{backgroundColor:"#6094bc", color:"white",  width:"20%"}} align='right'>{scenarios[indices[0]].name}</TableCell> 
                    <TableCell style={{backgroundColor:"#6094bc", color:"white",  width:"20%"}} align='right'>{scenarios[indices[1]].name}</TableCell>
                    <TableCell style={{backgroundColor:"#6094bc", color:"white",  width:"20%"}} align='right'>Percent Difference</TableCell>  
                    {/* <TableCell key="overview3" style={{backgroundColor:"#6094bc", color:"white",  width:"25%", paddingTop:"0px"}}>{renderConfigurationSelect(1)}</TableCell>  */}
                </TableRow>
                </TableHead>
                <TableBody>
                {scenarios[indices[0]].results.data[category].slice(1).map((value, index) => {
                  return (<TableRow key={`row_${value}_${index}`}>
                  {value.map((cellValue, i)=> {
                    return (i !== 1 &&
                       <TableCell 
                        align={(i === (value.length - 1)) ? "right" : "left"} 
                        key={"" + index + i} 
                        style={i === 0 ? styles.firstCol : styles.other}>
                          {(i === (value.length - 1)) ? 
                          cellValue.toLocaleString('en-US', {maximumFractionDigits:0}) : 
                          cellValue ? CategoryNames[cellValue] ? CategoryNames[cellValue] :
                          cellValue.replace('v_F_','').replace('v_C_','Cost ').replace(/([A-Z])/g, ' $1').replace('Cap Ex', 'CapEx').trim()
                          : null
                        }
                    </TableCell>
                    )
                  })}
                    <TableCell 
                        align="right" 
                        style={styles.other}
                    >
                        {scenarios[indices[1]].results.data[category][index+1][3].toLocaleString('en-US', {maximumFractionDigits:0})}
                    </TableCell>
                    <TableCell 
                        align="right" 
                        style={styles.other}
                    >
                      <span style={getDifferenceStyling(scenarios[indices[0]].results.data[category][index+1][3], scenarios[indices[1]].results.data[category][index+1][3])}>
                        {
                          getPercentDifference(scenarios[indices[0]].results.data[category][index+1][3], scenarios[indices[1]].results.data[category][index+1][3])
                        }
                        %
                      </span>
                    </TableCell>
                  </TableRow>)
                  
                })}
                </TableBody> 
              
              </Table>
              </TableContainer>
            </TableContainer>
            )
        } catch (e) {
          console.error("unable to render category: ",e)
        }
      }

  return (
        
        <>
            {  
                renderOutputTable()
            }
        </>
      
  );
}
