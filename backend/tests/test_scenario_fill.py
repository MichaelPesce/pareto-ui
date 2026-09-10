from copy import deepcopy
import tempfile
import unittest

from scenario_fixtures import simple_scenario
from app.internal.input_schema import flat_table, with_horizon
from app.internal.scenario_fill import prepare_fill
from app.internal.scenario_inputs import read_inputs, write_inputs
from app.internal.scenario_validation import validate_inputs


class ScenarioFillTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.example, cls.path = simple_scenario(cls.temp.name)

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def test_scalar_matrix_and_three_index_cells_fill_without_overwriting_valid_values(self):
        scenario = deepcopy(self.example)
        scenario['optimization']['pipeline_cost'] = 'capacity_based'
        tables = scenario['data_input']['df_parameters']
        tables['DisposalOperationalCost']['VALUE'] = ['']
        tables['PipelineExpansionDistance']['N1'][0] = -5
        tables['PipelineCapexCapacityBased'] = {}
        original = deepcopy(scenario)
        updated, preview = prepare_fill(scenario, 'costs', 0)
        self.assertEqual(scenario, original)
        filled = updated['data_input']['df_parameters']
        self.assertEqual(flat_table(filled['DisposalOperationalCost'])[('K1',)], 0)
        self.assertEqual(flat_table(filled['PipelineExpansionDistance'])[('P1', 'N1')], 0)
        self.assertEqual(flat_table(filled['PipelineExpansionDistance'])[('N1', 'K1')], 1)
        self.assertEqual(flat_table(filled['PipelineCapexCapacityBased'])[('P1', 'N1', 'D0')], 0)
        self.assertEqual(filled['PadRates'], tables['PadRates'])
        self.assertEqual(sum(t['cell_count'] for t in preview['tables']), preview['cell_count'])
        write_inputs(updated['data_input'], self.path)
        self.assertEqual(read_inputs(self.path)['df_parameters']['PipelineCapexCapacityBased'], filled['PipelineCapexCapacityBased'])

    def test_all_cells_and_table_highlights_are_counted_past_the_display_limit(self):
        scenario = deepcopy(self.example)
        scenario['data_input'] = with_horizon(scenario['data_input'], [f'T{i:03}' for i in range(300)])
        scenario['data_input']['df_parameters']['DisposalOperationalCost']['VALUE'] = ['']
        readiness = validate_inputs(scenario)
        self.assertTrue(readiness['truncated'])
        self.assertIn('DisposalOperationalCost', readiness['tables_with_issues'])
        filled, preview = prepare_fill(scenario, 'forecasts', 100)
        self.assertEqual(preview['cell_count'], 300)
        self.assertEqual(set(flat_table(filled['data_input']['df_parameters']['PadRates']).values()), {100})
        self.assertFalse(any(i['table'] == 'PadRates' for i in validate_inputs(filled)['issues']))

    def test_reuse_special_bound_and_missing_forecast_rows(self):
        scenario = deepcopy(self.example)
        data = scenario['data_input']
        data['df_sets']['ReuseOptions'] = ['O1']
        data['df_parameters']['ReuseMinimum'] = {'ReuseOptions': ['O1'], 'T01': [0], 'T02': [0]}
        data['df_parameters']['ReuseCapacity'] = {'ReuseOptions': ['O1'], 'T01': [-0.5], 'T02': ['']}
        with self.assertRaisesRegex(ValueError, 'nonnegative, or -1'):
            prepare_fill(scenario, 'forecasts', -0.5)
        filled, preview = prepare_fill(scenario, 'forecasts', -1)
        self.assertEqual(preview['cell_count'], 2)
        self.assertEqual(set(flat_table(filled['data_input']['df_parameters']['ReuseCapacity']).values()), {-1})
        data['df_parameters']['ReuseCapacity'] = {}
        filled, _ = prepare_fill(scenario, 'forecasts', 0)
        self.assertEqual(flat_table(filled['data_input']['df_parameters']['ReuseCapacity']), {('O1', 'T01'): 0, ('O1', 'T02'): 0})

    def test_invalid_numbers_and_structural_issues_are_not_blindly_overwritten(self):
        for value in ('', 'NaN', 'inf', True, -10):
            with self.subTest(value=value), self.assertRaises(ValueError):
                prepare_fill(self.example, 'capacity', value)
        scenario = deepcopy(self.example)
        scenario['data_input']['df_parameters']['DisposalOperationalCost'] = {'SWDSites': ['K1', 'K1'], 'VALUE': ['', '']}
        with self.assertRaisesRegex(ValueError, 'duplicate rows'):
            prepare_fill(scenario, 'costs', 1)
        scenario = deepcopy(self.example)
        scenario['data_input']['df_parameters']['NKA'] = {}
        filled, preview = prepare_fill(scenario, 'network', 1)
        self.assertEqual(preview['cell_count'], 0)
        self.assertEqual(filled, scenario)

    def test_storage_initial_level_can_be_filled_when_the_old_template_omits_it(self):
        scenario = deepcopy(self.example)
        data = scenario['data_input']
        data['df_sets']['StorageSites'] = ['S1']
        data['df_parameters']['InitialStorageCapacity'] = {'StorageSites': ['S1'], 'VALUE': [10000]}
        filled, _ = prepare_fill(scenario, 'capacity', 0)
        table = filled['data_input']['df_parameters']['InitialStorageLevel']
        self.assertEqual(table, {'StorageSites': ['S1'], 'VALUE': [0]})
        write_inputs(filled['data_input'], self.path)
        self.assertEqual(read_inputs(self.path)['df_parameters']['InitialStorageLevel'], table)
