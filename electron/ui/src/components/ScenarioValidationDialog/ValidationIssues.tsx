import React, {useState} from 'react';
import {Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Tooltip, Typography} from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import type {ValidationIssue} from '../../types';

export default function ValidationIssues({issues, onSelect, limit = 12}: {
  issues: ValidationIssue[]; onSelect?: (issue: ValidationIssue) => void; limit?: number;
}) {
  const [helpIssue, setHelpIssue] = useState<ValidationIssue | null>(null);
  return <><Box component="ul" sx={{pl: 2.5, my: 1, textAlign: 'left'}}>
    {issues.slice(0, limit).map((issue, index) => <Box component="li" key={`${issue.code}-${index}`} sx={{mb: 1}}>
      <Box sx={{display: 'flex', alignItems: 'flex-start', gap: 0.5}}>
        <Typography variant="body2" color={issue.severity === 'error' ? 'error.main' : 'text.secondary'}>{issue.message}</Typography>
        {issue.help && <Tooltip title="How to address this issue">
          <IconButton size="small" aria-label={`How to address: ${issue.message}`} onClick={() => setHelpIssue(issue)}>
            <InfoOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>}
      </Box>
      {onSelect && <Button size="small" onClick={() => onSelect(issue)}>
        {issue.table === 'TimePeriods' ? 'Review planning periods' : issue.area === 'map' ? 'Review network' : `Open ${issue.table || 'optimization settings'}`}
        {issue.row?.length ? ` · ${issue.row.join(' / ')}` : ''}{issue.period ? ` · ${issue.period}` : ''}
      </Button>}
    </Box>)}
    {issues.length > limit && <Typography variant="body2">{issues.length - limit} more items in this section. Resolve these and check again.</Typography>}
  </Box>
    <Dialog open={!!helpIssue} onClose={() => setHelpIssue(null)} fullWidth maxWidth="sm" aria-labelledby="issue-help-title">
      <DialogTitle id="issue-help-title">How to address this issue</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{mb: 2}}>{helpIssue?.message}</Typography>
        <Typography>{helpIssue?.help?.rule}</Typography>
        <Box component="ol" sx={{pl: 2.5}}>{helpIssue?.help?.steps.map((step, index) =>
          <Typography component="li" variant="body2" key={index} sx={{mb: 1}}>{step}</Typography>)}</Box>
      </DialogContent>
      <DialogActions><Button onClick={() => setHelpIssue(null)}>Close</Button>
        {onSelect && helpIssue && <Button onClick={() => { onSelect(helpIssue); setHelpIssue(null); }}>Review affected input</Button>}
      </DialogActions>
    </Dialog>
  </>;
}
