"""Acceptance checks use isolated storage and the real model/report pipeline."""
from copy import deepcopy
import importlib
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient
from pyomo.environ import SolverFactory
from scenario_fixtures import simple_scenario, map_files
from app.internal.scenario_inputs import read_inputs, write_inputs


class ScenarioApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory = tempfile.TemporaryDirectory()
        cwd = os.getcwd()
        with patch.dict(os.environ, {'PARETO_DATA_BASEDIR': cls.directory.name, 'PARETO_LOG_DIR': cls.directory.name}):
            cls.module = importlib.import_module('app.internal.scenario_handler')
            cls.routes = importlib.import_module('app.routers.scenarios')
            cls.runner = importlib.import_module('app.internal.pareto_stategic_model')
        os.chdir(cwd)

    @classmethod
    def tearDownClass(cls):
        cls.directory.cleanup()

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        cwd = os.getcwd()
        self.handler = self.module.ScenarioHandler(data_basedir=self.temp.name, log_dir=self.temp.name)
        os.chdir(cwd)
        self.addCleanup(self.handler._db.close)
        for module in (self.routes, self.runner):
            replacement = patch.object(module, 'scenario_handler', self.handler)
            replacement.start(); self.addCleanup(replacement.stop)
        app = FastAPI(); app.include_router(self.routes.router)
        self.client = TestClient(app)
        self.example, _ = simple_scenario(self.temp.name)
        write_inputs(self.example['data_input'], self.handler.get_excelsheet_path(1))
        self.example = self.handler.update_scenario(self.example)

    def test_validation_is_invalidated_and_stale_or_running_edits_are_rejected(self):
        revision = self.example['input_revision']
        checked = self.client.get('/validate_scenario/1')
        self.assertEqual(checked.json()['model_check'], 'passed', checked.text)
        changed = self.client.post('/planning_horizon/1', json={'periods': ['T01', 'T02', 'T03'], 'revision': revision})
        self.assertEqual(changed.status_code, 200, changed.text)
        self.assertEqual(changed.json()['validation']['state'], 'needs_input')
        self.assertEqual(changed.json()['validation']['model_check'], 'not_run')
        self.assertEqual(changed.json()['validation']['feasibility'], 'not_run')
        self.assertEqual(self.client.post('/advance_to_optimization_setup/1').status_code, 409)
        self.assertEqual(self.client.post('/planning_horizon/1', json={'periods': ['T01'], 'revision': revision}).status_code, 409)
        self.assertEqual(self.client.post('/run_model', json={'scenario': self.example}).status_code, 409)
        current = self.handler.get_scenario(1)
        self.handler.add_background_task(1)
        self.assertEqual(self.client.post('/update_excel', json={'id': 1, 'tableKey': 'PadRates', 'updatedTable': {}, 'revision': current['input_revision']}).status_code, 409)
        self.assertEqual(self.handler.get_scenario(1)['input_revision'], current['input_revision'])

    def test_table_and_map_edits_survive_reload_and_export(self):
        table = {'ProductionPads': ['P1'], 'T01': [100], 'T02': [0]}
        saved = self.client.post('/update_excel', json={'id': 1, 'tableKey': 'PadRates', 'updatedTable': table}).json()
        saved['data_input']['map_data']['all_nodes']['K1']['DisposalOperationalCost'] = 2
        saved['data_input']['map_data']['all_nodes']['P1']['coordinates'][0] -= .001
        response = self.client.post('/update', json={'updatedScenario': saved, 'propagateChanges': 'map'})
        self.assertEqual(response.status_code, 200, response.text)
        current = response.json()['data']
        self.assertEqual(current['data_input']['df_parameters']['PadRates'], table)
        self.assertEqual(current['data_input']['df_parameters']['DisposalOperationalCost']['VALUE'], [2])
        exported = read_inputs(self.handler.get_excelsheet_path(1))
        self.assertEqual(exported['df_parameters']['PadRates'], table)
        self.assertEqual(exported['df_sets']['TimePeriods'], ['T01', 'T02'])
        self.assertEqual(exported['units'], current['data_input']['units'])

    def test_kml_and_shapefile_import_classification_forecasts_and_optimization(self):
        self.handler.update_next_id()
        with patch.dict(os.environ, {'PATH': str(Path.home() / '.idaes/bin') + os.pathsep + os.environ['PATH']}):
            if not SolverFactory('cbc').available(False):
                self.skipTest('CBC is not installed')
            for path in map_files(self.temp.name):
                with self.subTest(format=path.suffix), path.open('rb') as stream:
                    response = self.client.post('/upload/Imported%20network?defaultNodeType=NetworkNode', files={'file': (path.name, stream)})
                    self.assertEqual(response.status_code, 200, response.text)
                    scenario = response.json()
                    scenario_id = scenario['id']
                    mapped = scenario['data_input']['map_data']
                    self.assertEqual(set(mapped['all_nodes']), {'P1', 'N1', 'K1'})
                    for name, node in self.example['data_input']['map_data']['all_nodes'].items():
                        mapped['all_nodes'][name].update(node)
                    for arc in mapped['arcs'].values():
                        arc['diameter'] = 'D4'
                        for node in arc['nodes']:
                            node['outgoing_nodes'] = {'P1': ['N1'], 'N1': ['K1'], 'K1': []}[node['name']]
                    response = self.client.post('/update', json={'updatedScenario': scenario, 'propagateChanges': 'map'})
                    self.assertEqual(response.status_code, 200, response.text)
                    response = self.client.post(f'/planning_horizon/{scenario_id}', json={'periods': ['T01', 'T02']})
                    self.assertEqual(response.status_code, 200, response.text)
                    response = self.client.post('/update_excel', json={'id': scenario_id, 'tableKey': 'PadRates',
                        'updatedTable': {'ProductionPads': ['P1'], 'T01': [100], 'T02': [0]}})
                    self.assertEqual(response.status_code, 200, response.text)
                    scenario = response.json()
                    validation = self.client.get(f'/validate_scenario/{scenario_id}').json()
                    self.assertTrue(validation['valid'], validation)
                    scenario['optimization']['runtime'] = 20
                    response = self.client.post('/run_model', json={'scenario': scenario})
                    self.assertEqual(response.status_code, 200, response.text)
                    completed = self.handler.get_scenario(scenario_id)
                    self.assertEqual(completed['results']['status'], 'Optimized', completed['results'].get('error'))
                    self.assertEqual(completed['results']['solution_status'], 'optimal')
                    self.assertEqual(completed['data_input']['df_parameters']['PadRates']['T02'], [0])

    def test_complete_optimization_produces_report_from_validated_inputs(self):
        with patch.dict(os.environ, {'PATH': str(Path.home() / '.idaes/bin') + os.pathsep + os.environ['PATH']}):
            if not SolverFactory('cbc').available(False):
                self.skipTest('CBC is not installed')
            validation = self.client.post('/scenario_feasibility/1')
            self.assertEqual(validation.json()['feasibility'], 'feasible', validation.text)
            self.assertEqual(self.client.post('/advance_to_optimization_setup/1').status_code, 200)
            current = self.handler.get_scenario(1)
            current['optimization']['runtime'] = 20
            response = self.client.post('/run_model', json={'scenario': current})
            self.assertEqual(response.status_code, 200, response.text)
        result = self.handler.get_scenario(1)
        self.assertEqual(result['results']['status'], 'Optimized', result['results'].get('error'))
        self.assertEqual(result['results']['solution_status'], 'optimal')
        self.assertEqual(result['results']['input_revision'], result['input_revision'])
        self.assertGreater(len(result['results']['data']), 50)
        report = self.client.get('/generate_report/1')
        self.assertEqual(report.status_code, 200)
        self.assertTrue(report.content.startswith(b'PK'))
        self.assertEqual(self.handler.get_background_tasks(), [])
        self.assertFalse(list(self.handler.excelsheets_path.glob('optimization-*')))

    def test_run_endpoint_rechecks_changed_settings(self):
        self.client.get('/validate_scenario/1')
        current = self.handler.get_scenario(1)
        current['optimization']['waterQuality'] = 'discrete'
        response = self.client.post('/run_model', json={'scenario': current})
        self.assertEqual(response.status_code, 422, response.text)
        self.assertTrue(any(issue['table'] == 'PadWaterQuality' for issue in response.json()['detail']['validation']['issues']))
        self.assertEqual(self.handler.get_background_tasks(), [])

    def test_explicit_facility_rename_preserves_forecasts_and_connections(self):
        scenario = deepcopy(self.example)
        mapped = scenario['data_input']['map_data']
        mapped['all_nodes']['Production A'] = mapped['all_nodes'].pop('P1')
        mapped['_node_renames'] = {'P1': 'Production A'}
        response = self.client.post('/update', json={'updatedScenario': scenario, 'propagateChanges': 'map'})
        self.assertEqual(response.status_code, 200, response.text)
        data = response.json()['data']['data_input']
        self.assertEqual(data['df_parameters']['PadRates']['ProductionPads'], ['Production A'])
        self.assertEqual(data['df_parameters']['PadRates']['T02'], [100])
        self.assertEqual(data['df_parameters']['PNA']['N1'], [1])
        self.assertNotIn('P1', data['map_data']['all_nodes'])

    def test_validation_finishing_after_an_edit_is_not_saved_as_current(self):
        current = deepcopy(self.example)
        self.handler.update_horizon(1, ['T01'])
        result = self.handler._save_validation_results(current, {'valid': True, 'revision': current['input_revision']})
        self.assertEqual(result['state'], 'outdated')
        self.assertEqual(self.handler.get_scenario(1)['validation']['state'], 'inputs_complete')
        self.assertEqual(self.handler.get_scenario(1)['validation']['model_check'], 'not_run')

    def test_saving_one_table_keeps_other_errors_and_partial_fixes_highlighted(self):
        scenario = deepcopy(self.example)
        tables = scenario['data_input']['df_parameters']
        tables['PadRates']['T01'] = ['']
        tables['PadRates']['T02'] = ['']
        tables['DisposalOperationalCost']['VALUE'] = ['']
        self.handler.save_inputs(scenario)
        self.client.get('/validate_scenario/1')
        tables['PadRates']['T01'] = [100]
        response = self.client.post('/update_excel', json={'id': 1, 'tableKey': 'PadRates', 'updatedTable': tables['PadRates']})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertIn('PadRates', response.json()['validation']['tables_with_issues'])
        tables['PadRates']['T02'] = [100]
        response = self.client.post('/update_excel', json={'id': 1, 'tableKey': 'PadRates', 'updatedTable': tables['PadRates']})
        checked = response.json()['validation']
        self.assertNotIn('PadRates', checked['tables_with_issues'])
        self.assertIn('DisposalOperationalCost', checked['tables_with_issues'])
        self.assertEqual(self.handler.get_scenario(1)['validation'], checked)

    def test_valid_edit_refreshes_inputs_but_requires_a_new_model_check(self):
        self.client.get('/validate_scenario/1')
        table = {'ProductionPads': ['P1'], 'T01': [90], 'T02': [100]}
        response = self.client.post('/update_excel', json={'id': 1, 'tableKey': 'PadRates', 'updatedTable': table})
        result = response.json()['validation']
        self.assertTrue(result['valid'])
        self.assertEqual(result['state'], 'inputs_complete')
        self.assertEqual(result['model_check'], 'not_run')
        self.assertEqual(result['feasibility'], 'not_run')
        self.assertEqual(self.client.post('/advance_to_optimization_setup/1').status_code, 409)

    def test_autofill_preview_apply_export_and_concurrent_edit_protection(self):
        scenario = deepcopy(self.example)
        scenario['data_input']['df_parameters']['DisposalOperationalCost']['VALUE'] = ['']
        current = self.handler.save_inputs(scenario)
        payload = {'section': 'costs', 'value': 2, 'revision': current['input_revision']}
        preview = self.client.post('/fill_scenario_inputs/1', json=payload)
        self.assertEqual(preview.status_code, 200, preview.text)
        self.assertGreater(preview.json()['cell_count'], 0)
        self.assertEqual(self.handler.get_scenario(1)['input_revision'], current['input_revision'])
        saved = self.client.post('/fill_scenario_inputs/1', json={**payload, 'apply': True})
        self.assertEqual(saved.status_code, 200, saved.text)
        self.assertNotIn('DisposalOperationalCost', saved.json()['validation']['tables_with_issues'])
        self.assertEqual(saved.json()['data_input']['map_data']['all_nodes']['K1']['DisposalOperationalCost'], 2)
        self.assertEqual(read_inputs(self.handler.get_excelsheet_path(1))['df_parameters']['DisposalOperationalCost']['VALUE'], [2])
        self.assertEqual(self.client.post('/fill_scenario_inputs/1', json={**payload, 'apply': True}).status_code, 409)
        self.handler.add_background_task(1)
        self.assertEqual(self.client.post('/fill_scenario_inputs/1', json={**payload, 'revision': saved.json()['input_revision'], 'apply': True}).status_code, 409)

    def test_autofill_invalid_value_does_not_partially_save(self):
        original = self.handler.get_scenario(1)
        response = self.client.post('/fill_scenario_inputs/1', json={
            'section': 'capacity', 'revision': original['input_revision'], 'value': -2, 'apply': True})
        self.assertEqual(response.status_code, 400, response.text)
        self.assertEqual(self.handler.get_scenario(1), original)
