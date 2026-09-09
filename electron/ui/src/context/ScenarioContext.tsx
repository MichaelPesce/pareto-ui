// src/ScenarioContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { AppState, Scenario, ScenarioMap, ValidationIssue } from "../types";
import {
  updateScenario,
  updateExcel,
  fetchScenarios,
  checkTasks,
  deleteScenario,
  copyScenario,
  runModel,
} from "../services/app.service";
import { useApp } from "../AppContext";

type NavigateFn = (to: string, opts?: { replace?: boolean }) => void;

export interface ScenarioContextValue {
  // state
  scenarioData: Scenario | null;
  scenarios: ScenarioMap;
  appState: AppState | null;
  section: number;
  category: string | null;
  scenarioIndex: string | number | null;
  backgroundTasks: Array<string | number>;
  loadLandingPage: number;
  checkModelResults: number;
  showCompletedOptimization: boolean;
  lastCompletedScenario: string | number | null;
  compareScenarioIndexes: Array<string | number>;
  isSaving: boolean;
  saveError: string | null;
  acceptSavedScenario: (scenario: Scenario) => void;
  inputFocus: ValidationIssue | null;
  focusInputIssue: (issue: ValidationIssue) => void;

  // setters
  setScenarios: React.Dispatch<React.SetStateAction<ScenarioMap>>;
  setCompareScenarioIndexes: React.Dispatch<React.SetStateAction<Array<string | number>>>;
  setScenarioIndex: React.Dispatch<React.SetStateAction<string | number | null>>;

  // handlers
  navigateToScenarioList: () => void;
  handleScenarioSelection: (scenario: string | number) => void;
  handleNewScenario: (data: Scenario) => void;
  handleScenarioUpdate: (updatedScenario: any, keepOptimized?: boolean, propagateChanges?: string) => Promise<boolean>;
  handleSetSection: (section: number) => void;
  handleSetCategory: (category: string) => void;
  handleEditScenarioName: (newName: string, id: string | number, updateScenarioData?: boolean) => void;
  handleDeleteScenario: (index: string | number) => void;
  handleUpdateExcel: (id: string | number, tableKey: string, updatedTable: any) => Promise<boolean>;
  syncScenarioData: () => void;
  addTask: (id: string | number) => void;
  updateAppState: (action: any, index?: string | number) => void;
  copyAndRunOptimization: (newScenarioName: string) => void;

  // model completion bar
  goToModelResults: () => void;
  handleCloseFinishedOptimizationDialog: () => void;
}

const ScenarioContext = createContext<ScenarioContextValue | undefined>(undefined);

export const useScenario = (): ScenarioContextValue => {
  const ctx = useContext(ScenarioContext);
  if (!ctx) throw new Error("useScenario must be used within a ScenarioProvider");
  return ctx;
};

interface ScenarioProviderProps {
  children: React.ReactNode;
  navigate: NavigateFn; // pass in from App.tsx (keeps router dependency out of the provider)
}

