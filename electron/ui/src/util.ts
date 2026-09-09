import { useEffect } from 'react';

import { 
  blueIcon, 
  disposalIcon, 
  treatmentIcon, 
  completionsPadIcon, 
  productionPadIcon, 
  networkNodeIcon, 
  storageSiteIcon, 
  reuseOptionIcon, 
  externalWaterSourceIcon
} from './assets/custom-icons';
import {
  CoordinateTuple,
  DimensionIndexedTable,
  SeriesByKey,
  Cell,
} from 'types';

export const NetworkNodeTypes = {
  TreatmentSite: {
    key: 'R',
    name: 'TreatmentSite',
    displayName: 'Treatment Site',
    icon: treatmentIcon,
	  iconUrl: 'img/target-green.png',
    additionalFields: [
      {
        key: "TreatmentTechnology",
        displayName: "Treatment Technology",
        type: "dropdown",
        /* TODO: these options should ideally come from the scenario (df_sets[TreatmentTechnologies])*/
        defaultOptions: ["CB", "CB-EV", "MVC", "MD"],
        defaultValue: "",
      },
      {
        key: "Capacity",
        displayName: "Treatment Capacity",
        type: "dynamic_dropdown",
        reliesOn: "TreatmentTechnology",
        usesKey: "TreatmentCapacityIncrements",
        defaultOptions: [0],
        defaultValue: 0,
      },
      {
        key: "DesalinationSites",
        displayName: "Desalination Technology",
        type: "boolean",
        defaultValue: 0,
        tip: "non-desalination (false) or desalination technology (true)"
      },
      {
        key: "Elevation",
        displayName: "Elevation",
        type: "number",
        defaultValue: 0,
        units: "foot"
      },
    ]
  },
  ProductionPad: {
    key: 'PP',
    name: 'ProductionPad',
    displayName: 'Production Pad',
    icon: productionPadIcon,
	  iconUrl: 'img/donut-green.png',
    additionalFields: [
      {
        key: "PadWaterQuality",
        displayName: "Water Quality",
        type: "number",
        defaultValue: 0,
        unit: "TDS"
      },
      {
        key: "Elevation",
        displayName: "Elevation",
        type: "number",
        defaultValue: 0,
        units: "foot"
      },
      {
        key: "TruckingHourlyCost",
        displayName: "Trucking Hourly Cost",
        type: "number",
        defaultValue: 0,
        units: "USD/hour"
      }
    ]
  },
  CompletionsPad: {
    key: 'CP',
    name: 'CompletionsPad',
    displayName: 'Completion Pad',
    icon: completionsPadIcon,
	  iconUrl: 'img/forbidden-green.png',
    additionalFields: [
      {
        key: "CompletionsPadStorage",
        displayName: "Storage Capacity",
        type: "number",
        defaultValue: 0,
        units: "bbl/day",
      },
      {
        key: "ReuseOperationalCost",
        displayName: "Operational Cost",
        type: "number",
        defaultValue: 0,
        units: "USD/bbl",
      },
      {
        key: "PadOffloadingCapacity",
        displayName: "Offloading Capacity",
        type: "number",
        defaultValue: 0,
        units: "bbl/day",
      },
      {
        key: "PadStorageInitialWaterQuality",
        displayName: "Initial Water Quality",
        type: "number",
        defaultValue: 0,
        unit: "TDS"
      },
      {
        key: "PadWaterQuality",
        displayName: "Water Quality",
        type: "number",
        defaultValue: 0,
        unit: "TDS"
      },
      {
        key: "CompletionsPadOutsideSystem",
        displayName: "Outside System",
        type: "boolean",
        defaultValue: 0,
        tip: "outside system (true) or not (false)"
      },
      {
        key: "Elevation",
        displayName: "Elevation",
        type: "number",
        defaultValue: 0,
        units: "foot"
      },
      {
        key: "TruckingHourlyCost",
        displayName: "Trucking Hourly Cost",
        type: "number",
        defaultValue: 0,
        units: "USD/hour"
      }
    ]
  },
  DisposalSite: {
    key: 'K',
    name: 'DisposalSite',
    displayName: 'Disposal Site',
    icon: disposalIcon,
	  iconUrl: 'img/triangle-green.png',
    additionalFields: [
      {
        key: "InitialDisposalCapacity",
        displayName: "Capacity",
        type: "number",
        defaultValue: 0,
        units: "bbl",
      },
      {
        key: "DisposalOperationalCost",
        displayName: "Operational Cost",
        type: "number",
        defaultValue: 0,
        units: "USD/bbl",
      },
      {
        key: "Elevation",
        displayName: "Elevation",
        type: "number",
        defaultValue: 0,
        units: "foot"
      },
      {
        key: "SWDDeep",
        displayName: "Depth",
        type: "boolean",
        booleanValues: {"true": "deep", "false": "shallow"},
      },
      {
        key: "SWDAveragePressure",
        displayName: "Average Pressure",
        type: "number",
        defaultValue: 0,
        units: "psi/ft",
      },
      {
        key: "SWDProxPAWell",
        displayName: "Prox. to P&A'd well",
        type: "number",
        defaultValue: 0,
        units: "miles",
      },
      {
        key: "SWDProxInactiveWell",
        displayName: "Prox. to inactive well",
        type: "number",
        defaultValue: 0,
        units: "miles",
      },
      {
        key: "SWDProxEQ",
        displayName: "Prox. to earthquakes",
        type: "number",
        defaultValue: 0,
        tip: "earthquakes >= 3.0 magnitude",
        units: "miles",
      },
      {
        key: "SWDProxFault",
        displayName: "Prox. to fault",
        type: "number",
        defaultValue: 0,
        units: "miles",
      },
      {
        key: "SWDProxHpOrLpWell",
        displayName: "Prox. to injection well",
        type: "number",
        defaultValue: 0,
        units: "miles",
        tip: "proximity to high pressure or low pressure injection well",
      },
    ]
  },
  StorageSite: {
    key: 'S',
    name: 'StorageSite',
    displayName: 'Storage Site',
    icon: storageSiteIcon,
	  iconUrl: 'img/polygon-green.png', 
    additionalFields: [
      {
        key: "InitialStorageCapacity",
        displayName: "Capacity",
        type: "number",
        defaultValue: 0,
        units: "bbl",
      },
      {
        key: "StorageInitialWaterQuality",
        displayName: "Water Quality",
        type: "number",
        defaultValue: 0,
        units: "mg/liter",
      },
      {
        key: "Elevation",
        displayName: "Elevation",
        type: "number",
        defaultValue: 0,
        units: "foot"
      },
    ]
  },
  NetworkNode: {
    key: 'N',
    name: 'NetworkNode',
    displayName: 'Network Node',
    icon: networkNodeIcon,
	  iconUrl: 'img/placemark_circle.png',
    additionalFields: [
      {
        key: "NodeCapacities",
        displayName: "Capacity",
        type: "number",
        defaultValue: null,
        units: "bbl/day",
      },
      {
        key: "Elevation",
        displayName: "Elevation",
        type: "number",
        defaultValue: 0,
        units: "foot"
      },
    ]
  },  
  ExternalWaterSource: {
    key: 'R',
    name: 'ExternalWaterSource',
    displayName: 'Ext. Water Source',
    icon: externalWaterSourceIcon,
	  iconUrl: 'img/square-green.png',
    additionalFields: [
      {
        key: "Elevation",
        displayName: "Elevation",
        type: "number",
        defaultValue: 0,
        units: "foot"
      },
      {
        key: "ExternalWaterQuality",
        displayName: "Water Quality",
        type: "number",
        defaultValue: 0,
        units: "mg/liter"
      },
      {
        key: "ExternalSourcingCost",
        displayName: "Cost",
        type: "number",
        defaultValue: 0,
        units: "USD/bbl"
      },
      {
        key: "TruckingHourlyCost",
        displayName: "Trucking Hourly Cost",
        type: "number",
        defaultValue: 0,
        units: "USD/hour"
      }
    ]
  },
  ReuseOption: {
    key: 'O',
    name: 'ReuseOption',
    displayName: 'Reuse Option',
    icon: reuseOptionIcon,
    iconUrl: 'img/open-diamond-green.png',
    additionalFields: [
      {
        key: "ReuseOperationalCost",
        displayName: "Operational Cost",
        type: "number",
        defaultValue: 0,
        units: "USD/bbl",
      },
      {
        key: "Elevation",
        displayName: "Elevation",
        type: "number",
        defaultValue: 0,
        units: "foot"
      },
      {
        key: "BeneficialReuseCost",
        displayName: "Beneficial Reuse Cost",
        type: "number",
        defaultValue: 0,
        units: "USD/bbl",
      },
      {
        key: "BeneficialReuseCredit",
        displayName: "Beneficial Reuse Credit",
        type: "number",
        defaultValue: 0,
        units: "USD/bbl",
      },
    ]
  }
};

