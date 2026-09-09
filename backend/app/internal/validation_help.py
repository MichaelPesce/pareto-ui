"""Actionable explanations of the network checks used by scenario readiness."""

DESTINATIONS = 'a disposal site, storage site, completions pad, or beneficial reuse site'


def network_help(code, table, row, sets):
    node = str(row[0]) if row else 'the facility'
    if code == 'unreachable_destination':
        role = 'production pad' if node in sets.get('ProductionPads', []) else 'completions pad with flowback'
        forecast = 'PadRates' if node in sets.get('ProductionPads', []) else 'FlowbackRates'
        return {
            'rule': f'Every pad with positive production or flowback must have an enabled, directed path to {DESTINATIONS} other than itself. Supported pipelines and trucking routes both count; intermediate nodes are allowed.',
            'steps': [
                f'{node} is classified as a {role}. Select Review network and check its Node Type. If the type is wrong, correct it; if its water forecast is wrong, review {forecast}.',
                'Select the connecting pipeline and check its ordered nodes and the flow arrows between them. Add a missing connection or change the arrows so water can leave the pad and continue all the way to a destination. For example: production pad → network node → disposal site.',
                'For trucking, enable a supported origin-to-destination route in its trucking connection table (tables ending in T). A drawn line or a nearby site alone does not establish an enabled route.',
                'Treatment, including desalination, is an intermediate step for this check: continue the path to a destination. Save the network, then review destination capacity, demand or availability for each period and run Validate Scenario.',
            ],
        }
    explanations = {
        'missing_production_source': (
            'The installed model requires positive total produced water from production pads or completions-pad flowback.',
            ['Select the source on the network and set Node Type to Production Pad or Completions Pad as appropriate.',
             'Set planning periods, then enter the actual PadRates or FlowbackRates forecast, with at least one positive value. Connect the source to a destination.']),
        'missing_destination': (
            f'Produced water needs a destination: {DESTINATIONS}. Treatment alone does not satisfy this route check.',
            ['Select the intended destination in the network and correct its Node Type, or add the missing facility.',
             'Connect the producing pads to it in the direction of flow. Enter its capacity and any applicable demand or availability forecasts.']),
        'duplicate_identifier': (
            'Identifiers must be unique within each facility or option list.',
            [f'Review {table} and rename or remove duplicate entries. Use a distinct name for each separate facility or option.',
             'Update references in connections and input tables to match the intended identifier.']),
        'invalid_identifier': (
            'Each facility needs a nonempty name and exactly one facility type.',
            [f'Review {node} in the network and its facility lists. Give each distinct facility a unique name and select the correct Node Type.',
             'Remove any duplicate classification in the input lists and check that connected tables use the corrected name.']),
        'unknown_identifier': (
            'Table identifiers must match an existing facility or option in the corresponding input list.',
            [f'Open {table} and find {node}. Correct the reference to the exact existing name, or add the missing facility or option to its input list.',
             'If a facility was renamed or removed, update its connections and table references, then save.']),
        'invalid_arc': (
            'Each connection table permits a specific origin type and destination type, in that order. The warning names the required types.',
            [f'Check the endpoints in {table} ({" → ".join(map(str, row))}). Both names must exist in the required facility lists.',
             'In the network, check each endpoint’s Node Type and the pipeline flow arrow. Correct the type or direction, or use a supported connection table for the intended route.']),
        'arc_value': (
            'Connection cells use 0 or blank for disabled routes and 1 for enabled routes. Routes leaving treatment may use 2 for residual water.',
            [f'Open {table} and check the origin/destination cell for {" → ".join(map(str, row))}. Enter the appropriate connection code.',
             'Enter flow rates and pipeline capacities in their own input tables; the connection code is not a flow or capacity.']),
        'residual_boundary': (
            'Without an outgoing route marked 2, the installed model omits the treatment site’s residual-water balance.',
            [f'Decide how residual water from {node} is handled. If it remains in the modeled network, add a supported outgoing treatment route and mark its connection cell 2 for residual water.',
             'Continue that route to a suitable destination and provide capacity and operating inputs. If residuals leave the modeled system, review and accept that boundary assumption.']),
        'network_capacity': (
            'For this production/pipeline/disposal network, connected capacity must carry the produced water in every period, including eligible expansion and disposal operating fractions.',
            [f'Open the highlighted {table} cell and review the bottleneck, then follow the route through the network.',
             'Check InitialPipelineCapacity, InitialDisposalCapacity, DisposalOperatingCapacity and enabled NodeCapacities. Increase capacity only where physically justified, provide eligible expansion options, or add another usable route.',
             'Check the production forecast and units. Save changes and run Validate Scenario and Check feasibility; passing this capacity screen alone does not prove the full model is feasible.']),
    }
    if code in explanations:
        rule, steps = explanations[code]
        return {'rule': rule, 'steps': steps}
    return None