export const ScenarioProvider: React.FC<ScenarioProviderProps> = ({ children, navigate }) => {
  const { port } = useApp();
  const [pendingSaves, setPendingSaves] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const revisions = useRef<Record<string, string>>({});
  const [inputFocus, setInputFocus] = useState<ValidationIssue | null>(null);
  const focusInputIssue = (issue: ValidationIssue) => {
    const target = issue.area === 'map' ? 'Network Diagram' : issue.table === 'TimePeriods' ? 'Complete Scenario Inputs' : issue.table || 'Complete Scenario Inputs';
    setInputFocus({...issue});
    if (issue.section === 'settings' && !issue.table) {
      handleSetSection(1);
      return;
    }
    setSection(0);
    setCategory(target);
    setAppState(previous => ({...previous, section: 0, category: {...previous?.category, 0: target}} as AppState));
  };
  const acceptSavedScenario = (saved: Scenario) => {
    revisions.current[String(saved.id)] = saved.input_revision;
    setScenarios(previous => ({...previous, [saved.id]: saved}));
    setScenarioData(previous => String(previous?.id) === String(saved.id) ? saved : previous);
    setSaveError(null);
  };
  const enqueueSave = (work: () => Promise<void>): Promise<boolean> => {
    setPendingSaves(count => count + 1);
    const request = saveQueue.current.then(async () => {
      try {
        await work();
        return true;
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : 'Unable to save scenario. Your changes have not been saved.');
        return false;
      } finally {
        setPendingSaves(count => count - 1);
      }
    });
    saveQueue.current = request;
    return request;
  };

  const [scenarioData, setScenarioData] = useState<Scenario | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioMap>({});
  const [appState, setAppState] = useState<AppState | null>(null);
  const [section, setSection] = useState<number>(0);
  const [category, setCategory] = useState<string | null>(null);
  const [scenarioIndex, setScenarioIndex] = useState<string | number | null>(null);
  const [backgroundTasks, setBackgroundTasks] = useState<Array<string | number>>([]);
  const [loadLandingPage, setLoadLandingPage] = useState<number>(1);
  const [checkModelResults, setCheckModelResults] = useState<number>(0);
  const [showCompletedOptimization, setShowCompletedOptimization] = useState<boolean>(false);
  const [lastCompletedScenario, setLastCompletedScenario] = useState<string | number | null>(null);
  const [compareScenarioIndexes, setCompareScenarioIndexes] = useState<Array<string | number>>([]);

  // ---- constants ----
  const INITIAL_STATES = useMemo(() => ["Draft", "Incomplete"], []);
  const RUNNING_STATES = useMemo(() => ["Initializing", "Solving Model", "Generating Output"], []);
  const COMPLETED_STATES = useMemo(() => ["Optimized", "failure", "Infeasible"], []);
  const TIME_BETWEEN_CALLS = 20000;

  // prevent runaway timers on unmount
  const pollTimerRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) window.clearTimeout(pollTimerRef.current);
    };
  }, []);

  // ---- helper function for updating the state of the app (category, section...) ----
  const updateAppState = (action: any, index?: string | number): void => {
    if (action.action === "select") {
      let tempSection: number;
      let tempCategory: Record<number, string | null>;
      const status = scenarios[index!].results.status;

      if (appState) {
        if (INITIAL_STATES.includes(status) && appState.section === 2) {
          tempSection = 0;
          tempCategory = appState.category;
        } else {
          tempSection = appState.section;
          tempCategory = status === "Draft" ? appState.category : { 0: "Input Summary", 1: null, 2: "Dashboard" };
        }
      } else {
        if (COMPLETED_STATES.includes(status) || RUNNING_STATES.includes(status)) {
          tempSection = 2;
        } else {
          tempSection = 0;
        }
        tempCategory = { 0: "Input Summary", 1: null, 2: "Dashboard" };
        const tempState = { section: tempSection, category: tempCategory };
        setAppState(tempState);
      }

      setSection(tempSection);
      setCategory(tempCategory[tempSection]);
    } else if (action.action === "new") {
      const tempSection = 0;
      const tempCategory = { 0: "Input Summary", 1: null, 2: "Dashboard" };
      const tempState = { section: tempSection, category: tempCategory };
      setAppState(tempState);
      setSection(tempSection);
      setCategory(tempCategory[tempSection]);
    } else if (action.action === "section") {
      const tempState = { ...(appState as AppState) };
      tempState.section = action.section;
      setAppState(tempState);
      setSection(action.section);
      setCategory(tempState.category[action.section]);
    } else if (action.action === "category") {
      const tempState = { ...(appState as AppState) };
      tempState.category[section] = action.category;
      setAppState(tempState);
      setCategory(action.category);
    }
  };

  const handleSetSection = (newSection: number): void => {
    setInputFocus(null);
    updateAppState({ action: "section", section: newSection }, scenarioIndex ?? undefined);
  };

  const handleSetCategory = (newCategory: string): void => {
    setInputFocus(null);
    updateAppState({ action: "category", category: newCategory }, scenarioIndex ?? undefined);
  };

  const handleCompletedOptimization = (newScenarios: ScenarioMap, id: string | number): void => {
    setCheckModelResults(0);
    setScenarios(newScenarios);

    checkTasks(port)
      .then((response) => response.json())
      .then((data) => {
        setBackgroundTasks(data.tasks);
      });

    if ("" + id === "" + scenarioIndex) {
      setScenarioData(newScenarios[id]);
      if (section === 2) {
        handleSetCategory("Dashboard");
      }
    }
    if (section !== 2) {
      setShowCompletedOptimization(true);
    }
  };

  const goToModelResults = (): void => {
    handleSetSection(2);
    setShowCompletedOptimization(false);
    setScenarioData(scenarios[lastCompletedScenario as any]);
    setScenarioIndex(lastCompletedScenario);
  };

  const handleCloseFinishedOptimizationDialog = (): void => {
    setShowCompletedOptimization(false);
  };

  const navigateToScenarioList = (): void => {
    setScenarioData(null);
    setSection(0);
    setCategory(null);
    setScenarioIndex(null);

    fetchScenarios(port)
      .then((response) => response.json())
      .then((data) => {
        setScenarios(data.data);
      });

    navigate("/scenarios", { replace: true });
  };

  const handleScenarioSelection = (scenario: string | number): void => {
    setInputFocus(null);
    navigate("/scenario", { replace: true });
    setScenarioData(scenarios[scenario]);
    setScenarioIndex(scenario);
    updateAppState({ action: "select" }, scenario);
  };

  const handleNewScenario = (data: Scenario): void => {
    const temp = { ...scenarios };
    temp[data.id] = data;
    setScenarios(temp);
    setScenarioIndex(data.id);
    setScenarioData(data);
    updateAppState({ action: "new" }, data.id);
    navigate("/scenario", { replace: true });
  };

  const handleScenarioUpdate = (updatedScenario: Scenario, keepOptimized?: boolean, propagateChanges?: string): Promise<boolean> => {
    const snapshot = JSON.parse(JSON.stringify(updatedScenario));
    if (snapshot.results.status === 'Optimized' && !keepOptimized) snapshot.results.status = 'Not Optimized';
    setScenarioData(snapshot);
    return enqueueSave(async () => {
      snapshot.input_revision = revisions.current[String(snapshot.id)] || snapshot.input_revision;
      const response = await updateScenario(port, {updatedScenario: snapshot, propagateChanges});
      const body = await response.json();
      if (!response.ok) throw new Error(typeof body.detail === 'string' ? body.detail : 'Unable to save scenario.');
      acceptSavedScenario(body.data);
    });
  };

  const handleEditScenarioName = (newName: string, id: string | number, updateScenarioData?: boolean): void => {
    const tempScenarios = { ...scenarios };
    const tempScenario = tempScenarios[id];
    tempScenario.name = newName;
    tempScenarios[id] = tempScenario;

    setScenarios(tempScenarios);
    if (updateScenarioData) setScenarioData(tempScenario);

    updateScenario(port, { updatedScenario: tempScenario }).catch((e) => {
      console.error("error on scenario update");
      console.error(e);
    });
  };

  const handleDeleteScenario = (index: string | number): void => {
    deleteScenario(port, { id: index })
      .then((response) => response.json())
      .then((data) => {
        setScenarios(data.data);
        updateAppState({ action: "delete" }, index);
      })
      .catch((e) => {
        console.error("error on scenario delete");
        console.error(e);
      });
  };

  const handleUpdateExcel = (id: string | number, tableKey: string, updatedTable: any): Promise<boolean> => {
    const table = JSON.parse(JSON.stringify(updatedTable));
    return enqueueSave(async () => {
      const response = await updateExcel(port, {id, tableKey, updatedTable: table,
        revision: revisions.current[String(id)] || scenarioData?.input_revision});
      const body = await response.json();
      if (!response.ok) throw new Error(typeof body.detail === 'string' ? body.detail : 'Unable to save input table.');
      acceptSavedScenario(body);
    });
  };

  const syncScenarioData = (): void => {
    fetchScenarios(port)
      .then((response) => response.json())
      .then((data) => {
        setScenarios(data.data);
        setScenarioData(data.data[scenarioIndex as any]);
        const saved = data.data[scenarioIndex as any];
        if (saved) revisions.current[String(saved.id)] = saved.input_revision;
        setSaveError(null);
      });
  };

  const addTask = (id: string | number): void => {
    setBackgroundTasks((prev) => [...prev, id]);
    setCheckModelResults((prev) => prev + 1);
  };

  const copyAndRunOptimization = (newScenarioName: string): void => {
    copyScenario(port, scenarioIndex, newScenarioName)
      .then((response) => response.json())
      .then((copy_data) => {
        setScenarios(copy_data.scenarios);
        setScenarioIndex(copy_data.new_id);
        setScenarioData(copy_data.scenarios[copy_data.new_id]);

        runModel(port, { scenario: copy_data.scenarios[copy_data.new_id] })
          .then((r) => r.json().then((data) => ({ status: r.status, body: data })))
          .then((response) => {
            const responseCode = response.status;
            const data = response.body;

            if (responseCode === 200) {
              acceptSavedScenario(data);
              updateAppState({action: 'section', section: 2}, copy_data.new_id);
              addTask(copy_data.new_id);
            } else {
              setSaveError(typeof data.detail === 'string' ? data.detail : data.detail?.message || 'Unable to start optimization.');
            }
          })
          .catch((e) => {
            console.error("error on model run: ", e);
          });
      })
      .catch((e) => {
        console.error("error on scenario copy");
        console.error(e);
      });
  };

  // ---- effect 1: initial load ----
  useEffect(() => {
    checkTasks(port)
      .then((response) => response.json())
      .then((data) => {
        const tasks = data.tasks;
        setBackgroundTasks(tasks);

        fetchScenarios(port)
          .then((response) => response.json())
          .then((data) => {
            const tempScenarios: any = {};
            for (const key in data.data) {
              const scenario = { ...data.data[key] };
              tempScenarios[key] = scenario;

              if (RUNNING_STATES.includes(scenario.results.status) && !tasks.includes(scenario.id)) {
                scenario.results.status = "Draft";
                updateScenario(port, { updatedScenario: { ...scenario } }).catch((e) => {
                  console.error("error on scenario update");
                  console.error(e);
                });
              }
            }
            setScenarios(tempScenarios);
            navigate("/scenarios", { replace: true });
          });
      })
      .catch((e) => {
        console.error("try #" + loadLandingPage + " unable to check for tasks: ", e);
        window.setTimeout(() => setLoadLandingPage((x) => x + 1), 1000);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadLandingPage, port]);

  // ---- effect 2: polling for running optimizations ----
  useEffect(() => {
    if (checkModelResults <= 0) return;

    fetchScenarios(port)
      .then((response) => response.json())
      .then((data) => {
        const tempScenarios = data.data;
        let updated = false;
        let completed = false;

        for (let i = 0; i < backgroundTasks.length; i++) {
          const task = backgroundTasks[i];
          const tempScenario = tempScenarios[task];

          if (tempScenario?.results?.status !== scenarios[task]?.results?.status) updated = true;
          if (COMPLETED_STATES.includes(tempScenario?.results?.status)) completed = true;
        }

        if (completed) {
          setLastCompletedScenario(backgroundTasks[0]);
          handleCompletedOptimization(tempScenarios, backgroundTasks[0]);
          return;
        }

        if (updated) {
          if ("" + scenarioIndex === "" + backgroundTasks[0]) {
            setScenarioData(tempScenarios[backgroundTasks[0]]);
          }
          setScenarios(tempScenarios);
        }

        if (checkModelResults < 1000) {
          pollTimerRef.current = window.setTimeout(() => {
            setCheckModelResults((x) => x + 1);
          }, TIME_BETWEEN_CALLS);
        } else {
          setCheckModelResults(0);
        }
      })
      .catch((e) => {
        console.error("unable to fetch scenarios and check results: " + e);
      });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkModelResults, port]);

  const value: ScenarioContextValue = {
    scenarioData,
    scenarios,
    appState,
    section,
    category,
    scenarioIndex,
    backgroundTasks,
    loadLandingPage,
    checkModelResults,
    showCompletedOptimization,
    lastCompletedScenario,
    compareScenarioIndexes,
    isSaving: pendingSaves > 0,
    saveError,
    acceptSavedScenario,
    inputFocus,
    focusInputIssue,

    setScenarios,
    setCompareScenarioIndexes,
    setScenarioIndex,

    navigateToScenarioList,
    handleScenarioSelection,
    handleNewScenario,
    handleScenarioUpdate,
    handleSetSection,
    handleSetCategory,
    handleEditScenarioName,
    handleDeleteScenario,
    handleUpdateExcel,
    syncScenarioData,
    addTask,
    updateAppState,
    copyAndRunOptimization,

    goToModelResults,
    handleCloseFinishedOptimizationDialog,
  };

  return <ScenarioContext.Provider value={value}>{children}</ScenarioContext.Provider>;
};
