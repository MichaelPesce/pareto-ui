import { render, screen } from '@testing-library/react';
import ConstraintDiagnostics from '../views/ModelResults/ConstraintDiagnostics';

test('absent evidence is not displayed as zero violations', () => {
  render(<ConstraintDiagnostics />);
  expect(screen.getByText(/No evaluable constraint details/)).toBeInTheDocument();
  expect(screen.queryByText(/0 constraint violations/)).not.toBeInTheDocument();
});

test('partial scans show missing evidence and the limits of their interpretation', () => {
  render(<ConstraintDiagnostics summary={{status: 'partial', count: 3, tolerance: 1e-6,
    evaluated_count: 10, skipped_count: 2, truncated: true, violations: [
      {constraint: 'Capacity[N1]', violation: 5, side: 'upper', lower_bound: null, body_value: 15, upper_bound: 10},
    ]}} />);
  expect(screen.getByText(/2 constraints could not be evaluated/)).toBeInTheDocument();
  expect(screen.getByText(/do not prove the cause/)).toBeInTheDocument();
  expect(screen.getByText('Capacity[N1]')).toBeInTheDocument();
});
