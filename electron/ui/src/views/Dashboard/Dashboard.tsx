import './Dashboard.css';
import {useEffect, useState, type ChangeEvent} from 'react';   
import {  } from "react-router-dom";
import { Alert, Button, Grid, IconButton } from '@mui/material'
import ScenarioCompletion from '../../components/ScenarioCompletion/ScenarioCompletion';
import EditIcon from '@mui/icons-material/Edit';
import ProcessToolbar from '../../components/ProcessToolbar/ProcessToolbar'
import Bottombar from '../../components/Bottombar/Bottombar'; 
import DataInput from '../DataInput/DataInput'
import Optimization from '../Optimization/Optimization'
import ModelResults from '../ModelResults/ModelResults'
import Sidebar from '../../components/Sidebar/Sidebar'
import PopupModal from '../../components/PopupModal/PopupModal'
import { runModel } from '../../services/app.service'
import { useApp } from '../../AppContext';
import { MapProvider } from '../../context/MapContext';
import { useScenario } from "../../context/ScenarioContext";


export default function Dashboard() {
  const { 
    scenarios, scenarioData: scenario, navigateToScenarioList: navigateHome, handleScenarioUpdate: updateScenario, updateAppState,
    addTask, handleEditScenarioName, section, category, handleSetSection,
    handleSetCategory, appState, backgroundTasks, syncScenarioData,
    copyAndRunOptimization, handleUpdateExcel, isSaving, saveError, inputFocus, focusInputIssue, acceptSavedScenario,
  } = useScenario();
  // console.log(scenario)
  
  const [ name, setName ] = useState<string>('')
  const [ openEditName, setOpenEditName ] = useState<boolean>(false)
  const [ inputDataEdited, setInputDataEdited ] = useState<boolean>(false)
  const [ disableOptimize, setDisableOptimize ] = useState<boolean>(false)
  const [runError, setRunError] = useState<string | null>(null);
  const enabledStatusList = ['Optimized','Draft','failure', 'Not Optimized', 'Infeasible']

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

   const handleRunModel = async () => {
     setDisableOptimize(true); setRunError(null);
     try {
       const response = await runModel(port, {scenario});
       const data = await response.json();
       if (!response.ok) {
         const detail = data.detail;
         throw new Error(typeof detail === 'string' ? detail : detail?.validation?.error || detail?.message || 'Unable to start optimization.');
       }
       acceptSavedScenario(data);
       updateAppState({action: 'section', section: 2}, scenario.id);
       addTask(scenario.id);
     } catch (error) {
       setRunError(error instanceof Error ? error.message : 'Unable to start optimization.');
     } finally { setDisableOptimize(false); }
   };

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
      {(section === 0 || (section === 2 && scenario?.results?.status?.includes("Optimized"))) && 
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
      
    <Grid container spacing={1} sx={(section !== 1 && !(section === 2 && !scenario?.results?.status?.includes("Optimized"))) ? styles.shiftTextRight : {}}>
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
      {runError && <Alert severity="error" action={<Button onClick={() => {handleSetSection(0); setRunError(null);}}>Review inputs</Button>}>{runError}</Alert>}
      {saveError && <Alert severity="error" action={<Button disabled={isSaving} onClick={syncScenarioData}>Reload saved inputs</Button>}>{saveError}</Alert>}
      {isSaving && <Alert severity="info">Saving scenario…</Alert>}
      {(scenario && section === 0 && category === 'Complete Scenario Inputs') && <ScenarioCompletion scenario={scenario}
        disabled={inputDataEdited || isSaving || !!saveError || backgroundTasks.includes(scenario.id)} onSelect={focusInputIssue} />}
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
          setDisabled={setDisableOptimize}
        />
      }
      {(scenario && section===2) && 
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
      saving={isSaving || !!saveError}
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
      setDisableOptimize={setDisableOptimize}
      copyAndRunOptimization={copyAndRunOptimization}
      port={port}
      />
    </MapProvider>
  );

}
