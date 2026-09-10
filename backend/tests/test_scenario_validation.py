from copy import deepcopy
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from scenario_fixtures import simple_scenario
from app.internal.input_schema import input_revision, with_horizon
from app.internal.scenario_inputs import write_inputs, read_inputs
from app.internal.scenario_validation import validate_inputs, check_model
from pyomo.environ import SolverFactory

class ScenarioValidationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.example, cls.path = simple_scenario(cls.temp.name)

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def test_small_network_does_not_require_optional_facilities(self):
        result = validate_inputs(deepcopy(self.example))
        self.assertTrue(result['valid'], result['issues'])
        self.assertEqual(result['feasibility'], 'not_run')

    def test_forecast_zero_is_valid_but_unknown_and_negative_values_are_not(self):
        scenario = deepcopy(self.example)
        scenario['data_input']['df_parameters']['PadRates']['T02'] = [0]
        self.assertTrue(validate_inputs(scenario)['valid'])
        for invalid in ('', -1, 'not a number'):
            scenario['data_input']['df_parameters']['PadRates']['T02'] = [invalid]
            result = validate_inputs(scenario)
            self.assertFalse(result['valid'])
            self.assertTrue(any(i['table'] == 'PadRates' and i['period'] == 'T02' for i in result['issues']))

    def test_horizon_reorder_and_roundtrip_preserve_values_by_period(self):
        scenario = deepcopy(self.example)
        scenario['data_input']['df_parameters']['PadRates']['T02'] = [25]
        changed = with_horizon(scenario['data_input'], ['T02', 'T01', 'T03'])
        self.assertEqual(changed['df_parameters']['PadRates']['T02'], [25])
        self.assertEqual(changed['df_parameters']['PadRates']['T03'], [''])
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'roundtrip.xlsx'
            write_inputs(changed, path)
            loaded = read_inputs(path)
        self.assertEqual(loaded['df_sets']['TimePeriods'], ['T02', 'T01', 'T03'])
        self.assertEqual(loaded['df_parameters']['PadRates'], changed['df_parameters']['PadRates'])
        self.assertEqual(loaded['units'], changed['units'])
        self.assertEqual(loaded['df_sets']['CompletionsPads'], [])

    def test_disconnected_source_points_to_affected_map_feature(self):
        scenario = deepcopy(self.example)
        scenario['data_input']['df_parameters']['NKA'] = {}
        result = validate_inputs(scenario)
        self.assertFalse(result['valid'])
        self.assertTrue(any(i['code'] == 'unreachable_destination' and i['row'] == ['P1'] for i in result['issues']))
        help_text = next(i['help'] for i in result['issues'] if i['code'] == 'unreachable_destination')
        self.assertIn('trucking', help_text['rule'])
        self.assertIn('intermediate', ' '.join(help_text['steps']))
        self.assertIn('PadRates', ' '.join(help_text['steps']))

    def test_route_help_matches_supported_trucking_and_treatment_paths(self):
        scenario = deepcopy(self.example)
        tables = scenario['data_input']['df_parameters']
        tables['NKA'] = {}
        tables['PKT'] = {'ProductionPads': ['P1'], 'K1': [1]}
        self.assertFalse(any(i['code'] == 'unreachable_destination' for i in validate_inputs(scenario)['issues']))
        tables['PKT'] = {}
        scenario['data_input']['df_sets']['TreatmentSites'] = ['R1']
        tables['PRT'] = {'ProductionPads': ['P1'], 'R1': [1]}
        self.assertTrue(any(i['code'] == 'unreachable_destination' for i in validate_inputs(scenario)['issues']))
        tables['RKT'] = {'TreatmentSites': ['R1'], 'K1': [1]}
        self.assertFalse(any(i['code'] == 'unreachable_destination' for i in validate_inputs(scenario)['issues']))

    def test_revision_tracks_settings_and_fixed_decisions_but_not_results(self):
        scenario = deepcopy(self.example)
        original = input_revision(scenario)
        scenario['results'] = {'status': 'Building model'}
        self.assertEqual(input_revision(scenario), original)
        scenario['optimization']['waterQuality'] = 'discrete'
        self.assertNotEqual(input_revision(scenario), original)

        scenario = deepcopy(self.example)
        scenario['override_values'] = {'v_F_Piped_dict': {'test': {'value': 20}}}
        self.assertNotEqual(input_revision(scenario), original)

    def test_horizon_rejects_names_that_would_overwrite_the_forecast_index(self):
        with self.assertRaises(ValueError):
            with_horizon(self.example['data_input'], ['ProductionPads'])
        self.assertEqual(self.example['data_input']['df_parameters']['PadRates']['ProductionPads'], ['P1'])

    def test_advanced_modes_require_additional_data(self):
        scenario = deepcopy(self.example)
        scenario['optimization']['waterQuality'] = 'discrete'
        result = validate_inputs(scenario)
        self.assertTrue(any(i['code'] == 'configuration_data' and i['table'] == 'PadWaterQuality' for i in result['issues']))

    def test_reuse_is_conditional_and_zero_cost_and_minimum_are_valid(self):
        scenario = deepcopy(self.example)
        data = scenario['data_input']
        data['df_sets']['ReuseOptions'] = ['O1']
        result = validate_inputs(scenario)
        self.assertTrue(any(i['table'] == 'ReuseMinimum' and i['severity'] == 'error' for i in result['issues']))
        data['df_parameters'].update({
            'ReuseMinimum': {'ReuseOptions': ['O1'], 'T01': [0], 'T02': [0]},
            'ReuseCapacity': {'ReuseOptions': ['O1'], 'T01': [-1], 'T02': [-1]},
            'BeneficialReuseCost': {'ReuseOptions': ['O1'], 'VALUE': [0]},
            'BeneficialReuseCredit': {'ReuseOptions': ['O1'], 'VALUE': [0]},
        })
        self.assertTrue(validate_inputs(scenario)['valid'])
        data['df_parameters']['BeneficialReuseCost']['VALUE'] = [-1]
        self.assertFalse(validate_inputs(scenario)['valid'])

    def test_capacity_screen_identifies_the_connected_bottleneck(self):
        scenario = deepcopy(self.example)
        scenario['data_input']['df_parameters']['InitialPipelineCapacity']['N1'][0] = 50
        result = validate_inputs(scenario)
        issue = next(i for i in result['issues'] if i['code'] == 'network_capacity')
        self.assertEqual(issue['row'], ['P1', 'N1'])
        self.assertEqual(issue['actual'], 50)
        self.assertEqual(issue['expected'], 100)
        self.assertEqual(result['feasibility'], 'not_run')

    def test_storage_only_route_and_upstream_node_bottleneck_are_both_reported(self):
        scenario = deepcopy(self.example)
        data = scenario['data_input']
        data['df_sets']['StorageSites'] = ['S1']
        tables = data['df_parameters']
        tables['InitialStorageCapacity'] = {'StorageSites': ['S1'], 'VALUE': [10000]}
        tables['NKA'] = {}
        tables['NSA'] = {'NetworkNodes': ['N1'], 'S1': [1]}
        tables['InitialPipelineCapacity']['S1'] = [100] * len(tables['InitialPipelineCapacity']['NODES'])
        tables['NodeCapacities'] = {'NetworkNodes': ['N1'], 'VALUE': [50]}
        result = validate_inputs(scenario)
        issue = next(i for i in result['issues'] if i['code'] == 'storage_only_destination')
        self.assertEqual(issue['row'], ['P1'])
        self.assertIn('Storage must end empty', issue['message'])
        bottleneck = next(i for i in result['issues'] if i['code'] == 'network_capacity')
        self.assertEqual(bottleneck['table'], 'NodeCapacities')
        self.assertEqual(bottleneck['row'], ['N1'])
        self.assertEqual(bottleneck['actual'], 50)
        # Storage can be an intermediate facility, and a trucking alternative
        # must prevent a false pipeline/node-capacity blocker.
        tables['SKA'] = {'StorageSites': ['S1'], 'K1': [1]}
        tables['PKT'] = {'ProductionPads': ['P1'], 'K1': [1]}
        result = validate_inputs(scenario)
        self.assertFalse(any(i['code'] in ('storage_only_destination', 'network_capacity') for i in result['issues']))

    def test_connected_evaporation_treatment_is_not_rejected_as_a_storage_dead_end(self):
        scenario = deepcopy(self.example)
        data = scenario['data_input']
        data['df_sets']['StorageSites'] = ['S1']
        data['df_sets']['TreatmentSites'] = ['R1']
        data['df_sets']['TreatmentTechnologies'] = ['CB-EV']
        tables = data['df_parameters']
        tables['NKA'] = {}
        tables['NRA'] = {'NetworkNodes': ['N1'], 'R1': [1]}
        tables['RSA'] = {'TreatmentSites': ['R1'], 'S1': [1]}
        self.assertFalse(any(i['code'] in ('storage_only_destination', 'unreachable_destination') for i in validate_inputs(scenario)['issues']))

    def test_solver_check_distinguishes_feasible_and_infeasible(self):
        with patch.dict(os.environ, {'PATH': str(Path.home() / '.idaes/bin') + os.pathsep + os.environ['PATH']}):
            if not SolverFactory('cbc').available(False):
                self.skipTest('CBC is not installed')
            scenario = deepcopy(self.example)
            result = check_model(scenario, self.path, validate_inputs(scenario), solve=True)
            self.assertEqual(result['feasibility'], 'feasible', result)
            capacity = scenario['data_input']['df_parameters']['InitialPipelineCapacity']
            capacity['N1'][0] = 50
            with tempfile.TemporaryDirectory() as directory:
                path = Path(directory) / 'bottleneck.xlsx'
                write_inputs(scenario['data_input'], path)
                result = check_model(scenario, path, validate_inputs(scenario), solve=True)
            self.assertEqual(result['feasibility'], 'infeasible', result)
            self.assertFalse(result['valid'])

if __name__ == '__main__':
    unittest.main()
