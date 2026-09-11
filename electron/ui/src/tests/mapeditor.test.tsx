import { render, screen } from '@testing-library/react';
import MapEditor from '../components/NetworkMap/MapEditor';

const mockNodes = [{name: 'P', nodeType: 'ProductionPad'}, {name: 'N', nodeType: 'NetworkNode'}];
let mockSelected: any;
jest.mock('../context/MapContext', () => ({useMapValues: () => ({
  selectedNode: mockSelected, availableNodes: mockNodes, nodeData: mockNodes, lineData: [],
  networkMapData: {}, creatingNewNode: false, setSelectedNode: jest.fn(),
  saveNodeChanges: jest.fn(), setShowNetworkNode: jest.fn(), setShowNetworkPipeline: jest.fn(),
})}));

test('a blank pipeline dropdown renders and cannot be saved', () => {
  mockSelected = {idx: 0, node: {name: 'Draft pipe', node_type: 'path', nodes: [{name: ''}]}};
  render(<MapEditor />);
  expect(screen.getByRole('button', {name: /^Save$/})).toBeDisabled();
});

test('a one-way segment cannot be toggled into an unsupported direction', () => {
  mockSelected = {idx: 0, node: {name: 'Pipe', node_type: 'path', nodes: [
    {name: 'P', outgoing_nodes: ['N']}, {name: 'N', outgoing_nodes: []},
  ]}};
  render(<MapEditor />);
  expect(screen.getByRole('button', {name: /Cycle flow direction/})).toBeDisabled();
  expect(screen.getByRole('button', {name: /^Save$/})).toBeEnabled();
});

test('zero trucking cost is visible with hourly units', () => {
  mockSelected = {idx: 0, node: {...mockNodes[0], coordinates: [-103,34], TruckingHourlyCost: 0}};
  render(<MapEditor />);
  expect(screen.getByLabelText('Trucking Hourly Cost')).toHaveValue(0);
  expect(screen.getByText('USD/hour')).toBeInTheDocument();
});
