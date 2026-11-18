import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { drawTree, treeForms, type TreeDiagram } from '../src/shared/tree';
import { inflectionCases } from './fixtures/tree-inflection-cases';
import { resolvePos, type WordNetPos } from '../src/shared/wordnet-pos';

// Section 1 of the maintainer's checklist (1-66): inflection and word formation. These are not new
// clause frames but the form decisions the rest of the trees depend on, so a wrong noun, verb or
// adjective reading changes structure rather than one label.
const letters = [...'abcdefghijklmnopqrstuvwxyz0'];
const buckets = new Map(letters.map(letter => [letter, JSON.parse(readFileSync(`public/dictionary/oewn-2025/pos-${letter}.json`, 'utf8')) as Record<string, number>]));
const forms = JSON.parse(readFileSync('public/dictionary/oewn-2025/forms.json', 'utf8')) as Record<string, string[]>;
const parts: WordNetPos[] = ['noun', 'verb', 'adjective', 'adverb'];
const lookup = (word: string) => {
  const counts = resolvePos(word, buckets, forms);
  const ordered = parts.filter(part => counts[part] > 0).map(part => [part, counts[part]] as const);
  return ordered.length ? ordered : undefined;
};

function shape(diagram: TreeDiagram) {
  const byId = new Map(diagram.nodes.map(node => [node.id, node]));
  const walk = (id: string): string => {
    const node = byId.get(id)!;
    return node.children.length ? `(${node.label} ${node.children.map(walk).join(' ')})` : node.label;
  };
  return walk(diagram.root);
}

it('draws every inflection and word-formation structure in the checklist', () => {
  const failures: string[] = [];
  for (const item of inflectionCases) {
    try {
      drawTree(item.sentence, 'constituency', lookup);
      for (const form of treeForms) drawTree(item.sentence, form, lookup);
    } catch { failures.push(`${item.id} ${item.label}: ${item.sentence}`); }
  }
  expect(failures, failures.join('\n')).toEqual([]);
});

it('reads each inflected or derived form correctly', () => {
  const wrong: string[] = [];
  for (const item of inflectionCases) {
    if (!item.expect) continue;
    const tree = shape(drawTree(item.sentence, 'constituency', lookup));
    if (!tree.includes(item.expect)) wrong.push(`${item.id} ${item.label}\n  expected ${item.expect}\n  got      ${tree}`);
  }
  expect(wrong, wrong.join('\n\n')).toEqual([]);
});

it('keeps the plural, tense and degree decisions that the rest of the trees rely on', () => {
  const draw = (sentence: string) => shape(drawTree(sentence, 'constituency', lookup));
  // Irregular plurals carry no -s but are still plurals.
  expect(draw('the men left early')).toContain('(NP (DT the) (NNS men))');
  expect(draw('the children played')).toContain('(NP (DT the) (NNS children))');
  expect(draw('the criteria are unclear')).toContain('(NP (DT the) (NNS criteria))');
  expect(draw('the mothers-in-law arrived')).toContain('(NP (DT the) (NNS mothers-in-law))');
  // A prefixed irregular past is still a past tense.
  expect(draw('she rewrote the letter')).toContain('(VP (VBD rewrote)');
  expect(draw('she misunderstood me')).toContain('(VP (VBD misunderstood)');
  expect(draw('she outran him')).toContain('(VP (VBD outran)');
  // A comparative keeps its degree tag after a copula and turns adverbial after a lexical verb.
  expect(draw('she is happier now')).toContain('(ADJP (JJR happier)');
  expect(draw('this one is better')).toContain('(ADJP (JJR better)');
  expect(draw('she walked further')).toContain('(ADVP (RBR further)');
  expect(draw('this is the best book of the year')).toContain('(JJS best) (NN book)');
  // A noun after a noun compounds; a finite verb after a noun does not.
  expect(draw('the bus stop is near')).toContain('(NP (DT the) (NN bus) (NN stop))');
  expect(draw('the boys ran home')).toContain('(VP (VBD ran)');
  // A two-syllable modifier keeps its adjective reading: "a big red ball".
  expect(draw('she bought a big red ball')).toContain('(NP (DT a) (JJ big) (JJ red) (NN ball))');
});
