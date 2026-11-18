import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { drawTree, treeForms } from '../src/shared/tree';
import { clausePatternCases, nounPhraseCases } from './fixtures/tree-clause-np-cases';
import { quantityCases, determinerCases, adjectiveCases } from './fixtures/tree-quantity-cases';
import { prepositionCases, tenseCases, modalityCases } from './fixtures/tree-pp-tense-modal-cases';
import { passiveCases, negationCases, questionCases } from './fixtures/tree-passive-neg-q-cases';
import { complementationCases, nounClauseCases } from './fixtures/tree-complement-nounclause-cases';
import { relativeCases, nonFiniteCases, adverbialCases } from './fixtures/tree-relative-nonfinite-adverbial-cases';
import { conditionalCases, comparisonCases, coordinationCases, inversionCases, discourseCases } from './fixtures/tree-cond-comp-coord-inv-disc-cases';
import { resolvePos, type WordNetPos } from '../src/shared/wordnet-pos';

// Sections 2-9 of the maintainer's checklist (67-775). Each sentence is only a probe: the parser
// has to draw all nine forms from its rules, never from a per-sentence entry.
const letters = [...'abcdefghijklmnopqrstuvwxyz0'];
const buckets = new Map(letters.map(letter => [letter, JSON.parse(readFileSync(`public/dictionary/oewn-2025/pos-${letter}.json`, 'utf8')) as Record<string, number>]));
const forms = JSON.parse(readFileSync('public/dictionary/oewn-2025/forms.json', 'utf8')) as Record<string, string[]>;
const parts: WordNetPos[] = ['noun', 'verb', 'adjective', 'adverb'];
const lookup = (word: string) => {
  const counts = resolvePos(word, buckets, forms);
  const ordered = parts.filter(part => counts[part] > 0).map(part => [part, counts[part]] as const);
  return ordered.length ? ordered : undefined;
};

const sections: [string, { id: number; sentence: string }[]][] = [
  ['clause patterns and word order (67-138)', clausePatternCases],
  ['noun phrases and articles (139-229)', nounPhraseCases],
  ['quantity (230-324)', quantityCases],
  ['determiners and pronouns (325-411)', determinerCases],
  ['adjective and adverb phrases (412-499)', adjectiveCases],
  ['prepositional phrases (500-623)', prepositionCases],
  ['tense and aspect (624-699)', tenseCases],
  ['modality (700-775)', modalityCases],
  ['passive and causative (776-844)', passiveCases],
  ['negation (845-912)', negationCases],
  ['questions and tags (913-1000)', questionCases],
  ['verb valency and complementation (1001-1153)', complementationCases],
  ['noun clauses and reported speech (1154-1233)', nounClauseCases],
  ['relative clauses (1234-1306)', relativeCases],
  ['non-finite clauses (1307-1383)', nonFiniteCases],
  ['adverbial clauses (1384-1453)', adverbialCases],
  ['condition and hypothesis (1454-1530)', conditionalCases],
  ['comparison (1531-1608)', comparisonCases],
  ['coordination and ellipsis (1609-1688)', coordinationCases],
  ['inversion and focus (1689-1755)', inversionCases],
  ['spoken and discourse structure (1756-1820)', discourseCases],
];

for (const [name, cases] of sections) {
  it(`draws every structure in ${name}`, () => {
    const failures: string[] = [];
    for (const item of cases) {
      try {
        for (const form of treeForms) drawTree(item.sentence, form, lookup);
      } catch { failures.push(`${item.id} ${item.sentence}`); }
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });
}
