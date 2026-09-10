# From map file to optimization

A map supplies locations and connections; you add roles, forecasts, capacities, and
costs. Start with **production pad → network node → disposal site**. Other facility
types are optional. **No AI API key is required.**

**Try it first:** the repository includes the same small network as a
[KML](../examples/map-to-optimization/network.kml) and a
[shapefile ZIP](../examples/map-to-optimization/network.zip), plus
[completed Excel inputs](../examples/map-to-optimization/completed-inputs.xlsx)
for comparison. On GitHub, use **Download raw file** to download each file.
Follow the steps below using the practice values in step 3, or upload the completed
workbook as a separate scenario and go to step 5. See the
[example notes](../examples/map-to-optimization/README.md) for expected results.

## 1. Prepare and import your map

Have PARETO UI and **CBC (Free)** available. For a source installation, follow
[setup instructions](building.md).

- **KML/KMZ:** include facility points and pipeline lines.
- **Shapefile:** upload a ZIP containing the `.shp`, `.shx`, `.dbf`, and `.prj`
  files for each point/line layer, plus `.cpg` if supplied. Keep matching filenames
  together; `.prj` supplies the coordinate system.
- Use recognizable, unique facility names; shapefiles use the `Name` attribute.
  Check connections after import—crossing lines alone do not establish a junction.

Choose **Create New Scenario**, enter a name, select the file, and click
**Create Scenario**. Keep **Default Node Type For This Map** as **Network Node**
unless another type fits your points.

## 2. Classify facilities and check routes

Open **Data Input → Network Diagram**. Select each facility, set its actual type,
and save. Names such as `PP01` or `K01` do not assign types automatically.

Assign the three roles above. Check each pipeline's connections, direction,
diameter, and length. Every producing pad needs a directed route to a destination
with available capacity; disconnected capacity cannot receive water.
For the practice map, assign **P1 = Production Pad**, **N1 = Network Node**, and
**K1 = Disposal Site**. Set the line diameter to **D4**, save, and check the
connections run **P1 → N1 → K1**.
Storage is an intermediate stop: the installed model requires it to end empty.
Provide an onward route to disposal, completions demand, or beneficial reuse.
Simply connecting an otherwise isolated branch to storage does not make it usable.

The current model requires some positive production or flowback during the horizon.

## 3. Choose periods and enter the basic inputs

Open **Data Input → Complete Scenario Inputs → Planning periods** from the sidebar. Keep the existing horizon or
use ordered names such as `T01, T02`. Matching names retain their forecast values;
new periods are blank, and removing or renaming periods removes the old values.

Enter plain numbers in the displayed units. Default periods are **weeks**, but
forecasts and flow capacities are **bbl/day**: 100 bbl/day means 700 bbl per week.
Storage inventory and capacity are volumes.

The **Complete Scenario Inputs** sidebar item sits between **PARETO Input File**
(or **Input Summary**) and **Network Diagram**, and remains available in network view.
Its issue links open the affected map feature or table; the checklist has its own
page so it does not take space above tables.
Use the **info icon** beside a network issue for its rule and repair steps.
Enter or review these inputs; the template supplies some defaults:

| Input table | What to enter or review |
| --- | --- |
| `PadRates` | Production for every production pad and period. Enter **0** for known inactive periods; blanks mean unfinished input. |
| `InitialPipelineCapacity` | Existing capacity for every enabled pipe. Review the diameter-derived value; edit if needed. |
| `InitialDisposalCapacity` | Existing capacity for each disposal site. |
| `DisposalOperatingCapacity` | Available fraction by site/period, from 0 to 1. Blank defaults to 1 (100%); review that assumption. |
| `NodeCapacities` | Network-node throughput limits. Blank or 0 means unrestricted. |
| `DisposalOperationalCost`, `PipelineOperationalCost` | Disposal and transport costs in the displayed units. Review fallback costs flagged by validation. |
| `PipelineExpansionDistance`, `PipelineCapexDistanceBased`, `Economics` | Pipe lengths, distance-based construction cost, discount rate, and CAPEX lifetime. Review the supplied values. |
| Capacity/expansion option tables | Keep supplied pipeline/disposal size options, increments, and costs, including zero-size options. Emptying these tables can prevent model construction. |

Use **Fill forecast values → Preview changes → Apply changes** to fill selected
facilities/periods with a constant. It fills blanks by default. Save other edits
and wait for saving to finish before validating.

