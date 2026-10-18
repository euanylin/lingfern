import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import fc from 'fast-check';
import sources from '../public/audio/a1-sentences/NUMERIC.json';
import { sentenceNumericLesson, sentenceListeningLesson } from '../src/core/beginnerListening';
import { corpusOperation } from '../src/core/corpusPractice';
import { asTestLesson, score, practiceLocale, lessonSchema } from '../src/shared/content';
for (const kind of ['count', 'time'] as const) it(`hears ${kind} with exact units, two original works and separate licences`, () => {
  for (const source of sources[kind]) expect(createHash('sha256').update(readFileSync('public' + source.audio.src)).digest('hex')).toBe(source.audio.sha256);
  fc.assert(fc.property(fc.integer({ min: 0, max: 0xffffffff }), seed => {
    const lesson = sentenceNumericLesson(sources[kind], new Set(), seed, kind)!;
    expect(lesson).toEqual(sentenceNumericLesson(sources[kind], new Set(), seed, kind));
    expect(lesson.goalId).toBe(`heard-explicit-${kind}`); expect(lesson.targetLevel).toBe('A1');
    expect(new Set(lesson.materials.map(m => m.rootId)).size).toBe(2);
    expect(lesson.materials[0].questions[0].hints).toHaveLength(3); expect(lesson.materials[1].questions[0].hints).toBeUndefined();
    expect(lesson).toEqual(JSON.parse(JSON.stringify(lesson)));
    for (const locale of ['en', 'zh-Hans', 'zh-Hant'] as const) { expect(practiceLocale(lesson, locale)).toBe(locale); expect(lesson.teaching![locale]).toContain('nine=9'); expect(lesson.workedExample![locale]).toBeTruthy(); expect(lesson.nextStep![locale]).toBeTruthy(); }
    for (const m of lesson.materials) {
      const s = sources[kind].find(s => s.rootId === m.rootId)!; expect(m.audio).toEqual(s.audio); expect(m.blocks[0].text).toBe(s.text);
      const q = m.questions[0]; if ('kind' in q) throw Error('Expected numeric choice');
      expect(corpusOperation(q)).toBe(`choice:heard-${kind}`); expect(q.id.length).toBeLessThanOrEqual(80);
      expect(q.options[q.answer]).toBe(kind === 'count' ? m.rootId.startsWith('voa-') ? '2' : '3' : m.rootId.startsWith('voa-') ? '5:00 p.m.' : '10:08 p.m.');
      expect(q.evidence).toEqual({ start: 0, end: s.text.length, audioStart: s.segments[0].audioStart, audioEnd: s.segments.at(-1)!.audioEnd });
      expect(q.options[0]).not.toBe(q.options[1]); for (let i = 0; i < 2; i++) expect(score(q, i).correct).toBe(i === q.answer); expect(() => score(q, '2')).toThrow();
      if (m.rootId.startsWith('fleurs-')) { expect(m.credit!.license).toContain('CC BY-SA 4.0'); expect(m.credit!.license).toContain('recording CC BY 4.0'); expect(m.credit!.attribution).toContain('FLEURS'); expect(m.audio!.license).toBe('CC BY 4.0'); }
    }
    const expected = structuredClone(lesson.materials); for (const m of expected) delete m.questions[0].hints;
    expect(asTestLesson(lesson).materials).toEqual(expected); expect(asTestLesson(lesson).teaching).toBeUndefined();
    expect(sentenceNumericLesson(sources[kind], new Set([lesson.materials[0].audio!.sha256]), seed, kind)).toBeUndefined();
  }), { numRuns: 200, seed: 3253185 });
  expect(sentenceNumericLesson([], new Set(), 0, kind)).toBeUndefined(); expect(sentenceNumericLesson(sources[kind].slice(0, 1), new Set(), 0, kind)).toBeUndefined();
});
it('does not turn different groups, uncertain times or malformed sources into exact numeric evidence', () => {
  const modified = (kind: 'count' | 'time', text: string) => ({ ...sources[kind][1], text, segments: [{ start: 0, end: text.length, text, audioStart: .2, audioEnd: 3 }] });
  for (const text of ['Earlier this week, a police helicopter crash killed three people and wounded at least three more.', 'Earlier this week, a police helicopter crash killed three people and might have wounded three more.']) expect(sentenceNumericLesson([sources.count[0], modified('count', text)], new Set(), 0, 'count')).toBeUndefined();
  for (const text of ['A moderate earthquake shook western Montana at 13:08 p.m. on Monday.', 'A moderate earthquake shook western Montana at 10:70 p.m. on Monday.', 'My office, 5 p.m. 6 p.m.', 'My office, 5 p.m. 5 a.m.']) expect(sentenceNumericLesson([sources.time[0], modified('time', text)], new Set(), 0, 'time')).toBeUndefined();
  expect(sentenceNumericLesson(sources.time, new Set(), 0, 'count')).toBeUndefined();
  expect(() => sentenceNumericLesson(sources.time, new Set(), -1, 'time')).toThrow();
  expect(() => sentenceNumericLesson([sources.time[0], sources.time[0]], new Set(), 0, 'time')).toThrow();
  const bad = structuredClone(sources.time); bad[1].audio.license = 'unknown'; expect(() => sentenceNumericLesson(bad, new Set(), 0, 'time')).toThrow();
  expect(() => sentenceListeningLesson(sources.time, new Set(), 0)).toThrow(); // The older VOA-only parser stays narrow.
});

it('retains the bundled voice path, author and separate text/audio provenance guards', () => {
  const lesson = sentenceNumericLesson(sources.time, new Set(), 0, 'time')!;
  for (const mutate of [
    (m: typeof lesson.materials[number]) => { m.audio!.author = 'Unknown voice'; },
    (m: typeof lesson.materials[number]) => { m.audio!.license = 'public domain'; },
    (m: typeof lesson.materials[number]) => { m.audio!.src = '/audio/unknown/fleurs-montana-clock.mp3'; },
    (m: typeof lesson.materials[number]) => { m.credit!.license = 'recording CC BY 4.0'; },
    (m: typeof lesson.materials[number]) => { m.credit!.sourceUrl = 'https://example.com/article'; },
    (m: typeof lesson.materials[number]) => { m.rootId = 'unrelated-work'; },
  ]) {
    const bad = structuredClone(lesson), material = bad.materials.find(m => m.rootId.startsWith('fleurs-'))!; mutate(material);
    expect(() => lessonSchema.parse(bad)).toThrow('Audio provenance is inconsistent');
  }
});

it('makes a wrong hour, minute and day-part independently testable in ordinary time seeds', () => {
  for (const [seed, wrong] of [[7, '10:08 a.m.'], [40, '10:09 p.m.'], [51, '11:08 p.m.']] as const) {
    const lesson = sentenceNumericLesson(sources.time, new Set(), seed, 'time')!;
    const material = lesson.materials.find(m => m.rootId.startsWith('fleurs-'))!, q = material.questions[0];
    if ('kind' in q) throw Error('Expected time choice');
    expect(q.options[q.answer]).toBe('10:08 p.m.'); expect(q.options[1 - q.answer]).toBe(wrong);
  }
});