export {
  AllowedPipelineArcs, getPipelineNodeTypeCode, getMapEditorNodeType, isAllowedPipelineArc,
  getAllowedPipelineFlowDirections, getAllowedPipelineConnectionCandidates,
  getPipelineConnectionIssues, reconcilePipelineOutgoingNodes,
} from './pipeline';

export const formatCoordinatesFromNodes = (nodes) => {
  const coordinates = [];
  for (const node of nodes || []) {
    const segment = node.segment_coordinates?.length ? node.segment_coordinates : [node.coordinates];
    for (const point of segment) {
      const coords = [Number(point?.[1]), Number(point?.[0])];
      const previous = coordinates[coordinates.length - 1];
      if (!previous || coords[0] !== previous[0] || coords[1] !== previous[1]) coordinates.push(coords);
    }
  }
  return coordinates;
}

const EARTH_RADIUS_MILES = 3958.7613;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/**
 * Great-circle distance (miles) between two [lon, lat] coordinates.
 */
export const calculateDistanceFromCoordinates = (startCoords, endCoords): number => {
  const lon1 = Number(startCoords?.[0]);
  const lat1 = Number(startCoords?.[1]);
  const lon2 = Number(endCoords?.[0]);
  const lat2 = Number(endCoords?.[1]);

  if ([lon1, lat1, lon2, lat2].some((v) => Number.isNaN(v))) return 0;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_MILES * c;
}

/**
 * Returns segment lengths in miles where lengths[i] is distance between
 * nodes[i] and nodes[i + 1].
 */
