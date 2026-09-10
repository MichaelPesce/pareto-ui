import json
import unittest
from pyomo.environ import Binary, ConcreteModel, Constraint, Var
from app.internal.model_diagnostics import scan_constraint_violations, build_diagnosis_context, solution_is_feasible


class DiagnosticTests(unittest.TestCase):
    def test_only_active_constraints_are_counted_and_results_are_bounded(self):
        model = ConcreteModel()
        model.x = Var(initialize=0)
        model.c = Constraint(range(1, 8), rule=lambda m, i: m.x >= i)
        model.c[7].deactivate()
        result = scan_constraint_violations(model, max_results=2)
        self.assertEqual(result['status'], 'complete')
        self.assertEqual(result['count'], 6)
        self.assertEqual(result['evaluated_count'], 6)
        self.assertEqual([v['violation'] for v in result['violations']], [6, 5])
        self.assertTrue(result['truncated'])

    def test_uninitialized_and_nonfinite_values_do_not_imply_feasibility(self):
        model = ConcreteModel()
        model.x = Var()
        model.c = Constraint(expr=model.x >= 5)
        result = scan_constraint_violations(model)
        self.assertEqual(result['status'], 'unavailable')
        self.assertEqual(result['skipped_count'], 1)
        model.y = Var(initialize=1)
        model.d = Constraint(expr=model.y >= 2)
        model.x.set_value(float('nan'), skip_validation=True)
        result = scan_constraint_violations(model)
        self.assertEqual(result['status'], 'partial')
        self.assertEqual(result['evaluated_count'], 1)
        self.assertEqual(result['count'], 1)
        json.dumps(result, allow_nan=False)

    def test_upper_bound_and_tolerance(self):
        model = ConcreteModel()
        model.x = Var(initialize=3)
        model.c = Constraint(expr=model.x <= 2)
        result = scan_constraint_violations(model)
        self.assertEqual(result['violations'][0]['side'], 'upper')
        model.x.set_value(2 + 1e-8)
        self.assertEqual(scan_constraint_violations(model)['count'], 0)

    def test_context_keeps_status_and_evidence_when_tables_are_large(self):
        scenario = {'results': {'status': 'Infeasible', 'terminationCondition': 'infeasible'},
                    'data_input': {'df_parameters': {f'table{i}': {'T1': ['x' * 10000] * 1000} for i in range(100)}}}
        context = build_diagnosis_context(scenario)
        self.assertEqual(context['resultsStatus'], 'Infeasible')
        self.assertEqual(context['constraintsViolations']['status'], 'unavailable')
        self.assertEqual(len(context['editableInputTables']), 100)
        self.assertTrue(context['omittedInputTables'])
        self.assertLess(len(json.dumps(context)), 22000)
        self.assertIn('do not identify a proven', context['limitations'])

    def test_rounded_large_totals_do_not_hide_real_flow_violations(self):
        model = ConcreteModel()
        model.cost = Var(initialize=1_000_000_000.4)
        model.cost_balance = Constraint(expr=model.cost == 1_000_000_000)
        model.flow = Var(initialize=350)
        model.supply = Constraint(expr=model.flow == 350)
        self.assertEqual(scan_constraint_violations(model)['count'], 1)
        self.assertTrue(solution_is_feasible(model))
        for supply in (0, 349.9):
            model.flow.set_value(supply)
            self.assertFalse(solution_is_feasible(model))
        model.flow.set_value(350)
        model.cost.set_value(1_000_001_000)
        self.assertFalse(solution_is_feasible(model))

    def test_solution_verification_checks_bounds_and_integrality(self):
        model = ConcreteModel()
        model.x = Var(initialize=0, bounds=(1, 10))
        model.c = Constraint(expr=model.x >= 0)
        self.assertFalse(solution_is_feasible(model))
        model.x.set_value(2)
        model.choice = Var(within=Binary, initialize=0.5)
        model.d = Constraint(expr=model.choice <= 1)
        self.assertFalse(solution_is_feasible(model))
        model.choice.set_value(1)
        model.unused = Var()
        self.assertTrue(solution_is_feasible(model))
        model.x.set_value(None)
        self.assertFalse(solution_is_feasible(model))

    def test_relative_check_handles_cancellation_and_scaled_equalities(self):
        for scale in (1, 0.001):
            model = ConcreteModel()
            model.total = Var(initialize=scale * 10_000_000.4)
            model.a = Var(initialize=scale * 6_000_000)
            model.b = Var(initialize=scale * 4_000_000)
            model.c = Constraint(expr=model.total == model.a + model.b)
            self.assertTrue(solution_is_feasible(model))
            model.total.set_value(scale * 10_000_010)
            self.assertFalse(solution_is_feasible(model))


if __name__ == '__main__':
    unittest.main()
