import {act, render, waitFor} from '@testing-library/react';
import {ScenarioProvider, useScenario, ScenarioContextValue} from '../context/ScenarioContext';
import {checkTasks, fetchScenarios, updateExcel, updateScenario} from '../services/app.service';
import {copyScenario} from '../scenarioEdits';

jest.mock('../AppContext', () => ({useApp: () => ({port: 50011})}));
jest.mock('../services/app.service');

let context: ScenarioContextValue;
let initial: any;
let pending: Array<{sent: any; resolve: (response: any) => void}>;

beforeEach(async () => {
  jest.resetAllMocks();
  initial = {id: 1, name: 'Saving test', results: {status: 'Draft'}, input_revision: 'r0',
    optimization: {runtime: 900, optimalityGap: 0},
    data_input: {df_parameters: {PadRates: {ProductionPads: ['P1'], T01: [100]}}}};
  pending = [];
  (checkTasks as jest.Mock).mockResolvedValue({json: async () => ({tasks: []})});
  (fetchScenarios as jest.Mock).mockImplementation(async () => ({json: async () => ({data: {1: copyScenario(initial)}})}));
  (updateScenario as jest.Mock).mockImplementation((_port, body) => new Promise(resolve => {
    pending.push({sent: copyScenario(body.updatedScenario), resolve});
  }));
  function Probe() { context = useScenario(); return null; }
  render(<ScenarioProvider navigate={jest.fn()}><Probe/></ScenarioProvider>);
  await waitFor(() => expect(context.scenarios[1]).toBeDefined());
  act(() => context.handleScenarioSelection(1));
});

function edit(field: string, value: number) {
  act(() => {
    const snapshot = copyScenario(context.scenarioData);
    snapshot.optimization[field] = value;
    void context.handleScenarioUpdate(snapshot);
  });
}

async function acknowledge(index: number, additions = {}) {
  await act(async () => pending[index].resolve({ok: true, json: async () => ({data: {
    ...pending[index].sent, ...additions, input_revision: `r${index + 1}`,
  }})}));
}

test('three rapid settings edits survive older acknowledgements and retain server normalization', async () => {
  edit('runtime', 100);
  await waitFor(() => expect(pending).toHaveLength(1));
  edit('optimalityGap', 1);
  const normalized = {df_parameters: {...initial.data_input.df_parameters, NodeCapacities: {NetworkNodes: ['N1'], VALUE: [500]}}};
  await acknowledge(0, {data_input: normalized});
  await waitFor(() => expect(pending).toHaveLength(2));
  expect(context.scenarioData.optimization.optimalityGap).toBe(1);
  expect(pending[1].sent.data_input).toEqual(normalized);
  expect(pending[1].sent.input_revision).toBe('r1');
  edit('runtime', 200);
  await acknowledge(1);
  await waitFor(() => expect(pending).toHaveLength(3));
  expect(pending[2].sent.optimization).toEqual({runtime: 200, optimalityGap: 1});
  expect(pending[2].sent.input_revision).toBe('r2');
  await acknowledge(2);
  expect(context.scenarioData.optimization).toEqual({runtime: 200, optimalityGap: 1});
  expect(context.scenarioData.data_input).toEqual(normalized);
  expect(context.isSaving).toBe(false);
});

test('queued settings retain a preceding table edit and its server-generated map data', async () => {
  let resolveTable: (response: any) => void;
  (updateExcel as jest.Mock).mockImplementation(() => new Promise(resolve => { resolveTable = resolve; }));
  const table = {ProductionPads: ['P1'], T01: [250]};
  act(() => { void context.handleUpdateExcel(1, 'PadRates', table); });
  await waitFor(() => expect(updateExcel).toHaveBeenCalledTimes(1));
  edit('runtime', 120);
  const updated = {...copyScenario(initial), input_revision: 'table-revision', data_input: {
    df_parameters: {PadRates: table}, map_data: {all_nodes: {P1: {node_type: 'ProductionPad'}}},
  }};
  await act(async () => resolveTable({ok: true, json: async () => updated}));
  await waitFor(() => expect(pending).toHaveLength(1));
  expect(pending[0].sent.input_revision).toBe('table-revision');
  expect(pending[0].sent.data_input).toEqual(updated.data_input);
  await acknowledge(0);
  expect(context.scenarioData.data_input.df_parameters.PadRates).toEqual(table);
});

test('failed saves stop later requests and retain the draft until an explicit reload', async () => {
  edit('runtime', 100);
  await waitFor(() => expect(pending).toHaveLength(1));
  edit('optimalityGap', 1);
  await act(async () => pending[0].resolve({ok: false, json: async () => ({detail: 'Inputs changed. Refresh first.'})}));
  await waitFor(() => expect(context.isSaving).toBe(false));
  expect(pending).toHaveLength(1);
  expect(context.saveError).toMatch(/previous save failed/i);
  expect(context.scenarioData.optimization).toEqual({runtime: 100, optimalityGap: 1});
  act(() => context.syncScenarioData());
  await waitFor(() => expect(context.saveError).toBeNull());
  expect(context.scenarioData.optimization).toEqual(initial.optimization);
  edit('runtime', 200);
  await waitFor(() => expect(pending).toHaveLength(2));
  expect(pending[1].sent.input_revision).toBe('r0');
  await acknowledge(1);
});

test('a form mutating its prop cannot mutate the saved baseline', async () => {
  act(() => {
    context.scenarioData.optimization.runtime = 120;
    void context.handleScenarioUpdate({...context.scenarioData});
  });
  await waitFor(() => expect(pending).toHaveLength(1));
  expect(pending[0].sent.optimization.runtime).toBe(120);
  await acknowledge(0);
});

test('renaming during a settings save preserves the queued setting', async () => {
  edit('runtime', 100);
  await waitFor(() => expect(pending).toHaveLength(1));
  act(() => context.handleEditScenarioName('Renamed scenario', 1, true));
  await acknowledge(0);
  await waitFor(() => expect(pending).toHaveLength(2));
  expect(context.scenarioData.name).toBe('Renamed scenario');
  expect(pending[1].sent.optimization.runtime).toBe(100);
  await acknowledge(1);
  expect(context.scenarioData.name).toBe('Renamed scenario');
});

test('saving one scenario cannot replace another selected scenario', async () => {
  edit('runtime', 100);
  await waitFor(() => expect(pending).toHaveLength(1));
  const second = {...copyScenario(initial), id: 2, name: 'Second scenario'};
  act(() => context.handleNewScenario(second));
  edit('runtime', 300);
  await acknowledge(0);
  await waitFor(() => expect(pending).toHaveLength(2));
  expect(context.scenarioData.id).toBe(2);
  expect(context.scenarioData.optimization.runtime).toBe(300);
  expect(pending[1].sent.id).toBe(2);
  await acknowledge(1);
  act(() => context.handleScenarioSelection(1));
  expect(context.scenarioData.optimization.runtime).toBe(100);
});