export const calculatePipelineSegmentLengths = (nodes = []) => {
  if (!Array.isArray(nodes) || nodes.length < 2) return [];

  const lengths = [];
  for (let i = 0; i < nodes.length - 1; i += 1) {
    const startCoords = nodes[i]?.coordinates;
    const endCoords = nodes[i + 1]?.coordinates;
    lengths.push(calculateDistanceFromCoordinates(startCoords, endCoords));
  }

  return lengths;
}

// Preserve measured or manually entered lengths on segments that survive an edit.
export const reconcilePipelineSegmentLengths = (nextNodes = [], prevNodes = [], prevLengths = []) => {
  const calculated = calculatePipelineSegmentLengths(nextNodes);
  return calculated.map((length, idx) => {
    const start = nextNodes[idx], end = nextNodes[idx + 1];
    const oldIdx = prevNodes.findIndex((node, i) =>
      node.name === start.name && prevNodes[i + 1]?.name === end.name
      && String(node.coordinates) === String(start.coordinates)
      && String(prevNodes[i + 1]?.coordinates) === String(end.coordinates));
    const previous = oldIdx >= 0 ? prevLengths[oldIdx] : undefined;
    return typeof previous === 'number' && Number.isFinite(previous) && previous >= 0 ? previous : length;
  });
};

export const reverseMapCoordinates = (coords: CoordinateTuple) => {
    try {
      if (coords?.length >= 2) {
        const coordinates = [String(coords[0]), String(coords[1])];
        return coordinates;
      }
      console.log(`coordinates formatted incorrectly: `);
      console.log(coords)
      console.log(`returning null`);
      return null;
    } catch(e) {
      console.error(`unable to reverse coords ${coords} : ${e}`);
      return null;
    }
}

/* TODO:
The following are categories that cannot be filled in by initial map parsing, assumptions.
Some will neeed AI fill, some can be filled in on the map.
Candidates for AI Fill:
  "CompletionsDemand","PadRates","FlowbackRates", "WellPressure", "InitialPipelineCapacity", 
  "InitialPipelineDiameters", "InitialTreatmentCapacity", "ReuseMinimum", "ReuseCapacity",
  "ExtWaterSourcingAvailability", "DisposalOperatingCapacity",

Manually Map fill:
  "InitialDisposalCapacity", "InitialStorageCapacity", "CompletionsPadStorage", "PadOffloadingCapacity",
  "NodeCapacities", "DisposalOperationalCost", "ReuseOperationalCost", "PipelineOperationalCost",
  "ExternalSourcingCost", "TruckingHourlyCost" (CP, PP),  "TruckingTime" (CP, PP),
  "PipelineExpansionDistance", "BeneficialReuseCost", "BeneficialReuseCredit", "ExternalWaterQuality",
  "PadWaterQuality" (CP, PP), "PadStorageInitialWaterQuality", "SWDDeep", "SWDAveragePressure",
  "SWDProxPAWell", "SWDProxInactiveWell", "SWDProxEQ", "SWDProxFault", "SWDProxHpOrLpWell", "SWDRiskFactors"

Unsure how to handle:
  "TreatmentOperationalCost", "DisposalExpansionCost", "DisposalCapacityIncrements",
  "StorageExpansionCost", "StorageCapacityIncrements", "TreatmentExpansionCost",
  "TreatmentCapacityIncrements", "PipelineCapexCapacityBased", "TreatmentExpansionLeadTime",
  "DisposalExpansionLeadTime", "StorageExpansionLeadTime", "PipelineExpansionLeadTime_Dist",
  "PipelineExpansionLeadTime_Capac", 

*/ 

export const Subcategories = {
  "Dynamic": [
      "CompletionsDemand","PadRates","FlowbackRates", "Elevation", "WellPressure",
      "InitialPipelineDiameters", "InitialPipelineCapacity","InitialDisposalCapacity","InitialStorageCapacity", "InitialTreatmentCapacity", "ReuseMinimum", "ReuseCapacity",
      "ExtWaterSourcingAvailability", "CompletionsPadStorage", "PadOffloadingCapacity", "NodeCapacities", 
      "DisposalOperatingCapacity", "DisposalOperationalCost", "TreatmentOperationalCost",
      "ReuseOperationalCost", "PipelineOperationalCost", "ExternalSourcingCost", "TruckingHourlyCost",
      "TruckingTime", "DisposalExpansionCost", "DisposalCapacityIncrements", "StorageExpansionCost",
      "StorageCapacityIncrements", "TreatmentExpansionCost", "TreatmentCapacityIncrements",
      "PipelineCapexDistanceBased", "PipelineExpansionDistance", "PipelineCapexCapacityBased", 
      "PipelineCapacityIncrements", "PipelineDiameterValues", "TreatmentEfficiency",
      "RemovalEfficiency", "DesalinationTechnologies", "DesalinationSites", "BeneficialReuseCost",
      "BeneficialReuseCredit", "CompletionsPadOutsideSystem", "Hydraulics", "Economics",
      "ExternalWaterQuality", "PadWaterQuality", "StorageInitialWaterQuality", "AirEmissionCoefficients",
      "TreatmentEmissionCoefficients", "PadStorageInitialWaterQuality",
      "TreatmentExpansionLeadTime", "DisposalExpansionLeadTime",    
      "StorageExpansionLeadTime", "PipelineExpansionLeadTime_Dist", "PipelineExpansionLeadTime_Capac",  
      "SWDDeep", "SWDAveragePressure", "SWDProxPAWell", "SWDProxInactiveWell", "SWDProxEQ", "SWDProxFault", "SWDProxHpOrLpWell", "SWDRiskFactors",
       
      // The following are in the excel sheets, do we want them in pareto?
      // "ProductionsPads", "CompletionsPads", "ExternalWaterSources", "WaterQualityComponents", "AirEmissionsComponents", "StorageSites", "TreatmentSites", "TreatmentTechnologies", "ReuseOptions",
      // "NetworkNodes", "PipelineDiameters", "StorageCapacities", "TreatmentCapacities", "InjectionCapacities",

      // "DesalinationSurrogate", 
  ],
  "Static": [
      "PNA", "CNA", "CCA", "NNA", "NCA", "NKA", "NRA", "NSA", "FCA", "RCA", "RNA", "RSA",
      "SCA", "SNA", "ROA", "RKA", "SOA", "NOA", "PCT", "PKT", "FCT", "CST", "CCT", "CKT",
      "RST", "ROT", "SOT", "RKT"
  ]
}

