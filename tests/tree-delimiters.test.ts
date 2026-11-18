import { expect, it } from 'vitest';
import { drawTree, isWrittenTreeInput, sentenceFileName, treeForms, treeText } from '../src/shared/tree';

it.each([
  ['she said "we left."', 'said', 'left'],
  ['she said “he said ‘we left.’”', 'said', 'left'],
])('parses quoted clauses in %s', (sentence, root, embedded) => {
  const tree = drawTree(sentence, 'dependency');
  expect(tree.nodes.find(node => node.id === tree.root)?.label).toBe(root);
  expect(tree.nodes.find(node => node.label === embedded)?.role).toBe('ccomp');
  expect(tree.nodes.filter(node => /^["“”‘’]$/u.test(node.label)).every(node => node.role === 'punct')).toBe(true);
  expect(tree.nodes.some(node => node.label === 'we')).toBe(true);
});

it('keeps a parenthetical adverb separate from the main clause', () => {
  const tree = drawTree('she (quietly) left.', 'dependency');
  expect(tree.nodes.map(node => node.label)).toEqual(['she', '(', 'quietly', ')', 'left', '.']);
  expect(tree.nodes.find(node => node.id === tree.root)?.label).toBe('left');
  expect(tree.nodes.find(node => node.label === 'quietly')?.role).toBe('advmod');
});

it('does not lose the first word of a parenthesized sentence', () => {
  const tree = drawTree('(the cat slept.)', 'dependency');
  expect(tree.nodes.map(node => node.label)).toEqual(['(', 'the', 'cat', 'slept', '.', ')']);
  expect(tree.nodes.find(node => node.id === tree.root)?.label).toBe('slept');
  expect(treeText(drawTree('(S (NP (PRP she)) (VP (VBD left)))'))).toBe('[S [NP [PRP she]] [VP [VBD left]]]');
});

it.each(['(we left)', '(I left)', '(the cat slept)', '(she (quietly) left.)'])('recognizes prose parentheses in %s', sentence => {
  expect(isWrittenTreeInput(sentence)).toBe(false);
  const tree = drawTree(sentence, 'dependency');
  expect(tree.nodes[0].label).toBe('(');
  expect(tree.nodes.at(-1)?.label).toBe(')');
  expect(tree.nodes[0].role).toBe('punct');
  expect(tree.nodes.at(-1)?.role).toBe('punct');
});

it('keeps quoted nominals inside the determiner phrase', () => {
  const tree = drawTree('we bought a “small cat”.', 'dependency');
  const cat = tree.nodes.find(node => node.label === 'cat')!;
  const article = tree.nodes.find(node => node.label === 'a')!;
  expect(cat.role).toBe('obj');
  expect(article.role).toBe('det');
  expect(cat.children).toContain(article.id);
});

it.each(['she said “we left.', 'she (quietly left.', 'she left.)'])('rejects unbalanced delimiters in %s', sentence => {
  expect(() => drawTree(sentence)).toThrow('TREE_PARSE');
});

it.each([':)', ':-)', ':(', ';-)'])('keeps the emoticon %s distinct from a prose delimiter', input => {
  expect(drawTree(input, 'dependency').nodes.map(node => node.label)).toEqual([input]);
});

it('accepts an unindented line wrap without treating it as an outline', () => {
  expect(treeText(drawTree('the cat\nslept.'))).toBe(treeText(drawTree('the cat slept.')));
  expect(sentenceFileName('the cat\nslept.')).toBe(sentenceFileName('the cat slept.'));
  expect(sentenceFileName('(the cat slept.)')).toBeDefined();
});

it('preserves overt content across all nine presentations with nested delimiters', () => {
  for (const form of treeForms) {
    const tree = drawTree('she said “he (quietly) said ‘we left.’”', form);
    const words = tree.nodes.filter(node => tree.kind === 'dependency' || !node.children.length)
      .map(node => node.label.split('|')[0]);
    for (const word of ['she', 'he', 'quietly', 'we', 'left']) expect(words, form).toContain(word);
    expect(words.filter(word => word === 'said'), form).toHaveLength(2);
  }
});

it.each([' [root leaf] ', '(S (NP (PRP she)) (VP (VBD left)))', 'root\n  leaf', '[the cat slept.]'])('preserves explicit structures in %s', input => {
  expect(isWrittenTreeInput(input)).toBe(true);
  expect(() => drawTree(input)).not.toThrow();
});
