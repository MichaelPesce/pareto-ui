# Plan 4: backend services and optimization runs

**Status:** Planned. **Dependency:** [core contracts](01-contracts-and-types.md).
Service extraction can accompany plans 2–3. [Roadmap](../roadmap.md).

## Problem and outcome

[scenario_handler.py](../../backend/app/internal/scenario_handler.py) combines
database/filesystem setup, persistence, imports, edits, validation, task tracking,
and AI orchestration. Constructing the module's global handler initializes storage
and can change the process working directory. [scenarios.py](../../backend/app/routers/scenarios.py)
also coordinates locks, snapshots, and optimization execution. Active tasks are
in memory, with the current run's result nested in the scenario.

Create explicit dependencies and smaller services while preserving the working
model adapter and validation modules. Then persist enough run information to
explain history and interruptions independently of the current editor.

## Proposed boundaries

| Boundary | Owns |
| --- | --- |
| HTTP routes and schemas | Request decoding, dependency injection, response/error mapping. |
| Scenario service | Revision checks, ordered edits, rename/copy/delete, validation invalidation. |
| Scenario repository and artifact store | Database operations, locks/atomic writes, workbook/report paths and lifetime. |
| Import/export adapters | Excel, KML, shapefile and canonical input conversion/preservation. |
| Validation service | Input requirements, issue generation, model-build and feasibility evidence. |
| PARETO adapter | Model configuration, compatibility adjustments, build/solve/verification/report calls. |
| Optimization run service | Reservation, immutable input snapshot, idempotent launch, phases, completion, and cleanup. |

Reuse existing `scenario_inputs`, `scenario_validation`, `scenario_fill`,
`network_capacity`, `model_diagnostics`, `model_compatibility`, and `solvers`
modules. AI remains a separate optional capability behind its current availability
and credential boundaries.

## PR-sized steps

1. Create an application factory/startup dependency setup. Inject settings,
   repository, artifact paths, and services. Remove storage initialization and
   working-directory changes from import time. Let tests create isolated apps
   without replacing a module-global handler.
2. Extract repository/artifact operations without changing the persisted format.
   Keep TinyDB initially. Move scenario edits and import/export coordination
   behind services, retaining revision checks and atomic workbook replacement.
3. Extract optimization orchestration and the PARETO adapter. Keep launch work
   under the database lock short: reserve, check inputs/revision, capture the
   snapshot, acknowledge. Workbook I/O and the single model build stay in the
   worker. Preserve cleanup on preparation, solver, and report failures.
4. Add versioned persistent run records: run/scenario IDs, input revision and
   immutable settings/input snapshot reference, phase/outcome, timestamps, error
   stage, and report/diagnostic references. Define atomic reservation and update
   rules. Serve the stage 2 status contract from these records; retain an adapter
   for existing scenario result consumers.
5. On backend startup, reconcile unfinished runs as **interrupted** when no worker
   can own them. Retain their evidence and allow an explicit new attempt. Move
   this responsibility out of the frontend's current reset-to-Draft behavior.
   Expose history and its input/settings provenance through a small follow-up UI.

## Acceptance checks

- Existing scenario and map-to-report API acceptance tests pass through injected
  services. Imports neither touch user storage nor change the working directory.
- Slow preparation does not block status requests or hold the database lock;
  one accepted run builds one model from its captured revision.
- Same-ID retries return the existing attempt; concurrent launches and edits
  retain defined conflict responses. Failed launch does not erase prior results.
- Restart tests reconstruct the app from the same temporary storage and verify
  interrupted status, preserved completed results, and an explicit new run.
  They must not rely on leftover in-memory task state.
- A migration fixture covers legacy scenarios/results, repeated startup, and
  failure partway through migration. Windows file-handle regressions still pass.
- Each displayed historical result identifies its run/input revision. Unknown
  provenance in legacy results is labeled unknown rather than invented.

## Persistence decisions and rollback

Before changing stored data, specify schema versions, backup/restore, atomic
update behavior, retention, and scenario deletion's treatment of run artifacts.
Test these against copies of existing data. Keep an old-format reader and avoid
destructive in-place rewrites until migration and rollback are proven.

A persistent record does not make an in-process background task durable. This
stage detects interruption; it does not resume a solver or promise cancellation.
A process/job queue or database replacement needs a separate concurrency and
deployment assessment. Prefer those changes only when the extracted boundaries
and measured workload justify them.
