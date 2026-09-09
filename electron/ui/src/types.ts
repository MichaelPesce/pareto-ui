/**
 * Notes:
 * - Many `df_parameters` / `df_parameters` tables are “dataframe-like” objects where:
 *   - one or more keys are dimension columns (arrays of strings)
 *   - the other keys are row labels mapping to arrays of numbers/strings/"" values
 * - Several tables can be `{}` (empty) (e.g., RKA, RKT).
 * - Some numeric-looking values are provided as strings (e.g., longitude/latitude in map_data nodes).
 */

/** Common scalar types seen in tables */
export type Scalar = string | number | boolean | null;

/** Common cell value in data table arrays (often numbers or "" placeholders) */
export type Cell = string | number | null;

/** A column in a dataframe-like object */
export type Column<T = Cell> = T[];

/** Generic dataframe-like object: keys map to columns (arrays) */
export type DataFrameLike = Record<string, Column<any>>;

/**
 * Generic "dimension column + value columns" table shape.
 * Example:
 * {
 *   TreatmentCapacities: ["CB", "CB-EV"],
 *   J0: [0, 0],
 *   J1: [10000, 10000]
 * }
 */
export type DimensionIndexedTable<
  TDimensionKey extends string = string,
  TDimensionValue = string,
  TValue = Cell
> = DataFrameLike & {
  [K in TDimensionKey]: Column<TDimensionValue>;
} & Record<string, Column<TValue | TDimensionValue>>;

/** Generic output map where each key maps to a vector of values. */
export type SeriesByKey<TKey extends string = string, TValue = Cell> = Record<TKey, TValue[]>;

/**
 * `df_sets` is a dictionary of set-name -> list of set members.
 * Example: ProductionPads: ["PP01", "PP02", ...]
 */
export type DfSets = Record<string, string[]>;

/**
 * Many `df_parameters` entries look like:
 * {
 *   "ProductionPads": ["PP01", ...],
 *   "N01": [1, "", "", ""],
 *   ...
 * }
 * i.e. dimension columns (string arrays) + row vectors of Cell[].
 *
 * Some parameter tables can be empty objects {}.
 */
export type ParameterTable =
  | Record<string, string[] | Cell[]>
  | Record<string, never>; // empty object

export type DfParameters = Record<string, ParameterTable>;

/** display_units is a map from variable/table name -> unit string */
export type DisplayUnits = Record<string, string>;

/** Map units object */
export interface MapUnits {
  volume: string;
  distance: string;
  diameter: string;
  concentration: string;
  currency: string;
  time: string;
  pressure: string;
  elevation: string;
  decision_period: string;
  mass: string;

  [k: string]: string;
}

/** A node inside map_data.all_nodes */
export interface MapNode {
  longitude: string;
  latitude: string;
  altitude: string;

  heading?: string;
  tilt?: string;
  range?: string;

  /** KML-ish fields */
  "gx:altitudeMode"?: string;
  LookAt?: string;
  styleUrl?: string;
  "gx:drawOrder"?: string;

  /** coordinates are string triplets */
  coordinates?: [string, string, string] | string[];
  Point?: string;

  /** domain field */
  node_type: string;

  /** allow extra KML / app-specific properties */
  [k: string]: any;
}

/** A node reference inside an Arc definition */
export interface ArcNodeRef {
  name: string;
  incoming: boolean;
  outgoing: boolean;

  /** sometimes string triplets, sometimes number pairs TODO: convert strings in python */
  coordinates: [string, string, string] | [number, number] | any[];

  incoming_nodes?: string[];
  outgoing_nodes?: string[];

  [k: string]: any;
}

/** An arc/path object in map_data.arcs */
export interface MapArc {
  name: string;
  node_type: "path" | string;

  styleUrl?: string;
  tessellate?: string;

  /** list of coordinate triplets */
  coordinates?: Array<[string, string, string] | any[]>;

  LineString?: string;
  nodes: ArcNodeRef[];

  [k: string]: any;
}

/** Connections map: node -> list of connected node names */
export type ConnectionsMap = Record<string, string[]>;

export interface MapConnections {
  all_connections: ConnectionsMap;

  [k: string]: any;
}

export interface MapData {
  all_nodes: Record<string, MapNode>;

  ProductionPads: Record<string, any>;
  CompletionsPads: Record<string, any>;
  NetworkNodes: Record<string, any>;
  SWDSites: Record<string, any>;
  TreatmentSites: Record<string, any>;
  StorageSites: Record<string, any>;
  ExternalWaterSources: Record<string, any>;
  ReuseOptions: Record<string, any>;
  other_nodes: Record<string, any>;

