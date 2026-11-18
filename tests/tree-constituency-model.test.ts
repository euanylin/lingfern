import { expect, test } from 'vitest';
import { drawModelConstituency } from '../src/shared/tree';

test('imports a matching Charniak tree and normalizes its auxiliary POS tag', () => {
  const tree = drawModelConstituency('She is ready.', '(S1 (S (NP (PRP She)) (VP (AUX is) (ADJP (JJ ready))) (. .)))');
  expect(tree.form).toBe('constituency');
  expect(tree.nodes.map(node => node.label)).toEqual(['S', 'NP', 'PRP', 'She', 'VP', 'VBZ', 'is', 'ADJP', 'JJ', 'ready', '.', '.']);
});

test('restores PTB bracket aliases while verifying the displayed sentence', () => {
  const tree = drawModelConstituency('(Hello.)', '(S1 (PRN (-LRB- -LRB-) (INTJ (UH Hello) (. .)) (-RRB- -RRB-)))');
  expect(tree.nodes.filter(node => !node.children.length).map(node => node.label)).toEqual(['(', 'Hello', '.', ')']);
});

test.each([
  ['She is ready.', '(S1 (S (NP (PRP He)) (VP (AUX is) (ADJP (JJ ready))) (. .)))'],
  ['She is ready.', '(S1 (S (NP (PRP She)) (VP (AUX is) (ADJP (JJ ready)))))'],
  ['She is ready.', '(S1 (S (NP (PRP She)) (VP (AUX is) (ADJP (JJ ready))) (. .))) (S1 (NP (NN extra)))'],
  ['I have finished.', '(S1 (S (NP (PRP I)) (VP (AUX have) (VP (VBN finished))) (. .)))'],
])('rejects mismatched text, multiple trees or an auxiliary with an ambiguous tag', (source, brackets) => {
  expect(() => drawModelConstituency(source, brackets)).toThrow('TREE_PARSE');
});
