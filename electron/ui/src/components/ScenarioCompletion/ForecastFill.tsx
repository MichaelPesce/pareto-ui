import React, {useState} from 'react';
import {Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, TextField, Typography} from '@mui/material';
import type {DataFrameLike} from '../../types';

export function fillForecast(table: DataFrameLike, periods: string[], row: string, start: string, end: string, value: number, blanksOnly: boolean) {
  const updated = JSON.parse(JSON.stringify(table));
  const key = Object.keys(table)[0];
  const selected = periods.slice(periods.indexOf(start), periods.indexOf(end) + 1);
  let changed = 0;
  (table[key] || []).forEach((name: string, index: number) => {
    if (row && name !== row) return;
    selected.forEach(period => {
      const before = updated[period]?.[index];
      if (blanksOnly && before !== '' && before !== null && before !== undefined) return;
      if (!updated[period]) updated[period] = table[key].map(() => '');
      if (before !== value) { updated[period][index] = value; changed += 1; }
    });
  });
  return {updated, changed};
}

export default function ForecastFill({table, periods, name, unit, disabled, onSave}: {
  table: DataFrameLike; periods: string[]; name: string; unit: string; disabled: boolean;
  onSave: (table: DataFrameLike) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [row, setRow] = useState('');
  const [start, setStart] = useState(periods[0] || '');
  const [end, setEnd] = useState(periods[periods.length - 1] || '');
  const [value, setValue] = useState('0');
  const [blanksOnly, setBlanksOnly] = useState(true);
  const [preview, setPreview] = useState<ReturnType<typeof fillForecast> | null>(null);
  const [saving, setSaving] = useState(false);
  const valid = value.trim() !== '' && Number.isFinite(Number(value)) && (Number(value) >= 0 || (name === 'ReuseCapacity' && Number(value) === -1))
    && (name !== 'DisposalOperatingCapacity' || Number(value) <= 1) && periods.includes(start) && periods.indexOf(end) >= periods.indexOf(start);
  const rows = table[Object.keys(table)[0]] || [];
  const save = async () => {
    if (!preview) return;
    setSaving(true);
    if (await onSave(preview.updated)) setOpen(false);
    setSaving(false);
  };
  return <>
    <Button disabled={disabled || !rows.length || !periods.length} onClick={() => {setPreview(null); setStart(periods[0]); setEnd(periods[periods.length - 1]); setOpen(true);}}>Fill forecast values</Button>
    <Dialog open={open} onClose={() => !saving && setOpen(false)} maxWidth="sm" fullWidth>
      <DialogTitle>Fill {name}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{mb: 2}}>Enter a constant for the selected rows and periods. Use zero for known inactive periods.</Typography>
        <Box onChange={() => setPreview(null)} sx={{display: 'flex', gap: 2, flexWrap: 'wrap', pt: 1}}>
          <TextField select fullWidth label="Facility" value={row} onChange={e => {setRow(e.target.value); setPreview(null);}}>
            <MenuItem value="">All facilities ({rows.length})</MenuItem>{rows.map(node => <MenuItem key={node} value={node}>{node}</MenuItem>)}
          </TextField>
          <TextField select label="First period" value={start} onChange={e => {setStart(e.target.value); setPreview(null);}} sx={{flex: 1}}>{periods.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}</TextField>
          <TextField select label="Last period" value={end} onChange={e => {setEnd(e.target.value); setPreview(null);}} sx={{flex: 1}}>{periods.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}</TextField>
          <TextField label={`Value (${unit})`} value={value} onChange={e => setValue(e.target.value)} fullWidth />
          <FormControlLabel control={<Checkbox checked={blanksOnly} onChange={e => setBlanksOnly(e.target.checked)}/>} label="Fill blank cells only"/>
        </Box>
        {preview && <Alert severity="info">{preview.changed} cells will change to {value} {unit} for {row || 'all facilities'}, from {start} through {end}. {blanksOnly ? 'Existing values will be preserved.' : 'Existing values in this selection will be replaced.'}</Alert>}
      </DialogContent>
      <DialogActions><Button disabled={saving} onClick={() => setOpen(false)}>Cancel</Button>
        <Button disabled={!valid || saving} onClick={() => setPreview(fillForecast(table, periods, row, start, end, Number(value), blanksOnly))}>Preview changes</Button>
        <Button disabled={!preview?.changed || saving} onClick={save} variant="contained">{saving ? 'Saving…' : 'Apply changes'}</Button></DialogActions>
    </Dialog>
  </>;
}
