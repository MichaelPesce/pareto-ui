import React, {useEffect, useState} from 'react';
import {Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography} from '@mui/material';
import {fillScenarioInputs} from '../../services/app.service';
import type {Scenario, ScenarioFillPreview} from '../../types';

export default function IssueFill({port, scenarioId, revision, section, title, count, disabled, onSaved}: {
  port: number; scenarioId: number; revision: string; section: string; title: string; count: number;
  disabled: boolean; onSaved: (scenario: Scenario) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [preview, setPreview] = useState<ScenarioFillPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { setPreview(null); }, [revision]);
  const validNumber = value.trim() !== '' && Number.isFinite(Number(value));
  const fill = async (apply: boolean) => {
    setBusy(true); setError(null);
    try {
      const response = await fillScenarioInputs(port, scenarioId, {
        section, revision: apply && preview ? preview.revision : revision,
        value: apply && preview ? preview.value : Number(value), apply,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Unable to fill scenario inputs.');
      if (apply) { onSaved(data); setOpen(false); }
      else setPreview(data);
    } catch (error) {
      setPreview(null);
      setError(error instanceof Error ? error.message : 'Unable to fill scenario inputs.');
    } finally { setBusy(false); }
  };
  return <>
    <Button sx={{mt: 1}} disabled={disabled || busy} onClick={() => {
      setValue(''); setPreview(null); setError(null); setOpen(true);
    }}>Autofill flagged cells ({count})</Button>
    <Dialog open={open} onClose={() => !busy && setOpen(false)} fullWidth maxWidth="sm">
      <DialogTitle>Autofill · {title}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{mb: 2}}>
          Enter one value for the missing or invalid numeric cells in this section, including blank cells using model defaults.
          Valid values are preserved. Connections, identifiers and capacity shortfalls need individual review.
        </Typography>
        <TextField autoFocus fullWidth label="Value for flagged cells" type="number" value={value}
          disabled={busy} onChange={event => { setValue(event.target.value); setPreview(null); }}
          helperText="Use each table’s input units. Zero is accepted where allowed; it may not provide usable capacity or a production forecast." />
        {preview && <>
          <Typography sx={{mt: 2}}>{preview.cell_count} cells will change to {preview.value}.</Typography>
          <Typography variant="body2">Review the tables and units before applying the same number to all of them.</Typography>
          <ul>{preview.tables.map(table => <li key={table.name}>
            {table.name}: {table.cell_count} {table.cell_count === 1 ? 'cell' : 'cells'}{table.unit ? ` (${table.unit})` : ''}
          </li>)}</ul>
          <Typography variant="body2">Inputs will be checked again after saving. Other issues may still need attention.</Typography>
        </>}
        {error && <Alert severity="error" sx={{mt: 2}}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
        <Button disabled={disabled || busy || !validNumber} onClick={() => fill(false)}>Preview autofill</Button>
        <Button variant="contained" disabled={disabled || busy || !preview?.cell_count} onClick={() => fill(true)}>
          {busy ? 'Working…' : 'Apply autofill'}
        </Button>
      </DialogActions>
    </Dialog>
  </>;
}
