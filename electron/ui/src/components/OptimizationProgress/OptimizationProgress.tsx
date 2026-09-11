import {Box, LinearProgress, Typography} from '@mui/material';

export default function OptimizationProgress({status = 'Submitting request'}: {status?: string}) {
  const solving = status.toLowerCase() === 'solving model';
  const reporting = status.toLowerCase() === 'generating output';
  return <Box role="status" aria-live="polite" sx={{m: 3, p: 3, bgcolor: 'white', boxShadow: 3, textAlign: 'center'}}>
    <Typography variant="h5" component="h2">
      {solving ? 'Running optimization' : reporting ? 'Preparing results' : 'Preparing optimization'}
    </Typography>
    <Typography sx={{my: 2}}>
      {solving ? 'The solver is finding a plan. This can take several minutes.' :
        reporting ? 'Checking the solution and generating the report.' : 'Preparing the scenario inputs and building the model.'}
    </Typography>
    <LinearProgress aria-label="Optimization progress" sx={{maxWidth: 500, mx: 'auto'}} />
    <Typography sx={{mt: 2}}>Status: <b>{status}</b></Typography>
  </Box>;
}
