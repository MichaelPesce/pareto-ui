import type { MapEditorNode } from './types';

type PipelineNodes = NonNullable<MapEditorNode['nodes']>;
export type PipelineFlowDirection = 'down' | 'up' | 'bidirectional';

const nodeTypeCodes: Record<string, string> = {
  ProductionPad: 'P', NetworkNode: 'N', CompletionsPad: 'C', DisposalSite: 'K',
  SWDSite: 'K', TreatmentSite: 'R', StorageSite: 'S', ExternalWaterSource: 'F', ReuseOption: 'O',
};

export const AllowedPipelineArcs = new Set([
  'PNA', 'CNA', 'CCA', 'NNA', 'NCA', 'NKA', 'NRA', 'NSA', 'FCA',
  'RCA', 'RNA', 'RSA', 'SCA', 'SNA', 'ROA', 'RKA', 'SOA', 'NOA',
]);
export const getPipelineNodeTypeCode = (nodeType?: string): string | null => nodeTypeCodes[nodeType] || null;
export const getMapEditorNodeType = (node?: MapEditorNode): string | null => node?.nodeType || node?.node_type || null;
export const isAllowedPipelineArc = (fromType?: string | null, toType?: string | null): boolean =>
  AllowedPipelineArcs.has(`${getPipelineNodeTypeCode(fromType)}${getPipelineNodeTypeCode(toType)}A`);

export const getAllowedPipelineFlowDirections = (from?: MapEditorNode, to?: MapEditorNode): PipelineFlowDirection[] => {
  if (!from?.name || !to?.name || from.name === to.name) return [];
  const down = isAllowedPipelineArc(getMapEditorNodeType(from), getMapEditorNodeType(to));
  const up = isAllowedPipelineArc(getMapEditorNodeType(to), getMapEditorNodeType(from));
  return [...(down ? ['down' as const] : []), ...(up ? ['up' as const] : []),
    ...(down && up ? ['bidirectional' as const] : [])];
};

// A pipeline's list order is geometric; its outgoing_nodes determine water flow.
export const getAllowedPipelineConnectionCandidates = (
  availableNodes: MapEditorNode[] = [], pipelineNodes: PipelineNodes = [], connectionIdx?: number | null,
): MapEditorNode[] => {
  const idx = connectionIdx ?? pipelineNodes.length;
  const previous = availableNodes.find(node => node.name === pipelineNodes[idx - 1]?.name);
  const next = availableNodes.find(node => node.name === pipelineNodes[idx + 1]?.name);
  return availableNodes.filter(candidate => {
    if (!previous && !next) {
      return availableNodes.some(target => getAllowedPipelineFlowDirections(candidate, target).length > 0);
    }
    return (!previous || getAllowedPipelineFlowDirections(previous, candidate).length > 0)
      && (!next || getAllowedPipelineFlowDirections(candidate, next).length > 0);
  });
};

export const getPipelineConnectionIssues = (
  availableNodes: MapEditorNode[] = [], pipelineNodes: PipelineNodes = [],
): Record<number, string> => {
  const issues: Record<number, string> = {};
  const byName = new Map(availableNodes.map(node => [node.name, node]));
  pipelineNodes.forEach((ref, idx) => {
    if (!byName.has(ref.name)) issues[idx] = 'Please select a valid node.';
  });
  pipelineNodes.forEach((from, idx) => {
    const to = pipelineNodes[idx + 1];
    if (!to || !byName.has(from.name) || !byName.has(to.name)) return;
    const down = from.outgoing_nodes?.includes(to.name);
    const up = to.outgoing_nodes?.includes(from.name);
    const allowed = getAllowedPipelineFlowDirections(byName.get(from.name), byName.get(to.name));
    if (from.name === to.name || (!down && !up) || (down && !allowed.includes('down')) || (up && !allowed.includes('up'))) {
      issues[idx] = issues[idx + 1] = from.name === to.name
        ? 'A pipeline cannot connect a node to itself.'
        : 'Choose a flow direction supported by these node types.';
    }
  });
  return issues;
};

export const reconcilePipelineOutgoingNodes = (
  nextNodes: PipelineNodes = [], prevNodes: PipelineNodes = [], availableNodes: MapEditorNode[] = [],
): PipelineNodes => {
  const nextNames = new Set(nextNodes.map(node => node.name));
  const prevNames = new Set(prevNodes.map(node => node.name));
  // An explicit replacement inherits its old segment directions. Deletions and
  // reordering must match surviving nodes by name instead of array position.
  const replacements = new Map<string, string>();
  if (nextNodes.length === prevNodes.length) {
    prevNodes.forEach((node, idx) => {
      const replacement = nextNodes[idx].name;
      if (node.name && replacement && !nextNames.has(node.name) && !prevNames.has(replacement)) {
        replacements.set(node.name, replacement);
      }
    });
  }
  const mappedName = (name: string) => replacements.get(name) || name;
  const previousSegments = new Map<string, { down: boolean; up: boolean }>();
  prevNodes.forEach((from, idx) => {
    const to = prevNodes[idx + 1];
    if (!from.name || !to?.name) return;
    const a = mappedName(from.name), b = mappedName(to.name);
    const down = Boolean(from.outgoing_nodes?.includes(to.name));
    const up = Boolean(to.outgoing_nodes?.includes(from.name));
    previousSegments.set(JSON.stringify([a, b]), { down, up });
    previousSegments.set(JSON.stringify([b, a]), { down: up, up: down });
  });
  const result: PipelineNodes = nextNodes.map(node => ({ ...node, outgoing_nodes: [] as string[] }));
  result.forEach((from, idx) => {
    const to = result[idx + 1];
    const previous = prevNodes.find(node => node.name === from.name);
    const previousIdx = prevNodes.indexOf(previous);
    if (!previous || prevNodes[previousIdx + 1]?.name !== to?.name
        || String(previous.coordinates) !== String(from.coordinates)
        || String(prevNodes[previousIdx + 1]?.coordinates) !== String(to?.coordinates)) {
      delete from.segment_coordinates;
    }
    if (!from.name || !to?.name || from.name === to.name) return;
    let direction = previousSegments.get(JSON.stringify([from.name, to.name]));
    if (!direction) {
      const allowed = getAllowedPipelineFlowDirections(
        availableNodes.find(node => node.name === from.name), availableNodes.find(node => node.name === to.name),
      );
      direction = { down: allowed.includes('down') || availableNodes.length === 0,
        up: !allowed.includes('down') && allowed.includes('up') };
    }
    if (direction.down) from.outgoing_nodes.push(to.name);
    if (direction.up) to.outgoing_nodes.push(from.name);
  });
  return result;
};