export const TerminationConditions = {
  "maxTimeLimit":	"Exceeded maximum time limit allowed",
  "maxIterations":	"Exceeded maximum number of iterations allowed",
  "minFunctionValue":	"Found solution smaller than specified function value",
  "minStepLength":	"Step length is smaller than specified limit",
  "globallyOptimal":	"Found a globally optimal solution",
  "locallyOptimal":	"Found a locally optimal solution",
  "optimal":	"Found an optimal solution",
  "maxEvaluations":	"Exceeded maximum number of problem evaluations (e.g., branch and bound nodes)",
  "other":	"Other, uncategorized normal termination",
  "unbounded": "Demonstrated that problem is unbounded",
  "infeasible":	"Demonstrated that problem is infeasible",
  "invalidProblem":	"The problem setup or characteristics are not valid for the solver",
  "solverFailure":	"Solver failed to terminate correctly",
  "internalSolverError":	"Internal solver error",
  "error": "Other error",
  "userInterrupt":	"Interrupt signal generated by user",
  "resourceInterrupt":	"Interrupt signal in resources used by the solver",
  "licensingProblem":	"Problem accessing solver license"
}

export const ParetoDictionary = {
  "PNA": "Production-to-node pipeline arcs",
  "CNA": "Completions-to-node pipeline arcs",
  "CCA": "Completions-to-completions pipeline arcs",
  "NNA": "Node-to-node pipeline arcs",
  "NCA": "Node-to-completions pipeline arcs",
  "NKA": "Node-to-disposal pipeline arcs",
  "NRA": "Node-to-treatment pipeline arcs",
  "NSA": "Node-to-storage pipeline arcs",
  "FCA": "External Water-to-completions pipeline arcs",
  "RCA": "Treatment-to-completions pipeline arcs",
  "RNA": "Treatment-to-node pipeline arcs",
  "RSA": "Treatment-to-storage pipeline arcs",
  "SCA": "Storage-to-completions pipeline arcs",
  "SNA": "Storage-to-node pipeline arcs",
  "ROA": "Treatment-to-reuse pipeline arcs",
  "RKA": "Treatment-to-disposal pipeline arcs",
  "SOA": "Storage-to-reuse pipeline arcs",
  "NOA": "Node-to-reuse pipeline arcs",
  "PCT": "Production-to-completions trucking arcs",
  "PKT": "Production-to-disposal trucking arcs",
  "FCT": "External Water-to-completions trucking arcs",
  "CST": "Completions-to-storage trucking arcs",
  "CCT": "Completions-to-completions trucking arcs (flowback reuse)",
  "CKT": "Completions-to-disposal trucking arcs",
  "RST": "Treatment-to-storage trucking arcs",
  "ROT": "Treatment-to-reuse trucking arcs",
  "SOT": "Storage-to-reuse trucking arcs",
  "RKT": "Treatment-to-disposal trucking arcs",
  "CompletionsPadOutsideSystem": "Binary parameter designating the completion pads that are outside the system",
  "DesalinationTechnologies": "Binary parameter designating which treatment technologies are for desalination (1) and which are not (0)",
  "DesalinationSites": "Binary parameter designating which treatment sites are for desalination (1) and which are not (0)",
  "TruckingTime": "",
  "CompletionsDemand": "",
  "PadRates": "",
  "FlowbackRates": "",
  "NodeCapacities": "",
  "InitialPipelineCapacity": "",
  "InitialDisposalCapacity": "",
  "InitialTreatmentCapacity": "",
  "ExtWaterSourcingAvailability": "",
  "PadOffloadingCapacity": "",
  "CompletionsPadStorage": "",
  "DisposalOperationalCost": "",
  "TreatmentOperationalCost": "",
  "ReuseOperationalCost": "",
  "PipelineOperationalCost": "",
  "FreshSourcingCost": "",
  "TruckingHourlyCost": "",
  "PipelineDiameterValues": "",
  "DisposalCapacityIncrements": "",
  "InitialStorageCapacity": "",
  "StorageCapacityIncrements": "",
  "TreatmentCapacityIncrements": "",
  "TreatmentEfficiency": "",
  "DisposalExpansionCost": "",
  "StorageExpansionCost": "",
  "TreatmentExpansionCost": "",
  "PipelineCapexDistanceBased": "",
  "PipelineCapexCapacityBased": "",
  "PipelineCapacityIncrements": "",
  "PipelineExpansionDistance": "",
  "Hydraulics": "",
  "Economics": "",
  "PadWaterQuality": "",
  "StorageInitialWaterQuality": "",
  "PadStorageInitialWaterQuality": "",
  "DisposalOperatingCapacity": "",

  "v_F_Overview_dict": "Results overview",
  "v_F_Piped_dict": "Produced water piped from one location to another location",
  "v_C_Piped_dict": "Cost of piping produced water from one location to another location",
  "v_F_Trucked_dict": "Water trucked from one location to another location",
  "v_C_Trucked_dict": "Cost of trucking produced water from one location to another location",
  "v_F_Sourced_dict": "External water sourced from source to completions",
  "v_C_Sourced_dict": "Cost of sourcing external water from source to completions pad",
  "v_F_PadStorageIn_dict": "Water put into completions pad storage",
  "v_F_PadStorageOut_dict": "Water removed from completions pad storage",
  "v_C_Disposal_dict": "Cost of injecting produced water at disposal site",
  "v_C_Treatment_dict": "Cost of treating produced water at treatment site",
  "v_C_Reuse_dict": "Total cost of reusing produced water",
  "v_C_Storage_dict": "Cost of storing produced water at storage site (incl. treatment)",
  "v_R_Storage_dict": "Credit for retrieving stored produced water from storage site",
  "v_L_Storage_dict": "Water level at storage site at the end of time period t",
  "v_L_PadStorage_dict": "Water level in completions pad storage at the end of time period t",
  "vb_y_Pipeline_dict": "New pipeline installed between one location and another location with specific diameter",
  "vb_y_Disposal_dict": "New or additional disposal facility installed at disposal site with specific injection capacity",
  "vb_y_Storage_dict": "New or additional storage facility installed at storage site with specific storage capacity",
  "vb_y_Flow_dict": "Directional flow between two locations",
  "vb_y_Treatment_dict": "New or additional treatment capacity installed at treatment site with specific treatment capacity and treatment technology",
  "v_D_Capacity_dict": "Disposal capacity in a given time period at disposal site",
  "v_T_Capacity_dict": "Treatment capacity in a given time period at treatment site",
  "v_X_Capacity_dict": "Storage capacity in a given time period at storage site",
  "v_F_Capacity_dict": "Flow capacity in a given time period between two locations",
  "v_F_ReuseDestination_dict": "",
  "v_F_DisposalDestination_dict": "Water injected at disposal site",
  "quality.v_Q_dict": "",
  "v_F_DesalinatedWater_dict": "Water removed from system post desalination",
  "v_F_ResidualWater_dict": "Flow of residual water out at a treatment site",
  "v_F_TreatedWater_dict": "Flow of treated water out at a treatment site",
  "v_F_StorageEvaporationStream_dict": "Water at storage lost to evaporation",
  "v_F_CompletionsDestination_dict": "All water delivered to completions pad",
  "v_Q_CompletionPad_dict": "",
  "v_DQ_dict": "",
  "v_F_DiscretePiped_dict": "",
  "v_F_DiscreteTrucked_dict": "",
  "v_F_DiscreteDisposalDestination_dict": "Water injected at disposal site for each discrete quality",
  "v_F_DiscreteFlowOutStorage_dict": "",
  "v_L_DiscreteStorage_dict": "",
  "v_F_DiscreteFlowTreatment_dict": "",
  "v_F_DiscreteFlowOutNode_dict": "",
  "v_F_DiscreteBRDestination_dict": "",
  "v_F_DiscreteFlowCPIntermediate_dict": "",
  "v_F_DiscreteFlowCPStorage_dict": "",
  "v_L_DiscretePadStorage_dict": "",
  "v_F_DiscreteFlowOutPadStorage_dict": "",
  "v_F_DiscreteFlowInPadStorage_dict": "",
  "v_F_DiscreteCPDestination_dict": "",
  "v_F_BeneficialReuseDestination_dict": "Water delivered to beneficial reuse",
  "v_S_FracDemand_dict": "",
  "v_S_Production_dict": "",
  "v_S_Flowback_dict": "",
  "v_S_PipelineCapacity_dict": "",
  "v_S_StorageCapacity_dict": "",
  "v_S_DisposalCapacity_dict": "",
  "v_S_TreatmentCapacity_dict": "",
  "v_S_ReuseCapacity_dict": "",
  "SWDDeep": "Binary parameter designating which disposal sites are shallow (0) and which are deep (1)",
  "SWDAveragePressure": "Average pressure/depth in vicinity of well",
  "SWDProxPAWell": "Proximity to Plugged & Abandoned wells",
  "SWDProxInactiveWell": "Proximity to inactive/temporarily abandoned formerly producing well (completed prior to 2000)",
  "SWDProxEQ": "Proximity to earthquakes >= 3.0 magnitude",
  "SWDProxFault": "Disposal proximity to Fault",
  "SWDProxHpOrLpWell": "Disposal proximity to high pressure or low pressure injection well",
  "SWDRiskFactors": "Disposal Risk Factors",
  "AirEmissionCoefficients": "Air Emissions Coeficcients",
  "TreatmentEmissionCoefficients": "Treatment Emission Coefficients",
  // "DesalinationSurrogate": "Desalination Surrogate"
}

