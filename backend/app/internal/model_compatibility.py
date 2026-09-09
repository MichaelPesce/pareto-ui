"""Narrow adapters for the installed parent model's empty-facility cases."""

def prepare_model_for_ui(model):
    """Keep zero emissions dimensionally valid when an optional facility is absent.

    The parent sums empty terms to a bare 0, then multiplies some of those by
    time. Its report subsequently tries to add that time quantity to emissions
    mass. Replacing only the provably empty terms with zero mass preserves the
    numeric optimization problem and permits reports for simpler networks.
    """
    if not hasattr(model, 'model_units'):
        return model
    empty_terms = {
        'e_TotalTruckingEmissions': not len(model.s_LLT),
        'e_TotalPipeOperationsEmissions': not len(model.s_LLA),
        'e_TotalPipeInstallEmissions': not len(model.s_LLA) or not len(model.s_D),
        'e_TotalStorageEmissions': not len(model.s_S),
        'e_TotalTreatmentEmissions': not len(model.s_R) or not len(model.s_WT),
    }
    for name, empty in empty_terms.items():
        component = getattr(model, name, None)
        if empty and component is not None:
            for expression in component.values():
                expression.set_value(0 * model.model_units['mass'])
    if not len(model.s_F) and hasattr(model, 'e_WaterAvailable'):
        for period in model.s_T:
            model.e_WaterAvailable[period].set_value(model.e_TotalPW[period])
    if not len(model.s_CP) and hasattr(model, 'e_TimePeriodDemand'):
        for expression in model.e_TimePeriodDemand.values():
            expression.set_value(0 * model.model_units['volume'])
    return model
