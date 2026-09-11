# Regression tests

A regression test captures a behavior that must keep working after another
change. For example: fix one invalid table, save it, and assert that the other
invalid tables remain highlighted. If a later refactor clears every highlight,
that test fails without someone having to rediscover the bug manually.

This guide describes the suite at the merge of
[PR #112](https://github.com/project-pareto/pareto-ui/pull/112), commit `2103ee9`
(11 September 2026). See the [roadmap](roadmap.md) for planned improvements and
[validation reference](scenario-validation.md) for the behavior being protected.

## What the PR added

| Layer | Added or updated in PR #112 | What actually runs |
| --- | --- | --- |
| Backend | 11 new test modules containing 66 test methods, plus shared fixtures. | Python functions, temporary files/databases, FastAPI requests, small Pyomo models, and selected real PARETO/CBC solves. Failure cases also use mocks. |
| Frontend | 10 new files containing 50 test cases; two existing test files updated. The resulting full suite has 19 suites / 66 tests. | React components/context in Jest's simulated browser environment, with controlled API responses; geometry/helper tests execute the actual functions. |
| Desktop settings | 4 new Node tests. | AI-settings logic with fake storage, encryption, and backend requests. |
| Browser | The existing six-test Cypress workflow was updated, including a delayed optimization acknowledgement check. | A real browser, running frontend/backend, Excel upload, and solver. |

Frontend counts include expanded `test.each` cases. Python methods can exercise
both map formats or scaled/unscaled models within one method. Passing these
tests does not establish that every uploaded scenario is feasible.

## Backend: rules, preservation, and real optimization

| Tests | Main protection |
| --- | --- |
| [Scenario validation](../backend/tests/test_scenario_validation.py) | Conditional requirements, explicit zero versus missing forecasts, planning-horizon preservation, directed routes and capacity bottlenecks, revision changes, and feasible versus infeasible small CBC cases. |
| [Scenario API](../backend/tests/test_scenario_api.py) | Map import through optimization, workbook/report output, stale revisions and running-edit rejection, persistent issue highlights, autofill, launch snapshots, retries, and preparation failure cleanup. |
| [Map import](../backend/tests/test_map_import.py) / [export](../backend/tests/test_map_export.py) | Duplicate shapefile names, pipe bends/directions, and preservation of forecasts, capacities, trucking, treatment streams, and intended expansion defaults across map edits. |
| [Scenario fill](../backend/tests/test_scenario_fill.py) | Fill all eligible cells, including beyond the displayed issue limit, while preserving valid values and rejecting invalid or structural changes. |
| [Workbook handles](../backend/tests/test_workbook_handles.py) | Close workbook readers before replacement, rename, or deletion, including error paths. Tests retain reader references so garbage collection cannot hide Windows file-lock bugs. |
| [Model diagnostics](../backend/tests/test_model_diagnostics.py) / [solver precision](../backend/tests/test_solver_precision.py) | Do not call missing, fractional-integer, or physically inconsistent values feasible. Preserve CBC flow precision and limit any rounding allowance to the intended currency equations. |
| [Optimization workflow](../backend/tests/test_optimization_workflow.py) | Keep diagnostic evidence when solving/reporting fails; recover from unavailable or malformed AI responses. These solver/AI outcomes are simulated. |
| [AI availability](../backend/tests/test_ai_availability.py) / [configuration](../backend/tests/test_ai_configuration.py) | Hide unavailable features, apply user/environment fallback, retain working settings after failure, and avoid exposing keys. AI clients are mocked; no paid provider calls are needed. |

The [fixtures](../backend/tests/scenario_fixtures.py) generate a small production
pad → network node → disposal network in KML and shapefile ZIP formats. The API
acceptance test imports each, assigns facility types and inputs, sets periods and
forecasts, validates, and actually optimizes with PARETO and CBC. A separate
acceptance test checks feasibility, one model build per run, result tables,
downloadable workbook bytes, and cleanup. These are real integration checks;
they do not click through the map UI.

The early-launch regression intentionally invokes the route with a
`BackgroundTasks` container without executing its worker yet. It asserts that
the acknowledgement precedes workbook writing/model construction and that the
worker holds an immutable snapshot. A separate test blocks preparation and checks
that status requests still respond. This matters because FastAPI's test client
normally waits for background tasks before returning; an ordinary request test
alone would not prove early acknowledgement. These are ordering/concurrency
checks, not a production latency benchmark.

## Frontend: edits and asynchronous behavior

Mocks replace external responses with controllable ones. A test can hold an old
save response, make another edit, then release the response and check that the
new edit survives. This makes otherwise intermittent bugs reproducible.

| Tests | Main protection |
| --- | --- |
| [Scenario saving](../electron/ui/src/tests/scenariosaving.test.tsx) | Ordered rapid edits, server revisions, retained drafts, stopped queues after failure, renames, and switching scenarios while a save is pending. |
| [Optimization start](../electron/ui/src/tests/optimizationstart.test.tsx) | Immediate preparation view, duplicate-click prevention, lost-response retry identity, prior results on rejection, copy-and-run, navigation during pending requests, polling recovery, and unchanged polls preserving scenario identity. |
| [Readiness](../electron/ui/src/tests/scenarioreadiness.test.tsx) / [issue fill](../electron/ui/src/tests/issuefill.test.tsx) | Build success is not proof of feasibility; preview/apply honors current values and revision; errors stay actionable; route help selects the affected feature. |
| [Pipeline](../electron/ui/src/tests/pipeline.test.ts), [geometry](../electron/ui/src/tests/pipelinemapgeometry.test.ts), [map editor](../electron/ui/src/tests/mapeditor.test.tsx) | Supported directed/bidirectional connections, preserved bends/lengths, rejected incomplete edits, and visible units. |
| [Constraint diagnostics](../electron/ui/src/tests/constraintdiagnostics.test.tsx) | An absent scan or unevaluated constraints are not presented as zero violations or proof of feasibility. |
| [AI availability](../electron/ui/src/tests/aiavailability.test.tsx) / [settings](../electron/ui/src/tests/aisettings.test.tsx) | Unavailable AI is not offered; saves, resets, pending dialogs, and environment fallback behave correctly. |

These tests exercise real application code, but no real backend or solver is
started by Jest. They prove UI behavior for the supplied responses; the backend
and browser layers check that the real systems produce and consume those results.

## Desktop and browser checks

The [desktop tests](../electron/tests/ai-settings.test.cjs) verify that remembered
keys cross the persistence boundary encrypted, restore directly into the backend,
and stay out of settings readback. They also cover session-only settings and failed
saves. The test cipher is a reversible fake: this checks data flow, not the
strength of encryption, the actual OS keychain, or a packaged Electron launch.

The [Cypress suite](../electron/ui/cypress/e2e/ScenarioTests.cy.ts) opens the list,
downloads a workbook, uploads it, copies/deletes a scenario, and optimizes to
visible KPIs. It holds the launch response for three seconds and requires
**Preparing optimization** to appear before acknowledgement. The workbook is
the parent's **workshop baseline**, despite the test/download filename saying
`strategic_toy_case_study.xlsx`.

The six browser cases share state and should run as a complete spec. They use a
live backend and modify its scenarios. They do not yet automate the entire
map-upload → Complete Scenario Inputs → optimization browser workflow.

## Run the tests

First follow [Building and running](building.md) to install Python/Node dependencies
and IDAES solver extensions. Activate the Python environment. From the repo root:

```bash
PYTHONPATH=backend python -m unittest discover -s backend/tests
npm --prefix electron/ui test -- --watchAll=false --runInBand
node --test electron/tests/ai-settings.test.cjs
node electron/ui/node_modules/typescript/bin/tsc --noEmit --project electron/ui/tsconfig.json
```

For the Python command in PowerShell:

```powershell
$env:PYTHONPATH = "backend"
python -m unittest discover -s backend/tests
```

These suites need no running app. Backend tests use temporary storage. Solver
tests explicitly skip when CBC is unavailable: **a green run with solver skips
is not full optimization verification**. Use the IDAES CBC build with ASL support.
Type checking is separate from executing tests.

For focused iteration:

```bash
PYTHONPATH=backend python -m unittest discover -s backend/tests -p 'test_scenario_api.py'
npm --prefix electron/ui test -- --watchAll=false --runInBand scenariosaving optimizationstart
```

For Cypress, stop any existing app on ports **3000 / 50011** and start an isolated
backend. Set the storage variables **before startup** so the tests cannot copy or
delete your working scenarios. In a macOS/Linux terminal at the repo root:

```bash
PARETO_TEST_ROOT="$(mktemp -d)"
PARETO_DATA_BASEDIR="$PARETO_TEST_ROOT/data" PARETO_LOG_DIR="$PARETO_TEST_ROOT/log" \
  PYTHONPATH=backend python -m uvicorn app.main:app --host 127.0.0.1 --port 50011
```

PowerShell equivalent:

```powershell
$paretoTestRoot = Join-Path ([IO.Path]::GetTempPath()) ("pareto-ui-tests-" + [guid]::NewGuid())
$env:PARETO_DATA_BASEDIR = Join-Path $paretoTestRoot "data"
$env:PARETO_LOG_DIR = Join-Path $paretoTestRoot "log"
$env:PYTHONPATH = "backend"
python -m uvicorn app.main:app --host 127.0.0.1 --port 50011
```

In a second terminal at the repo root, run `npm --prefix electron/ui start`.
Once both servers are ready, use a third terminal:

```bash
cd electron/ui
npx cypress run --spec cypress/e2e/ScenarioTests.cy.ts
```

The spec needs network access to download the parent workbook. Its intercepts
assume backend port 50011; changing Cypress's `baseUrl` alone is insufficient to
move the backend. Optimization may take several minutes; the results assertion
allows up to 20 minutes. Stop the test servers afterward; use fresh storage for
the next full run.

## CI and remaining gaps

[App Tests](../.github/workflows/main.yml) runs backend, frontend, desktop settings,
and Cypress tests on **Linux and Windows**. Check each step and solver skips,
not just the job name. Cypress screenshots are uploaded for troubleshooting.
There is currently no dedicated `tsc --noEmit` CI step;
[plan 1](plans/01-contracts-and-types.md) adds that explicitly.

Future coverage should include route reload/back/forward, large scenario
collections and payload sizes, backend restart/run history, a complete map
workflow in Cypress, additional model/solver configurations, and packaged desktop
storage. The browser fixture currently follows the parent's `main` branch and
the cases depend on execution order; pinning that fixture and isolating cases
would make failures easier to reproduce. The present tests also do not assess
whether user-entered costs/forecasts are realistic, or prove the cause of an
infeasible model from its initial constraint values.
