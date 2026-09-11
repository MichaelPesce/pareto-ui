# Plan 1: core types and API contracts

**Status:** Planned. **Dependency:** none. [Roadmap](../roadmap.md).

## Problem and outcome

[types.ts](../../electron/ui/src/types.ts) permits broad `any` values, including
navigation and scenario data. [app.service.ts](../../electron/ui/src/services/app.service.ts)
returns raw fetch responses; callers interpret status codes and differing payload
shapes themselves. [ScenarioContext](../../electron/ui/src/context/ScenarioContext.tsx)
also recognizes several legacy status strings.

Create explicit contracts at these boundaries before changing storage or UI
ownership. Keep dynamic PARETO tables representable without claiming every
imported cell has already been validated.

## Proposed contracts

| Contract | Responsibility |
| --- | --- |
| `ScenarioId`, `InputRevision`, `RunId` | Distinguish scenario identity, saved input version, and one optimization attempt. Use nonnegative integer scenario IDs at the API boundary, including valid ID `0`; parse URL text once. |
| `ScenarioSummary` / `ScenarioDetail` | Separate list metadata from tables, map data, settings, and detailed results. Define summary fields from actual list/comparison consumers. |
| `ValidationResult` | Input revision, deterministic issues, model-build evidence, and feasibility outcome. Preserve “not determined” as distinct from infeasible. |
| `RunStatus` | Run/scenario IDs, input revision, phase, terminal outcome, timestamps, result version/reference, and structured failure information. Keep phase separate from user-facing labels and navigation. |
| `ApiError` | Stable code, readable message, optional validation details and conflict information; normalize existing string/object error responses. |

Use `unknown` at untrusted import/JSON boundaries, then narrow or validate it.
Use opaque/branded ID types where needed to prevent mixing identities in code.
Describe table cells, indices, columns, and metadata with reusable types. Preserve
missing versus empty versus explicit zero and legacy settings representations at
the normalization boundary. Share authoritative backend request/response schemas
through generated client types if a small prototype is maintainable; otherwise
use explicit mirrored types with contract tests. Decide this in the first PR.

## PR-sized steps

1. Inventory the endpoints used by scenario loading, saving, validation, launch,
   polling, results, and AI availability. Record success/error examples from
   existing fixtures, including legacy status and settings shapes. Agree on the
   contracts above and which layer owns normalization.
2. Add backend schemas and compatibility adapters around existing routes in
   [scenarios.py](../../backend/app/routers/scenarios.py). Introduce a typed
   frontend request helper that returns decoded data or a normalized error.
   Migrate scenario retrieval and one edit operation first; keep old callers
   working until migrated.
3. Migrate validation, launch/retry, status, and result consumers. Narrow the
   central scenario state types and remove obsolete status spellings inside
   the app after mapping them at the boundary.
4. Add a dedicated CI type-check command. Enforce strict checking in the migrated
   core and expand its scope deliberately; do not enable strict mode for the
   entire app and suppress the resulting errors with casts or `any`.

## Acceptance checks

- Existing stored scenarios and Excel imports still load without a manual data
  migration; ID `0`, legacy settings, and legacy results have explicit cases.
- API decoding handles malformed data and both validation and revision-conflict
  errors without losing useful recovery information.
- Compile-time checks reject invalid run phases and ID misuse in migrated code;
  no untyped response escapes the new client into those consumers.
- Save-ordering, delayed launch/retry, stale validation, and AI availability
  regressions still pass. Add contract tests for compatibility and malformed
  payloads, rather than duplicating every existing request test.
- Type checking is an explicit CI step, alongside relevant regression suites.

## Migration and scope limits

This stage changes representations and boundaries, not solver defaults, polling
cadence, routes, persistence format, or launch behavior. Keep adapters until all
callers have moved; each PR should be revertible without modifying user data.
Avoid publishing a large speculative schema for every PARETO table. Define the
validated core first and retain typed generic structures for optional tables.
