import { expect, test } from 'vitest';
import { drawModelCcg, drawModelConstituency, drawTree, isWrittenTreeInput, treeFileName, treeText } from '../src/shared/tree';

const auto = String.raw`ID=example.1 PARSER=GOLD NUMPARSE=1
(<T S[dcl] 0 2>
  (<T S[dcl] 1 2> (<L NP PRP PRP She NP>) (<L S[dcl]\NP VBD VBD left S[dcl]\NP>) )
  (<L . . . . .>) )`;

test('imports a single CCGbank AUTO derivation and preserves categories and branch order', () => {
  expect(isWrittenTreeInput(auto)).toBe(true);
  const tree = drawTree(auto, 'dependency');
  expect(tree.form).toBe('ccg');
  expect(tree.nodes.map(node => [node.label, node.children])).toEqual([
    ['S[dcl]', ['n2', 'n5']],
    ['S[dcl]', ['n3', 'n4']],
    ['She|NP', []],
    [String.raw`left|S[dcl]\NP`, []],
    ['.|.', []],
  ]);
  expect(treeFileName(tree)).toBe('She-left');
  expect(drawTree(treeText(tree)).nodes).toEqual(tree.nodes);
});

test('recognizes a standalone lexical AUTO node without treating @ as a role', () => {
  const tree = drawTree('(<L NP NNP NNP test@example.org NP>)');
  expect(tree.form).toBe('ccg');
  expect(tree.nodes).toEqual([{ id: 'n1', label: 'test@example.org|NP', children: [] }]);
});

test.each([
  '(<T S[dcl] 1 1> (<L NP PRP PRP She NP>) )',
  '(<T S[dcl] 0 2> (<L NP PRP PRP She NP>) )',
  '(<T S[dcl] 0 1> (<L NP PRP PRP She NP>) (<L N NN NN dog N>) )',
  '(<L NP PRP PRP She>)',
  '(<L NP PRP PRP She NP>) trailing',
  '(<L NP PRP PRP She NP>)\n(<L N NN NN dog N>)',
])('rejects malformed or multiple CCGbank AUTO trees %s', input => {
  expect(isWrittenTreeInput(input)).toBe(true);
  expect(() => drawTree(input)).toThrow('TREE_PARSE');
});


test('validates the full source surface before using a generated CCG tree', () => {
  expect(drawModelCcg('She left.', auto).form).toBe('ccg');
  expect(() => drawModelCcg('She stayed.', auto)).toThrow('TREE_PARSE');
  const brackets = '(<T NP 0 2> (<L -LRB- POS POS -LRB- -LRB->) (<L N POS POS word N>) )';
  expect(drawModelCcg('(word', brackets).nodes.map(node => node.label)).toContain('(|-LRB-');
});


test('round-trips literal brackets and quotes in copied model trees', () => {
  const phrase = drawModelConstituency('("go")', "(S1 (S (-LRB- -LRB-) (`` ``) (VB go) ('' '') (-RRB- -RRB-)))");
  expect(drawTree(treeText(phrase)).nodes).toEqual(phrase.nodes);
  const ccg = drawModelCcg('(word', '(<T NP 0 2> (<L -LRB- POS POS -LRB- -LRB->) (<L N POS POS word N>) )');
  expect(drawTree(treeText(ccg)).nodes).toEqual(ccg.nodes);
});
