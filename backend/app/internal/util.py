from pyomo.environ import (
    Var,
    Param,
    Set,
    ConcreteModel,
    Expression,
    Constraint,
    Objective,
    minimize,
    maximize,
    NonNegativeReals,
    Reals,
    Binary,
    Any,
    units as pyunits,
    Block,
    Suffix,
    TransformationFactory,
    value,
    SolverFactory,
)
from pareto.utilities.build_utils import (
    build_sets,
    build_common_params,
    build_common_vars,
    build_common_constraints,
    process_constraint,
)

def TotalReuseVolumeRule(model):
    constraint = model.v_F_TotalReused == (
        sum(
            sum(
                sum(
                    model.v_F_Piped[l, p, t]
                    for l in (model.s_L - model.s_F)
                    if (l, p) in model.s_LLA
                )
                + sum(
                    model.v_F_Trucked[l, p, t]
                    for l in (model.s_L - model.s_F)
                    if (l, p) in model.s_LLT
                )
                for p in model.s_CP
            )
            for t in model.s_T
        )
    )
    return process_constraint(constraint)

def CompletionsWaterDeliveriesRule(model, p, t):
    constraint = model.v_F_CompletionsDestination[p, t] == (
        sum(
            model.v_F_Piped[l, p, t]
            for l in (model.s_L - model.s_F)
            if (l, p) in model.s_LLA
        )
        + sum(model.v_F_Sourced[f, p, t] for f in model.s_F if model.p_FCA[f, p])
        + sum(
            model.v_F_Trucked[l, p, t]
            for l in (model.s_L - model.s_F)
            if (l, p) in model.s_LLT
        )
        + sum(model.v_F_Trucked[f, p, t] for f in model.s_F if model.p_FCT[f, p])
        - model.v_F_PadStorageIn[p, t]
        + model.v_F_PadStorageOut[p, t]
    )

    return process_constraint(constraint)


# model.e_CompletionsReusedFrac = Expression(
#     expr=model.v_F_TotalReused / model.e_TotalCompletionsDeliveries,
#     doc="Fraction of completions deliveries using reused water [fraction]",
# )

# model.e_TotalCompletionsDeliveries = Expression(
#     expr=sum(
#         sum(model.v_F_CompletionsDestination[cp, t] for cp in model.s_CP)
#         for t in model.s_T
#     )
#     * model.model_units["time"],
#     doc="Total deliveries to completions pads to meet completions demand [volume]",
# )