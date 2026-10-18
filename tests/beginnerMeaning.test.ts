import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import fc from 'fast-check';
import sources from '../public/audio/a1-sentences/MEANING.json';
import { sentenceMeaningLesson } from '../src/core/beginnerListening';
import { corpusOperation } from '../src/core/corpusPractice';
import { asTestLesson, score, practiceLocale } from '../src/shared/content';

for (const kind of ['location', 'instruction', 'verification'] as const) {
  it(`generates exact-source ${kind} meaning and unfamiliar application without leaking an example answer`, () => {
    for (const source of sources[kind]) expect(createHash('sha256').update(readFileSync('public' + source.audio.src)).digest('hex')).toBe(source.audio.sha256);
    const expected = kind === 'location' ? ['We relax in the living room.', 'The gym is across from the lounge.'] : kind === 'instruction' ? ['Try once more.', 'Meet your coworkers.'] : ['A-N-N-A', '555-8689'];
    fc.assert(fc.property(fc.integer({ min: 0, max: 0xffffffff }), seed => {
      const lesson = sentenceMeaningLesson(sources[kind], new Set(), seed, kind)!;
      expect(lesson).toEqual(sentenceMeaningLesson(sources[kind], new Set(), seed, kind));
      expect(lesson.goalId).toBe(`heard-explicit-${kind}`);
      if (kind === 'verification') for (const text of Object.values(lesson.teaching!)) { expect(text).toContain('five=5'); expect(text).toContain('nine=9'); expect(text).toContain('en'); }
      expect(new Set(lesson.materials.map(m => m.rootId)).size).toBe(2);
      expect(lesson.materials[0].questions[0].hints).toHaveLength(3);
      expect(lesson.materials[1].questions[0].hints).toBeUndefined();
      expect(lesson).toEqual(JSON.parse(JSON.stringify(lesson)));
      for (const locale of ['en', 'zh-Hans', 'zh-Hant'] as const) {
        expect(practiceLocale(lesson, locale)).toBe(locale);
        expect(lesson.goal![locale]).toBeTruthy(); expect(lesson.teaching![locale]).toBeTruthy(); expect(lesson.workedExample![locale]).toBeTruthy(); expect(lesson.nextStep![locale]).toBeTruthy();
      }
      for (const m of lesson.materials) {
        const source = sources[kind].find(s => s.rootId === m.rootId)!;
        expect(m.audio).toEqual(source.audio); expect(m.blocks[0].text).toBe(source.text);
        const q = m.questions[0]; if ('kind' in q) throw Error('Expected meaning choice');
        expect(corpusOperation(q)).toBe(`choice:heard-${kind}`); expect(q.id.length).toBeLessThanOrEqual(80);
        expect(expected).toContain(q.options[q.answer]); expect(q.options[q.answer]).not.toBe(q.options[1 - q.answer]);
        expect(q.evidence).toEqual({ start: 0, end: source.text.length, audioStart: source.segments[0].audioStart, audioEnd: source.segments.at(-1)!.audioEnd });
        expect(lesson.workedExample!.en).not.toContain(q.options[q.answer]);
        for (let answer = 0; answer < 2; answer++) expect(score(q, answer).correct).toBe(answer === q.answer);
        expect(() => score(q, 2)).toThrow(); expect(() => score(q, '0')).toThrow();
      }
      const materials = structuredClone(lesson.materials); for (const m of materials) delete m.questions[0].hints;
      expect(asTestLesson(lesson).materials).toEqual(materials); expect(asTestLesson(lesson).teaching).toBeUndefined();
      expect(sentenceMeaningLesson(sources[kind], new Set([lesson.materials[0].audio!.sha256]), seed, kind)).toBeUndefined();
    }), { numRuns: 200, seed: 3253185 });
    expect(sentenceMeaningLesson([], new Set(), 0, kind)).toBeUndefined();
    expect(sentenceMeaningLesson(sources[kind].slice(0, 1), new Set(), 0, kind)).toBeUndefined();
  });
}
it('rejects contradictory, ambiguous, unconfirmed and incomplete constructions', () => {
  const replace = (kind: 'location' | 'instruction' | 'verification', text: string) => {
    const source = sources[kind][1]; return [sources[kind][0], { ...source, text, segments: [{ start: 0, end: text.length, text, audioStart: .2, audioEnd: 3 }] }];
  };
  for (const text of ['The gym is across from the lounge. It might be next to the mailroom.', "The gym is across from the lounge. It's next to the lounge. Go that way.", 'We relax in the living room. I relax in the bedroom.'])
    expect(sentenceMeaningLesson(replace('location', text), new Set(), 0, 'location')).toBeUndefined();
  for (const text of ['Please, meet your coworkers. But remember, do not meet them.', 'Do not meet your coworkers.', 'Your coworkers are busy working.'])
    expect(sentenceMeaningLesson(replace('instruction', text), new Set(), 0, 'instruction')).toBeUndefined();
  for (const text of ['Is this 555-8986? No, this is 555-8986.', 'Is this 555-8986? Maybe it is 555-8689.', 'Is this 555-8986?', 'Anna, is that A-N-A? No, A-N-A. Well, Anna with two N\'s.'])
    expect(sentenceMeaningLesson(replace('verification', text), new Set(), 0, 'verification')).toBeUndefined();
});
