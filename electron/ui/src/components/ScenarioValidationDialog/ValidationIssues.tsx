import React from 'react';
import {Box, Button, Typography} from '@mui/material';
import type {ValidationIssue} from '../../types';

export default function ValidationIssues({issues, onSelect, limit = 12}: {
  issues: ValidationIssue[]; onSelect?: (issue: ValidationIssue) => void; limit?: number;
}) {
  return <Box component="ul" sx={{pl: 2.5, my: 1, textAlign: 'left'}}>
    {issues.slice(0, limit).map((issue, index) => <Box component="li" key={`${issue.code}-${index}`} sx={{mb: 1}}>
      <Typography variant="body2" color={issue.severity === 'error' ? 'error.main' : 'text.secondary'}>{issue.message}</Typography>
      {onSelect && <Button size="small" onClick={() => onSelect(issue)}>
        {issue.table === 'TimePeriods' ? 'Review planning periods' : issue.area === 'map' ? 'Review network' : `Open ${issue.table || 'optimization settings'}`}
        {issue.row?.length ? ` · ${issue.row.join(' / ')}` : ''}{issue.period ? ` · ${issue.period}` : ''}
      </Button>}
    </Box>)}
    {issues.length > limit && <Typography variant="body2">{issues.length - limit} more items in this section. Resolve these and check again.</Typography>}
  </Box>;
}
