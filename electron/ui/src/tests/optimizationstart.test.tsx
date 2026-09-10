import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {ScenarioProvider, useScenario, ScenarioContextValue} from '../context/ScenarioContext';
import {checkTasks, copyScenario, fetchScenario, fetchScenarios, runModel} from '../services/app.service';
import {copyScenario as clone} from '../scenarioEdits';
import Dashboard from '../views/Dashboard/Dashboard';

jest.mock('../AppContext', () => ({useApp: () => ({port: 50011})}));
jest.mock('../services/app.service');
jest.mock('../context/MapContext', () => ({MapProvider: ({children}) => children}));
jest.mock('../components/ScenarioCompletion/ScenarioCompletion', () => () => <div>Complete inputs</div>);
jest.mock('../components/Sidebar/Sidebar', () => () => <div>Scenario sidebar</div>);
jest.mock('../components/PopupModal/PopupModal', () => () => null);
jest.mock('../components/Bottombar/Bottombar', () => props => <button disabled={props.disableOptimize} onClick={props.handleRunModel}>Optimize toolbar</button>);
jest.mock('../views/DataInput/DataInput', () => () => null);
jest.mock('../views/Optimization/Optimization', () => props => <button disabled={props.disabled} onClick={props.handleRunModel}>Optimize setup</button>);
jest.mock('../views/ModelResults/ModelResults', () => props => <div>Saved results: {props.scenario.results.status}</div>);

let context: ScenarioContextValue;
let database: Record<string, any>;
let requests: Array<{body: any; resolve: (response: any) => void; reject: (error: Error) => void}>;

// jsdom lacks the browser crypto API; use Node's equivalent in these tests.
beforeAll(() => Object.defineProperty(window, 'crypto', {value: require('crypto').webcrypto, configurable: true}));

beforeEach(async () => {
  jest.resetAllMocks();
  database = {1: {id: 1, name: 'Startup test', input_revision: 'r1', override_values: {},
    results: {status: 'Optimized', data: {previous: [[123]]}}, optimization: {runtime: 100},
    data_input: {df_parameters: {}, map_data: {}}}};
  requests = [];
  (checkTasks as jest.Mock).mockResolvedValue({json: async () => ({tasks: []})});
  (fetchScenarios as jest.Mock).mockImplementation(async () => ({json: async () => ({data: clone(database)})}));
  (fetchScenario as jest.Mock).mockImplementation(async (_port, id) => ({ok: true, json: async () => clone(database[id])}));
  (runModel as jest.Mock).mockImplementation((_port, body) => new Promise((resolve, reject) => {
    requests.push({body: clone(body), resolve, reject});
  }));
  function Probe() { context = useScenario(); return context.scenarioData ? <Dashboard/> : null; }
  render(<ScenarioProvider navigate={jest.fn()}><Probe/></ScenarioProvider>);
  await waitFor(() => expect(context.scenarios[1]).toBeDefined());
  act(() => context.handleScenarioSelection(1));
  act(() => context.handleSetSection(1));
});

async function acknowledge(index = 0, status = 'Preparing inputs') {
  const {body, resolve} = requests[index];
  database[body.scenario.id] = {...clone(body.scenario), results: {status, data: {}, run_id: body.run_id}};
  await act(async () => resolve({ok: true, json: async () => clone(database[body.scenario.id])}));
}

test('opens preparation immediately, keeps prior results intact, and prevents duplicate clicks', async () => {
  const previous = clone(context.scenarioData.results);
  act(() => { void context.startOptimization(); void context.startOptimization(); });
  expect(requests).toHaveLength(1);
  expect(context.section).toBe(2);
  expect(screen.getByText('Preparing optimization')).toBeVisible();
  expect(screen.queryByText('Scenario sidebar')).not.toBeInTheDocument();
  expect(screen.queryByText(/Saved results:/)).not.toBeInTheDocument();
  expect(screen.getByRole('button', {name: 'Optimize toolbar'})).toBeDisabled();
  expect(context.scenarioData.results).toEqual(previous);
  await acknowledge();
  expect(context.optimizationStart).toBeNull();
  expect(context.backgroundTasks).toEqual([1]);
  expect(context.scenarioData.results.status).toBe('Preparing inputs');
});

test('late acceptance updates only its scenario and does not change selection or section', async () => {
  fireEvent.click(screen.getByText('Optimize setup'));
  act(() => context.handleNewScenario({...clone(database[1]), id: 2, name: 'Another scenario'}));
  act(() => context.handleSetSection(1));
  await acknowledge();
  expect(context.scenarioData.id).toBe(2);
  expect(context.section).toBe(1);
  expect(context.scenarios[1].results.status).toBe('Preparing inputs');
});

test('rejected inputs show a review action and preserve previous results without a save error', async () => {
  const previous = clone(database[1].results);
  fireEvent.click(screen.getByText('Optimize setup'));
  await act(async () => requests[0].resolve({ok: false, status: 422, json: async () => ({detail: {
    message: 'Review scenario inputs.', validation: {error: 'Fill in disposal capacity.'},
  }})}));
  expect(screen.getByText('Fill in disposal capacity.')).toBeVisible();
  expect(context.isStartingOptimization).toBe(false);
  expect(context.saveError).toBeNull();
  expect(context.scenarioData.results).toEqual(previous);
  expect(context.backgroundTasks).toEqual([]);
  fireEvent.click(screen.getByText('Review inputs & settings'));
  expect(screen.getByText('Complete inputs')).toBeVisible();
  expect(context.optimizationStart).toBeNull();
});

