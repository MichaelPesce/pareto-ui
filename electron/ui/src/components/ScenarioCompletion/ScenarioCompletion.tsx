import React, {useEffect, useState} from 'react';
import {Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography} from '@mui/material';
import {useApp} from '../../AppContext';
import {useScenario} from '../../context/ScenarioContext';
import {getScenarioReadiness, savePlanningHorizon} from '../../services/app.service';
import type {Scenario, ScenarioValidation, ValidationIssue} from '../../types';
import ValidationIssues from '../ScenarioValidationDialog/ValidationIssues';
import IssueFill from './IssueFill';

export default function ScenarioCompletion({scenario, disabled, onSelect}: {
  scenario: Scenario; disabled: boolean; onSelect: (issue: ValidationIssue) => void;
}) {
  const {port} = useApp();
  const {acceptSavedScenario, inputFocus} = useScenario();
  const [readiness, setReadiness] = useState<ScenarioValidation | null>(null);
  const [section, setSection] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [periodsOpen, setPeriodsOpen] = useState(false);
  const [periodText, setPeriodText] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (disabled) return;
    const controller = new AbortController();
    setReadiness(null);
    getScenarioReadiness(port, scenario.id, controller.signal).then(async response => {
      if (!response.ok) throw new Error('Unable to check scenario completion.');
      const result = await response.json();
      if (!controller.signal.aborted) { setReadiness(result); setError(null); }
    }).catch(error => { if (error.name !== 'AbortError') setError(error.message); });
    return () => controller.abort();
  }, [port, scenario.id, scenario.input_revision, scenario.data_input, scenario.optimization, disabled]);
  const openPeriods = () => {
    setPeriodText((readiness?.periods || scenario.data_input.df_sets.TimePeriods || []).join('\n'));
    setPeriodsOpen(true);
  };
  useEffect(() => {
    if (inputFocus?.table === 'TimePeriods') openPeriods();
    // Focus follows an explicit issue selection, not every readiness refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputFocus]);
  const selectIssue = (issue: ValidationIssue) => {
    if (issue.table === 'TimePeriods') { openPeriods(); return; }
    onSelect(issue);
  };
  const periods = periodText.split(/[\n,]+/).map(t => t.trim()).filter(Boolean);
  const removed = (readiness?.periods || []).filter(period => !periods.includes(period));
  const selectedSection = readiness?.sections?.find(item => item.id === section);
  const savePeriods = async () => {
    setSaving(true); setError(null);
    try {
      const response = await savePlanningHorizon(port, scenario.id, periods, readiness?.revision);
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Unable to save planning periods.');
      acceptSavedScenario(data);
      setPeriodsOpen(false);
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to save planning periods.'); }
    finally { setSaving(false); }
  };
  return <Box sx={{m: 3, p: 2, border: '1px solid #c5d8e0', borderRadius: 1, bgcolor: 'white', textAlign: 'left'}}>
    <Box sx={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2}}>
      <Typography variant="subtitle1">Complete scenario inputs</Typography>
      <Button onClick={openPeriods} disabled={disabled || saving}>Planning periods ({readiness?.periods?.length ?? scenario.data_input.df_sets.TimePeriods?.length ?? 0})</Button>
    </Box>
    {disabled ? <Typography variant="body2">Save your edits before checking completion.</Typography> : !readiness && !error ? <CircularProgress size={20} /> : null}
    {error && !periodsOpen && <Alert severity="error">{error}</Alert>}
    {readiness && !disabled && <>
      <Typography variant="body2" sx={{mb: 1}}>
        {readiness.error_count ? `${readiness.error_count} input items need attention.` : 'Required inputs are complete. Use Validate Scenario to build the selected model and check feasibility.'}
        {readiness.warning_count ? ` ${readiness.warning_count} assumptions to review.` : ''}
      </Typography>
      <Box sx={{display: 'flex', gap: 1, flexWrap: 'wrap'}}>
        {(readiness.sections || []).map(item => <Chip key={item.id}
          label={`${item.title} · ${item.error_count || item.warning_count || 'complete'}`}
          color={item.error_count ? 'error' : item.warning_count ? 'warning' : 'success'}
          variant={section === item.id ? 'filled' : 'outlined'}
          onClick={() => setSection(section === item.id ? null : item.id)} />)}
      </Box>
      {section && <>
        {!!selectedSection?.fillable_count && readiness.revision && <IssueFill key={`${scenario.id}-${section}`}
          port={port} scenarioId={scenario.id} revision={readiness.revision} section={section}
          title={selectedSection.title} count={selectedSection.fillable_count} disabled={disabled || saving}
          onSaved={acceptSavedScenario} />}
        <ValidationIssues issues={(readiness.issues || []).filter(issue => issue.section === section)} onSelect={selectIssue} />
      </>}
      {readiness.truncated && <Typography variant="caption">Showing the first issues. Completion counts include all checked inputs.</Typography>}
    </>}
    <Dialog open={periodsOpen} onClose={() => !saving && setPeriodsOpen(false)} fullWidth maxWidth="sm">
      <DialogTitle>Planning periods</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{mb: 2}}>Each period represents one {readiness?.units?.['decision period'] || 'week'}. Forecast rates use {readiness?.units?.volume || 'bbl'}/{readiness?.units?.time || 'day'}.</Typography>
        <TextField fullWidth multiline minRows={5} maxRows={10} label="Periods in chronological order" value={periodText}
          onChange={event => setPeriodText(event.target.value)} helperText="Separate names with commas or new lines, for example T01, T02, T03. Values stay with matching period names." />
        <Typography variant="body2" sx={{mt: 1}}>{periods.length} periods. New forecast cells will be blank.</Typography>
        {!!removed.length && <Alert severity="warning" sx={{mt: 1}}>Applying this change removes forecast values for: {removed.join(', ')}.</Alert>}
        {error && <Alert severity="error" sx={{mt: 1}}>{error}</Alert>}
      </DialogContent>
      <DialogActions><Button disabled={saving} onClick={() => setPeriodsOpen(false)}>Cancel</Button>
        <Button disabled={saving || !periods.length || new Set(periods).size !== periods.length} variant="contained" onClick={savePeriods}>{saving ? 'Saving…' : 'Apply planning periods'}</Button></DialogActions>
    </Dialog>
  </Box>;
}
