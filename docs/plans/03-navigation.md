# Plan 3: navigation and workflow state

**Status:** Planned. **Dependencies:** [contracts](01-contracts-and-types.md) and
[scenario data ownership](02-scenario-data-and-polling.md). [Roadmap](../roadmap.md).

## Problem and outcome

[App.tsx](../../electron/ui/src/App.tsx) has a generic `/scenario` route, while
[ScenarioContext](../../electron/ui/src/context/ScenarioContext.tsx) combines
numeric sections, `appState`, categories, selected scenario, and optimization
behavior. A URL does not fully describe what the user is viewing.

Use named routes for location, a separate edit state for saving, and a separate
run state for optimization. A solver update may refresh a view; it must not
silently navigate a user who has moved elsewhere.

## Proposed navigation model

Retain the [HashRouter](../../electron/ui/src/index.tsx) for browser and packaged
Electron compatibility. Proposed locations include:

| URL fragment | View |
| --- | --- |
| `#/scenarios` | Scenario list |
| `#/scenarios/:scenarioId/complete` | Complete Scenario Inputs |
| `#/scenarios/:scenarioId/inputs/:table` | A selected input table |
| `#/scenarios/:scenarioId/network` | Network diagram |
| `#/scenarios/:scenarioId/setup` | Optimization settings |
| `#/scenarios/:scenarioId/results` | Latest preparation/progress/results view |

Keep comparison working throughout migration. Add a run-specific result route
when historical runs exist. Selected issue rows or map features can be optional
query parameters; temporary dialog and hover state should stay local.

## PR-sized steps

1. List existing transitions and entry points: scenario open, sidebar, validation
   issue links, Advance, Optimize, Review inputs, results, comparison, and the
   hamburger menu. Specify reload, missing/deleted IDs, invalid table names, and
   unsaved-edit behavior. Define a route-to-view mapping with named views.
2. Introduce scenario-ID routes and a compatibility redirect from `/scenario`.
   If no valid prior selection exists, show the list. Fetch the route's scenario
   without needing a prior list click. Preserve existing input/setup/results
   entry defaults; do not guess readiness from the route.
3. Migrate sidebar, checklist links, and launch/review navigation through shared
   route helpers. Keep Complete Scenario Inputs accessible alongside the network
   diagram. Scope late acknowledgements to their scenario/run without navigation.
4. Move remaining edit/run lifecycle logic out of navigation, remove numeric
   section adapters and duplicated `appState` fields, and update browser tests.

## Acceptance checks

- Direct links and reload open the requested scenario/view in both browser and
  packaged Electron; invalid locations have a clear fallback.
- Back/forward restores the viewed location without relaunching a run or losing
  drafts. Leaving a view follows the documented save/failure recovery policy;
  dirty edits are never discarded merely because a route changes.
- Validation links select the correct table/cell or network feature. Sidebar and
  main content agree on the active view, including Complete Scenario Inputs.
- Optimization progress continues after navigation away. Delayed launch, save,
  or poll responses never change the newly selected scenario.
- Existing readiness/launch regressions pass, and targeted browser tests cover
  reload, back/forward, deleted IDs, and issue-link navigation.

## Migration and scope limits

Use a temporary adapter so individual views can migrate without an all-at-once
router rewrite. Keep old entry links functional until callers move. Routes
describe location; backend validation still decides whether optimization is
allowed. No workflow-state-machine dependency is necessary unless the transition
inventory demonstrates a need beyond small explicit state types.