For a completion section such as **Costs and assumptions**, choose **Autofill
flagged cells**, enter a value, then **Preview autofill**. Review the affected
tables, cell counts, and units before **Apply autofill**. This fills missing or
invalid numeric cells, including blanks using defaults, and preserves valid values.
Use individual tables when different values are needed. Network connections and
capacity shortfalls still require review. After saving, resolved table highlights
clear automatically; remaining issues stay highlighted.

**Practice values for the supplied map:**

| Setting / table | Value |
| --- | --- |
| Planning periods | `T01, T02`; keep the default weekly periods and daily rate units. |
| `PadRates` | P1 = **100 bbl/day** in both periods. |
| `InitialPipelineCapacity` | P1 → N1 and N1 → K1 = **100 bbl/day** each. Set these after choosing D4; diameter supplies an initial suggestion. |
| `NodeCapacities` | N1 = **100 bbl/day**. |
| `InitialDisposalCapacity` | K1 = **100 bbl/day**. |
| `DisposalOperatingCapacity` | K1 = **1** in both periods (100% available). |
| `DisposalOperationalCost` | K1 = **1 USD/bbl**. |
| `PipelineOperationalCost` | Both enabled pipes = **0.01 USD/bbl** each. |

Retain generated distances, economics, and expansion options; leave other facility
types absent. These are synthetic practice values, not estimates for a real site.
For your own map, use measured or planned forecasts and infrastructure limits.
Where branches merge, size the shared route for their **combined** flow in each
period. Check disposal capacity after multiplying by its available fraction.
Do not lower a real forecast just to make it fit a bottleneck; review capacity,
eligible construction, or another destination.

## 4. Add inputs only for features you use

| Feature | Additional data to provide or review |
| --- | --- |
| Completions pads | `CompletionsDemand` and `FlowbackRates` for every period, delivery/flowback routes, storage/outside-system flags, and reuse operating cost. Use zero for inactive periods. |
| External water | `ExtWaterSourcingAvailability` for every period, sourcing cost, and delivery routes. |
| Storage | Initial capacity/inventory, expansion options/costs, operating costs/revenue, and filling/withdrawal routes. Default final inventory is limited to zero; storage is not permanent disposal. |
| Treatment | Technology, initial/expansion capacity, efficiency, costs, and desalination flags. Review outgoing stream types: **1 = treated water; 2 = residual water**. Review any missing residual route. |
| Beneficial reuse | `ReuseMinimum` and `ReuseCapacity` for every period, costs/credits, and incoming routes. Capacity **-1** means unrestricted; **0** prevents delivery. The minimum applies when the option is selected. |
| Trucking | Enable trucking routes in the tables; supply `TruckingTime` in hours, `TruckingHourlyCost`, and applicable offloading limits. Pipe lengths do not establish travel times. |
| New infrastructure | Eligible capacity increments and construction costs. Disposal expansion requires explicitly zero initial capacity; existing positive-capacity sites cannot expand. |

Advanced quality, hydraulics, emissions, risk, desalination, and timing modes need
additional data and possibly another solver. Their guidance and acceptance coverage
are limited; complete a basic run first.
See the [feature requirements reference](map-to-optimization-assessment.md#how-requirements-grow).

## 5. Validate, optimize, and review results

Choose **Validate Scenario**, resolve blockers, and review warnings about defaults.
A model that builds is not yet proven feasible. Choose **Check feasibility** for a
separate check that does not allow unmet water requirements.
For example, a 50,000 bbl/day production forecast cannot pass through a network
node limited to 1,000 bbl/day, even if disposal elsewhere has enough capacity.
Autofill checks individual values; matching rates, routes and capacities still matters.

- **Feasible plan found:** continue to **Advance to Optimization Setup**.
- **Infeasible:** check directions, bottlenecks, forecasts, storage balances, and fixed decisions.
- **Not determined:** the 20-second solver budget or a solver/formulation limitation
  prevented a conclusion; this does not mean infeasible.

In **Optimization Setup**, start with **Minimize Cost**, **CBC**, input pipeline
capacities, distance-based pipeline cost, and advanced modes off. Keep the existing
scaling, runtime, and gap defaults, then click **Optimize**. Changed settings are
checked again before the run; input edits refresh the checklist and invalidate
earlier model and feasibility checks.

Open **Model Results → Generate Excel Report** when finished. A feasible result at
the time limit is not a proven optimum. For failures, review the reported stage
and inputs; allow more solver time when appropriate. Reload saved inputs after a
stale-save error. Wait for optimization to finish before editing.

For map-editing details, see [Network map editing](network-map.md). Technical
validation and preservation notes are [documented separately](scenario-validation.md).