  connections: MapConnections;
  arcs: Record<string, MapArc>;

  units: MapUnits;
  defaultNode: string;

  [k: string]: any;
}

export interface ScenarioDataInput {
  df_sets: DfSets;
  df_parameters: DfParameters;
  display_units: DisplayUnits;
  map_data: MapData;

  [k: string]: any;
}

export interface ScenarioOptimization {
  objective: string; // e.g. "cost"
  runtime: number;
  pipeline_cost: string;
  waterQuality: string | boolean;
  hydraulics: string | boolean;
  solver: string;
  build_units: string;
  optimalityGap: number;
  scale_model: boolean;

  [k: string]: any;
}

/**
 * Results tables are arrays-of-arrays:
 * - first row is often headers
 * - rows mix strings/numbers/null
 */
export type ResultsTable = Array<Array<Scalar>>;

/** Results.data is a map: tableName -> ResultsTable */
export interface ScenarioResultsData {
  [tableName: string]: ResultsTable;
}

export interface ConstraintViolationRecord {
  violation: number;
  side: string | null;
  constraint: string;
  lower_bound: number | null;
  body_value: number | null;
  upper_bound: number | null;
}

export interface ConstraintViolationsSummary {
  count: number;
  tolerance: number;
  logged_count?: number;
  status?: "complete" | "partial" | "unavailable";
  evaluated_count?: number;
  skipped_count?: number;
  returned_count?: number;
  truncated?: boolean;
  reason?: string;
  solution_state?: "solver_solution" | "current_model_values";
  violations: ConstraintViolationRecord[];
}

export interface ScenarioResults {
  data: ScenarioResultsData;
  constraints_violations?: ConstraintViolationsSummary;

  [k: string]: any;
}

export interface ScenarioValidation {
  revision?: string;
  state?: string;
  issues?: ValidationIssue[];
  error_count?: number;
  warning_count?: number;
  truncated?: boolean;
  model_check?: string;
  feasibility?: string;
  sections?: Array<{id: string; title: string; error_count: number; warning_count: number}>;
  units?: Record<string, string>;
  periods?: string[];
  valid?: boolean | null;
  missing_tables?: string[];
  tables_with_issues?: string[];
  check_for_missing_tables?: boolean | null;
  check_for_minimum_required_tables?: boolean | null;
  check_for_infeasibility?: boolean | null;
  error?: string | null;
}

export interface ValidationIssue {
  code: string;
  section: string;
  severity: 'error' | 'warning';
  message: string;
  table?: string | null;
  row?: string[];
  period?: string | null;
  area?: string;
}

export interface OverrideEntry {
  /** Which underlying model variable/table this entry targets */
  variable: string;

  /** Convenience flag some payloads include */
  isZero: boolean;
  indexes: string[];

  /** The actual override value (often 0/1 for binaries, but could be numeric) */
  value: number;

  number_value?: number;
}

/** Map from override-id (like "Pipeline Construction:PP04:N09:--") to entry */
export type OverrideTable = Record<string, OverrideEntry>;


export interface ScenarioOverrides {
  vb_y_overview_dict: OverrideTable;
  v_F_Piped_dict: OverrideTable;
  v_F_Sourced_dict: OverrideTable;
  v_F_Trucked_dict: OverrideTable;
  v_L_Storage_dict: OverrideTable;
  v_L_PadStorage_dict: OverrideTable;
  vb_y_Pipeline_dict: OverrideTable;
  vb_y_Disposal_dict: OverrideTable;
  vb_y_Storage_dict: OverrideTable;
  vb_y_Treatment_dict: OverrideTable;
}


export interface Scenario {
  name: string;
  id: number;

  /** e.g. "01/13/2026" */
  date: string;

  data_input: ScenarioDataInput;
  optimization: ScenarioOptimization;
  results: ScenarioResults;
  validation?: ScenarioValidation;
  
  override_values: ScenarioOverrides;
  optimized_override_values: ScenarioOverrides;

  [k: string]: any;
}


export type ScenarioMap = Record<string, Scenario>;

export interface AppContextValue {
  port: number;
}

export interface AppState {
  section: number;
  category: Record<number, string | null>;
  [key: string]: any;
}

export interface AIPromptUpdatedScenario {
  df_sets?: DfSets;
  df_parameters?: DfParameters;
  display_units?: DisplayUnits;
  map_data?: any;
}

