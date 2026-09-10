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
For more complex networks, the screen treats storage, treatment, completions and
reuse as unlimited destinations and trucking as unlimited transport, and ignores
additional flowback/external supply. A bottleneck even under these optimistic
assumptions is a blocker; passing does not establish feasibility or account for
inventory/demand balances. Ordinary storage must have an onward route because
final inventory is fixed at zero. Potential evaporation via connected CB-EV
treatment is left to the full model. The parent model's sorted-period/storage
screening limitations remain.

Solution verification uses an absolute tolerance of `1e-6`. Only **linear
equalities with currency units** receive an additional relative tolerance of
`1e-7` against evaluated term magnitudes, accounting for CBC's rounded cost totals
(including equalities whose bound is zero). Physical constraints, inequalities,
nonlinear equations, and variable bounds retain the absolute tolerance. Missing
or inconsistent units never grant a larger allowance. Discrete decisions and
missing values are checked separately. Diagnostic scans without solver
verification also retain the absolute tolerance. This preserves checks on flow
and capacity even when large coefficients cancel, while accommodating rounded
large monetary totals.

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
snapshots from the same canonical data. Input changes refresh deterministic issues
and table highlights while invalidating old model/feasibility evidence. The backend
rejects stale supplied revisions and edits during optimization. The UI disables
optimization while saves are pending or a save has failed. Queued edits are
applied to the latest saved scenario; earlier responses retain newer local edits
and server-generated data. Settings, table edits, and renames use the same queue.
A failed save retains the draft and stops subsequent saves for that scenario
until the user chooses **Reload saved inputs**, which discards unsaved changes.

Section autofill derives eligible missing/invalid numeric cells from the same
requirements, independently of the 250 displayed-issue limit. Preview lists counts
and units by table. Apply checks the input revision and all value bounds before
saving through the canonical workbook/map synchronization path. Valid cells and
structural issues are preserved; malformed or ambiguous table layouts require
manual repair. Model defaults change only when the user explicitly fills them.

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

The [public practice files](../examples/map-to-optimization/README.md) provide a
small manual acceptance case available in a fresh clone. Both map formats and the
completed workbook have been verified through the backend with CBC. Workbook
readers close explicitly on success and failure, before atomic replacement.
Regressions retain references to those readers and check that their file handles
are closed, so garbage collection cannot mask Windows file-lock problems.

The parent dependency is pinned in [requirements.txt](../backend/requirements.txt).
When upgrading it, rerun the backend suite on Linux and Windows, the frontend
save-ordering tests, and both public map examples. A large-cost scenario was also
rechecked: its physical constraints pass, and only monetary accounting residuals
need the relative allowance.

The local `map_testing/strategic_toy_case_study.xlsx` was also checked separately:
it passed readiness and generated 97 result tables from a feasible CBC incumbent
at a 30-second time limit. Small generated cases reached proven optima. A browser
acceptance check covered editing periods, previewing and filling forecasts,
validation, feasibility, optimization, and results with AI unavailable. Use
isolated `PARETO_DATA_BASEDIR` and `PARETO_LOG_DIR` directories for manual checks.

The original model research and future extensions are in
[the assessment](map-to-optimization-assessment.md).
