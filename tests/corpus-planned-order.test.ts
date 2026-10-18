import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import fc from 'fast-check';
import { corpusLesson, corpusSchema, corpusPlannedOrder, corpusDefaultFocus } from '../src/core/corpus';
import { corpusOperation } from '../src/core/corpusPractice';
import { asTestLesson, score } from '../src/shared/content';
import scopes from '../content/corpus/a2-order-scopes.json';
const bank = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8')));
const operation = 'choice:planned-order';
const sources = bank.records.filter(r => scopes.records.some(s => s.rootId === r.rootId));
const paragraphs = scopes.records.map(scope => sources.flatMap(s => s.passages).find(p => p.id === scope.passageId)!.text);

it('generates same-goal plans on two inspected originals, preserving action order rather than page order', () => {
  fc.assert(fc.property(fc.integer({ min: 0, max: 0xffffffff }), seed => {
    const lesson = corpusLesson(bank, new Set(), seed, 120, 'A2', [], 'choice', [], operation)!;
    expect(lesson?.goalId).toBe('explicit-planned-order'); expect(lesson.targetLevel).toBe('A2');
    expect(lesson.materials.map(m => m.rootId).sort()).toEqual(scopes.records.map(s => s.rootId).sort());
    for (const [i, m] of lesson.materials.entries()) {
      const q = m.questions[0]; if ('kind' in q) throw new Error('Expected choice');
      expect(m.questions).toHaveLength(1); expect(corpusOperation(q)).toBe(operation);
      expect(q.hints?.length).toBe(i ? undefined : 3);
      expect(createHash('sha256').update(m.blocks[0].text).digest('hex')).toBe(scopes.records.find(s => s.rootId === m.rootId)!.textSha256);
      const text = m.blocks[0].text.slice(q.evidence.start, q.evidence.end);
      expect(text).toMatch(/First, I have to|before we get ice cream/);
      expect(q.options[q.answer]).toBe(text.includes('First,') ? 'take a test on the computer → take a test in the car' : 'return three books to the library → get ice cream');
      expect(score(q, q.answer).correct).toBe(true); expect(score(q, 1 - q.answer).correct).toBe(false);
      for (const bad of [-1, 2, '0']) expect(() => score(q, bad)).toThrow();
      for (const locale of ['en', 'zh-Hans', 'zh-Hant'] as const) {
        expect(q.explanations[1 - q.answer][locale].length).toBeGreaterThan(40);
        expect(lesson.teaching![locale].length).toBeGreaterThan(100);
        expect(lesson.workedExample![locale]).not.toMatch(/Anna|books|computer/);
      }
    }
    const bare = structuredClone(lesson.materials); bare.forEach(m => m.questions.forEach(q => delete q.hints));
    expect(asTestLesson(lesson).materials).toEqual(bare); expect(asTestLesson(lesson).teaching).toBeUndefined();
  }), { numRuns: 200 });
});

it('rejects missing, duplicated, ambiguous and qualified frames instead of inferring order', () => {
  for (const text of ['Anna: I take a test on the computer. I take a test in the car.', paragraphs.join('\n'), paragraphs[0] + '\n' + paragraphs[0], paragraphs[0].replace('First, I have to', 'First, I might'), paragraphs[1].replace('before we get ice cream', 'after we get ice cream'), paragraphs[1].replace('I need to return', 'I do not need to return')]) expect(corpusPlannedOrder(text, 0)).toBeUndefined();
  expect(() => corpusPlannedOrder('', -1)).toThrow(); expect(() => corpusPlannedOrder('a'.repeat(12001), 0)).toThrow();
  for (const record of sources) expect(corpusLesson({ ...bank, records: [record] }, new Set(), 0, 120, 'A2', [], 'choice', [], operation)).toBeUndefined();
  expect(corpusLesson(bank, new Set(bank.records.flatMap(r => r.passages.map(p => p.id))), 0, 120, 'A2', [], 'choice', [], operation)).toBeUndefined();
  expect(corpusLesson(bank, new Set(), 0, 120, 'A1', [], 'choice', [], operation)).toBeUndefined();
});

it('reaches planned order from the ordinary A2 operation cycle and never substitutes another application', () => {
  const count = bank.records.reduce((sum, r) => sum + r.passages.filter(p => p.startingPoints?.includes('A2') && p.wordCount <= 120).length, 0);
  expect(Array.from({ length: 100 }, (_, n) => corpusDefaultFocus(n * count, count, 'A2')[1])).toContain(operation);
  const exhaustedApplication = { ...bank, records: bank.records.map(r => ({ ...r, passages: r.passages.filter(p => p.id !== scopes.records[1].passageId) })) };
  expect(corpusLesson(exhaustedApplication, new Set(), 0, 120, 'A2', [], 'choice', [], operation)).toBeUndefined();
});

it('protects reviewed order scopes against altered context and source identity', async () => {
  const { reviewedReading } = await import('../src/data/corpus');
  for (const scope of scopes.records) {
    const source = sources.find(s => s.rootId === scope.rootId)!;
    await expect(reviewedReading([{ ...source, sourceHash: 'f'.repeat(64) }])).rejects.toThrow('CORPUS_INTEGRITY');
    await expect(reviewedReading([{ ...source, passages: source.passages.map(p => p.id === scope.passageId ? { ...p, text: p.text + '\nAnna: The plan changed.' } : p) }])).rejects.toThrow('CORPUS_INTEGRITY');
  }
});
