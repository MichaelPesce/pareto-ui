import {
  getAllowedPipelineConnectionCandidates as candidates,
  getAllowedPipelineFlowDirections as directions,
  getPipelineConnectionIssues as issues,
  reconcilePipelineOutgoingNodes as reconcile,
} from '../pipeline';
import type { MapEditorNode } from '../types';

const available: MapEditorNode[] = [
  { name: 'P', nodeType: 'ProductionPad' }, { name: 'N', nodeType: 'NetworkNode' },
  { name: 'K', nodeType: 'DisposalSite' }, { name: 'C', nodeType: 'CompletionsPad' },
];

test('selection allows a reverse geometric order and defaults to a supported flow', () => {
  const previous = [{ name: 'N' }];
  expect(candidates(available, previous).map(n => n.name)).toContain('P');
  const refs = reconcile([...previous, { name: 'P' }], previous, available);
  expect(refs[0].outgoing_nodes).toEqual([]);
  expect(refs[1].outgoing_nodes).toEqual(['N']);
  expect(issues(available, refs)).toEqual({});
});

test('actual flow is validated, including both halves of bidirectional flow', () => {
  expect(directions(available[0], available[1])).toEqual(['down']);
  for (const outgoing of [[], ['N']]) {
    expect(issues(available, [{ name: 'P', outgoing_nodes: outgoing }, { name: 'N', outgoing_nodes: ['P'] }])).not.toEqual({});
  }
  expect(directions(available[1], available[3])).toEqual(['down', 'up', 'bidirectional']);
});

test('self connections and missing nodes are rejected', () => {
  expect(candidates(available, [{ name: 'N' }]).map(n => n.name)).not.toContain('N');
  expect(issues(available, [{ name: 'N', outgoing_nodes: ['N'] }, { name: 'N' }])[0]).toMatch(/itself/);
  expect(issues(available, [{ name: 'deleted' }])[0]).toMatch(/valid node/);
});

test('deleting an intermediate node preserves the surviving segment direction', () => {
  const previous = [
    { name: 'A', outgoing_nodes: ['B'] }, { name: 'B', outgoing_nodes: [] },
    { name: 'C', outgoing_nodes: ['B', 'D'] }, { name: 'D', outgoing_nodes: [] },
  ];
  const next = reconcile(previous.filter(n => n.name !== 'B'), previous);
  expect(next).toEqual([
    { name: 'A', outgoing_nodes: ['C'] }, { name: 'C', outgoing_nodes: ['D'] },
    { name: 'D', outgoing_nodes: [] },
  ]);
  expect(previous[2].outgoing_nodes).toEqual(['B', 'D']);
});

test('replacement preserves explicit directions and saving is idempotent', () => {
  const previous = [{ name: 'A', outgoing_nodes: [] }, { name: 'B', outgoing_nodes: ['A'] }];
  const next = reconcile([previous[0], { ...previous[1], name: 'C' }], previous);
  expect(next[1].outgoing_nodes).toEqual(['A']);
  expect(reconcile(next, next)).toEqual(next);
});

test('reordering keeps water flowing between the same nodes', () => {
  const previous = [{ name: 'A', outgoing_nodes: ['B'] }, { name: 'B', outgoing_nodes: [] }];
  expect(reconcile([...previous].reverse(), previous)).toEqual([...previous].reverse());
});

test('filling a blank connection defaults to forward flow', () => {
  const previous = [{ name: 'P', outgoing_nodes: [] }, { name: '', outgoing_nodes: [] }];
  expect(reconcile([previous[0], { name: 'N' }], previous, available)[0].outgoing_nodes).toEqual(['N']);
});
