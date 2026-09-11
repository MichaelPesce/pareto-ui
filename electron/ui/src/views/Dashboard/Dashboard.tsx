import './Dashboard.css';
import {useEffect, useState, type ChangeEvent} from 'react';   
import {  } from "react-router-dom";
import { Alert, Box, Button, Grid, IconButton } from '@mui/material'
import OptimizationProgress from '../../components/OptimizationProgress/OptimizationProgress';
import ScenarioCompletion from '../../components/ScenarioCompletion/ScenarioCompletion';
import EditIcon from '@mui/icons-material/Edit';
import ProcessToolbar from '../../components/ProcessToolbar/ProcessToolbar'
import Bottombar from '../../components/Bottombar/Bottombar'; 
import DataInput from '../DataInput/DataInput'
import Optimization from '../Optimization/Optimization'
import ModelResults from '../ModelResults/ModelResults'
import Sidebar from '../../components/Sidebar/Sidebar'
import PopupModal from '../../components/PopupModal/PopupModal'
import { useApp } from '../../AppContext';
import { MapProvider } from '../../context/MapContext';
import { useScenario } from "../../context/ScenarioContext";


export default function Dashboard() {
  const { 
    scenarios, scenarioData: scenario, navigateToScenarioList: navigateHome, handleScenarioUpdate: updateScenario,
    handleEditScenarioName, section, category, handleSetSection,
    handleSetCategory, appState, backgroundTasks, syncScenarioData,
    copyAndRunOptimization, handleUpdateExcel, isSaving, saveError, inputFocus, focusInputIssue,
    startOptimization: handleRunModel, optimizationStart, isStartingOptimization, retryOptimizationStart, dismissOptimizationStart,
  } = useScenario();
  // console.log(scenario)
  
  const [ name, setName ] = useState<string>('')
  const [ openEditName, setOpenEditName ] = useState<boolean>(false)
  const [ inputDataEdited, setInputDataEdited ] = useState<boolean>(false)
  const enabledStatusList = ['Optimized','Draft','failure', 'Not Optimized', 'Infeasible']
  const disableOptimize = isStartingOptimization || backgroundTasks.length > 0 || !enabledStatusList.includes(scenario?.results?.status);
  const showSidebar = section === 0 || (section === 2 && !optimizationStart && scenario?.results?.status?.includes('Optimized'));

  const handleOpenEditName = () => setOpenEditName(true);
  const handleCloseEditName = () => setOpenEditName(false);
  const { port } = useApp();

  /*
    TODO: make api call to fetch scenario by ID here.
  */

  useEffect(()=>{
    try {
      if(!scenario) {
        navigateHome()
      } else {
        setInputDataEdited(false)
        setName(scenario.name)
      }
    }
    catch (e){
      console.error('unable to set scenario name: ',e)
    }
  }, [scenario]);

   const styles = {
    shiftTextLeft: {
      paddingLeft: '0px'
    },
    shiftTextRight: {
      paddingLeft: '240px',
      pb: 7
      // paddingTop: '184px'
    },
    titleDivider: {
      m:2, 
      marginTop:2
    },
   }

  const handleEditName = (event: ChangeEvent<HTMLInputElement>) => {
   setName(event.target.value)
  }

   const handleSaveName = () => {
    handleEditScenarioName(name, scenario.id, true)
    setOpenEditName(false)
  }
  
  return (
    <MapProvider scenario={scenario} handleUpdateScenario={updateScenario}>
      <ProcessToolbar 
        hasOptimizationStart={!!optimizationStart}
        handleSelection={handleSetSection} 
        selected={section} 
        scenario={scenario}
        category={category} 
        inputDataEdited={inputDataEdited}
        handleUpdateExcel={handleUpdateExcel}
        setInputDataEdited={setInputDataEdited}
        syncScenarioData={syncScenarioData}
      >
      </ProcessToolbar>
      {showSidebar &&
        <Sidebar 
          handleSetCategory={handleSetCategory} 
          scenario={scenario} 
          section={section} 
          category={category} 
          inputFocus={inputFocus}
          inputDataEdited={inputDataEdited}
          handleUpdateExcel={handleUpdateExcel}
          setInputDataEdited={setInputDataEdited}
          syncScenarioData={syncScenarioData}
          >
        </Sidebar>
      }
      
    <Grid container spacing={1} sx={showSidebar ? styles.shiftTextRight : {}}>
      <Grid item xs={4} ></Grid>
      <PopupModal
        input
        open={openEditName}
        handleClose={handleCloseEditName}
        text={name}
        textLabel='Config Name'
        handleEditText={handleEditName}
        handleSave={handleSaveName}
        buttonText='Save'
        buttonColor='primary'
        buttonVariant='contained'
        width={400}
      />
      <Grid item xs={4}>
      <div>
        <b id='scenarioTitle' >
        {(scenario && section===0) && 
        <p>{scenario.name}
        <IconButton onClick={handleOpenEditName} style={{fontSize:"15px", zIndex:'0'}} disabled={enabledStatusList.includes(scenario.results.status) ? false : true}>
          <EditIcon fontSize='inherit'/>
        </IconButton>
        </p>
        }
      </b> 
      </div>
      </Grid>
      <Grid item xs={4}>
      </Grid>
      <Grid item xs={12}>
      {saveError && <Alert severity="error" action={<Button disabled={isSaving} onClick={syncScenarioData}>Reload saved inputs</Button>}>{saveError}</Alert>}
      {isSaving && <Alert severity="info">Saving scenario…</Alert>}
      {(scenario && section === 0 && category === 'Complete Scenario Inputs') && <ScenarioCompletion scenario={scenario}
        disabled={inputDataEdited || isSaving || !!saveError || isStartingOptimization || backgroundTasks.includes(scenario.id)} onSelect={focusInputIssue} />}
      {(scenario && section===0 && category !== 'Complete Scenario Inputs') &&
        <DataInput 
          handleUpdateExcel={handleUpdateExcel} 
          category={category} 
          scenario={scenario} 
          edited={inputDataEdited} 
          handleEditInput={setInputDataEdited}
          syncScenarioData={syncScenarioData}
          handleSetCategory={handleSetCategory} 
          updateScenario={updateScenario}
        />
      }
      {(scenario && section===1) && 
        <Optimization 
          category={category} 
          scenario={scenario} 
          updateScenario={updateScenario}
          handleRunModel={handleRunModel}
          backgroundTasks={backgroundTasks} 
          disabled={disableOptimize}
          saving={isSaving || !!saveError}
        />
      }
      {section === 2 && optimizationStart && (optimizationStart.error ?
        <Box sx={{m: 3}}>
          <Alert severity={optimizationStart.phase === 'uncertain' ? 'warning' : 'error'}>{optimizationStart.error}</Alert>
          {optimizationStart.phase === 'uncertain' ? <Button onClick={retryOptimizationStart}>Retry start request</Button> : <>
            <Button onClick={() => {dismissOptimizationStart(); syncScenarioData(); handleSetSection(0); handleSetCategory('Complete Scenario Inputs');}}>Review inputs &amp; settings</Button>
            {scenario.results.status === 'Optimized' && <Button onClick={dismissOptimizationStart}>View previous results</Button>}
          </>}
        </Box> : <OptimizationProgress status={optimizationStart.phase === 'copying' ? 'Copying scenario' : 'Submitting request'} />)}
      {(scenario && section===2 && !optimizationStart) &&
        <ModelResults 
          category={category} 
          scenario={scenario} 
          handleSetSection={handleSetSection} 
          appState={appState}
          syncScenarioData={syncScenarioData}
          scenarios={scenarios}
          updateScenario={updateScenario}
          handleSetCategory={handleSetCategory} 
        />
      }
      </Grid>
    </Grid>
    <Bottombar
      saving={isSaving || !!saveError || isStartingOptimization}
      focusInputIssue={focusInputIssue}
      handleSelection={handleSetSection} 
      handleSetCategory={handleSetCategory}
      section={section} 
      backgroundTasks={backgroundTasks} 
      scenario={scenario} 
      category={category}
      handleUpdateExcel={handleUpdateExcel}
      inputDataEdited={inputDataEdited}
      setInputDataEdited={setInputDataEdited}
      syncScenarioData={syncScenarioData}
      handleRunModel={handleRunModel}
      disableOptimize={disableOptimize}
      copyAndRunOptimization={copyAndRunOptimization}
      port={port}
      />
    </MapProvider>
  );

}
