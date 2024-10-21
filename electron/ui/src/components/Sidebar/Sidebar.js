import React, {useState, useEffect} from 'react';
import { Box, Drawer, CssBaseline, Collapse, Tooltip, IconButton } from '@mui/material'
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import ParetoDictionary from '../../assets/ParetoDictionary.json'
import CategoryNames from '../../assets/CategoryNames.json'
import SUBCATEGORIES from '../../assets/Subcategories.json'
import PopupModal from '../../components/PopupModal/PopupModal'


const drawerWidth = 240;

export default function Sidebar(props) {
  const {
    handleSetCategory,
    scenario,
    section,
    category,
    inputDataEdited,
    handleUpdateExcel,
    setInputDataEdited,
    syncScenarioData,
    modelType
  } = props
  const [ openSaveModal, setOpenSaveModal ] = useState(false)
  const [ key, setKey ] =  useState(null)
  const [ openDynamic, setOpenDynamic ] = useState(true)
  const [ openStatic, setOpenStatic ] = useState(false)
  const [ openResultsTables, setOpenResultsTables ] = useState(false)
  const [ overrideList, setOverrideList ] = useState([])
  const [ Subcategories, setSubCategories ] = useState(SUBCATEGORIES[modelType || 'strategic'])

  useEffect(() => {
    let tempOverrideList = []
    if (scenario.optimized_override_values !== undefined)  {
        for(let key of Object.keys(scenario.optimized_override_values)) {
            if(Object.keys(scenario.optimized_override_values[key]).length > 0) {
              tempOverrideList.push(key)
            }
        }
    }
    if (tempOverrideList.length > 0) tempOverrideList.push("Results Tables")
    setOverrideList(tempOverrideList)
    let newSubCategories = SUBCATEGORIES[modelType || 'strategic']
    setSubCategories(newSubCategories)
},[scenario])

  const handleOpenSaveModal = () => setOpenSaveModal(true);
  const handleCloseSaveModal = () => setOpenSaveModal(false);

  const styles = {
    topLevelCategory: {
      paddingLeft: "0px",
      fontWeight: "500",
      margin: 0,
      // justifyContent: "space-between"
    },
    subcategory: {
      paddingLeft: "10px",
      margin: 0,
    },
    selected: {
      cursor: "pointer",
      color:"#0b89b9",
      backgroundColor: "#D4EFFF",
      padding: 10,
      marginLeft: "10px",
      marginRight: "10px",
      borderRadius: "5px",
      textAlign: "left",
      marginTop: 1,
      marginBottom: 1,
      fontWeight: "bold"
    },
    unselected: {
      cursor: "pointer",
      padding: 10,
      marginLeft: "10px",
      marginRight: "10px",
      borderRadius: "5px",
      textAlign: "left",
      marginTop: 1,
      marginBottom: 1
    },
    override: {
      backgroundColor: "rgb(255,215,0, 0.4)",
      cursor: "pointer",
      padding: 10,
      marginLeft: "10px",
      marginRight: "10px",
      borderRadius: "5px",
      textAlign: "left",
      marginTop: 1,
      marginBottom: 1
    },
  }

  const handleSaveModal = () => {
    handleUpdateExcel(scenario.id, category, scenario.data_input.df_parameters[category])
    handleCloseSaveModal()
    setInputDataEdited(false)
    handleSetCategory(key)
  }

  const handleDiscardChanges = () => {
    handleCloseSaveModal()
    setInputDataEdited(false)
    handleSetCategory(key)
    syncScenarioData()
  }

  const handleClick = (key) => {
    setKey(key)
    if (inputDataEdited) {
      handleOpenSaveModal()
    }
    else {
      handleSetCategory(key)
    }
  }

  const getStyle = (key) => {
    try {
      if(category === key) return styles.selected
      else if (overrideList.includes(key)) return styles.override
      else return styles.unselected
    }
    catch(e) {
      return styles.unselected
    }
  }

  const renderAdditionalCategories = () => {
    let additionalCategories = section === 0 ? {"Input Summary" :null, "Network Diagram": null, "Plots": null} : section === 1 ? {} : {"Dashboard": null, "Sankey": null, "Network Diagram": null}
    return (
      Object.entries(additionalCategories).map( ([key, value]) => ( 
        <div style={category===key ? styles.selected : styles.unselected} onClick={() => handleClick(key)} key={value+""+key}> 
            <p style={styles.topLevelCategory}>{key === "Input Summary" && scenario.results.status === "Incomplete" ? "PARETO Input File" : key}</p>
        </div>
      ))
    )
  }

  const renderTopLevelCategories = () => {
    if (section === 0) {
      return (
        <div>
          <div style={getStyle("Dynamic")}  onClick={() => setOpenDynamic(!openDynamic)}> 
            <p style={styles.topLevelCategory}>
              <span style={{display:"flex", justifyContent: "space-between"}}>
                Dynamic Inputs
                <IconButton disableRipple size="small" sx={{marginTop: -3, marginBottom: -3}}>{openDynamic ? <ExpandLess /> : <ExpandMore />}</IconButton>
              </span>
            </p>
            
              
          </div>
          {renderDynamicCategories()}
          <div style={getStyle("Static")}  onClick={() => setOpenStatic(!openStatic)}> 
              <p style={styles.topLevelCategory}>
              <span style={{display:"flex", justifyContent: "space-between"}}>
                Static Inputs
                <IconButton disableRipple size="small" sx={{marginTop: -3, marginBottom: -3}}>{openStatic ? <ExpandLess /> : <ExpandMore />}</IconButton>
              </span>
              </p>
          </div>
          {renderStaticCategories()}
        </div>
      ) 
    }else if (section ===2) {
      return (
        <>
        <div style={category==="Results Tables" ? styles.selected : styles.unselected} onClick={() => setOpenResultsTables(!openResultsTables)}> 
            
          <p style={styles.topLevelCategory}>
            <span style={{display:"flex", justifyContent: "space-between"}}>
              Results Tables
              <IconButton disableRipple edge={"end"} size="small" sx={{marginTop: -3, marginBottom: -3}}>{openResultsTables ? <ExpandLess /> : <ExpandMore />}</IconButton>
            </span>
          </p>
        </div>
          {renderResultsTables()}
          </>
      ) 
    }
  }

  const renderDynamicCategories = () => {
    return (
      <Collapse in={openDynamic} timeout="auto" unmountOnExit>
      {Subcategories.Dynamic.map( (value,index) => {
        return(
          <div style={getStyle(value)} onClick={() => handleClick(value)} key={value+""+index}> 
          <Tooltip title={ParetoDictionary[value] ? ParetoDictionary[value] : CategoryNames[value] ? CategoryNames[value] : value} placement="right-start">
            <p style={styles.subcategory}>
              {CategoryNames[value] ? CategoryNames[value] : 
                    value.replace('_dict','')
                    .replace('v_F_','')
                    .replace('v_C_','Cost ')
                    .replace('v_R_','Credit ')
                    .replace('v_L_','Water Level ')
                    .replace('v_S_','Slack ')
                    .replace('v_D_','Disposal ')
                    .replace('v_X_','Storage ')
                    .replace('v_T_','Treatment ')
                    .replace('vb_y_Flow','Directional Flow')
                    .replace('vb_y_','New ')
              }
              </p>
              </Tooltip>
          </div>
        )
      })}
      </Collapse>
    )
  }

  const renderStaticCategories = () => {
    return (
      <Collapse in={openStatic} timeout="auto" unmountOnExit>
      {Subcategories.Static.map( (value,index) => {
        return (
          <div style={getStyle(value)} onClick={() => handleClick(value)} key={value+""+index}> 
          <Tooltip title={ParetoDictionary[value] ? ParetoDictionary[value] : CategoryNames[value] ? CategoryNames[value] : value} placement="right-start">
            <p style={styles.subcategory}>
              {CategoryNames[value] ? CategoryNames[value] : 
                    value.replace('_dict','')
                    .replace('v_F_','')
                    .replace('v_C_','Cost ')
                    .replace('v_R_','Credit ')
                    .replace('v_L_','Water Level ')
                    .replace('v_S_','Slack ')
                    .replace('v_D_','Disposal ')
                    .replace('v_X_','Storage ')
                    .replace('v_T_','Treatment ')
                    .replace('vb_y_Flow','Directional Flow')
                    .replace('vb_y_','New ')
              }
              </p>
              </Tooltip>
          </div>
        )
      })}
      </Collapse>
    )
  }
  const renderResultsTables = () => {
    return (
      <Collapse in={openResultsTables} timeout="auto" unmountOnExit>
        {Object.entries(scenario.results.data).map( ([key, value]) => ( 
          <div style={getStyle(key)} onClick={() => handleClick(key)} key={key+""+value}> 
              <p style={styles.subcategory}>
                {CategoryNames[key] ? CategoryNames[key] :
                    key.replace('_dict','')
                        .replace('v_F_','')
                        .replace('v_C_','Cost ')
                        .replace('v_R_','Credit ')
                        .replace('v_L_','Water Level ')
                        .replace('v_S_','Slack ')
                        .replace('v_D_','Disposal ')
                        .replace('v_X_','Storage ')
                        .replace('v_T_','Treatment ')
                        .replace('vb_y_Flow','Directional Flow')
                        .replace('vb_y_','New ')}
              </p>
          </div>
        ))}
      </Collapse>
    )
  }

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {backgroundColor:"#F5F5F6",  width: drawerWidth, boxSizing: 'border-box' },
          [`& .MuiBox-root`]: {marginBottom: '60px' },
        }}
        PaperProps={{
            sx: {
            width: 240,
            marginTop: '158px',
            paddingBottom: '158px',
            zIndex:1
            }
        }}
        open={true}
      >
        <Box key="drawer_box" sx={{ overflow: 'auto', overflowX: 'hidden'}}>
            {scenario &&
              renderAdditionalCategories()
            }
            {scenario &&
              renderTopLevelCategories()
            }
        </Box>
      </Drawer>
      <PopupModal
        hasTwoButtons
        open={openSaveModal}
        handleClose={handleCloseSaveModal}
        handleSave={handleSaveModal}
        handleButtonTwoClick={handleDiscardChanges}
        text="Do you want to save changes made to this table?"
        buttonText='Save'
        buttonColor='primary'
        buttonVariant='contained'
        buttonTwoText='Discard'
        buttonTwoColor='error'
        buttonTwoVariant='outlined'
        width={400}
      />
    </Box>
  );
}
