import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import fc from 'fast-check';
import { corpusPeople, peopleMatchingPrompt, corpusLesson, corpusSchema } from '../src/core/corpus';
import { corpusOperation } from '../src/core/corpusPractice';
import { asTestLesson, score } from '../src/shared/content';
const bank = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8')));
const operation = `matching:${peopleMatchingPrompt}`;

it('identifies the speaker of real self-descriptions, including a different person named inside the turn', () => {
  const book = bank.records.find(source => source.rootId === 'voa-article-3168920')!.passages.find(p => p.startingPoints?.includes('A1'))!;
  const intro = bank.records.find(source => source.rootId === 'voa-article-3113733')!.passages.find(p => p.startingPoints?.includes('A1'))!;
  expect(corpusPeople(book.text, 0)?.pairs).toEqual([{ label: 'Says they are great.', answer: 'Marsha' }, { label: 'Says they are new to D.C.', answer: 'Anna' }]);
  expect(corpusPeople(intro.text, 0)?.choices).toEqual(['Anna', 'Pete', 'Jonathan']);
  fc.assert(fc.property(fc.integer({ min: 0, max: 0xffffffff }), seed => {
    const lesson = corpusLesson(bank, new Set(), seed, 120, 'A1', [], 'matching', operation)!;
    expect(lesson).toBeDefined(); expect(lesson.targetLevel).toBe('A1');
    expect(lesson.goalId).toBe('explicit-person-description');
    expect(lesson).toEqual(JSON.parse(JSON.stringify(lesson)));
    expect(lesson).toEqual(corpusLesson(bank, new Set(), seed, 120, 'A1', [], 'matching', operation));
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    expect(lesson.materials.map(material => material.rootId).sort()).toEqual(['voa-article-3113733', 'voa-article-3168920']);
    for (const [index, material] of lesson.materials.entries()) {
      const q = material.questions[0];
      if (!('kind' in q) || q.kind !== 'matching') throw new Error('Expected people matching');
      expect(corpusOperation(q)).toBe(operation);
      expect(q.hints?.length).toBe(index ? undefined : 3);
      const ranges = [q.evidence, ...q.additionalEvidence!];
      q.pairs.forEach((pair, i) => {
        const evidence = material.blocks[0].text.slice(ranges[i].start, ranges[i].end);
        expect(evidence.startsWith(pair.answer + ':')).toBe(true);
        expect(evidence).toContain('I am ' + pair.label.slice('Says they are '.length, -1).replace('apartment D7', 'Apartment D7'));
      });
      const answer = q.pairs.map(pair => pair.answer);
      expect(score(q, answer).correct).toBe(true);
      expect(score(q, answer.toReversed()).correct).toBe(false);
      expect(() => score(q, [])).toThrow(); expect(() => score(q, 'Anna')).toThrow();
      expect(() => score(q, answer.map(() => 'unknown'))).toThrow();
      const response = material.questions[1]; expect('kind' in response && response.kind).toBe('response');
      expect(score(response, 'A learner sentence').correct).toBeNull();
      for (const locale of ['zh-Hans', 'zh-Hant', 'en'] as const) {
        expect(lesson.teaching![locale]).toContain('I');
        expect(lesson.workedExample![locale]).toContain('Mira');
        expect(lesson.workedExample![locale]).not.toContain('Anna');
        expect(q.explanation[locale]).toContain('I');
      }
    }
    const test = asTestLesson(lesson), expected = structuredClone(lesson.materials);
    expected.forEach(material => material.questions.forEach(question => delete question.hints));
    expect(test.materials).toEqual(expected); expect(test.teaching).toBeUndefined(); expect(test.workedExample).toBeUndefined();
  }), { numRuns: 500 });
});

it('rejects ambiguity, uncertain/negative speakers, missing evidence and missing same-goal independent application', () => {
  for (const text of ['Mira: I am great.\nLeo: I am great.', 'Mira: If it is Monday, I am great.\nLeo: I am new to D.C.', 'Mira: I am great.\nMira: I am not great.\nLeo: I am new to D.C.', 'I am great.\nI am from a small town.', 'Mira: I am hungry.\nLeo: I am asleep.']) expect(corpusPeople(text, 0)).toBeUndefined();
  expect(() => corpusPeople('Mira: I am great.', -1)).toThrow();
  const one = { ...bank, records: bank.records.filter(source => source.rootId === 'voa-article-3168920') };
  expect(corpusLesson(one, new Set(), 0, 120, 'A1', [], 'matching', operation)).toBeUndefined();
  const seen = new Set(bank.records.flatMap(source => source.passages.map(p => p.id)));
  expect(corpusLesson(bank, seen, 0, 120, 'A1', [], 'matching', operation)).toBeUndefined();
  const different = { ...bank, records: [...one.records, bank.records.find(source => source.rootId === 'voa-article-3168971')!] };
  expect(corpusLesson(different, new Set(), 0, 120, 'A1', [], 'matching', operation)).toBeUndefined();
});

it('binds admitted person scopes to their exact source and text before client generation', async () => {
  const { reviewedReading } = await import('../src/data/corpus');
  const source = bank.records.find(source => source.rootId === 'voa-article-3168920')!;
  const passage = source.passages.find(p => p.startingPoints?.includes('A1'))!;
  expect((await reviewedReading([{ ...source, passages: [passage] }]))[0].passages[0]).toEqual(passage);
  for (const changed of [{ ...source, sourceHash: '0'.repeat(64) }, { ...source, passages: source.passages.map(p => p.id === passage.id ? { ...p, text: p.text.replace('I am great!', 'I am not great!') } : p) }]) await expect(reviewedReading([changed])).rejects.toThrow('CORPUS_INTEGRITY');
});