export interface AIPromptResponse {
  status: "success" | "error";
  updatedScenario?: AIPromptUpdatedScenario;
  updateNotes?: string[];
  errorMessage?: string;
  error?: string;
}

export interface AIOptimizationDiagnosisStep {
  title: string;
  instruction: string;
  reason?: string;
  appArea?: string;
}

export interface AIOptimizationDiagnosisResponse {
  status: "success" | "error";
  summary?: string;
  likelyCauses?: string[];
  nextSteps?: AIOptimizationDiagnosisStep[];
  cautionNotes?: string[];
  diagnosedAt?: string;
  errorMessage?: string;
  error?: string;
}

export interface ScenarioAIDiagnosis {
  status: "success";
  summary: string;
  likelyCauses: string[];
  nextSteps: AIOptimizationDiagnosisStep[];
  cautionNotes: string[];
  diagnosedAt: string;
  sourceErrorMessage?: string;
  outdated?: boolean;
  outdatedAt?: string;
  outdatedReason?: string;
}

// Map / Editor related types
export type CoordinateTuple = [number | string, number | string];

export type MapEditorNode = {
  name?: string;
  node_type?: string; // node or path
  nodeType?: string; // type of node (NetworkNode, CompletionPad ...)
  coordinates?: CoordinateTuple;
  lengths?: number[];
  nodes?: Array<{
    name: string;
    coordinates?: CoordinateTuple;
    outgoing_nodes?: string[];
    [key: string]: any;
  }>;
  length?: number;
  diameter?: number | string;
  [key: string]: any;
};

export type SelectedNodeState = {
  node: MapEditorNode;
  idx: number;
};

export interface MapContextValue {
  networkMapData: any;
  setNetworkMapData: React.Dispatch<React.SetStateAction<any>>;
  selectedNode: SelectedNodeState | null;
  setSelectedNode: React.Dispatch<React.SetStateAction<SelectedNodeState | null>>;
  showNetworkNode: boolean;
  setShowNetworkNode: React.Dispatch<React.SetStateAction<boolean>>;
  showNetworkPipeline: boolean;
  setShowNetworkPipeline: React.Dispatch<React.SetStateAction<boolean>>;
  addNode: () => void;
  addPipeline: () => void;
  clickNode: (node: MapEditorNode, idx: number) => void;
  clickPipeline: (node: MapEditorNode, idx: number) => void;
  saveNodeChanges: (updatedNode: MapEditorNode, deselectAfterwards?: boolean) => void;
  nodeData: MapEditorNode[];
  setNodeData: React.Dispatch<React.SetStateAction<MapEditorNode[]>>;
  lineData: MapEditorNode[];
  setLineData: React.Dispatch<React.SetStateAction<MapEditorNode[]>>;
  handleMapClick: (coords: CoordinateTuple) => void;
  availableNodes: MapEditorNode[];
  creatingNewNode: boolean;
  selectingPipelineConnectionFromMap: boolean;
  setSelectingPipelineConnectionFromMap: React.Dispatch<React.SetStateAction<boolean>>;
  pipelineConnectionSelectionIndex: number | null;
  setPipelineConnectionSelectionIndex: React.Dispatch<React.SetStateAction<number | null>>;
  deleteSelectedNode: () => void;
  currentlyCreatingPipeline: boolean;
  currentlyCreatingNode: boolean;
  handleFileUpload: (file: File, defaultNodeType?: string) => void;
  nodeType: "node" | "pipeline" | null;
}

export interface MapProviderProps {
  children: React.ReactNode;
  scenario?: Scenario | null;
  handleUpdateScenario: (updatedScenario: Scenario | null, setScenarioData?: boolean, propagateChanges?: string) => void;
}

export interface ModelResultsProps {
  category: string;
  scenario: Scenario;
  handleSetSection: (section: number) => void;
  handleEditInput?: (edited: boolean) => void;
  updateScenario: (updatedScenario: any) => void;
  appState?: any;
  syncScenarioData?: (id?: string | number) => void;
  scenarios?: Record<string, any>;
  handleSetCategory?: (category: string) => void;
}

export interface SankeyPlotProps {
  data: Record<string, any[]>;
  scenarioId: string | number;
  appState?: any;
}

export interface KPIDashboardProps {
  overviewData: any[];
  truckedData: any[];
  pipedData: any[];
  waterQualityData: any[];
  hydraulicsData?: any[];
}

