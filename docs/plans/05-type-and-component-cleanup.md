# Plan 5: broader typing and component cleanup

**Status:** Planned. **Dependencies:** use the ownership and contracts established
in [plans 1–4](../roadmap.md). Small improvements can accompany those stages.

## Problem and outcome

[types.ts](../../electron/ui/src/types.ts), [util.ts](../../electron/ui/src/util.ts),
[ScenarioContext](../../electron/ui/src/context/ScenarioContext.tsx), and
[ModelResults](../../electron/ui/src/views/ModelResults/ModelResults.tsx)
mix responsibilities or rely on permissive data shapes. Strict mode is disabled
in [tsconfig.json](../../electron/ui/tsconfig.json). Backend import/export code
also has large modules whose responsibilities will be clearer after service
extraction.

Organize code around scenario inputs, validation, network editing, optimization,
and AI settings. Place types and pure helpers near their owners, with shared
contracts reserved for actual cross-feature boundaries.

## PR-sized steps

1. Audit remaining broad types and large components after earlier migrations.
   Prioritize data mutation, result interpretation, table indexing, and API
   boundaries over harmless presentation props. Track the remaining strict-mode
   errors so progress is measurable without a line-count target.
2. Split results into focused progress, outcome/diagnostics, and report/chart
   views. Extract hooks for data access and lifecycle behavior established by
   previous plans. Keep formatting and geometry calculations pure where practical.
3. Replace generic `any` and catch-all properties in each migrated feature with
   domain types, narrowed `unknown`, and reusable table/index/value types. Parse
   numeric inputs deliberately; preserve blank versus zero and display units.
4. Expand the strict type-check scope feature by feature. Resolve nullability,
   event types, and indexed access issues rather than silencing them. Enable
   project-wide `strict` once the remaining callers are migrated; consider
   additional indexing checks separately because dynamic tables need care.
5. Remove unused helpers, duplicate types, compatibility adapters, and legacy
   branches once their callers and stored-data needs are accounted for. Split
   remaining backend Excel/map utilities along the service boundaries from
   [plan 4](04-backend-services-and-runs.md), preserving conversion fixtures.

## Acceptance checks

- Types and component responsibilities have clear owners, with no new dependency
  cycles or central utility module collecting unrelated feature behavior.
- Strict checking expands without blanket assertions, unchecked JSON casts,
  `ts-ignore` fixes, or wider `any` aliases hiding errors.
- Relevant save, readiness, map geometry, diagnostics, AI, and optimization tests
  pass. Add tests for meaningful new boundaries or uncovered behavior; do not
  rewrite assertions merely to match a new component tree.
- Browser acceptance still reaches an optimization report. Component extraction
  preserves input focus, map state, accessible controls, and loading/error states.
- The final typing PR enables the intended compiler settings in normal builds
  and CI. Temporary strict-check configurations/adapters are removed or have a
  documented continuing purpose.

## Migration and scope limits

Move and simplify one feature at a time; keep public component/service interfaces
compatible while callers migrate. Separate behavior fixes from structural moves
so review and rollback stay straightforward. Preserve runtime validation even
with stronger TypeScript: uploaded files and backend responses are external data.

Avoid combining this work with a visual redesign, component-library replacement,
build-tool migration, or broad dependency upgrade. Those changes would make it
harder to determine whether the cleanup preserved the established workflow.
