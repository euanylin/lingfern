import { expect, it } from 'vitest';
import { inflectionCases } from './fixtures/tree-inflection-cases';
import { clausePatternCases, nounPhraseCases } from './fixtures/tree-clause-np-cases';
import { quantityCases, determinerCases, adjectiveCases } from './fixtures/tree-quantity-cases';
import { prepositionCases, tenseCases, modalityCases } from './fixtures/tree-pp-tense-modal-cases';
import { passiveCases, negationCases, questionCases } from './fixtures/tree-passive-neg-q-cases';
import { complementationCases, nounClauseCases } from './fixtures/tree-complement-nounclause-cases';
import { relativeCases, nonFiniteCases, adverbialCases } from './fixtures/tree-relative-nonfinite-adverbial-cases';
import { conditionalCases, comparisonCases, coordinationCases, inversionCases, discourseCases } from './fixtures/tree-cond-comp-coord-inv-disc-cases';

// The checklist has exactly 1820 numbered structures in 22 sections. This test keeps the fixtures
// in step with it: one probe sentence per item, no gaps, no duplicates. The drawing itself is
// checked by tree-grammar-sections.test.ts and tree-inflection.test.ts.
const sections: [number, number, number[]][] = [
  [1, 66, inflectionCases.map(item => item.id)],
  [67, 138, clausePatternCases.map(item => item.id)],
  [139, 229, nounPhraseCases.map(item => item.id)],
  [230, 324, quantityCases.map(item => item.id)],
  [325, 411, determinerCases.map(item => item.id)],
  [412, 499, adjectiveCases.map(item => item.id)],
  [500, 623, prepositionCases.map(item => item.id)],
  [624, 699, tenseCases.map(item => item.id)],
  [700, 775, modalityCases.map(item => item.id)],
  [776, 844, passiveCases.map(item => item.id)],
  [845, 912, negationCases.map(item => item.id)],
  [913, 1000, questionCases.map(item => item.id)],
  [1001, 1153, complementationCases.map(item => item.id)],
  [1154, 1233, nounClauseCases.map(item => item.id)],
  [1234, 1306, relativeCases.map(item => item.id)],
  [1307, 1383, nonFiniteCases.map(item => item.id)],
  [1384, 1453, adverbialCases.map(item => item.id)],
  [1454, 1530, conditionalCases.map(item => item.id)],
  [1531, 1608, comparisonCases.map(item => item.id)],
  [1609, 1688, coordinationCases.map(item => item.id)],
  [1689, 1755, inversionCases.map(item => item.id)],
  [1756, 1820, discourseCases.map(item => item.id)],
];

it('has one probe sentence for every numbered structure in the checklist', () => {
  const gaps: string[] = [];
  const duplicates: number[] = [];
  const all: number[] = [];
  for (const [low, high, ids] of sections) {
    const missing = Array.from({ length: high - low + 1 }, (_, index) => low + index).filter(id => !ids.includes(id));
    if (missing.length) gaps.push(`${low}-${high}: ${missing.join(', ')}`);
    for (const id of ids) if (all.includes(id)) duplicates.push(id);
    all.push(...ids);
  }
  expect(gaps, gaps.join('\n')).toEqual([]);
  expect(duplicates, duplicates.join(', ')).toEqual([]);
  expect(all).toHaveLength(1820);
  expect(Math.min(...all)).toBe(1);
  expect(Math.max(...all)).toBe(1820);
});