export const CategoryNames = {
  "CompletionsDemand":"Completions Demand",
  "DisposalOperationalCost":"Disposal Operational Cost",
  "TreatmentOperationalCost":"Treatment Operational Cost",
  "CompletionsPadOutsideSystem":"Completions PadOutside System",
  "DesalinationTechnologies":"Desalination Technologies",
  "DesalinationSites":"Desalination Sites",
  "TruckingTime":"Trucking Time",
  "PadRates":"Pad Rates",
  "FlowbackRates":"Flowback Rates",
  "NodeCapacities":"Node Capacities",
  "InitialPipelineCapacity":"Initial Pipeline Capacity",
  "InitialPipelineDiameters":"Initial Pipeline Diameters",
  "InitialDisposalCapacity":"Initial Disposal Capacity",
  "InitialTreatmentCapacity":"Initial Treatment Capacity",
  "ExtWaterSourcingAvailability": "External Water Sourcing",
  "PadOffloadingCapacity":"Pad Offloading Capacity",
  "CompletionsPadStorage":"Completions PadStorage",
  "ReuseOperationalCost":"Reuse Operational Cost",
  "PipelineOperationalCost":"Pipeline Operational Cost",
  "FreshSourcingCost":"External Water Sourcing Cost",
  "ExternalSourcingCost":"External Water Sourcing Cost",
  "TruckingHourlyCost":"Trucking Hourly Cost",
  "PipelineDiameterValues":"Pipeline Diameter Values",
  "DisposalCapacityIncrements":"Disposal Capacity Increments",
  "InitialStorageCapacity":"Initial Storage Capacity",
  "StorageCapacityIncrements":"Storage Capacity Increments",
  "TreatmentCapacityIncrements":"Treatment Capacity Increments",
  "TreatmentEfficiency":"Treatment Efficiency",
  "DisposalExpansionCost":"Disposal Expansion Cost",
  "StorageExpansionCost":"Storage Expansion Cost",
  "TreatmentExpansionCost":"Treatment Expansion Cost",
  "PipelineCapexDistanceBased":"Pipeline Capex Distance Based",
  "PipelineCapexCapacityBased":"Pipeline Capex Capacity Based",
  "PipelineCapacityIncrements":"Pipeline Capacity Increments",
  "PipelineExpansionDistance":"Pipeline Expansion Distance",
  "Hydraulics":"Hydraulics",
  "Economics":"Economics",
  "PadWaterQuality":"Pad Water Quality",
  "StorageInitialWaterQuality":"Storage Initial Water Quality",
  "PadStorageInitialWaterQuality":"Pad Storage Initial Water Quality",
  "DisposalOperatingCapacity":"Disposal Operating Capacity",
  "RemovalEfficiency": "Removal Efficiency",
  "WellPressure": "Well Pressure",
  "Elevation": "Elevation",
  "ExternalWaterQuality": "External Water Quality",
  "SWDDeep": "Deep Disposal Sites",
  "SWDAveragePressure": "Disposal Average Pressure",
  "SWDProxPAWell": "Disposal Proximity to PA'd Wells",
  "SWDProxInactiveWell": "Disposal Proximity to Inactive Wells",
  "SWDProxEQ": "Disposal Proximity to Earthquakes",
  "SWDProxFault": "Disposal proximity to fault",
  "SWDProxHpOrLpWell": "Disposal Proximity to HP/LP Well",
  "SWDRiskFactors": "Disposal Risk Factors",
  "AirEmissionCoefficients": "Air Emissions Coeficcients",
  "TreatmentEmissionCoefficients": "Treatment Emission Coefficients",
  // "DesalinationSurrogate": "Desalination Surrogate",
  "PNA":"PNA",
  "CNA":"CNA",
  "CCA":"CCA",
  "NNA":"NNA",
  "NCA":"NCA",
  "NKA":"NKA",
  "NRA":"NRA",
  "NSA":"NSA",
  "FCA":"FCA",
  "RCA":"RCA",
  "RNA":"RNA",
  "RSA":"RSA",
  "SCA":"SCA",
  "SNA":"SNA",
  "PCT":"PCT",
  "PKT":"PKT",
  "FCT":"FCT",
  "CST":"CST",
  "CCT":"CCT",
  "CKT":"CKT",

  "vb_y_overview_dict": "Infrastructure Buildout",
  "v_F_PadStorageIn_dict":"Pad Storage In",
  "v_F_PadStorageOut_dict":"Pad Storage Out",
  "v_F_ReuseDestination_dict":"Reuse Destination",
  "v_F_DisposalDestination_dict":"Disposal Destination",
  "quality.v_Q_dict":"Water Quality",
  "v_F_DesalinatedWater_dict":"Desalinated Water",
  "v_F_ResidualWater_dict":"Residual Water",
  "v_F_TreatedWater_dict":"Treated Water",
  "v_F_StorageEvaporationStream_dict":"Storage Evaporation Stream",
  "v_F_CompletionsDestination_dict":"Completions Destination",
  "v_Q_CompletionPad_dict":"Completions Pad Water Quality",
  "v_DQ_dict":"Discrete Water Quality",
  "v_F_DiscretePiped_dict":"Discrete Piped",
  "v_F_DiscreteTrucked_dict":"Discrete Trucked",
  "v_F_DiscreteDisposalDestination_dict":"Discrete Disposal Destination",
  "v_F_DiscreteFlowOutStorage_dict":"Discrete Flow Out Storage",
  "v_L_DiscreteStorage_dict":"Water Level Discrete Storage",
  "v_F_DiscreteFlowTreatment_dict":"Discrete Flow Treatment",
  "v_F_DiscreteFlowOutNode_dict":"Discrete Flow Out Node",
  "v_F_DiscreteBRDestination_dict":"Discrete BR Destination",
  "v_F_DiscreteFlowCPIntermediate_dict":"Discrete Flow CP Intermediate",
  "v_F_DiscreteFlowCPStorage_dict":"Discrete Flow CP Storage",
  "v_L_DiscretePadStorage_dict":"Water Level Discrete Pad Storage",
  "v_F_DiscreteFlowOutPadStorage_dict":"Discrete Flow Out Pad Storage",
  "v_F_DiscreteFlowInPadStorage_dict":"Discrete Flow In Pad Storage",
  "v_F_DiscreteCPDestination_dict":"Discrete CP Destination",
  "v_F_BeneficialReuseDestination_dict":"Beneficial ReuseDestination",
  "v_S_FracDemand_dict":"Slack Frac Demand",
  "v_S_PipelineCapacity_dict":"Slack Pipeline Capacity",
  "v_S_StorageCapacity_dict":"Slack Storage Capacity",
  "v_S_DisposalCapacity_dict":"Slack Disposal Capacity",
  "v_S_TreatmentCapacity_dict":"Slack reatment Capacity",
  "v_S_ReuseCapacity_dict":"Slack Reuse Capacity",
  "v_S_BeneficialReuseCapacity_dict": "Slack Beneficial Reuse Capacity",
  "hydraulics.v_PumpHead_dict": "Hydraulics Pump Head",
  "hydraulics.vb_Y_Pump_dict": "Hydraulics New Pump",
  "hydraulics.v_ValveHead_dict": "Hydraulics Valve Head",
  "hydraulics.v_PumpCost_dict": "Hydraulics Pump Cost",
  "hydraulics.v_Pressure_dict": "Hydraulics Pressure",
  "quality.v_X": "Water Quality", 
  "hydraulics.v_Z_HydrualicsCost": "Hydraulics Cost",
  "v_Z": "Objective",
  "v_R_TotalStorage": "Credit Total Storage",
  "v_R_BeneficialReuse_dict": "Credit Beneficial Reuse",
  "vb_y_BeneficialReuse_dict": "Beneficial Reuse Usage",
  "reuse_WaterKPI": "Produced Water Recycle Rate",
  "disposal_WaterKPI": "Produced Water Disposal Rate",
  "fresh_CompletionsDemandKPI": "Completions Demand External Water Rate",
  "reuse_CompletionsDemandKPI": "Recycle Rate",
  "ReuseCapacity": "Reuse Capacity", 
  "ReuseMinimum": "Reuse Minimum", 
  "BeneficialReuseCredit": "Beneficial Reuse Credit",
  "BeneficialReuseCost": "Beneficial Reuse Cost",
  "TreatmentExpansionLeadTime": "Treatment Expansion",
  "DisposalExpansionLeadTime": "Disposal Expansion", 
  "StorageExpansionLeadTime": "Storage Expansion",
  "PipelineExpansionLeadTime_Dist": "Pipeline Expansion Distance Based", 
  "PipelineExpansionLeadTime_Capac": "Pipeline Expansion Capacity Based",
  "Solver_Stats_dict": "Solver Stats",
  "e_TotalTruckingEmissions_dict": "Trucking Emissions",
  "e_TotalPipeOperationsEmissions_dict": "Pipe Operation Emissions",
  "e_TotalPipeInstallEmissions_dict": "Pipe Installation Emissions",
  "e_TotalDisposalEmissions_dict": "Disposal Emissions",
  "e_TotalStorageEmissions_dict": "Storage Emissions",
  "e_TotalTreatmentEmissions_dict": "Treatment Emissions",
  "e_TotalEmissionsByComponent_dict": "Emissions by Component",
  "e_TotalPW_dict": "Total Produced Water",
  "e_MaxPWCapacity_dict": "Produced Water Capacity",
  "e_TimePeriodDemand_dict": "Demand Over Time",
  "e_WaterAvailable_dict": "Available Water",
  "e_capacity_check_dict": "Capacity Check",
  "e_demand_check_dict": "Demand Check"
}

