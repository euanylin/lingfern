import { regressionSourcePacks, readSourcePackFixture } from './fixtures/source-pack-regression';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import fc from 'fast-check';
import { corpusEvaluation, corpusSchema, evaluationPrompt, corpusLesson, corpusWorkedExample } from '../src/core/corpus';
import { corpusOperation } from '../src/core/corpusPractice';
import { inspectCommunityPack } from '../src/data/communityPack';
import { reviewedReading } from '../src/data/corpus';
import { score } from '../src/shared/content';
import { exposureSchema } from '../src/shared/exposure';
const neutral = 'The trial began on Monday in the main hall. The team distributed the forms before noon.';
const judgement = 'Dana praised the clear directions but criticised the long wait.';
it('preserves mixed evaluations and exact source ranges with bounded deterministic generation', () => {
  const text = judgement + ' ' + neutral;
  fc.assert(fc.property(fc.integer({ min: 0, max: 0xffffffff }), seed => {
    const task = corpusEvaluation(text, seed)!;
    expect(task).toEqual(corpusEvaluation(text, seed));
    expect(task.sourceName).toBe('Dana');
    expect(text.slice(task.evidence.start, task.evidence.end)).toBe(judgement);
    expect(task.spans[task.accepted[0]].text).toBe(judgement);
    for (const span of task.spans) expect(text.slice(span.start, span.end)).toBe(span.text);
  }), { numRuns: 64 });
  for (const seed of [-1, 0.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(() => corpusEvaluation(text, seed)).toThrow('INVALID_CORPUS_EVALUATION');
  expect(() => corpusEvaluation('x'.repeat(12001), 0)).toThrow();
});
it('rejects generic sources, broken initials/quotes/colon introductions and ambiguous alternative evaluations', () => {
  for (const cue of ['He', 'They', 'Critics', 'Reviewers', 'When']) expect(corpusEvaluation(judgement.replace('Dana', cue) + ' ' + neutral, 0)).toBeUndefined();
  expect(corpusEvaluation('Professor Donald E. Pease praised the clear directions. ' + neutral, 0)).toBeUndefined();
  expect(corpusEvaluation('Dana praised the clear directions: ' + neutral, 0)).toBeUndefined();
  expect(corpusEvaluation('Dana praised the clear directions, asking "Were they clear? ' + neutral, 0)).toBeUndefined();
  for (const other of ['Robin refuted the claim, saying:', 'Robin appreciated the clear directions.', 'Robin established the trial to demonstrate the "disturbingly easy" process.', 'Robin told the team he was unhappy with the delay.']) {
    const task = corpusEvaluation(judgement + ' ' + other + ' ' + neutral + ' The doors closed at six in the evening.', 0)!;
    expect(task.spans.some(span => span.text === other)).toBe(false);
    expect(corpusEvaluation(judgement + ' ' + other + ' The trial began on Monday in the main hall.', 0)).toBeUndefined();
  }
});
it('generates reviewed-package evaluation practice and distinct-root application with unscored interpretation', async () => {
  const catalogue = regressionSourcePacks as { packs: { id: string; path: string; sha256: string }[] };
  const banks = await Promise.all(['008', '010', '013', '020', '021', '025'].map(async suffix => {
    const entry = catalogue.packs.find(pack => pack.id === `wikipedia-reading-${suffix}`)!;
    const bytes = readSourcePackFixture(entry.id);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256);
    const bank = (await inspectCommunityPack(bytes)).corpus!;
    return { ...bank, records: await reviewedReading(bank.records) };
  }));
  const full = { version: 1 as const, failures: [], records: banks.flatMap(bank => bank.records) };
  const candidates = full.records.flatMap(source => source.passages.filter(passage => !!corpusEvaluation(passage.text, 0)).map(passage => ({ source, passage })));
  expect(candidates).toHaveLength(6); expect(new Set(candidates.map(item => item.source.rootId)).size).toBe(6);
  const normal = { ...full, records: candidates.filter(item => item.passage.wordCount <= 220).map(item => ({ ...item.source, passages: [item.passage] })) };
  expect(normal.records).toHaveLength(2);
  for (const seed of [4, 5]) expect(corpusLesson(normal, new Set(), seed, 220, 'B1')!.materials.every(material => material.questions[0].prompt === evaluationPrompt)).toBe(true);
  const operation = `evidence:${evaluationPrompt}`;
  for (const point of ['B1', 'B2', 'C1', 'C2'] as const) for (let seed = 0; seed < 6; seed++) {
    const lesson = corpusLesson(full, new Set(), seed, point === 'B1' ? 220 : 700, point, [], 'evidence', operation)!;
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    expect(lesson.goal.en).toBe(lesson.goal['zh-Hans']);
    for (const material of lesson.materials) {
      const question = material.questions[0];
      expect(corpusOperation(question)).toBe(operation);
      if (!('kind' in question) || question.kind !== 'evidence') throw Error('Expected evaluation evidence');
      expect(score(question, question.accepted[0]).correct).toBe(true);
      expect(score(question, (question.accepted[0] + 1) % 3).correct).toBe(false);
      expect(question.explanation.en).toBe(question.explanation['zh-Hans']);
      const text = material.blocks[0].text;
      for (const span of question.spans) expect(text.slice(span.start, span.end)).toBe(span.text);
      const example = corpusWorkedExample(material, seed);
      if (example) expect(example.en).not.toContain(text.slice(question.evidence.start, question.evidence.end));
      const response = material.questions[1];
      expect('kind' in response && response.kind).toBe('response');
      expect(response.prompt).toContain('praise or criticise');
      expect(score(response, 'An interpretation supported by a quotation.').correct).toBeNull();
      const time = '2026-10-03T00:00:00.000Z';
      expect(exposureSchema.safeParse({ profileId: 'test', rootId: material.rootId, firstSeenAt: time, lastSeenAt: time, contacts: [{ sessionId: 'test', materialId: material.id, questionId: question.id, variantGroup: question.id, firstSeenAt: time, lastSeenAt: time }] }).success).toBe(true);
    }
    const seen = new Set(lesson.materials.map(material => material.id.slice(7)));
    const next = corpusLesson(full, seen, seed, 700, point, [], 'evidence', operation);
    expect(next?.materials.some(material => seen.has(material.id.slice(7)))).not.toBe(true);
  }
  for (const point of ['A1', 'A2'] as const) expect(corpusLesson(full, new Set(), 0, 700, point, [], 'evidence', operation)).toBeUndefined();
}, 15000);

it('keeps two inspected Chomsky criticisms and pairs them with a different named evaluation', () => {
  const bank = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/open-reading.json', 'utf8')));
  const ids = [
    'cbeffc6659c2fea50dba4e9e788bb863a75fdb72a8c52b786de770596a268b12',
    '93bae7be0e0cd4622da2a9569c9098dfe3b4de1ee72be84f7fa08a7595bd6281',
    'cd0ab3f81cf04eb23b288526891a54aacff6fe0fd8e0aca483f2ba302b6a6e16',
  ];
  const frames = ids.map(id => {
    const source = bank.records.find(record => record.passages.some(passage => passage.id === id))!;
    return { source, passage: source.passages.find(passage => passage.id === id)! };
  });
  expect(frames.map(item => item.source.rootId)).toEqual(['openstax-book-psychology-2e', 'openstax-book-psychology-2e', 'openstax-book-us-history']);
  for (const [index, frame] of frames.entries()) {
    const task = corpusEvaluation(frame.passage.text, 0)!;
    expect(task.sourceName).toBe(index === 2 ? 'Abolitionists' : 'Noam Chomsky');
    expect(frame.passage.text.slice(task.evidence.start, task.evidence.end)).toContain(index === 2 ? 'praised' : 'criticized');
    if (index < 2) expect(task.cue).toMatch(/Noam Chomsky \((?:1957|1965)\) criticized/);
  }
  const focused = { version: 1 as const, failures: [] as [], records: frames.map(item => ({ ...item.source, passages: [item.passage] })) };
  const lesson = corpusLesson(focused, new Set(), 0, 220, 'B1', [], 'evidence', `evidence:${evaluationPrompt}`)!;
  expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
  expect(corpusEvaluation('Noam Chomsky (1965) criticized this approach. ' + neutral, 0)?.sourceName).toBe('Noam Chomsky');
  expect(corpusEvaluation('He criticized the incumbent’s increases in taxes. ' + neutral, 0)).toBeUndefined();
  expect(corpusEvaluation('Some criticized the movie for its focus. ' + neutral, 0)).toBeUndefined();
});
