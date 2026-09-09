# Network map editing and diagnostics

Map imports support KML/KMZ and zipped shapefiles. Duplicate feature names are
retained with unique suffixes. Repeated line vertices near the same node do not
create self-connections; imported bends and measured segment lengths are retained.

The order of pipeline connections describes the route. Flow can follow either
supported direction, and the editor offers bidirectional flow only when both
node-type combinations are supported. New segments default to forward flow when
available, otherwise the supported reverse direction. Editing a pipeline preserves
the directions and lengths of surviving segments. Changing its connections
recalculates new segment lengths.

Expansion tables preserve entered values by node, technology (where applicable),
and capacity option when the map is saved. Missing values use the existing defaults:

| Expansion | Cost | Lead time |
| --- | --- | --- |
| Storage C0–C3 | 2 USD/bbl | 0, 88, 89, 90 weeks |
| Disposal I0–I3 | 0, 1000, 1000, 1000 USD/(bbl/day) | 0, 45, blank, blank weeks |
| Pipeline D0, D4, D6, D8, D12 | Enter capacity-based costs in the input table | 0, 1, 2, blank, blank weeks |

Blank defaults remain blank; no costs or lead times are invented. Existing zero
values are preserved. Trucking hourly cost uses USD/hour. Beneficial reuse is
optional; scenarios with reuse options require numeric, nonnegative reuse minimums,
costs, and credits, including valid zero values.

Constraint diagnostics are collected before output report generation and retained
if reporting fails. The scan evaluates active constraints, reports skipped checks,
and retains up to 25 of the largest violations. An unavailable scan is distinct
from an evaluated scan with zero violations.

These residuals describe available model values, which may be initial values after
an infeasible solve. They do not identify a proven conflicting set of constraints.
AI diagnosis uses saved scenario settings, bounded input-table samples, and this
qualified evidence to suggest practical checks in the app. AI failures leave the
scenario and its diagnostic evidence available for retry.

AI controls are shown only after the backend confirms a configured API key.
Missing or blank keys, a pending check, and failed checks keep
AI diagnosis, saved AI guidance, and AI input filling hidden. Ordinary optimization
errors and constraint details remain available. The check sends no request to the
AI service and never returns the key to the frontend. Users can configure AI from
the main header's Settings button; see [AI settings](ai-settings.md).

## Regression checks

After activating the development environment, run from the repository root:

```bash
PYTHONPATH=backend python -m unittest discover -s backend/tests
npm --prefix electron/ui test -- --watchAll=false --runInBand
./electron/ui/node_modules/.bin/tsc --noEmit --project electron/ui/tsconfig.json
```

For local integration checks, `map_testing/map_testing.kml` and
`map_testing/map_testing.zip` should import the same 17 nodes and 17 pipelines.
These local fixtures are ignored by Git; automated regression tests generate their
own small fixtures. Use a separate `PARETO_DATA_BASEDIR` and `PARETO_LOG_DIR` for
integration tests that create or edit scenarios.
