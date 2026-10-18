import { regressionSourcePacks, readSourcePackFixture } from './fixtures/source-pack-regression';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import fc from 'fast-check';
import { attributionMatchingPrompt, corpusAttributionPairs, corpusLesson, corpusWorkedExample } from '../src/core/corpus';
import { corpusOperation } from '../src/core/corpusPractice';
import { inspectCommunityPack } from '../src/data/communityPack';
import { reviewedReading } from '../src/data/corpus';
import { score, questionSchema } from '../src/shared/content';
import { exposureSchema } from '../src/shared/exposure';

const text = 'According to Dana, the proposal may reduce delays during the trial. According to Robin, the costs remain uncertain until the equipment is tested.';
it('matches complete explicit claims with exact attribution evidence and bounded deterministic seeds', () => {
  fc.assert(fc.property(fc.integer({ min: 0, max: 0xffffffff }), seed => {
    const task = corpusAttributionPairs(text, seed)!;
    expect(task).toEqual(corpusAttributionPairs(text, seed));
    expect(new Set(task.choices)).toEqual(new Set(['Dana', 'Robin']));
    for (const [index, span] of [task.evidence, ...task.otherEvidence].entries()) {
      const pair = task.pairs[index];
      expect(text.slice(span.start, span.end)).toBe(`According to ${pair.answer}, ${pair.label}`);
    }
    expect(task.pairs.find(pair => pair.answer === 'Dana')!.label).toContain('may reduce');
  }), { numRuns: 64 });
  for (const seed of [-1, 0.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(() => corpusAttributionPairs(text, seed)).toThrow('INVALID_CORPUS_ATTRIBUTION_PAIRS');
  expect(() => corpusAttributionPairs('x'.repeat(12001), 0)).toThrow();
});
it('rejects duplicated claims, shared surnames, implicit/nested attribution and damaged source markers', () => {
  for (const invalid of [
    'According to Dana, the costs remain uncertain until the equipment is tested. According to Robin, the costs remain uncertain until the equipment is tested.',
    'According to Dana, the costs remain uncertain until the equipment is tested. According to Robin, the costs  remain uncertain until the equipment is tested.',
    text.replace('Dana', 'James Barr').replace('Robin', 'Barr'),
    'Dana said the proposal may reduce delays. Robin said the costs remain uncertain.',
    text.replace('the proposal may reduce delays during the trial', 'according to Robin, the proposal may reduce delays'),
    text.replace('during the trial', 'during the trial [citation needed]'),
    text.split(' According to Robin')[0],
  ]) expect(corpusAttributionPairs(invalid, 0)).toBeUndefined();
});
it('uses actual reviewed source packages for distinct-root same-operation application and retry', async () => {
  const catalogue = regressionSourcePacks as { packs: { id: string; path: string; sha256: string }[] };
  const banks = await Promise.all(['003', '005', '010', '029'].map(async suffix => {
    const entry = catalogue.packs.find(pack => pack.id === `wikipedia-reading-${suffix}`)!;
    const bytes = readSourcePackFixture(entry.id);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256);
    const bank = (await inspectCommunityPack(bytes)).corpus!;
    return { ...bank, records: await reviewedReading(bank.records) };
  }));
  const corpus = { version: 1 as const, failures: [], records: banks.flatMap(bank => bank.records) };
  const candidates = corpus.records.flatMap(source => source.passages.filter(passage => !!corpusAttributionPairs(passage.text, 0)).map(passage => ({ source, passage })));
  expect(candidates).toHaveLength(5); expect(new Set(candidates.map(item => item.source.rootId)).size).toBe(4);
  // Derive the operation from the actual question, not its internal serialisation.
  const normal = { ...corpus, records: candidates.filter(item => item.passage.wordCount <= 300).map(item => ({ ...item.source, passages: [item.passage] })) };
  expect(normal.records).toHaveLength(2);
  // The next passage-selection cycle exposes the matching operation on both roots.
  for (const seed of [2, 3]) expect(corpusLesson(normal, new Set(), seed, 300, 'B2')!.materials.every(material => material.questions[0].prompt === attributionMatchingPrompt)).toBe(true);
  const initial = corpusLesson(corpus, new Set(), 0, 300, 'B2', [], 'matching')!;
  const requested = corpusOperation(initial.materials[0].questions[0])!;
  expect(initial.materials[0].questions[0].prompt).toBe(attributionMatchingPrompt);
  expect(requested).toContain(attributionMatchingPrompt);
  for (const point of ['B2', 'C1', 'C2'] as const) for (let seed = 0; seed < 8; seed++) {
    const lesson = corpusLesson(corpus, new Set(), seed, point === 'B2' ? 300 : 700, point, [], 'matching', [], requested)!;
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    for (const material of lesson.materials) {
      const question = material.questions[0];
      expect(corpusOperation(question)).toBe(requested);
      if (!('kind' in question) || question.kind !== 'matching') throw Error('Expected source matching');
      expect(score(question, question.pairs.map(pair => pair.answer)).correct).toBe(true);
      expect(score(question, question.pairs.map(pair => pair.answer).reverse()).correct).toBe(false);
      expect(question.additionalEvidence).toHaveLength(1);
      expect(question.pairs.every(pair => pair.label.length <= 240 && material.blocks[0].text.includes(pair.label))).toBe(true);
      expect(question.explanation.en).toBe(question.explanation['zh-Hans']);
      expect(questionSchema.safeParse({ ...question, pairs: [{ ...question.pairs[0], label: 'x'.repeat(241) }, question.pairs[1]] }).success).toBe(false);
      const time = '2026-10-03T00:00:00.000Z';
      expect(exposureSchema.safeParse({ profileId: 'test', rootId: material.rootId, firstSeenAt: time, lastSeenAt: time, contacts: [{ sessionId: 'test', materialId: material.id, questionId: question.id, variantGroup: question.id, firstSeenAt: time, lastSeenAt: time }] }).success).toBe(true);
      const example = corpusWorkedExample(material, seed);
      if (example) for (const pair of question.pairs) expect(example.en).not.toContain(pair.label);
      const response = material.questions[1]; expect('kind' in response && response.kind).toBe('response');
      for (const pair of question.pairs) expect(response.prompt).toContain(pair.answer);
      expect(score(response, 'A comparison with exact quotations.').correct).toBeNull();
    }
    const seen = new Set(lesson.materials.map(material => material.id.slice(7)));
    const next = corpusLesson(corpus, seen, seed, 700, point, [], 'matching', [], requested);
    expect(next?.materials.some(material => seen.has(material.id.slice(7)))).not.toBe(true);
  }
  for (const point of ['A1', 'A2'] as const) expect(corpusLesson(corpus, new Set(), 0, 700, point, [], 'matching')).toBeUndefined();
});
