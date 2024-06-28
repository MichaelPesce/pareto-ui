export const descriptions = {
    objective: <div>Select what you would like to solve for.</div>,
    runtime:  <div> 
                  This setting limits the runtime for the solver to find a solution. 
                  Note that this time does not include time to build the model and process output.
              </div>,
    pipelineCost: <div>
                        There are two ways pipeline capacity expansion costs can be calculated:<br/>
                        -Distance based:  Uses pipeline distance, diameter and  $/inch-mile rate<br/>
                        -Capacity based: Uses pipeline capacity and $/bbl rate
                  </div>,
    optimalityGap: <div>
                  Measure of optimality guaranteed 
                  (example: 0% gap is the mathematically proven best possible solution, 3% optimality 
                  gap ensures that the reported solution is within 3% of the best theoretically possible solution). 
                  Please note that runtime limits may supersede the optimality gap settings.
            </div>,
    waterQuality: <div>
                      PARETO can also consider water quality in the model, select how you would like to include it in the model:<br/>
                      -False: Model does not consider water quality.<br/>
                      -Post Process: Calculates the water quality after optimization. The model cannot impose quality restrictions.<br/>
                      -Discrete: Utilize a discrete model to incorporate water quality into decisions. This model can impose quality restrictions. For example, a maximum TDS allowed at a treatment facility.
                  </div>,
    hydraulics: <div>
                  PARETO's hydraulics module allows the user to determine pumping needs and compute pressures at every node in the network while considering maximum allowable operating pressure (MAOP) constraints. Select how you would like to include it in the model:<br/>
                  -False: This option allows the user to skip the hydraulics computations in the PARETO model.<br/>
                  -Post Process: PARETO first solves for optimal flows and network design. Afterwards, the hydraulics block containing constraints for pressure balances and losses is solved.<br/>
                  -Co-Optimize: In this method, the hydraulics model block is solved together with the produced water flow and network design. Note: The co-optimize model as currently implemented requires the following MINLP solvers: SCIP and BARON.
              </div>,
    solver: <div>
              Select the solver you would like to use. Note: Gurobi requires a license. 
              If you do not have a Gurobi licence, select "CBC", an open source solver.
            </div>,
    units: <div>
            Choose whether you would like to build the model with scaled units or user units.
          </div>,
    scaleModel: <div>
            Choose whether you would like to scale the model or not.
          </div>,
  }