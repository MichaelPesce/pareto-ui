 
import './App.css';
import React from 'react';
import {useEffect, useState} from 'react';   
import { Routes, Route, useNavigate, Navigate } from "react-router-dom";
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import Header from './components/Header/Header'; 
import Dashboard from './views/Dashboard/Dashboard';
import ScenarioList from './views/ScenarioList/ScenarioList';
import ScenarioCompare from './views/ScenarioCompare/ScenarioCompare';
import LandingPage from './views/LandingPage/LandingPage';
import ModelCompletionBar from './components/ModelCompletionBar/ModelCompletionBar';
import { updateScenario, updateExcel, fetchScenarios, checkTasks, deleteScenario, copyScenario, runModel } from './services/app.service'
import { useApp } from './AppContext';


function App() {
  const [ scenarioData, setScenarioData ] = useState(null);
  const [ scenarios, setScenarios ] = useState({}); 
  const [ appState, setAppState ] = useState(null)
  const [ section, setSection ] = useState(0)
  const [ category, setCategory ] = useState(null)
  const [ scenarioIndex, setScenarioIndex ] = useState(null)
  const [ backgroundTasks, setBackgroundTasks ] = useState([])
  const [ showHeader, setShowHeader ] = useState(false)
  const [ loadLandingPage, setLoadLandingPage ] = useState(1)
  const [ checkModelResults, setCheckModelResults ] = useState(0)
  const [ showCompletedOptimization, setShowCompletedOptimization ] = useState(false)
  const [ lastCompletedScenario, setLastCompletedScenario ] = useState(null)
  const [ compareScenarioIndexes, setCompareScenarioIndexes ] = useState([])
  const [ modelType, setModelType ] = useState("")
  const INITIAL_STATES = ['Draft','Incomplete']
  const RUNNING_STATES = ['Initializing', 'Solving Model','Generating Output']
  const STABLE_STATES = ['Draft','none', 'Optimized','failure', 'Not Optimized', 'complete', 'Infeasible']
  const COMPLETED_STATES = ['Optimized','failure', 'Infeasible']
  const TIME_BETWEEN_CALLS = 20000
  let navigate = useNavigate();
  const { port } = useApp()
  console.log(scenarios)
  useEffect(()=>{
    /*
      1) check for optimizations that are currently running
      2) fetch all scenarios
      3) if a scenario is a draft, is optimized, or is currently running, leave it as is
      4) if a scenario was running when the app was previously quit, reset it to draft
    */
    checkTasks(port)
    .then(response => response.json())
    .then((data)=>{
      let tasks = data.tasks
      setBackgroundTasks(tasks)
      fetchScenarios(port)
      .then(response => response.json())
      .then((data)=>{
        /* 
        check for any scenarios that were running when the app was previously quit
        reset the status of these scenarios so that they can be treated as drafts again
        */ 
        const tempScenarios = {}
          for (var key in data.data){
            let scenario = {...data.data[key]}
            tempScenarios[key] = scenario
            if (RUNNING_STATES.includes(scenario.results.status) && !tasks.includes(scenario.id)) {
              scenario.results.status = 'Draft'
              updateScenario(port, {'updatedScenario': {...scenario}})
              .then(response => response.json())
              .then((data) => {
                // console.log('reset scenario')
              }).catch(e => {
                console.error('error on scenario update')
                console.error(e)
              })
            }
        }
      setScenarios(tempScenarios)
      navigate('/scenarios', {replace: true})
    });
    })
    .catch(e => {
      console.error('try #'+loadLandingPage+' unable to check for tasks: ',e)
      setTimeout(function() {
        setLoadLandingPage(loadLandingPage => loadLandingPage+1)
      }, 1000)
  
      
    })
    
}, [loadLandingPage]);

useEffect(()=> {
  /*
    if model is running, periodically check for results 
  */
 if(checkModelResults > 0) {
  /*
    make api call to get status of each running task
  */
  fetchScenarios(port)
    .then(response => response.json())
    .then((data)=>{
      let tempScenarios = data.data
      let updated = false
      let completed = false
      for (var i =0; i < backgroundTasks.length; i++) {
        let task = backgroundTasks[i]
        let tempScenario = tempScenarios[task]
        if(tempScenario.results.status !== scenarios[task].results.status) updated=true
        if(COMPLETED_STATES.includes(tempScenario.results.status)) completed = true
      }
      if (completed) {
          /*
            set scenario data, section and scenarios; finish checking
          */
            setLastCompletedScenario(backgroundTasks[0])
            handleCompletedOptimization(tempScenarios, backgroundTasks[0])
      } else if (updated) {
          /*
            set scenarios and scenario data; keep checking
          */
            if(""+scenarioIndex === ""+backgroundTasks[0]) {
              updateScenarioData(tempScenarios[backgroundTasks[0]])
            }
            setScenarios(tempScenarios)
            if(checkModelResults < 1000) {
              setTimeout(function() {
                setCheckModelResults(checkModelResults => checkModelResults+1)
              }, TIME_BETWEEN_CALLS)
            } else{
              setCheckModelResults(0)
            }
      } else {
        if(checkModelResults < 1000) {
          setTimeout(function() {
            setCheckModelResults(checkModelResults => checkModelResults+1)
          }, TIME_BETWEEN_CALLS)
        }else{
          setCheckModelResults(0)
        }
      }
    }).catch(e => {
      console.error('unable to fetch scenarios and check results: '+e)
    })
 }
}, [checkModelResults])

const updateScenarioData = (newData) => {
  if (newData) {
    let newModelType = newData.model_type || "strategic"
    if (newModelType !== modelType) {
      // console.log("new model type is "+newModelType)
      setModelType(newModelType)
      if (appState) {
        updateAppState({action:'category',category:"Input Summary", section: 0},scenarioIndex)
      }
    }
  }
  setScenarioData(newData)
}

  const handleCompletedOptimization = (newScenarios, id) => {
    setCheckModelResults(0)
    setScenarios(newScenarios)
    checkTasks(port)
      .then(response => response.json())
      .then((data)=>{
        setBackgroundTasks(data.tasks)
      });
    /*
      if not on model results tab, show popup that lets user know that model has finished running
    */
   if(""+id === ""+scenarioIndex){
    updateScenarioData(newScenarios[id])
    if (section === 2) {
      handleSetCategory("Dashboard")
     }
   }
   if (section !== 2) {
    setShowCompletedOptimization(true)
   }
  }

  const goToModelResults = () => {
    handleSetSection(2)
    // handleSetCategory("Dashboard")
    setShowCompletedOptimization(false)
    updateScenarioData(scenarios[lastCompletedScenario]);
    setScenarioIndex(lastCompletedScenario)
  }

  const handleCloseFinishedOptimizationDialog = () => {
    setShowCompletedOptimization(false)
  }

  const navigateToScenarioList = () => {
    /*
      function for returning to scenario list and resetting scenario data
    */   
    setShowHeader(true)
    updateScenarioData(null)
    setSection(0)
    setCategory(null)
    setScenarioIndex(null)
    fetchScenarios(port)
    .then(response => response.json())
    .then((data)=>{
      setScenarios(data.data)
    });
    navigate('/scenarios', {replace: true})
  }

  const handleScenarioSelection = (scenario) => {
    navigate('/scenario', {replace: true})
    updateScenarioData(scenarios[scenario]);
    setScenarioIndex(scenario)
    updateAppState({action: 'select'}, scenario)

  };

  const handleNewScenario = (data) => {
    const temp = {...scenarios}
    temp[data.id] = data
    setShowHeader(true)
    setScenarios(temp)
    setScenarioIndex(data.id)
    updateScenarioData(data)
    updateAppState({action:'new'}, data.id)
    navigate('/scenario', {replace: true})   
  }

  const handleScenarioUpdate = (updatedScenario, keepOptimized) => {
    if (updatedScenario.results.status==='Optimized' && !keepOptimized) {
      updatedScenario.results.status = "Not Optimized"
    }
    const temp = {...scenarios}
    temp[scenarioIndex] = {...updatedScenario}
    setScenarios(temp)
    updateScenarioData({...updatedScenario})
    updateScenario(port, {'updatedScenario': {...updatedScenario}})
    .then(response => response.json())
    .then((data) => {
      // console.log('updated scenarios on backend')
    }).catch(e => {
      console.error('error on scenario update')
      console.error(e)
    })
  }

  /*
    set process section (input, optimization, results)
  */
  const handleSetSection = (section) => {
    updateAppState({action:'section',section:section, category: category},scenarioIndex)
 }

 /*
  set sidebar category
 */
 const handleSetCategory = (category) => {
  updateAppState({action:'category',category:category, section: section},scenarioIndex)
 }

  const handleEditScenarioName = (newName, id, updateScenarioData) => {
    const tempScenarios = {...scenarios}
    const tempScenario = tempScenarios[id]
    tempScenario.name = newName
    tempScenarios[id] = tempScenario
    setScenarios(tempScenarios)
    if (updateScenarioData) {
      updateScenarioData(tempScenario)
    }
    updateScenario(port, {'updatedScenario': tempScenario})
    .then(response => response.json())
    .then((data) => {
      // console.log('updated scenarios on backend')
    }).catch(e => {
      console.error('error on scenario update')
      console.error(e)
    })
  }

  const handleDeleteScenario = (index) => {
    deleteScenario(port, {'id': index})
    .then(response => response.json())
    .then((data) => {
      setScenarios(data.data)
      updateAppState({action:'delete'},index)
    }).catch(e => {
      console.error('error on scenario delete')
      console.error(e)
    })
  }

  /*
    function for updating an input table for excel sheet
  */
  const handleUpdateExcel = (id, tableKey, updatedTable) => {
    updateExcel(port, {"id": id, "tableKey":tableKey, "updatedTable":updatedTable})
    .then(response => response.json())
    .then((data)=>{
      if (data.results.status === 'Optimized') {
        data.results.status = "Not Optimized"
        handleScenarioUpdate(data)
      }
    })
    .catch(e => {
      console.error('unable to update excel: ',e)
    })
  }

  /*
    fetch scenarios and update frontend data
  */
  const syncScenarioData = () => {
    fetchScenarios(port)
      .then(response => response.json())
      .then((data)=>{
        setScenarios(data.data)
        updateScenarioData(data.data[scenarioIndex])
      });
  }

  /*
    add scenario id to background tasks while it's optimizing
  */
  const addTask = (id) => {
    let tempBackgroudTasks = [...backgroundTasks]
    tempBackgroudTasks.push(id)
    setBackgroundTasks(tempBackgroudTasks)
    setCheckModelResults(checkModelResults+1)
  }

  /*
    update the section or category and cache the values
  */
  const updateAppState = (action, index) => {
    if (action.action === 'select') {
      let tempSection
      let tempCategory
      if (appState) {
        if (INITIAL_STATES.includes(scenarios[index].results.status) && appState.section === 2) {
          tempSection = 0
          tempCategory = appState.category
        } else {
          tempSection = appState.section
          tempCategory = appState.category
        }
      } else {
        if(COMPLETED_STATES.includes(scenarios[index].results.status) || RUNNING_STATES.includes(scenarios[index].results.status)) {
          tempSection = 2
        } else {
          tempSection = 0
        }
        tempCategory = {0: "Input Summary", 1: null, 2: "Dashboard"}
        let tempState = {section: tempSection, category: tempCategory}
        setAppState(tempState)
      }
      setSection(tempSection)
      setCategory(tempCategory[tempSection])
    } else if (action.action === 'new') {
      let tempSection = 0
      let tempCategory = {0: "Input Summary", 1: null, 2: "Dashboard"}
      let tempState = {section: tempSection, category: tempCategory}
      setAppState(tempState)
      setSection(tempSection)
      setCategory(tempCategory[tempSection])
    } else if (action.action === 'section') {
      let tempState = {...appState}
      tempState.section = action.section
      setAppState(tempState)
      setSection(action.section)
      setCategory(tempState.category[action.section])
    }else if (action.action === 'category') {
      let tempState = {...appState}
      tempState.category[action.section] = action.category
      setAppState(tempState)
      setCategory(action.category)
    }
  }

  /*
    create a copy of current scenario and run an optimization
  */
  const copyAndRunOptimization = (newScenarioName) => {
    //copy scenario
    copyScenario(port, scenarioIndex, newScenarioName)
    .then(response => response.json())
    .then((copy_data) => {
      // update data
      setScenarios(copy_data.scenarios)
      setScenarioIndex(copy_data.new_id)
      updateScenarioData(copy_data.scenarios[copy_data.new_id])

      // run model on new id
      runModel(port, {"scenario": copy_data.scenarios[copy_data.new_id]})
        .then(r =>  r.json().then(data => ({status: r.status, body: data})))
        .then((response) => {
          let responseCode = response.status
          let data = response.body
          if(responseCode === 200) {
            // handleScenarioUpdate(data)
            updateScenario(port, {'updatedScenario': {...data}})
            .then(response => response.json())
            .then((updateScenario_data) => {
              updateAppState({action:'section',section:2, category: category},copy_data.new_id)
              addTask(copy_data.new_id)
            }).catch(e => {
              console.error('error on scenario update')
              console.error(e)
            })
          }
          else if(responseCode === 500) {
            console.error('error code on model run: ',data.detail)
          }
        })
        .catch(e => {
          console.error('error on model run: ',e)
        })

      }).catch(e => {
        console.error('error on scenario copy')
        console.error(e)
      })
  }

  return (
    <div className="App">  
      <Header 
          showHeader={showHeader}
          scenarios={scenarios}
          index={scenarioIndex}
          handleSelection={handleScenarioSelection}
          navigateHome={navigateToScenarioList}
        />
        
      <Routes> 
      <Route 
          path="/" 
          element={
            <LandingPage
              navigateToScenarioList={navigateToScenarioList}
              handleNewScenario={handleNewScenario} 
              scenarios={scenarios} 
            />} 
        />

        <Route 
          path="/scenarios" 
          element={
            <ScenarioList
              handleNewScenario={handleNewScenario} 
              handleEditScenarioName={handleEditScenarioName} 
              handleSelection={handleScenarioSelection}
              scenarios={scenarios} 
              deleteScenario={handleDeleteScenario}
              setScenarios={setScenarios}
              setShowHeader={setShowHeader}
              setCompareScenarioIndexes={setCompareScenarioIndexes}
              setScenarioIndex={setScenarioIndex}
            />} 
        />

        <Route 
          path="/scenario" 
          element={
            <Dashboard 
              handleUpdateExcel={handleUpdateExcel}
              updateScenario={handleScenarioUpdate} 
              handleEditScenarioName={handleEditScenarioName} 
              scenario={scenarioData} 
              section={section} 
              category={category} 
              handleSetCategory={handleSetCategory} 
              handleSetSection={handleSetSection} 
              backgroundTasks={backgroundTasks}
              navigateHome={navigateToScenarioList}
              syncScenarioData={syncScenarioData}
              addTask={addTask}
              appState={appState}
              updateAppState={updateAppState}
              scenarios={scenarios}
              copyAndRunOptimization={copyAndRunOptimization}
              modelType={modelType}
            />} 
        />

        <Route
          path="/compare" 
          element={
            <ScenarioCompare
              scenarios={scenarios} 
              compareScenarioIndexes={compareScenarioIndexes}
              setCompareScenarioIndexes={setCompareScenarioIndexes}
              setScenarioIndex={setScenarioIndex}
            />} 
        />

        <Route
          path="*" 
          element={<Navigate replace to="/" />}
        />
      </Routes> 
      {showCompletedOptimization && 
        <ModelCompletionBar
          handleCloseFinishedOptimizationDialog={handleCloseFinishedOptimizationDialog}
          goToModelResults={goToModelResults}
        />
      }
      
    </div> 
  );
  
}

export default App;
