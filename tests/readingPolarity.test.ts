import { expect, it } from 'vitest';
import fc from 'fast-check';
import sources from '../public/audio/a1-sentences/SENTENCES.json';
import { sentencePolarityLesson } from '../src/core/beginnerListening';
import { corpusOperation } from '../src/core/corpusPractice';
import { asTestLesson, score } from '../src/shared/content';

it('reads nominal affirmation/negation with meaning responses, exact evidence and unfamiliar same-goal application', () => {
  const primaryRoots = new Set<string>(), meanings = new Set<string>();
  fc.assert(fc.property(fc.integer({ min: 0, max: 0xffffffff }), seed => {
    const lesson = sentencePolarityLesson(sources, new Set(), seed, 'reading')!;
    expect(lesson).toEqual(sentencePolarityLesson(sources, new Set(), seed, 'reading'));
    expect(lesson).toEqual(JSON.parse(JSON.stringify(lesson)));
    expect(lesson.skill).toBe('reading');
    expect(lesson.targetLevel).toBe('A1');
    expect(lesson.goalId).toBe('stated-polarity-verification');
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    expect(lesson.materials.some(material => material.rootId === 'voa-article-3168971')).toBe(true);
    expect(lesson.materials.some(material => ['voa-article-3168920', 'voa-article-3225958'].includes(material.rootId))).toBe(true);
    primaryRoots.add(lesson.materials[0].rootId);
    expect(lesson.materials[0].questions[0].hints).toHaveLength(3);
    expect(lesson.materials[1].questions[0].hints).toBeUndefined();
    for (const material of lesson.materials) {
      expect(material.audio).toBeUndefined();
      const source = sources.find(source => source.rootId === material.rootId)!;
      expect(material.blocks[0].text).toBe(source.text);
      const q = material.questions[0];
      if ('kind' in q) throw new Error('Expected a binary meaning choice');
      expect(corpusOperation(q)).toBe('choice:stated-polarity');
      expect(q.id.length).toBeLessThanOrEqual(80);
      const text = source.text.slice(q.evidence.start, q.evidence.end);
      const claim = /^(It is|This is|She is)( not)? (.+)\.$/.exec(q.prompt.split('\n')[1])!;
      expect(claim).not.toBeNull();
      const predicate = claim[3], sourceNegative = text.includes(`${claim[1]} not ${predicate}.`);
      expect(text).toContain(`${claim[1]}${sourceNegative ? ' not' : ''} ${predicate}.`);
      const yes = sourceNegative === !!claim[2];
      expect(q.options[q.answer]).toBe(yes ? 'Yes' : 'No');
      expect(q.options[1 - q.answer]).toBe(yes ? 'No' : 'Yes');
      expect(q.evidence.audioStart).toBeUndefined();
      expect(q.evidence.audioEnd).toBeUndefined();
      meanings.add(`${material.rootId}:${yes}`);
      for (let answer = 0; answer < 2; answer++) expect(score(q, answer).correct).toBe(answer === q.answer);
      for (const invalid of [-1, 2, 'yes']) expect(() => score(q, invalid)).toThrow();
      expect(() => Reflect.apply(score, undefined, [q, null])).toThrow();
      for (const locale of ['zh-Hans', 'zh-Hant', 'en'] as const) {
        expect(lesson.goal[locale]).toBeTruthy(); expect(lesson.teaching![locale]).toBeTruthy();
        expect(lesson.workedExample![locale]).toContain('cup'); expect(lesson.workedExample![locale]).not.toContain(predicate);
        expect(lesson.nextStep![locale]).toBeTruthy(); expect(q.explanations.every(e => e[locale])).toBe(true);
      }
    }
    const tested = asTestLesson(lesson), expected = structuredClone(lesson.materials);
    for (const material of expected) for (const q of material.questions) delete q.hints;
    expect(tested.materials).toEqual(expected);
    expect(tested.teaching).toBeUndefined();
    expect(tested.materials.every(material => material.questions.every(q => !q.hints))).toBe(true);
  }), { numRuns: 500, seed: 3225958 });
  expect(primaryRoots.size).toBe(3); expect(meanings.size).toBe(6);
});

it('preserves an unseen negative recording for listening after the reading unit', () => {
  for (let seed = 0; seed < 32; seed++) {
    const reading = sentencePolarityLesson(sources, new Set(), seed, 'reading')!;
    const roots = new Set(reading.materials.map(material => material.rootId));
    const listening = sentencePolarityLesson(sources.filter(source => !roots.has(source.rootId)), new Set(), seed)!;
    expect(listening).toBeDefined();
    expect(listening.materials.every(material => !roots.has(material.rootId))).toBe(true);
  }
});

it('withholds missing, seen, ambiguous or insufficient statement contexts instead of inventing an application', () => {
  const pair = sources.filter(source => ['voa-article-3168920', 'voa-article-3225958'].includes(source.rootId));
  expect(sentencePolarityLesson(pair.slice(0, 1), new Set(), 0, 'reading')).toBeUndefined();
  expect(sentencePolarityLesson(sources, new Set([pair[0].audio.sha256]), 0, 'reading')!.materials.every(material => material.rootId !== pair[0].rootId)).toBe(true);
  expect(sentencePolarityLesson(sources, new Set(pair.map(source => source.audio.sha256)), 0, 'reading')).toBeUndefined();
  const rewrite = (text: string) => ({ ...pair[0], text, segments: [{ start: 0, end: text.length, text, audioStart: 0, audioEnd: pair[0].audio.duration }] });
  for (const text of ['It is not a pen. It is a pen.', 'It is not a book. It is a big book.', 'Is it a book? It may be a pen.', 'It is not a pen if you look closer.', 'This is not the gym.', 'It is not running.'])
    expect(sentencePolarityLesson([rewrite(text), pair[1]], new Set(), 0, 'reading')).toBeUndefined();
  const intro = sources.find(source => source.rootId === 'voa-article-3113733')!;
  const text = 'She is Anna. Hello.';
  const nameOnly = { ...intro, text, segments: [{ start: 0, end: text.length, text, audioStart: 0, audioEnd: intro.audio.duration }] };
  for (const skill of ['reading', 'listening'] as const) expect(sentencePolarityLesson([pair[0], nameOnly], new Set(), 0, skill)).toBeUndefined();
});