export interface OptimizationProps {
  saving?: boolean;
  scenario: Scenario;
  updateScenario: (updatedScenario: any, setScenarioData?: boolean, propagateChanges?: string) => void;
  disabled: boolean;
  setDisabled: (disabled: boolean) => void;
  handleRunModel: () => void;
  backgroundTasks: any[];
  category?: string;
}

export interface NetworkDiagramProps {
  scenario: Scenario;
  type?: string;
  syncScenarioData?: (id?: string | number) => void;
  showMapTypeToggle?: boolean;
  interactive?: boolean;
  width?: number | string;
  height?: number | string;
  [key: string]: any;
}

export interface DataTableProps {
  section: 'input' | 'output' | 'compare';
  scenario: Scenario;
  data: Record<string, any>;
  category: string;
  updateScenario?: (updatedScenario: any) => void;
  setScenario?: (scenario: Scenario) => void;
  OVERRIDE_CATEGORIES?: string[];
  overrideValues?: any;
  setOverrideValues?: (v: any) => void;
  newInfrastructureOverrideRow?: boolean;
  setNewInfrastructureOverrideRow?: (b: boolean) => void;
  rowFilterSet?: Record<string, {checked: boolean; amt: number}>;
  columnFilterSet?: Record<string, {checked: boolean; amt: number}>;
  columnNodes: Record<string, boolean>;
  columnNodesMapping: string[];
  rowNodes: Record<string, boolean>;
  rowNodesMapping: string[];
  editDict?: Record<string, boolean>;
  setEditDict?: (d: Record<string, boolean>) => void;
  handleEditInput?: (edited: boolean) => void;
  setShowError?: (b: boolean) => void;
  deltaDictionary?: any;
  
  [key: string]: any;
}

export interface DataInputProps {
  scenario: Scenario;
  updateScenario: (updatedScenario: any) => void;
  category: string;
  handleSetCategory: (category: string) => void;
  syncScenarioData: (id?: string | number) => void;
  handleUpdateExcel: (id: string | number, tableKey: string, updatedTable: any) => void | Promise<boolean>;
  handleEditInput: (edited: boolean) => void;
  edited: boolean;
}

export interface FilterDropdownProps {
  option1: string;
  option2: string;
  width?: string | number;
  maxHeight?: string | number;
  handleFilter1?: (value: string) => void;
  handleFilter2?: (value: string) => void;
  filtered1?: string[];
  filtered2?: string[];
  total1?: string[];
  total2?: string[];
  isAllSelected1?: boolean;
  isAllSelected2?: boolean;
  handleArrowSelection?: (direction: 'up' | 'down') => void;
  columnFilterSet?: Record<string, {checked: boolean; amt: number}>;
  rowFilterSet?: Record<string, {checked: boolean; amt: number}>;
}

export interface WaterQualityFilterDropdownProps {
  width?: string | number;
  maxHeight?: string | number;
  isAllSelected?: boolean;
  filtered?: any[] | Record<string, boolean>;
  total?: any[];
  handleFilter?: (value: string) => void;
  filterSet?: string[];
}

export interface OverrideTableProps {
  category: string;
  data: Record<string, any[]>;
  columnNodes: Record<string, boolean>;
  columnNodesMapping: string[];
  scenario: Scenario;
  show: boolean;
  updateScenario?: (updatedScenario: any, setScenarioData?: boolean) => void;
  newInfrastructureOverrideRow?: boolean;
  setNewInfrastructureOverrideRow?: (b: boolean) => void;
  rowFilterSet?: Record<string, {checked: boolean; amt: number}>;
  columnFilterSet?: Record<string, {checked: boolean; amt: number}>;
  overrideValues?: any;
  setOverrideValues?: (v: any) => void;
}

export interface OverrideTableRowsProps {
  category: string;
  data: any[];
  columnNodes: Record<string, boolean>;
  columnNodesMapping: string[];
  scenario: Scenario;
  handleCheckOverride: (index: string, value: any) => void;
  handleInputOverrideValue: (event: any, number_value?: any) => void;
  newInfrastructureOverrideRow?: boolean;
  setNewInfrastructureOverrideRow?: (b: boolean) => void;
  addNewRow?: (newOverride: any, newRow: any) => void;
}

export interface NewOverrideRowProps {
  category: string;
  scenario: Scenario;
  handleCheckOverride: (index: string, value: any) => void;
  handleInputOverrideValue: (event: any, number_value?: any) => void;
  setNewInfrastructureOverrideRow: (b: boolean) => void;
  addNewRow: (newOverride: any, newRow: any) => void;
}

