import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AISettingsDialog from '../components/AISettingsDialog/AISettingsDialog';
import { AIPromptProvider, useAIPrompt } from '../context/AIPromptContext';
import { getAIAvailability, getAISettings, saveAISettings, resetAISettings } from '../services/app.service';

jest.mock('../AppContext', () => ({useApp: () => ({port: 50011})}));
jest.mock('../services/app.service', () => ({
  getAIAvailability: jest.fn(), getAISettings: jest.fn(), saveAISettings: jest.fn(), resetAISettings: jest.fn(),
}));

const defaults = {available: false, source: 'none', base_url: 'https://provider.example/v1', model: 'default-model', environment_available: false};
const response = (data: unknown, ok = true) => ({ok, json: async () => data} as Response);
const mockedGet = getAISettings as jest.MockedFunction<typeof getAISettings>;
const mockedSave = saveAISettings as jest.MockedFunction<typeof saveAISettings>;
const mockedReset = resetAISettings as jest.MockedFunction<typeof resetAISettings>;

function Availability() {
  const {isAvailable} = useAIPrompt();
  return <output>{isAvailable ? 'AI actions visible' : 'AI actions hidden'}</output>;
}

function showSettings() {
  return render(<AIPromptProvider><Availability /><AISettingsDialog onClose={jest.fn()} /></AIPromptProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  delete window.paretoAISettings;
  (getAIAvailability as jest.Mock).mockResolvedValue(response({available: false}));
  mockedGet.mockResolvedValue(response(defaults));
});

test('saving and removing a user key updates AI availability immediately', async () => {
  mockedSave.mockResolvedValue(response({...defaults, source: 'user', available: true}));
  mockedReset.mockResolvedValue(response(defaults));
  showSettings();
  await screen.findByText('AI is not configured. AI actions are hidden.');
  expect(screen.getByLabelText('Remember on this device')).toBeDisabled();
  fireEvent.change(screen.getByLabelText('API key'), {target: {value: 'fixture-secret'}});
  fireEvent.click(screen.getByRole('button', {name: 'Save settings'}));
  await screen.findByText('AI actions visible');
  expect(mockedSave).toHaveBeenCalledWith(50011, {api_key: 'fixture-secret', base_url: defaults.base_url, model: defaults.model, remember: false});
  expect(screen.getByLabelText('API key')).toHaveValue('');
  fireEvent.click(screen.getByRole('button', {name: 'Remove user settings'}));
  await screen.findByText('User settings removed. AI features are hidden.');
  expect(screen.getByText('AI actions hidden')).toBeInTheDocument();
});

test('the dialog can be closed while the backend settings request is pending', () => {
  mockedGet.mockReturnValue(new Promise(() => {}));
  showSettings();
  expect(screen.getByRole('button', {name: 'Close'})).toBeEnabled();
});

test('environment keys are never populated into the form and a failed save leaves them active', async () => {
  mockedGet.mockResolvedValue(response({...defaults, available: true, source: 'environment', environment_available: true}));
  mockedSave.mockResolvedValue(response({detail: 'Enter a valid API base URL.'}, false));
  showSettings();
  await screen.findByText('Currently using environment settings.');
  expect(screen.getByLabelText('API key')).toHaveValue('');
  expect(screen.getByRole('button', {name: 'Save settings'})).toBeDisabled();
  fireEvent.change(screen.getByLabelText('API key'), {target: {value: 'fixture-secret'}});
  fireEvent.click(screen.getByRole('button', {name: 'Save settings'}));
  await screen.findByText('Enter a valid API base URL.');
  expect(screen.getByText('AI actions visible')).toBeInTheDocument();
});

test('desktop settings use the protected storage bridge and blank keys require re-entry on endpoint changes', async () => {
  const settings = {...defaults, source: 'user' as const, available: true, can_remember: true, remembered: true};
  const save = jest.fn().mockResolvedValue({ok: true, settings});
  window.paretoAISettings = {get: jest.fn().mockResolvedValue({ok: true, settings}), save, reset: jest.fn()};
  showSettings();
  await screen.findByText('Currently using your AI settings.');
  expect(screen.getByLabelText('Remember on this device')).toBeChecked();
  expect(screen.getByLabelText('API key')).toHaveValue('');
  fireEvent.change(screen.getByLabelText('API base URL'), {target: {value: 'https://different.example/v1'}});
  expect(screen.getByRole('button', {name: 'Save settings'})).toBeDisabled();
  fireEvent.change(screen.getByLabelText('API key'), {target: {value: 'replacement-secret'}});
  fireEvent.click(screen.getByRole('button', {name: 'Save settings'}));
  await waitFor(() => expect(save).toHaveBeenCalledWith({api_key: 'replacement-secret', base_url: 'https://different.example/v1', model: defaults.model, remember: true}));
  await screen.findByText('AI settings saved on this device.');
  expect(mockedSave).not.toHaveBeenCalled();
});
