"""Best-effort diagnostics of model values, not a proof of infeasibility."""
import heapq
import json
import logging
import math

from pyomo.environ import Constraint, Objective, Var, value, units as pyunits
from pyomo.core.expr.visitor import identify_variables
from pyomo.repn import generate_standard_repn

_log = logging.getLogger(__name__)
# Large accounting totals can accumulate floating-point rounding. Relative tolerance
# applies only to linear currency equalities, never to physical constraints,
# inequalities (including budget limits), or variable bounds.
SOLUTION_RELATIVE_TOLERANCE = 1e-7
DIAGNOSTIC_LIMITATION = (
    "Constraint residuals describe current model values, which may be initial values after an "
    "infeasible or interrupted solve. They do not identify a proven set of conflicting constraints. "
    "Missing or unevaluated constraints are not evidence of feasibility. Suggestions are hypotheses "
    "to check in the app; input samples may omit relevant rows."
)


def unavailable_constraint_scan(reason="No model values are available."):
    return {
        "status": "unavailable", "count": 0, "tolerance": 1e-6,
        "evaluated_count": 0, "skipped_count": 0, "returned_count": 0,
        "truncated": False, "violations": [], "reason": reason,
        "solution_state": "current_model_values",
    }


def _is_currency_equality(constraint):
    if not constraint.equality:
        return False
    try:
        pyunits.convert_value(1, from_units=pyunits.get_units(constraint.body), to_units=pyunits.USD)
        return True
    except Exception:
        # Missing or inconsistent unit metadata never grants a looser tolerance.
        return False


def scan_constraint_violations(model, tol=1e-6, max_results=25, solution_state="current_model_values", relative_tol=0):
    summary = unavailable_constraint_scan()
    summary.update(tolerance=tol, solution_state=solution_state)
    if relative_tol:
        summary['relative_tolerance'] = relative_tol
        summary['relative_tolerance_scope'] = 'linear_currency_equalities'
    top = []
    try:
        for con in model.component_data_objects(Constraint, active=True, descend_into=True):
            try:
                body = value(con.body, exception=False)
                lower = value(con.lower, exception=False) if con.has_lb() else None
                upper = value(con.upper, exception=False) if con.has_ub() else None
                if body is None or (con.has_lb() and lower is None) or (con.has_ub() and upper is None):
                    raise ValueError("Uninitialized value")
                if any(not math.isfinite(v) for v in (body, lower, upper) if v is not None):
                    raise ValueError("Nonfinite value")
                lower_gap = lower - body if lower is not None else 0
                upper_gap = body - upper if upper is not None else 0
                gap = max(lower_gap, upper_gap)
                if not math.isfinite(gap):
                    raise ValueError("Nonfinite residual")
                allowed = tol
                if relative_tol and gap > tol and _is_currency_equality(con):
                    repn = generate_standard_repn(con.body, compute_values=True, quadratic=False)
                    if repn.is_linear():
                        scale = max(abs(body), abs(lower or 0), abs(upper or 0), abs(repn.constant or 0),
                                    sum(abs(coef * value(var)) for coef, var in zip(repn.linear_coefs, repn.linear_vars)))
                        allowed += relative_tol * scale
                summary["evaluated_count"] += 1
                if gap <= allowed:
                    continue
                summary["count"] += 1
                record = {
                    "constraint": con.name, "violation": float(gap),
                    "side": "lower" if lower_gap >= upper_gap else "upper",
                    "lower_bound": float(lower) if lower is not None else None,
                    "body_value": float(body),
                    "upper_bound": float(upper) if upper is not None else None,
                }
                if max_results > 0:
                    heapq.heappush(top, (gap, summary["count"], record))
                    if len(top) > max_results:
                        heapq.heappop(top)
            except Exception:
                summary["skipped_count"] += 1
    except Exception:
        _log.exception("Unable to finish constraint scan")
        summary["skipped_count"] += 1
    summary["violations"] = [record for _, _, record in sorted(top, reverse=True)]
    summary["returned_count"] = len(top)
    summary["truncated"] = summary["count"] > len(top)
    if summary["evaluated_count"]:
        summary["status"] = "partial" if summary["skipped_count"] else "complete"
        summary.pop("reason", None)
    else:
        summary["reason"] = "No active constraints could be evaluated."
    _log.info("Constraint scan: %s violations, %s evaluated, %s skipped",
              summary["count"], summary["evaluated_count"], summary["skipped_count"])
    return summary


