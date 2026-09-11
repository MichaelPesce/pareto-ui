# Practice map → optimization

A synthetic three-facility network for learning the basic workflow:

```text
P1 (production pad) → N1 (network node) → K1 (disposal site)
```

- [network.kml](network.kml) and [network.zip](network.zip) contain equivalent
  points and pipeline geometry. The ZIP includes both shapefile layers and their
  coordinate-system files. Import either map with default node type **Network Node**.
- [completed-inputs.xlsx](completed-inputs.xlsx) contains the configured inputs.
  Upload it as a separate scenario to compare tables or try optimization directly.
  It contains inputs, not saved optimization results or AI settings.

On GitHub, open a file and choose **Download raw file**. Follow the
[map-to-optimization guide](../../docs/scenario-completion.md) to classify the
map's facilities, set the horizon, fill the tables, and run CBC.

The guide's practice values use two weekly periods, 100 bbl/day production, and
100 bbl/day capacity on each pipe, the network node, and disposal. Disposal costs
1 USD/bbl and each pipe costs 0.01 USD/bbl. These values illustrate a consistent
scenario; they are not engineering estimates. Generated expansion options and
economic assumptions are retained.

With the guide's basic cost settings, expect **1,400 bbl** produced and disposed
over two weeks, **no new capacity**, and total cost **1,428 USD** (1.428 kUSD if
the result is displayed in thousands of dollars).

Both map import paths and the completed workbook were checked through the app's
backend with CBC and Project PARETO 1.2.dev0: feasible check, optimal solve, and
Excel report generation for the map scenarios. The maps use the same geometry as
the public [acceptance-test fixture](../../backend/tests/scenario_fixtures.py).
