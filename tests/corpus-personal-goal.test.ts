import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import fc from 'fast-check';
import { corpusLesson, corpusSchema, corpusPersonalGoal } from '../src/core/corpus';
import { corpusOperation } from '../src/core/corpusPractice';
import { asTestLesson, score } from '../src/shared/content';
import scopes from '../content/corpus/a2-personal-goal-scopes.json';
const bank = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8')));

it.each(['need', 'preference'] as const)('generates inspected %s with exact people/context, both scoring outcomes and unfamiliar same-goal application', kind => {
  const operation = `choice:personal-${kind}`;
  fc.assert(fc.property(fc.integer({ min: 0, max: 0xffffffff }), seed => {
    const lesson = corpusLesson(bank, new Set(), seed, 160, 'A2', [], 'choice', [], operation)!;
    expect(lesson).toBeDefined(); expect(lesson.targetLevel).toBe('A2'); expect(lesson.goalId).toBe(kind === 'need' ? 'explicit-stated-need' : 'explicit-stated-preference');
    expect(lesson.materials.map(m => m.rootId).sort()).toEqual(scopes[kind].map(s => s.rootId).sort());
    for (const [index, material] of lesson.materials.entries()) {
      const q = material.questions[0]; if ('kind' in q) throw new Error('Expected choice');
      expect(material.questions).toHaveLength(1); expect(corpusOperation(q)).toBe(operation);
      expect(q.hints?.length).toBe(index ? undefined : 3);
      expect(createHash('sha256').update(material.blocks[0].text).digest('hex')).toBe(scopes[kind].find(s => s.rootId === material.rootId)!.textSha256);
      const evidence = material.blocks[0].text.slice(q.evidence.start, q.evidence.end);
      expect(evidence).toMatch(kind === 'need' ? /Anna:.*(?:I have to|I need to)/ : /(?:Louis|Anna): I like/);
      expect(q.options[q.answer]).toBe(kind === 'need' ? material.rootId === 'voa-article-3406732' ? 'get my driver’s license' : 'return three books to the library' : material.rootId === 'voa-article-3355849' ? 'the art museums' : 'the Sculpture Garden');
      expect(score(q, q.answer).correct).toBe(true); expect(score(q, 1 - q.answer).correct).toBe(false);
      for (const bad of [-1, 2, '1']) expect(() => score(q, bad)).toThrow();
      for (const locale of ['en', 'zh-Hans', 'zh-Hant'] as const) {
        expect(q.explanations[1 - q.answer][locale].length).toBeGreaterThan(50);
        expect(lesson.teaching![locale].length).toBeGreaterThan(100); expect(lesson.workedExample![locale]).not.toMatch(/Anna|Louis|license|Sculpture/);
      }
      if (kind === 'need' && material.rootId === 'voa-article-3406732') expect(q.additionalEvidence?.map(e => material.blocks[0].text.slice(e.start, e.end))).toEqual(['Marsha: Great! I have to help my friend with the party. Can you help me?']);
    }
    const bare = structuredClone(lesson.materials); bare.forEach(m => m.questions.forEach(q => delete q.hints));
    expect(asTestLesson(lesson).materials).toEqual(bare); expect(asTestLesson(lesson).teaching).toBeUndefined();
    expect(lesson).toEqual(JSON.parse(JSON.stringify(lesson)));
  }), { numRuns: 200 });
  for (const scope of scopes[kind]) {
    expect(corpusLesson({ ...bank, records: bank.records.filter(r => r.rootId === scope.rootId) }, new Set(), 0, 160, 'A2', [], 'choice', [], operation)).toBeUndefined();
    expect(corpusLesson(bank, new Set([scope.passageId]), 0, 160, 'A2', [], 'choice', [], operation)).toBeUndefined();
  }
  expect(corpusLesson(bank, new Set(), 0, 160, 'A1', [], 'choice', [], operation)).toBeUndefined();
});

it('rejects negation, changed contexts, hypothetical preferences, duplicated/conflicting frames and absent other-speaker context', () => {
  const textFor = (id: string) => bank.records.flatMap(r => r.passages).find(p => p.id === id)!.text;
  const need = textFor(scopes.need[0].passageId), pref = textFor(scopes.preference[0].passageId);
  for (const text of [need.replace('I have to get', 'I do not have to get'), need.replace('Marsha: Great! I have to help my friend with the party. Can you help me?', ''), need + '\n' + need]) expect(corpusPersonalGoal(text, 0, 'need')).toBeUndefined();
  for (const text of [pref.replace('I really like', 'I might really like'), pref.replace('I really like', 'I do not really like'), pref + '\n' + pref]) expect(corpusPersonalGoal(text, 0, 'preference')).toBeUndefined();
  expect(corpusPersonalGoal(scopes.preference.map(s => textFor(s.passageId)).join('\n'), 0, 'preference')).toBeUndefined();
  expect(() => corpusPersonalGoal('', -1, 'need')).toThrow(); expect(() => corpusPersonalGoal('a'.repeat(12001), 0, 'preference')).toThrow();
});

it('rejects altered full contexts or provenance rather than approving a matched preference phrase', async () => {
  const { reviewedReading } = await import('../src/data/corpus');
  for (const scope of [...scopes.need, ...scopes.preference]) {
    const source = bank.records.find(s => s.rootId === scope.rootId)!;
    await expect(reviewedReading([{ ...source, sourceHash: 'f'.repeat(64) }])).rejects.toThrow('CORPUS_INTEGRITY');
    await expect(reviewedReading([{ ...source, passages: source.passages.map(p => p.id === scope.passageId ? { ...p, text: p.text + '\nAnna: I changed my mind.' } : p) }])).rejects.toThrow('CORPUS_INTEGRITY');
  }
});
