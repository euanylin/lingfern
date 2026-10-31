import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import fc from 'fast-check';
import { personalListeningLesson } from '../src/core/a2Listening';
import { corpusOperation } from '../src/core/corpusPractice';
import { asTestLesson, lessonSchema, score } from '../src/shared/content';
import sources from '../public/audio/a2-speech/PERSONAL.json';

it.each(['need', 'preference'] as const)('teaches inspected heard %s meaning with exact scope, both alternatives, distinct works and unassisted application', kind => {
  fc.assert(fc.property(fc.integer({ min: 0, max: 0xffffffff }), seed => {
    const lesson = personalListeningLesson(sources[kind], new Set(), seed, kind)!;
    expect(lesson?.targetLevel).toBe('A2'); expect(lesson.materials.map(m => m.rootId).sort()).toEqual(sources[kind].map(s => s.rootId).sort());
    for (const [i, m] of lesson.materials.entries()) {
      expect(createHash('sha256').update(readFileSync('public' + m.audio!.src)).digest('hex')).toBe(m.audio!.sha256);
      expect(m.questions).toHaveLength(1); const q = m.questions[0]; if ('kind' in q) throw new Error('Expected choice');
      expect(corpusOperation(q)).toBe(`choice:heard-personal-${kind}`); expect(q.id.length).toBeLessThanOrEqual(80); expect(q.hints?.length).toBe(i ? undefined : 3);
      expect(score(q, q.answer).correct).toBe(true); expect(score(q, 1 - q.answer).correct).toBe(false);
      for (const bad of [-1, 2, '1']) expect(() => score(q, bad)).toThrow();
      const evidence = m.blocks[0].text.slice(q.evidence.start, q.evidence.end);
      expect(evidence).toMatch(kind === 'need' ? /I have to (?:go now|record again)/ : /I liked the music|lonesome places, I like them/);
      expect(q.evidence.audioStart).toBeGreaterThanOrEqual(0); expect(q.evidence.audioEnd).toBeLessThanOrEqual(m.audio!.duration);
      if (m.rootId === 'voa-article-3240468') { expect(q.additionalEvidence?.map(e => m.blocks[0].text.slice(e.start, e.end))).toEqual(['Are you recording?']); expect(q.options[1 - q.answer]).toBe('not record again'); expect(q.explanations[q.answer].en).toContain('does not specify how much'); }
      if (m.rootId === 'gutenberg-book-4540') {
        expect(evidence).toBe('I liked the music," answered Felicia quietly.');
        expect(q.additionalEvidence?.[0]).toBeDefined(); expect(m.blocks[0].text.slice(q.additionalEvidence![0].start, q.additionalEvidence![0].end)).toContain('Rose exclaimed');
      }
      if (m.rootId.startsWith('gutenberg-book-')) { expect(m.credit!.license).toMatch(/United States/); expect(m.credit!.license).toContain('other regions unverified'); expect(m.credit!.license).toMatch(/recording:? CC BY 4\.0/); expect(m.credit).toEqual(sources[kind].find(source => source.rootId === m.rootId)!.credit); }
      for (const locale of ['en', 'zh-Hans', 'zh-Hant'] as const) {
        expect(q.explanations[1 - q.answer][locale].length).toBeGreaterThan(40); expect(lesson.teaching![locale].length).toBeGreaterThan(90);
        expect(lesson.workedExample![locale]).not.toMatch(/Felicia|lonesome|recording|apartment|violinist/);
      }
    }
    const bare = structuredClone(lesson.materials); bare.forEach(m => m.questions.forEach(q => delete q.hints));
    expect(asTestLesson(lesson).materials).toEqual(bare); expect(asTestLesson(lesson).teaching).toBeUndefined();
    expect(lesson).toEqual(JSON.parse(JSON.stringify(lesson)));
  }), { numRuns: 200 });
  for (const source of sources[kind]) {
    expect(personalListeningLesson([source], new Set(), 0, kind)).toBeUndefined();
    expect(personalListeningLesson(sources[kind], new Set([source.audio.sha256]), 0, kind)).toBeUndefined();
    expect(() => personalListeningLesson([source, source], new Set(), 0, kind)).toThrow('DUPLICATE_PERSONAL_LISTENING_SOURCE');
  }
  expect(personalListeningLesson([], new Set(), 0, kind)).toBeUndefined();
});

it('rejects altered scope/voice/rights/timing and cross-family material rather than admitting a lexical match', () => {
  for (const kind of ['need', 'preference'] as const) {
    const original = sources[kind][0];
    for (const mutate of [
      (s: typeof original) => { s.text += ' I changed my mind.'; },
      (s: typeof original) => { s.segments[0].audioStart += .1; },
      (s: typeof original) => { s.audio.sha256 = 'f'.repeat(64); },
      (s: typeof original) => { s.audio.author = 'Unknown'; },
      (s: typeof original) => { s.credit.license = 'Unrestricted worldwide'; },
      (s: typeof original) => { s.sourceHash = 'a'.repeat(64); },
    ]) { const source = structuredClone(original); mutate(source); expect(() => personalListeningLesson([source, sources[kind][1]], new Set(), 0, kind)).toThrow(); }
  }
  expect(() => personalListeningLesson(sources.preference, new Set(), 0, 'need')).toThrow();
  for (const seed of [-1, 1.5, 0x100000000]) expect(() => personalListeningLesson(sources.need, new Set(), seed, 'need')).toThrow();
});

it('keeps the new built-in LibriSpeech exception limited to the exact four admitted source views', () => {
  const lesson = personalListeningLesson(sources.preference, new Set(), 0, 'preference')!;
  for (const field of ['src', 'sha256', 'author', 'license', 'sourceUrl'] as const) {
    const bad = structuredClone(lesson); bad.materials[0].audio![field] = field === 'sha256' ? 'f'.repeat(64) : 'https://example.com/forged'; expect(lessonSchema.safeParse(bad).success).toBe(false);
  }
  const wrongText = structuredClone(lesson); wrongText.materials[0].blocks[0].text += '\nExtra unreviewed context.'; expect(lessonSchema.safeParse(wrongText).success).toBe(false);
  const wrongRights = structuredClone(lesson); wrongRights.materials[0].credit!.license = 'Worldwide waiver'; expect(lessonSchema.safeParse(wrongRights).success).toBe(false);
  for (const mutate of [
    (value: typeof lesson) => { value.materials[0].rootId = 'synthetic-forged-root'; },
    (value: typeof lesson) => { value.materials[0].audio!.duration += .1; },
    (value: typeof lesson) => { value.materials[0].audio!.synthetic = true; },
    (value: typeof lesson) => { value.materials[0].credit!.attribution += ' Forged.'; },
    (value: typeof lesson) => { value.materials[0].credit!.sourceUrl = 'https://example.com/forged'; },
  ]) {
    const altered = structuredClone(lesson); mutate(altered);
    expect(lessonSchema.safeParse(altered).error?.issues.some(issue => issue.message === 'Known short recording metadata must match its inspected source')).toBe(true);
  }
});