def solution_is_feasible(model, scan=None, tol=1e-6, relative_tol=SOLUTION_RELATIVE_TOLERANCE):
    """Verify active constraints, used-variable bounds, and discrete decisions.

    Unused free variables need not be returned by the solver. Fixed variables
    and variables referenced by an active constraint/objective must be valid.
    """
    scan = scan if scan is not None else scan_constraint_violations(model, tol=tol, relative_tol=relative_tol)
    if scan['status'] != 'complete' or scan['count']:
        return False
    required = {}
    for kind in (Constraint, Objective):
        for component in model.component_data_objects(kind, active=True, descend_into=True):
            expression = component.body if kind is Constraint else component.expr
            required.update((id(var), var) for var in identify_variables(expression, include_fixed=True))
    required.update((id(var), var) for var in model.component_data_objects(Var, descend_into=True) if var.fixed)
    for var in required.values():
        number = value(var, exception=False)
        if number is None or not math.isfinite(number):
            return False
        for bound, sign in ((var.lb, -1), (var.ub, 1)):
            if bound is not None:
                if not math.isfinite(bound) or sign * (number - bound) > tol:
                    return False
        if var.is_binary() and min(abs(number), abs(number - 1)) > tol:
            return False
        if var.is_integer() and abs(number - round(number)) > tol:
            return False
    return True


def _preview(data, depth=0):
    if depth > 5:
        return "[omitted]"
    if isinstance(data, dict):
        return {str(k): _preview(v, depth + 1) for k, v in list(data.items())[:12]}
    if isinstance(data, (list, tuple)):
        return [_preview(v, depth + 1) for v in data[:4]]
    if isinstance(data, float) and not math.isfinite(data):
        return None
    if data is None or isinstance(data, (bool, int, float)):
        return data
    return str(data)[:300]


def build_diagnosis_context(scenario):
    """Keep status/evidence intact and budget table samples separately."""
    inputs = scenario.get("data_input") or {}
    tables = inputs.get("df_parameters") or {}
    results = scenario.get("results") or {}
    scan = results.get("constraints_violations") or unavailable_constraint_scan()
    scan = {key: val for key, val in scan.items() if key != "violations"}
    scan["violations"] = [
        {key: _preview(val) for key, val in record.items()}
        for record in (results.get("constraints_violations") or {}).get("violations", [])[:25]
    ]
    priority = [
        "PadRates", "FlowbackRates", "CompletionsDemand", "InitialDisposalCapacity",
        "DisposalOperatingCapacity", "InitialStorageCapacity", "InitialTreatmentCapacity",
        "NodeCapacities", "InitialPipelineCapacity", "ReuseMinimum", "ReuseCapacity",
        "TruckingTime", "TruckingHourlyCost", "ExtWaterSourcingAvailability",
    ]
    samples = {}
    used = 0
    for name in dict.fromkeys([*priority, *sorted(tables)]):
        if name not in tables:
            continue
        sample = {"preview": _preview(tables[name]), "sampleOnly": True}
        size = len(json.dumps({name: sample}))
        if used + size > 14000:
            continue
        samples[name] = sample
        used += size
    return {
        "scenario": {"id": scenario.get("id"), "name": _preview(scenario.get("name"))},
        "resultsStatus": results.get("status"),
        "terminationCondition": results.get("terminationCondition"),
        "constraintsViolations": scan,
        "limitations": DIAGNOSTIC_LIMITATION,
        "optimizationSettings": {key: _preview(val) for key, val in (scenario.get("optimization") or {}).items()},
        "overrideValues": _preview(scenario.get("override_values") or {}),
        "validation": _preview(scenario.get("validation") or {}),
        "editableInputTables": sorted(tables),
        "setsSample": _preview(inputs.get("df_sets") or {}),
        "inputTableSamples": samples,
        "omittedInputTables": sorted(set(tables) - set(samples)),
    }
