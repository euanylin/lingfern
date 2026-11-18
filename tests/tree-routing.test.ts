import { expect, it } from 'vitest';
import fc from 'fast-check';
import { layoutTree, type TreeDiagram } from '../src/shared/tree';
import { withIndex } from '../src/shared/tree-movement';

it('keeps movement segments outside node boxes and horizontal segments separate', () => {
  fc.assert(fc.property(fc.array(fc.tuple(fc.nat(100), fc.integer({ min: 1, max: 80 })), { minLength: 8, maxLength: 45 }), entries => {
    const nodes: TreeDiagram['nodes'] = entries.map(([, width], index) => ({ id: `n${index}`, label: 'W'.repeat(width), children: [] }));
    for (let index = 1; index < nodes.length; index++) nodes[entries[index][0] % index].children.push(nodes[index].id);
    for (let index = 1; index <= 3; index++) {
      nodes[index].label = withIndex(nodes[index].label, index);
      nodes[nodes.length - index].label = withIndex('t', index);
    }
    const layout = layoutTree({ root: 'n0', nodes });
    const segments = layout.edges.filter(edge => edge.movement).flatMap(edge => edge.points!.slice(1).map((point, index) => ({ from: edge.points![index], to: point })));
    for (const { from, to } of segments) for (const node of layout.nodes) {
      const crosses = from.x === to.x
        ? from.x > node.x + .01 && from.x < node.x + node.width - .01 && Math.max(from.y, to.y) > node.y + .01 && Math.min(from.y, to.y) < node.y + node.height - .01
        : from.y > node.y + .01 && from.y < node.y + node.height - .01 && Math.max(from.x, to.x) > node.x + .01 && Math.min(from.x, to.x) < node.x + node.width - .01;
      expect(crosses).toBe(false);
    }
    const horizontal = segments.filter(({ from, to }) => from.y === to.y && from.x !== to.x);
    for (const [index, { from, to }] of horizontal.entries()) for (const other of horizontal.slice(index + 1)) {
      expect(from.y === other.from.y && Math.max(Math.min(from.x, to.x), Math.min(other.from.x, other.to.x)) < Math.min(Math.max(from.x, to.x), Math.max(other.from.x, other.to.x))).toBe(false);
    }
  }), { numRuns: 100, seed: 20261115 });
});