test('a lost response reconnects to the accepted run, including a run already completed', async () => {
  fireEvent.click(screen.getByText('Optimize setup'));
  database[1].results = {status: 'Optimized', data: {new: [[456]]}, run_id: requests[0].body.run_id};
  await act(async () => requests[0].reject(new Error('Disconnected')));
  expect(context.optimizationStart).toBeNull();
  expect(context.scenarioData.results.data).toEqual({new: [[456]]});
  expect(context.backgroundTasks).toEqual([]);
  expect(requests).toHaveLength(1);
});

test('a rejected request stays rejected if refreshing inputs fails after review is clicked', async () => {
  let rejectRefresh: (error: Error) => void;
  (fetchScenario as jest.Mock).mockImplementationOnce(() => new Promise((_resolve, reject) => {rejectRefresh = reject;}));
  fireEvent.click(screen.getByText('Optimize setup'));
  await act(async () => requests[0].resolve({ok: false, status: 422, json: async () => ({detail: 'Review inputs.'})}));
  fireEvent.click(screen.getByText('Review inputs & settings'));
  await act(async () => rejectRefresh(new Error('Offline')));
  expect(context.optimizationStart).toBeNull();
  expect(context.isStartingOptimization).toBe(false);
  expect(context.section).toBe(0);
});

test('a duplicate rejected by the server reconnects to the existing active optimization', async () => {
  fireEvent.click(screen.getByText('Optimize setup'));
  database[1].results = {status: 'Solving model', data: {}, run_id: 'another-window'};
  await act(async () => requests[0].resolve({ok: false, status: 409, json: async () => ({detail: 'Wait for optimization to finish.'})}));
  expect(context.optimizationStart).toBeNull();
  expect(context.backgroundTasks).toEqual([1]);
  expect(context.scenarioData.results.run_id).toBe('another-window');
});

test('an uncertain start can be retried with the same identity and cannot start a separate run', async () => {
  fireEvent.click(screen.getByText('Optimize setup'));
  await act(async () => requests[0].reject(new Error('Disconnected')));
  expect(context.optimizationStart.phase).toBe('uncertain');
  act(() => { void context.startOptimization(); });
  expect(requests).toHaveLength(1);
  fireEvent.click(screen.getByText('Retry start request'));
  expect(requests).toHaveLength(2);
  expect(requests[1].body).toEqual(requests[0].body);
  await acknowledge(1);
  expect(context.optimizationStart).toBeNull();
  expect(context.backgroundTasks).toEqual([1]);
});

test('copy-and-run shows preparation during copying and uses the same launch flow', async () => {
  let resolveCopy: (response: any) => void;
  (copyScenario as jest.Mock).mockImplementation(() => new Promise(resolve => {resolveCopy = resolve;}));
  act(() => { void context.copyAndRunOptimization('Copy'); void context.copyAndRunOptimization('Copy'); });
  expect(copyScenario).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Copying scenario')).toBeVisible();
  expect(requests).toHaveLength(0);
  const copied = {...clone(database[1]), id: 2, name: 'Copy'};
  await act(async () => resolveCopy({ok: true, json: async () => ({new_id: 2, scenarios: {...database, 2: copied}})}));
  expect(context.scenarioData.id).toBe(2);
  expect(context.section).toBe(2);
  expect(screen.getByText('Preparing optimization')).toBeVisible();
  expect(requests[0].body.scenario.id).toBe(2);
  await acknowledge();
  expect(context.backgroundTasks).toEqual([2]);
});

test('finishing a copy after navigation does not take the user away from the new scenario', async () => {
  let resolveCopy: (response: any) => void;
  (copyScenario as jest.Mock).mockImplementation(() => new Promise(resolve => {resolveCopy = resolve;}));
  act(() => { void context.copyAndRunOptimization('Copy'); });
  act(() => context.handleNewScenario({...clone(database[1]), id: 3, name: 'Other'}));
  const copied = {...clone(database[1]), id: 2, name: 'Copy'};
  await act(async () => resolveCopy({ok: true, json: async () => ({new_id: 2, scenarios: {...database, 2: copied}})}));
  await acknowledge();
  expect(context.scenarioData.id).toBe(3);
  expect(context.section).toBe(0);
  expect(context.backgroundTasks).toEqual([2]);
});

test('polling recovers after a transient error and publishes results without overwriting another scenario', async () => {
  jest.useFakeTimers();
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    fireEvent.click(screen.getByText('Optimize setup'));
    (fetchScenario as jest.Mock).mockRejectedValueOnce(new Error('Offline'));
    await acknowledge();
    expect(context.backgroundTasks).toEqual([1]);
    act(() => context.handleNewScenario({...clone(database[1]), id: 2, name: 'Other'}));
    database[1].results = {...database[1].results, status: 'Optimized', data: {new: [[789]]}};
    await act(async () => { jest.advanceTimersByTime(2000); });
    expect(context.backgroundTasks).toEqual([]);
    expect(context.scenarios[1].results.data).toEqual({new: [[789]]});
    expect(context.scenarioData.id).toBe(2);
    expect(context.showCompletedOptimization).toBe(true);
  } finally { consoleError.mockRestore(); jest.useRealTimers(); }
});

test('unchanged status polls preserve scenario identity so maps do not reload', async () => {
  jest.useFakeTimers();
  try {
    fireEvent.click(screen.getByText('Optimize setup'));
    await acknowledge();
    const previous = context.scenarioData;
    const calls = (fetchScenario as jest.Mock).mock.calls.length;
    await act(async () => { jest.advanceTimersByTime(2000); });
    expect(fetchScenario).toHaveBeenCalledTimes(calls + 1);
    expect(context.scenarioData).toBe(previous);
    database[1].results.status = 'Solving model';
    await act(async () => { jest.advanceTimersByTime(2000); });
    expect(context.scenarioData.results.status).toBe('Solving model');
    expect(context.scenarioData).not.toBe(previous);
  } finally { jest.useRealTimers(); }
});