export const default_override_values = {
  "vb_y_overview_dict": {}, "v_F_Piped_dict": {}, "v_F_Sourced_dict": {}, "v_F_Trucked_dict": {}, "v_L_Storage_dict": {}, "v_L_PadStorage_dict": {}, "vb_y_Pipeline_dict": {}, "vb_y_Disposal_dict": {}, "vb_y_Storage_dict": {}, "vb_y_Treatment_dict": {}
}

export const useKeyDown = (
  key,
  singleKeyCallback,
  shiftKeyCallback,
  controlKeyCallback,
  shiftAndControlKeyCallback,
  keepDefaultBehavior
) => {
  const onKeyDown = (event) => {
    const wasKeyPressed = event.key === key;
    if (wasKeyPressed) {
      if (!keepDefaultBehavior) event.preventDefault();

      if ((event.metaKey || event.ctrlKey) && event.shiftKey && shiftAndControlKeyCallback) {
        shiftAndControlKeyCallback();
      } else if ((event.metaKey || event.ctrlKey) && controlKeyCallback) {
        controlKeyCallback();
      } else if (event.shiftKey && shiftKeyCallback) {
        shiftKeyCallback();
      } else if (singleKeyCallback) {
        singleKeyCallback();
      }
    }
  };

  useEffect(() => {
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onKeyDown]);
};

