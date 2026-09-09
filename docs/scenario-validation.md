# Scenario validation: implementation and verification

For the user walkthrough, see [From map file to optimization](scenario-completion.md).
These notes describe validation evidence, data preservation, and developer checks.

## What the checks establish

| State | Evidence |
| --- | --- |
| Inputs need attention | Missing or invalid applicable data, unknown identifiers, disconnected required routes, or a detected capacity bottleneck. |
| Inputs complete | The versioned input rules pass; this is not proof of feasibility. |
| Model builds | PARETO constructs the selected formulation and accepts fixed decisions. |
| Feasible plan found | The bounded solver check found an incumbent passing the constraint scan with slacks disabled. |
| Infeasible | The solver reports infeasibility with slacks disabled. |
| Not determined | No verified plan within the solver budget, an unavailable solver, or a formulation outside the quick check's scope. This is not proof of infeasibility. |

The quick check has a **20-second solver budget**; model construction and input
conversion take additional time. The installed solver must be available. The
check supports the basic formulation with cost, reuse, or environmental objectives
when required inputs are present. It does not claim support for advanced water
quality, hydraulics, desalination, or subsurface formulations.

For production/pipeline/disposal networks, a directed capacity calculation can
identify bottlenecks even when total disposal capacity is sufficient. It accounts
for existing pipes, eligible expansion, node limits, and operating availability.
Networks with storage, treatment, trucking, external water, or completions use the
full model for feasibility; the static screen does not approximate their temporal
balances. The parent model's sorted-period/storage screening limitations remain.

Optional facilities have conditional input rules. Advanced modes remain available
with additional data checks and model construction; comprehensive guidance and
acceptance cases for those modes remain follow-up work. Start with a verified
basic scenario before enabling them.

## Preservation and compatibility

Saved tables, sets, units, settings, and fixed decisions define the input revision.
Map edits preserve table-owned forecasts, costs, expansion options, trucking values,
and treatment stream classifications by identifier rather than row position.
Explicit facility renames migrate associated inputs. Deleting or reclassifying a
facility removes references that no longer apply. Geometry controls mapped pipe
directions; table-only routes remain available in tables.

Exports use the saved workbook. Validation and optimization use temporary input
snapshots from the same canonical data. Changes invalidate old validation; stale
edits and edits during optimization are rejected. The UI waits for save
confirmation and provides an error/reload action on failure.

An explicit `TimePeriods` sheet preserves the horizon even without completions
pads. Compatibility headers remain in `CompletionsDemand` for the parent reader.
Imported Excel scenarios retain the parent's sparse-forecast convention: blanks
mean zero with a warning. Map forecasts require an explicit value for every
applicable facility and period. Default trucking assumptions in legacy Excel
scenarios are also warnings, preserving the toy workbook's working behavior.

The UI applies a narrow compatibility adjustment to empty-facility expressions
in the installed PARETO model: zero emissions use mass units, and empty sourcing
or completions expressions use volume units. Numerical values are unchanged.
This prevents report conversion errors in small scenarios without optional
facilities; the parent source tree is not modified.

## Verification

From the repository root, with the Python environment activated:

```bash
PYTHONPATH=backend python -m unittest discover -s backend/tests
npm --prefix electron/ui test -- --watchAll=false --runInBand
./electron/ui/node_modules/.bin/tsc --noEmit --project electron/ui/tsconfig.json
```

Backend acceptance tests generate equivalent KML and shapefile fixtures, import
and classify them, set forecasts and periods, validate, solve with CBC, and assert
that a results workbook is available. They cover changed settings, stale validation,
edits during a run, renames, and export preservation. CBC-dependent tests skip
explicitly if the solver is unavailable. Test databases are temporary.

The local `map_testing/strategic_toy_case_study.xlsx` was also checked separately:
it passed readiness and generated 97 result tables from a feasible CBC incumbent
at a 30-second time limit. Small generated cases reached proven optima. A browser
acceptance check covered editing periods, previewing and filling forecasts,
validation, feasibility, optimization, and results with AI unavailable. Use
isolated `PARETO_DATA_BASEDIR` and `PARETO_LOG_DIR` directories for manual checks.

The original model research and future extensions are in
[the assessment](map-to-optimization-assessment.md).