export interface ComparisonTableProps {
  scenarios: Record<string, Scenario> | Array<Scenario> | any;
  scenarioIndex: number | string;
  secondaryScenarioIndex: number | string;
}

export interface CustomChartProps {
  input?: boolean;
  data: any;
  category?: string;
  labelIndex?: number;
  xindex?: number;
  yindex?: number;
  width?: number;
  height?: number;
  showlegend?: boolean;
  title?: string;
  xaxis?: { titletext?: string };
  yaxis?: { titletext?: string };
  stackgroup?: boolean | string;
  waterQuality?: boolean;
  filterSet?: string[];
  chartType?: string;
}

export interface SubHeaderProps {
  scenarios: Record<string, Scenario>;
  compareScenarioIndexes: Array<string | number>;
  setCompareScenarioIndexes: (indexes: Array<string | number>) => void;
}

export interface SidebarProps {
  inputFocus?: ValidationIssue | null;
  handleSetCategory?: (category: string) => void;
  scenario?: Scenario | any;
  section?: number;
  category?: string | null;
  inputDataEdited?: boolean;
  handleUpdateExcel?: (id: string | number, tableKey: string, updatedTable: any) => void | Promise<boolean>;
  setInputDataEdited?: (b: boolean) => void;
  syncScenarioData?: (id?: string | number) => void;
  [key: string]: any;
}

export interface PopupModalProps {
  open: boolean;
  handleClose: () => void;
  input?: boolean;
  text?: string | number;
  textLabel?: string;
  handleEditText?: (e: any) => void;
  handleSave?: () => void;
  buttonVariant?: any;
  buttonColor?: any;
  buttonText?: string;
  hasInput?: boolean;
  inputText?: string;
  showError?: boolean;
  errorText?: string;
  hasTwoButtons?: boolean;
  handleButtonTwoClick?: () => void;
  buttonTwoVariant?: any;
  buttonTwoColor?: any;
  buttonTwoText?: string;
  iconOne?: React.ReactNode;
  iconTwo?: React.ReactNode;
  width?: number;
  [key: string]: any;
}

export interface FileUploadModalProps {
  setShowFileModal: (show: boolean) => void;
  handleFileUpload: (file: File, defaultNodeType?: string, scenarioName?: string) => void;
  fileTypes?: string[];
  showNameInput?: boolean;
  showSampleFiles?: boolean;
  title?: string;
  buttonText?: string;
  [key: string]: any;
}

export interface ScenarioCompareInputProps {
  primaryScenario: Scenario;
  referenceScenario: Scenario;
  category: string;
  showSidebar: boolean;
  deltaDictionary: Record<string, string[]>;
}

export interface ScenarioCompareOverridesProps {
  primaryScenario: Scenario;
  referenceScenario: Scenario;
  category: string;
  showSidebar: boolean;
  overrides: Array<Record<string, any>>;
  deltaDictionary?: Record<string, string[]>;
}

export interface ScenarioCompareOutputProps {
  scenarios: Record<string, Scenario>;
  primaryScenarioIndex: string | number | null;
  referenceScenarioIndex: string | number | null;
  kpiDataPrimary?: Record<string, any> | null;
  kpiDataReference?: Record<string, any> | null;
  capexBarChartData?: any[] | null;
  opexBarChartData?: any[] | null;
  showSidebar?: boolean;
  compareCategory?: string;
  totalCapex?: number[];
  totalOpex?: number[];
}

export interface NetworkMapProps {
  map_data: any;
  interactive?: boolean;
  showMapTypeToggle?: boolean;
  width?: number | string;
  height?: number | string;
  [key: string]: any;
}

export interface InputSummaryProps {
  scenario: Scenario;
  initialDisposalCapacity: ParameterTable;
  initialTreatmentCapacity: ParameterTable;
  completionsDemand: ParameterTable;
  padRates: ParameterTable;
  flowbackRates: ParameterTable;
  updateScenario: (updatedScenario: any) => void;
  handleSetCategory: (category: string) => void;
  [key: string]: any;
}

export interface ScenarioCompareSidebarProps {
  category: string;
  setCategory: (category: string) => void;
  open: boolean;
  deltaDictionary: Record<string, Record<string, any>>;
  overrides: Array<Record<string, any>>;
  compareScenarioIndexes?: Array<string | number>;
  [key: string]: any;
}
