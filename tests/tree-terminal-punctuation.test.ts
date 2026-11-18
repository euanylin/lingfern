import { expect, it } from 'vitest';
import { drawTree, isWrittenTreeInput, treeForms, treeText } from '../src/shared/tree';
import { withoutIndex } from '../src/shared/tree-movement';

it.each([
  ['what did she see?', 'see', '?'],
  ['Why?', 'Why', '?'],
  ['she left!', 'left', '!'],
  ['she left?!', 'left', '?!'],
  ['she left...', 'left', '...'],
  ['she left…', 'left', '...'],
])('retains the predicate and terminal punctuation in %s', (sentence, predicate, stop) => {
  const tree = drawTree(sentence, 'dependency');
  expect(tree.nodes.find(node => node.id === tree.root)?.label).toBe(predicate);
  expect(tree.nodes.at(-1)?.label).toBe(stop);
  expect(tree.nodes.at(-1)?.role).toBe('punct');
});

it.each(['I have.', 'I can!', '“I have.”', '“I have”'])('licenses a stranded auxiliary before a clause boundary in %s', sentence => {
  const tree = drawTree(sentence, 'dependency');
  expect(tree.nodes.find(node => node.id === tree.root)?.label).toMatch(/^(?:have|can)$/u);
  expect(tree.nodes.find(node => node.label === 'I')?.role).toBe('nsubj');
  expect(treeText(drawTree(sentence))).not.toMatch(/∅|t[₀-₉]/u);
});

it.each(['?', '!!!', '...', '…', ':', ';'])('does not fabricate a sentence from punctuation alone: %s', input => {
  expect(() => drawTree(input)).toThrow('TREE_PARSE');
});

it.each(['Notes:', 'Excerpt:'])('keeps the nominal heading %s as a fragment', sentence => {
  const tree = drawTree(sentence);
  expect(tree.nodes[0].label).toBe('FRAG');
  const dependency = drawTree(sentence, 'dependency');
  expect(dependency.nodes.find(node => node.id === dependency.root)?.label).toBe(sentence.slice(0, -1));
  expect(dependency.nodes.at(-1)?.role).toBe('punct');
});

it.each(['she announced the news:', 'he left:', 'we read the book:'])('retains a complete clause before a final colon in %s', sentence => {
  const tree = drawTree(sentence, 'dependency');
  expect(tree.nodes.find(node => node.id === tree.root)?.label).toBe(sentence.split(' ')[1].replace(':', ''));
  expect(tree.nodes.at(-1)?.label).toBe(':');
  expect(tree.nodes.at(-1)?.role).toBe('punct');
});

it.each(['(we left).', '(the cat slept)!', '(I have).', '(we left)…'])('recognizes prose parentheses before the external stop in %s', sentence => {
  expect(isWrittenTreeInput(sentence)).toBe(false);
  const tree = drawTree(sentence, 'dependency');
  expect(tree.nodes[0].label).toBe('(');
  expect(tree.nodes[0].role).toBe('punct');
  expect(tree.nodes.at(-2)?.label).toBe(')');
  expect(tree.nodes.at(-1)?.role).toBe('punct');
  expect(tree.nodes.some(node => node.label === 'we' || node.label === 'the' || node.label === 'I')).toBe(true);
});

it('classifies full-width written brackets using the same normalization as the parser', () => {
  expect(isWrittenTreeInput('［S ［NP she］ ［VP left］］')).toBe(true);
  expect(treeText(drawTree('［S ［NP she］ ［VP left］］'))).toBe('[S [NP she] [VP left]]');
});

it.each([['Yes.', 'Yes'], ['seriously.', 'seriously']])('represents the short response %s as a fragment', (sentence, head) => {
  expect(drawTree(sentence).nodes[0].label).toBe('FRAG');
  const tree = drawTree(sentence, 'dependency');
  expect(tree.nodes.find(node => node.id === tree.root)?.label).toBe(head);
  expect(tree.nodes.at(-1)?.role).toBe('punct');
  expect(treeText(drawTree(sentence))).not.toMatch(/\bVP\b|∅|t[₀-₉]/u);
  for (const form of treeForms) {
    const view = drawTree(sentence, form);
    expect(view.nodes.filter(node => view.kind === 'dependency' || !node.children.length).map(node => node.label.split('|')[0]), form).toContain(head);
  }
});

it('preserves question words and punctuation in every presentation', () => {
  for (const form of treeForms) {
    const tree = drawTree('what did she see?', form);
    const words = tree.nodes.filter(node => tree.kind === 'dependency' || !node.children.length).map(node => withoutIndex(node.label.split('|')[0]));
    for (const word of ['what', 'did', 'she', 'see']) expect(words, form).toContain(word);
  }
});

it.each([';', ':', '.', '...'])('keeps independent clauses separated by %s', separator => {
  const tree = drawTree(`she left${separator} we stayed.`, 'dependency');
  expect(tree.nodes.find(node => node.id === tree.root)?.label).toBe('left');
  expect(tree.nodes.find(node => node.label === 'stayed')?.role).toBe('parataxis');
  expect(tree.nodes.find(node => node.label === separator)?.role).toBe('punct');
});

it.each([
  ['Dr. Smith left.', 'Dr.', 'left'],
  ['the U.S. grew.', 'U.S.', 'grew'],
  ['Acme Inc. joined the firm.', 'Inc.', 'joined'],
  ['we visited the U.S., Canada, and France.', 'U.S.', 'visited'],
])('preserves the abbreviation in %s', (sentence, abbreviation, predicate) => {
  const tree = drawTree(sentence, 'dependency');
  expect(tree.nodes.find(node => node.id === tree.root)?.label).toBe(predicate);
  expect(tree.nodes.some(node => node.label === abbreviation)).toBe(true);
});

it.each(['the U.S.', 'Acme Inc.'])('retains the existing shared final-period convention in %s', ending => {
  const tree = drawTree(`we visited ${ending}`, 'dependency');
  expect(tree.nodes.at(-1)?.label).toBe('.');
  expect(tree.nodes.at(-1)?.role).toBe('punct');
  expect(tree.nodes.some(node => node.label === ending.split(' ').at(-1)!.slice(0, -1))).toBe(true);
});

it('keeps an uppercase acronym after a determiner distinct from its lowercase pronoun', () => {
  expect(treeText(drawTree('the US grew.'))).toContain('[NNP US]');
  const tree = drawTree('she saw us.', 'dependency');
  expect(tree.nodes.find(node => node.label === 'us')?.role).toBe('obj');
  expect(treeText(drawTree('WE left!'))).toContain('[PRP WE]');
});

it('does not treat a prototype property name as an auxiliary', () => {
  const tree = drawTree('the constructor worked.', 'dependency');
  expect(tree.nodes.find(node => node.id === tree.root)?.label).toBe('worked');
  expect(tree.nodes.find(node => node.label === 'constructor')?.role).toBe('nsubj');
});

it.each(['constructor', '__proto__', 'toString'])('keeps the literal manual label %s safe in every presentation', label => {
  for (const form of treeForms) {
    const tree = drawTree(`[${label} leaf]`, form);
    expect(tree.nodes.every(node => typeof node.label === 'string'), form).toBe(true);
    expect(tree.nodes.map(node => node.label.split('|')[0]), form).toContain('leaf');
  }
});