export const convertMapDataToBackendFormat = (nodeData, lineData) => {
 /*
  Input: map data in leaflet format
  Output: map data in db format
 */
  const all_nodes = {};
  const arcs = {};
  nodeData?.forEach((node) => {
    const { name, coordinates, nodeType } = node;
    const stringCoordinates = coordinates.map((c) => `${c}`);
    all_nodes[name] = {
      ...node,
      name,
      node_type: nodeType,
      coordinates: stringCoordinates,
    }
  })
  lineData?.forEach((line) => {
    const { name } = line;
    arcs[name] = {
      ...line,
      name,
      node_type: "path",
    }
  })
  return {
    all_nodes,
    arcs,
  }
}

export const convertMapDataToFrontendFormat = (map_data) => {
  /* 
    Input: map data in db format
    Output: nodeData, lineData, and mapCenter for leaflet map
  */
  const points = map_data?.all_nodes;
  const lines = map_data?.arcs;

  const lineData = []
  const nodeData = []
  
  let amt = 0
  let totalCoords = [0, 0]
  for (let key of Object.keys(points)) {
    let node_object = points[key]
    let dataObject = {
      ...node_object,
      name: key
    }
    let coords = node_object.coordinates
    let coordinates = [parseFloat(coords[0]), parseFloat(coords[1])]
    let nodeType = node_object.node_type;
    if (nodeType && Object.keys(NetworkNodeTypes).includes(nodeType)) {
        nodeType = node_object.node_type;
    } else {
        nodeType = "NetworkNode"
    }
    dataObject.nodeType = nodeType
    dataObject.coordinates = coordinates
    nodeData.push(dataObject)

    amt+=1
    totalCoords[0] += parseFloat(coords[0])
    totalCoords[1] += parseFloat(coords[1])
  }
  for (let key of Object.keys(lines)) {
      let line_object = lines[key]
      let newLineObject = {
          ...line_object,
          name: key,
      }
      for (let n of line_object.nodes) {
        let coords = n.coordinates;
        if (coords && coords.length > 1) {
          amt+=1;
          totalCoords[0]+=parseFloat(coords[0]);
          totalCoords[1]+=parseFloat(coords[1]);
        }
      }
      lineData.push(newLineObject)
  }
  let mapCenter;
  if (totalCoords[1] && totalCoords[0])
    mapCenter = [totalCoords[1]/amt, totalCoords[0]/amt]
  else mapCenter = undefined
  return [nodeData, lineData, mapCenter]
}

