import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { corpusReference, referenceSupport } from '../src/core/corpusReference';
import { questionSchema, score } from '../src/shared/content';
import { inspectCommunityPack } from '../src/data/communityPack';
import { corpusLesson } from '../src/core/corpus';
import { corpusOperation } from '../src/core/corpusPractice';
import { claimSession, createSession, markExposure, submit, attempts, exposures } from '../src/data/db';

const windows = JSON.parse(readFileSync('tests/fixtures/long-reference-sources.json', 'utf8')).records as { text: string }[];
it('generates both inspected constructions from source text, with exact context and every option scored', () => {
  for (const { text } of windows) for (let seed = 0; seed < 24; seed++) {
    const task = corpusReference(text, seed)!;
    expect(task).toBeDefined();
    const q = questionSchema.parse({ ...task, id: 'reference', blockId: 'source', additionalEvidence: task.additionalEvidence.map(span => ({ ...span, blockId: 'source' })), hints: referenceSupport.hints });
    if ('kind' in q) throw new Error('Expected reference choice');
    expect(text.slice(q.evidence.start, q.evidence.end)).toContain(text.includes('these civilizations') ? 'these civilizations' : 'its');
    expect(q.additionalEvidence?.[0].end).toBeLessThan(q.evidence.start);
    for (let answer = 0; answer < task.options.length; answer++) expect(score(q, answer).correct).toBe(answer === q.answer);
    expect(() => score(q, -1)).toThrow('INVALID_ANSWER');
    expect(corpusReference(text, seed)).toEqual(task);
  }
});
it('refuses lost/changed/duplicate antecedents, duplicate scored context and uninspected alternatives', () => {
  for (const { text } of windows) {
    const task = corpusReference(text, 0)!;
    const span = task.additionalEvidence[0];
    expect(corpusReference(text.slice(task.evidence.start), 0)).toBeUndefined();
    expect(corpusReference(text.slice(0, span.start) + 'An unrelated statement.' + text.slice(span.end), 0)).toBeUndefined();
    expect(corpusReference(text + '\n' + text, 0)).toBeUndefined();
    expect(corpusReference(text.slice(0, span.start) + text.slice(span.start, span.end) + ' ' + text.slice(span.start), 0)).toBeUndefined();
  }
  expect(corpusReference('Mira saw Lena. She smiled.', 0)).toBeUndefined();
  expect(corpusReference(windows[0].text.replace('writing systems', 'other civilizations'), 0)).toBeUndefined();
  expect(corpusReference(windows[1].text.replace('liked its', 'liked their'), 0)).toBeUndefined();
  expect(() => corpusReference(windows[0].text, -1)).toThrow('INVALID_REFERENCE_SEED');
  const renamed = windows[1].text.replaceAll('Google', 'Orion').replaceAll('PageRank', 'LinkScore').replaceAll('Page and Brin', 'Mira and Lena');
  const generated = corpusReference(renamed, 1)!;
  expect(generated.options[generated.answer]).toBe('Orion.');
  expect(generated.options).not.toContain('Google.');
});

it('uses the same source-derived rule in reading generation and refuses exposed application or changed context', async () => {
  const pack = await inspectCommunityPack(new Uint8Array(readFileSync('tests/fixtures/long-reference-reading.zip')));
  expect(pack.lessons).toHaveLength(0);
  const bank = pack.corpus!;
  for (let seed = 0; seed < 24; seed++) {
    const lesson = corpusLesson(bank, new Set(), seed, 500, 'B2', [], 'choice', [], 'choice:reference')!;
    expect(lesson).toBeDefined(); expect(lesson.goalId).toBe('source-context-reference');
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    for (const m of lesson.materials) expect(corpusOperation(m.questions[0])).toBe('choice:reference');
    if (seed === 0) {
      const session = await createSession(lesson, 'long-reference-regression');
      const claimed = await claimSession(session.id, 'reference-owner');
      await markExposure(claimed);
      const q = claimed.lesson.materials[0].questions[0];
      if ('kind' in q) throw new Error('Expected reference choice');
      await submit(session.id, 'reference-owner', q.answer);
      expect((await attempts.get(`${session.id}:${q.id}`))?.correct).toBe(true);
      expect((await exposures.get(['long-reference-regression', claimed.lesson.materials[0].rootId]))?.contacts?.[0].questionId).toBe(q.id);
    }
  }
  expect(corpusLesson(bank, new Set([bank.records[0].passages[0].id]), 0, 500, 'B2', [], 'choice', [], 'choice:reference')).toBeUndefined();
  const changed = structuredClone(bank); changed.records[0].passages[0].text = changed.records[0].passages[0].text.replace('these civilizations', 'these objects');
  expect(corpusLesson(changed, new Set(), 0, 500, 'B2', [], 'choice', [], 'choice:reference')).toBeUndefined();
});
