# Plan 2: scenario data and polling

**Status:** Planned. **Dependency:** [core contracts](01-contracts-and-types.md).
[Roadmap](../roadmap.md).

## Problem and outcome

[ScenarioContext](../../electron/ui/src/context/ScenarioContext.tsx) retains all
full scenarios, a selected scenario, saved baselines, and drafts. Its two-second
polling loop downloads the active scenario and compares serialized contents.
Unchanged responses already preserve object identity; retain that protection
while reducing the amount of data transferred and retained.

Separate four responsibilities: scenario summaries, cached saved details, local
editing drafts/save queues, and optimization status. A list view should not need
every input table and report in memory.

## PR-sized steps

1. Measure list payload size, selected-scenario size, repeated polling bytes, and
   map/render behavior with small and large collections. Define a repeatable
   workload and record before/after results in the implementation PR.
2. Add a lightweight summaries endpoint. Include list badges, ordering metadata,
   readiness, and latest-run information needed by current consumers. Retain the
   old endpoint during migration. Change list loading to summaries and fetch
   full details only on opening a scenario or selecting it for comparison.
3. Extract per-scenario saved data and edit state from navigation and list state.
   Use a bounded detail cache that retains active/comparison data and never
   evicts unsaved drafts. Document the eviction policy. Preserve the saved
   baseline, queued edits, server revision, and explicit failed-save recovery.
4. Add a small status response keyed by run ID, with phase, input revision,
   terminal outcome, and result version/reference. Poll it while a run is active
   at the current cadence. Fetch full results when a new result is available;
   stop polling when the backend confirms the run is terminal and released.
5. Remove full-collection refreshes and whole-scenario polling from migrated
   callers. Centralize invalidation after save, copy, delete, and completion.
   Retire the old endpoints only after checking every caller.

No additional state library is required initially. Evaluate one only if its
cache/invalidation behavior simplifies the existing save guarantees.

## Acceptance checks

- Listing scenarios does not transfer tables, map geometry, or report payloads,
  and does not issue one detail request per row to calculate badges.
- Repeated polls contain status metadata only. Unchanged status does not replace
  detail objects or reset the map, table selection, or local edits.
- A completed run fetches its result version once during ordinary polling;
  explicit retries and reloads remain possible after network failure.
- Rapid edits, edits during a pending acknowledgement, switching scenarios,
  failed saves, and late responses preserve the current guarantees in
  [scenariosaving](../../electron/ui/src/tests/scenariosaving.test.tsx) and
  [optimizationstart](../../electron/ui/src/tests/optimizationstart.test.tsx).
- Copy/delete, comparison, reload, and terminal-run cleanup behave correctly.
  Cache tests verify observable eviction and retention rules, not library internals.
- Measured payload and retained-data improvements are recorded; no unexplained
  increase in renders or requests occurs in the representative workload.

## Migration and recovery

Deploy additive backend responses before migrating the frontend. The first
version may derive summaries/status from current storage; persistent run records
come in [plan 4](04-backend-services-and-runs.md). This does not require a database
migration or server-push transport. Reverting an endpoint consumer must leave
saved data and unsaved-edit recovery intact. Keep draft state explicitly separate
from a server cache: refetching is not permission to discard user edits.