export const convertTreatmentCapacityIncrementsToDict = (
  table?: DimensionIndexedTable<"TreatmentCapacities", string, Cell>
): SeriesByKey<string, Cell> => {
  /*
    Input format:
      {
        TreatmentCapacities: ["CB", "CB-EV", ...],
        J0: [0, 0, ...],
        J1: [10000, 10000, ...],
        ...
      }
    Output format:
      {
        "CB": [0, 10000, ...],
        "CB-EV": [0, 10000, ...],
        ...
      }
  */
  if (!table || typeof table !== "object") return {};

  const treatmentTechnologies = Array.isArray(table?.TreatmentCapacities)
    ? table.TreatmentCapacities
    : [];
  if (!treatmentTechnologies.length) return {};

  const incrementColumns = Object.keys(table)
    .filter((key) => key !== "TreatmentCapacities" && Array.isArray(table[key]))
    .sort((a, b) => {
      const aMatch = a.match(/^J(\d+)$/);
      const bMatch = b.match(/^J(\d+)$/);
      if (aMatch && bMatch) return Number(aMatch[1]) - Number(bMatch[1]);
      return a.localeCompare(b);
    });

  const result: SeriesByKey<string, Cell> = {};
  treatmentTechnologies.forEach((tech, techIdx) => {
    result[tech] = incrementColumns.map((columnKey) => table[columnKey][techIdx]);
  });

  return result;
}

export const generateNewName = (nodeList, nodeType = "Node") => {
  let i = 1;
  const newName = `New ${nodeType}`
  nodeList.forEach((node) => {
    const { name } = node;
    if (name === `New ${nodeType}_${i}`) i+=1;
  })
  return `New ${nodeType}_${i}`;

}

export const checkIfNameIsUnique = (nodeList, new_name, node_idx) => {
  let isUnique = true;
  nodeList.forEach((node, idx) => {
    const { name } = node;
    if (name === new_name && idx !== node_idx) isUnique = false;
  })
  return isUnique;

}
