import { getAIAvailability, getAISettings, saveAISettings, resetAISettings } from './app.service';

export interface AISettings {
  available: boolean;
  source: 'user' | 'environment' | 'none';
  base_url: string;
  model: string;
  environment_available: boolean;
  can_remember: boolean;
  remembered: boolean;
}

export interface AISettingsInput {
  api_key?: string;
  base_url: string;
  model: string;
  remember: boolean;
}

type SettingsResult = {ok: boolean; settings?: AISettings; error?: string; retryable?: boolean};
declare global {
  interface Window {
    paretoAISettings?: {
      get: () => Promise<SettingsResult>;
      save: (settings: AISettingsInput) => Promise<SettingsResult>;
      reset: () => Promise<SettingsResult>;
    };
  }
}

async function readResponse(response: Response): Promise<AISettings> {
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Unable to update AI settings.');
  return {...data, can_remember: false, remembered: false};
}

export async function updateAISettings(port: number, operation: 'get' | 'save' | 'reset', input?: AISettingsInput): Promise<AISettings> {
  if (window.paretoAISettings) {
    const result = operation === 'save' ? await window.paretoAISettings.save(input) : await window.paretoAISettings[operation]();
    if (!result.ok || !result.settings) throw new Error(result.error || 'Unable to update AI settings.');
    return result.settings;
  }
  const response = operation === 'get' ? await getAISettings(port)
    : operation === 'save' ? await saveAISettings(port, input) : await resetAISettings(port);
  return readResponse(response);
}

export async function checkAIAvailability(port: number, signal: AbortSignal): Promise<boolean> {
  if (window.paretoAISettings) {
    const result = await window.paretoAISettings.get();
    if (!result.ok && result.retryable) throw new Error('AI settings are not ready.');
    return result.ok && result.settings?.available === true;
  }
  const response = await getAIAvailability(port, signal);
  return response.ok && (await response.json()).available === true;
}
