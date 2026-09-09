import { useEffect, useState } from 'react';
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, LinearProgress, Stack, TextField, Typography } from '@mui/material';
import { useApp } from '../../AppContext';
import { useAIPrompt } from '../../context/AIPromptContext';
import { AISettings, updateAISettings } from '../../services/ai-settings.service';

export default function AISettingsDialog({onClose}: {onClose: () => void}) {
  const {port} = useApp();
  const {setAvailability} = useAIPrompt();
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const apply = (next: AISettings) => {
    setSettings(next);
    setAvailability(next.available);
    setBaseUrl(next.base_url);
    setModel(next.model);
    setRemember(next.source === 'user' ? next.remembered : next.can_remember);
    setApiKey('');
  };

  useEffect(() => {
    let cancelled = false;
    updateAISettings(port, 'get').then(next => { if (!cancelled) apply(next); })
      .catch(() => { if (!cancelled) setError('Unable to load AI settings. Try closing and reopening Settings.'); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
    // Settings are loaded when this dialog opens; edits remain local until saved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [port]);

  const save = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      const next = await updateAISettings(port, 'save', {api_key: apiKey, base_url: baseUrl, model, remember});
      apply(next);
      setMessage(next.remembered ? 'AI settings saved on this device.' : 'AI settings applied for this session.');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to save AI settings.');
    } finally { setBusy(false); }
  };

  const reset = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      const next = await updateAISettings(port, 'reset');
      apply(next);
      setMessage(next.available ? 'User settings removed. Using environment settings.' : 'User settings removed. AI features are hidden.');
    } catch { setError('Unable to remove AI settings. Please try again.'); }
    finally { setBusy(false); }
  };

  const keyRequired = settings?.source !== 'user' || baseUrl.trim().replace(/\/+$/, '') !== settings.base_url;
  return <Dialog open onClose={busy && settings !== null ? undefined : onClose} fullWidth maxWidth="sm" aria-labelledby="ai-settings-title">
    <DialogTitle id="ai-settings-title">Settings · AI connection</DialogTitle>
    <DialogContent>
      <Stack spacing={2} sx={{pt: 1}}>
        <Typography variant="body2">AI is optional. Configure an API key, an API base URL, and a model that supports the OpenAI-compatible chat completions API. These settings apply to all scenarios.</Typography>
        {busy && <LinearProgress />}
        {error && <Alert severity="error">{error}</Alert>}
        {message && <Alert severity="success">{message}</Alert>}
        {settings && <Typography variant="body2" color="text.secondary">
          {settings.source === 'environment' ? 'Currently using environment settings.'
            : settings.source === 'user' ? 'Currently using your AI settings.' : 'AI is not configured. AI actions are hidden.'}
        </Typography>}
        <TextField label="API base URL" value={baseUrl} onChange={event => setBaseUrl(event.target.value)} disabled={busy}
          helperText="Use the base URL from your provider, including /v1 if required." />
        <TextField label="Model" value={model} onChange={event => setModel(event.target.value)} disabled={busy}
          helperText="Enter the exact model identifier provided by your AI service." />
        <TextField label="API key" type="password" autoComplete="off" value={apiKey} onChange={event => setApiKey(event.target.value)} disabled={busy}
          helperText={keyRequired ? 'Enter a key for this endpoint.' : 'Leave blank to keep your current key.'} />
        <FormControlLabel control={<Checkbox checked={remember} onChange={event => setRemember(event.target.checked)} disabled={busy || !settings?.can_remember} />}
          label="Remember on this device" />
        <Typography variant="caption" color="text.secondary">
          {settings?.can_remember ? 'Remembered keys are protected by your operating system. Keys are never included in scenario exports.'
            : 'Settings are available for this session. Remembering keys requires protected storage in the desktop app.'}
        </Typography>
        <Typography variant="caption" color="text.secondary">Using AI features sends scenario information to the configured provider. Saving settings does not send an AI request.</Typography>
      </Stack>
    </DialogContent>
    <DialogActions sx={{px: 3, pb: 2}}>
      <Button onClick={reset} disabled={busy || (settings !== null && settings.source !== 'user')} sx={{mr: 'auto'}}>Remove user settings</Button>
      <Button onClick={onClose} disabled={busy && settings !== null}>Close</Button>
      <Button variant="contained" onClick={save} disabled={busy || !baseUrl.trim() || !model.trim() || (keyRequired && !apiKey.trim())}>Save settings</Button>
    </DialogActions>
  </Dialog>;
}
