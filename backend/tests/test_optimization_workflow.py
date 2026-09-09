import importlib
import json
import os
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

from pyomo.environ import ConcreteModel, Constraint, Var
from pyomo.opt import TerminationCondition
from app.internal.util import prepare_config, check_for_minimum_required_tables


class OptimizationWorkflowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        previous_cwd = os.getcwd()
        with patch.dict(os.environ, {'PARETO_DATA_BASEDIR': cls.temp.name, 'PARETO_LOG_DIR': cls.temp.name}):
            cls.runner = importlib.import_module('app.internal.pareto_stategic_model')
            cls.handler_module = importlib.import_module('app.internal.scenario_handler')
        os.chdir(previous_cwd)

    @classmethod
    def tearDownClass(cls):
        cls.handler_module.scenario_handler._db.close()
        # Close the log file before deleting it on Windows.
        import logging
        for handler in list(logging.getLogger().handlers):
            if getattr(handler, 'baseFilename', '').startswith(cls.temp.name):
                logging.getLogger().removeHandler(handler)
                handler.close()
        cls.temp.cleanup()

    def run_model(self, report_fails=False, solve_fails=False):
        scenario = {'id': 1, 'optimization': {}, 'results': {}, 'optimized_override_values': {}}
        model = ConcreteModel(); model.x = Var(initialize=0); model.c = Constraint(expr=model.x >= 10)
        handler = Mock()
        handler.get_scenario.return_value = scenario
        solver = SimpleNamespace(solver=SimpleNamespace(termination_condition=TerminationCondition.infeasible))
        with patch.multiple(self.runner, scenario_handler=handler, get_data=Mock(return_value=({}, {}, {})),
                            get_input_lists=Mock(return_value=([], [])), create_model=Mock(return_value=model),
                            solve_model=Mock(side_effect=RuntimeError('solver failed') if solve_fails else None, return_value=solver),
                            is_feasible=Mock(return_value=False),
                            generate_report=Mock(side_effect=RuntimeError('report failed') if report_fails else None, return_value=(model, {}))), \
                patch.object(self.runner.time, 'sleep'):
            self.runner.handle_run_strategic_model('input.xlsx', 'output.xlsx', 1,
                                                  prepare_config(scenario, expected_response='modelParameters'))
        return scenario, handler

    def test_infeasible_result_contains_current_value_diagnostics(self):
        scenario, handler = self.run_model()
        self.assertEqual(scenario['results']['status'], 'Infeasible')
        self.assertEqual(scenario['results']['constraints_violations']['count'], 1)
        self.assertEqual(scenario['results']['constraints_violations']['solution_state'], 'current_model_values')
        handler.remove_background_task.assert_called_once_with(1)

    def test_reporting_failure_preserves_scan_and_termination_condition(self):
        scenario, _ = self.run_model(report_fails=True)
        self.assertEqual(scenario['results']['status'], 'failure')
        self.assertEqual(scenario['results']['terminationCondition'], 'infeasible')
        self.assertEqual(scenario['results']['constraints_violations']['count'], 1)

    def test_solver_exception_preserves_available_diagnostics(self):
        scenario, _ = self.run_model(solve_fails=True)
        self.assertEqual(scenario['results']['error'], 'solver failed')
        self.assertEqual(scenario['results']['constraints_violations']['count'], 1)

    def test_ai_diagnosis_uses_saved_context_and_is_persisted(self):
        handler = self.handler_module.ScenarioHandler.__new__(self.handler_module.ScenarioHandler)
        handler.scenario_list = {1: {'id': 1, 'results': {'status': 'Infeasible'}, 'data_input': {}}}
        handler.update_scenario = Mock()
        ai = Mock()
        ai.prompt.return_value = json.dumps({'status': 'success', 'summary': 'Check capacity.',
                                            'likelyCauses': ['Insufficient capacity'], 'nextSteps': [
                                                {'title': 'Review capacity', 'instruction': 'Check disposal capacity.'}]})
        with patch.object(self.handler_module, 'cborg', ai):
            result = handler.generate_optimization_diagnosis_with_ai(1, None)
        self.assertEqual(result['status'], 'success')
        self.assertEqual(handler.scenario_list[1]['aiDiagnosis'], result)
        self.assertIn('not identify a proven', ai.prompt.call_args.args[0])
        self.assertTrue(result['cautionNotes'])
        handler.update_scenario.assert_called_once()

    def test_ai_unavailable_and_malformed_responses_are_recoverable(self):
        handler = self.handler_module.ScenarioHandler.__new__(self.handler_module.ScenarioHandler)
        handler.scenario_list = {1: {'id': 1, 'results': {'status': 'Infeasible'}}}
        ai = Mock(); ai.is_available.return_value = False
        with patch.object(self.handler_module, 'cborg', ai):
            self.assertEqual(handler.generate_optimization_diagnosis_with_ai(1, None)['status'], 'error')
            ai.prompt.assert_not_called()
            ai.is_available.return_value = True
            for payload in ['invalid json', '[]', '{"status":"success", "cautionNotes":null}',
                            json.dumps({'status': 'success', 'summary': 'Check capacity.', 'nextSteps': [
                                {'title': 'Review capacity', 'instruction': 'Check disposal.', 'reason': {}}]})]:
                ai.prompt.return_value = payload
                self.assertEqual(handler.generate_optimization_diagnosis_with_ai(1, None)['status'], 'error')
            ai.prompt.return_value = '{"status":"error", "errorMessage":{"unexpected":"object"}}'
            self.assertIsInstance(handler.generate_optimization_diagnosis_with_ai(1, None)['errorMessage'], str)


class OptionalReuseTests(unittest.TestCase):
    def test_reuse_is_optional_and_zero_values_are_valid_when_used(self):
        inputs = {'df_sets': {name: [name] for name in ['ProductionPads', 'CompletionsPads', 'StorageSites', 'SWDSites', 'ExternalWaterSources']},
                  'df_parameters': {name: {'NODES': ['A'], 'VALUE': [1]} for name in ['InitialDisposalCapacity', 'InitialStorageCapacity', 'CompletionsPadStorage', 'DisposalOperationalCost']}}
        inputs['df_parameters'].update({name: {'NODES': ['A'], 'T1': [1]} for name in ['PadRates', 'FlowbackRates', 'CompletionsDemand']})
        scenario = {'data_input': inputs}
        self.assertEqual(check_for_minimum_required_tables(scenario), [])
        inputs['df_sets']['ReuseOptions'] = ['O1']
        self.assertIn('ReuseMinimum', check_for_minimum_required_tables(scenario))
        inputs['df_parameters'].update({'ReuseMinimum': {'NODES': ['O1'], 'T1': [0]},
            'BeneficialReuseCost': {'NODES': ['O1'], 'VALUE': [0]}, 'BeneficialReuseCredit': {'NODES': ['O1'], 'VALUE': [0]}})
        self.assertEqual(check_for_minimum_required_tables(scenario), [])
        inputs['df_parameters']['BeneficialReuseCost']['VALUE'] = [-1]
        self.assertIn('BeneficialReuseCost', check_for_minimum_required_tables(scenario))


if __name__ == '__main__':
    unittest.main()
