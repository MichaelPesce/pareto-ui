import type { ConstraintViolationsSummary } from '../../types';

export default function ConstraintDiagnostics({ summary }: { summary?: ConstraintViolationsSummary }) {
  if (!summary?.status || summary.status === 'unavailable') {
    return <p>No evaluable constraint details are available for this run. This does not mean the model is feasible.</p>;
  }
  return (
    <div style={{ marginBottom: 16 }}>
      <p>
        {summary.count} constraint violations found in {summary.evaluated_count} evaluated constraints.
        {summary.skipped_count > 0 && ` ${summary.skipped_count} constraints could not be evaluated.`}
      </p>
      <p>
        These checks describe the available model values, which may be initial values after a failed solve.
        They are clues for troubleshooting and do not prove the cause of infeasibility.
      </p>
      {summary.violations.length > 0 && (
        <details>
          <summary>View {summary.truncated ? 'largest ' : ''}constraint violations ({summary.violations.length})</summary>
          <ul style={{ overflowWrap: 'anywhere' }}>
            {summary.violations.map(violation => (
              <li key={violation.constraint}>
                <code>{violation.constraint}</code>: {violation.side} bound exceeded by {violation.violation.toPrecision(4)}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
