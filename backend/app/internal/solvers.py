"""Solver interfaces used by both feasibility checks and optimization."""
import time
from pyomo.environ import SolverFactory
from pyomo.opt import ProblemFormat, SolverStatus, TerminationCondition
from pyomo.solvers.plugins.solvers.CBCplugin import CBCSHELL


@SolverFactory.register('pareto_cbc', doc='CBC with full-precision AMPL solution output')
class PreciseCBC(CBCSHELL):
    # CBC's LP interface writes only about eight significant digits to .soln.
    # Its NL/ASL interface writes full-precision .sol values. Use the latter so
    # reloading a feasible solution does not introduce physical balance errors.
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.set_problem_format(ProblemFormat.nl)
        if self.problem_format() != ProblemFormat.nl:
            raise RuntimeError('This CBC build lacks the full-precision NL interface. Install the CBC solver supplied by IDAES extensions.')

    def solve(self, *args, **kwargs):
        options = {**self.options, **kwargs.get('options', {})}
        started = time.monotonic()
        result = super().solve(*args, **kwargs)
        if result.solver.termination_condition != TerminationCondition.optimal or result.problem.number_of_variables != 0:
            return result
        # CBC 2.10's ASL interface can emit an empty, "optimal" result for an
        # infeasible MIP. The LP interface reports the termination correctly.
        # An empty response alone is never evidence of infeasibility; ask the
        # solver again, staying within the original time budget. Any returned
        # values still have to pass the ordinary strict solution verification.
        if options.get('seconds') is not None:
            remaining = float(options['seconds']) - (time.monotonic() - started)
            if remaining <= 0:
                result.solver.termination_condition = TerminationCondition.maxTimeLimit
                result.solver.status = SolverStatus.warning
                return result
            options['seconds'] = remaining
        fallback = SolverFactory('cbc', executable=self.executable())
        return fallback.solve(*args, **{**kwargs, 'options': options})


def solver_name(name):
    """Keep the user's solver choice while selecting our CBC file interface."""
    return 'pareto_cbc' if name == 'cbc' else name
