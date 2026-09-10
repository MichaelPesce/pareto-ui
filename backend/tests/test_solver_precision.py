"""Real CBC output must survive reloading without loosening physical checks."""
import os
from pathlib import Path
import unittest
from unittest.mock import patch

from pyomo.environ import ConcreteModel, Var, Binary, Constraint, Objective, SolverFactory, value
from pyomo.opt import SolverResults, SolverStatus, TerminationCondition
from app.internal.model_diagnostics import solution_is_feasible
from app.internal.solvers import solver_name


class SolverPrecisionTests(unittest.TestCase):
    def test_fractional_flows_keep_full_precision_with_and_without_scaling(self):
        with patch.dict(os.environ, {'PATH': str(Path.home() / '.idaes/bin') + os.pathsep + os.environ['PATH']}):
            if not SolverFactory('cbc').available(False):
                self.skipTest('CBC is not installed')
            for scale in (1, .001):
                with self.subTest(scale=scale):
                    model = ConcreteModel()
                    model.flow = Var(bounds=(0, None))
                    model.build = Var(domain=Binary)
                    model.supply = Constraint(expr=3 * model.flow / scale == 4000)
                    model.capacity = Constraint(expr=model.flow / scale <= 2000 * model.build)
                    model.objective = Objective(expr=model.flow / scale + model.build)
                    solver = SolverFactory(solver_name('cbc'))
                    result = solver.solve(model)
                    self.assertEqual(str(result.solver.termination_condition), 'optimal')
                    self.assertLess(abs(value(model.supply.body) - 4000), 1e-6)
                    self.assertTrue(solution_is_feasible(model))

    def test_infeasible_integer_model_is_not_reported_as_an_empty_optimum(self):
        with patch.dict(os.environ, {'PATH': str(Path.home() / '.idaes/bin') + os.pathsep + os.environ['PATH']}):
            if not SolverFactory('cbc').available(False):
                self.skipTest('CBC is not installed')
            model = ConcreteModel()
            model.flow = Var(bounds=(0, None))
            model.build = Var(domain=Binary)
            model.supply = Constraint(expr=model.flow >= 100)
            model.capacity = Constraint(expr=model.flow <= 50 * model.build)
            model.objective = Objective(expr=0)
            solver = SolverFactory(solver_name('cbc'))
            solver.options['seconds'] = 20
            result = solver.solve(model, load_solutions=False)
            self.assertEqual(result.solver.termination_condition, TerminationCondition.infeasible)

    def test_empty_result_fallback_respects_remaining_time_budget(self):
        with patch.dict(os.environ, {'PATH': str(Path.home() / '.idaes/bin') + os.pathsep + os.environ['PATH']}):
            if not SolverFactory('cbc').available(False):
                self.skipTest('CBC is not installed')
            solver = SolverFactory(solver_name('cbc'))
            solver.options['seconds'] = 20
            for elapsed in (5, 20):
                with self.subTest(elapsed=elapsed):
                    empty_result = SolverResults()
                    empty_result.solver.termination_condition = TerminationCondition.optimal
                    empty_result.problem.number_of_variables = 0
                    model = ConcreteModel()
                    with patch('app.internal.solvers.CBCSHELL.solve', return_value=empty_result), \
                         patch('app.internal.solvers.time.monotonic', side_effect=[100, 100 + elapsed]), \
                         patch('app.internal.solvers.SolverFactory') as fallback_factory:
                        result = solver.solve(model, load_solutions=False)
                        if elapsed < 20:
                            fallback_factory.return_value.solve.assert_called_once_with(
                                model, load_solutions=False, options={'seconds': 15})
                            self.assertIs(result, fallback_factory.return_value.solve.return_value)
                        else:
                            fallback_factory.assert_not_called()
                            self.assertEqual(result.solver.termination_condition, TerminationCondition.maxTimeLimit)
                            self.assertEqual(result.solver.status, SolverStatus.warning)
                    self.assertEqual(solver.options['seconds'], 20)


if __name__ == '__main__':
    unittest.main()
