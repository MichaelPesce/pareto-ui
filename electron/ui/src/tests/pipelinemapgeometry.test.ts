import { formatCoordinatesFromNodes, reconcilePipelineSegmentLengths } from '../util';
import { reconcilePipelineOutgoingNodes } from '../pipeline';
import type { MapEditorNode } from '../types';

test('imported bends remain visible and measured lengths survive appending a connection', () => {
  const nodes: MapEditorNode['nodes'] = [{name: 'A', coordinates: [-103, 34], segment_coordinates: [[-103,34],[-102.5,34.2],[-102,34]]},
    {name: 'B', coordinates: [-102, 34]}];
  expect(formatCoordinatesFromNodes(nodes)).toEqual([[34,-103],[34.2,-102.5],[34,-102]]);
  const lengths = reconcilePipelineSegmentLengths([...nodes, {name: 'C', coordinates: [-101,34]}], nodes, [123]);
  expect(lengths[0]).toBe(123);
  expect(lengths[1]).toBeGreaterThan(0);
  const moved = reconcilePipelineOutgoingNodes([nodes[0], {...nodes[1], coordinates: [-101, 34]}], nodes);
  expect(moved[0].segment_coordinates).toBeUndefined();
  expect(formatCoordinatesFromNodes(moved)).toEqual([[34, -103], [34, -101]]);
});
