import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import fc from 'fast-check';
import { actionOrderListeningLesson } from '../src/core/a2Listening';
import { corpusOperation } from '../src/core/corpusPractice';
import { asTestLesson, lessonSchema, score } from '../src/shared/content';
import sources from '../public/audio/a2-speech/ORDER.json';

it('generates true temporal order, not textual order or unrealised intentions, with same-goal distinct work application', () => {
  fc.assert(fc.property(fc.integer({ min: 0, max: 0xffffffff }), seed => {
    const lesson = actionOrderListeningLesson(sources, new Set(), seed)!;
    expect(lesson.goalId).toBe('heard-explicit-action-order'); expect(new Set(lesson.materials.map(m => m.rootId)).size).toBe(2);
    for (const [i, m] of lesson.materials.entries()) {
      expect(createHash('sha256').update(readFileSync('public' + m.audio!.src)).digest('hex')).toBe(m.audio!.sha256);
      const q = m.questions[0]; if ('kind' in q) throw new Error('Expected choice');
      expect(corpusOperation(q)).toBe('choice:heard-action-order'); expect(q.hints?.length).toBe(i ? undefined : 3);
      expect(score(q, q.answer).correct).toBe(true); expect(score(q, 1 - q.answer).correct).toBe(false);
      expect(q.options[1 - q.answer].split(' → ')).toEqual(q.options[q.answer].split(' → ').reverse());
      for (const answer of [-1, 2, '1']) expect(() => score(q, answer)).toThrow();
      const exact = m.blocks[0].text.slice(q.evidence.start, q.evidence.end);
      expect(exact).toContain('before');
      if (m.rootId === 'gutenberg-book-46') { expect(exact).toContain('and did it:'); expect(q.explanations[q.answer].en).toContain('does not tell us whether'); expect(q.options[q.answer]).toBe('passed the door a dozen times → go up and knock'); }
      else { expect(exact).toContain('reached a little station'); expect(q.explanations[q.answer].en).toContain('about five'); expect(q.explanations[q.answer].en).toContain('not a completed train wait'); expect(q.options[q.answer]).toBe('walk some five miles → reach a little station'); }
      expect(q.evidence.audioEnd).toBeLessThanOrEqual(m.audio!.duration); expect(q.evidence.audioStart).toBeGreaterThanOrEqual(0);
      expect(m.credit!.license).toContain('other regions unverified');
      for (const locale of ['en', 'zh-Hans', 'zh-Hant'] as const) { expect(q.explanations[1 - q.answer][locale].length).toBeGreaterThan(50); expect(lesson.teaching![locale].length).toBeGreaterThan(120); expect(lesson.workedExample![locale]).toContain('Before she opened'); expect(lesson.workedExample![locale]).not.toMatch(/Scrooge|Philip|station|knock/); }
    }
    const bare = structuredClone(lesson.materials); bare.forEach(m => m.questions.forEach(q => delete q.hints));
    expect(asTestLesson(lesson).materials).toEqual(bare); expect(asTestLesson(lesson).teaching).toBeUndefined();
  }), { numRuns: 150 });
});

it('rejects unreviewed/ambiguous/missing evidence, source and timing mutations; exhausts without unrelated application', () => {
  expect(actionOrderListeningLesson([], new Set(), 0)).toBeUndefined();
  for (const s of sources) { expect(actionOrderListeningLesson([s], new Set(), 0)).toBeUndefined(); expect(actionOrderListeningLesson(sources, new Set([s.audio.sha256]), 0)).toBeUndefined(); }
  expect(() => actionOrderListeningLesson([sources[0], sources[0]], new Set(), 0)).toThrow(/DUPLICATE/);
  for (const seed of [-1, 0.5, NaN, 0x100000000]) expect(() => actionOrderListeningLesson(sources, new Set(), seed)).toThrow();
  for (const mutate of [
    (s: typeof sources[number]) => { s.text = s.text.replace('and did it:', 'and wanted to:'); },
    (s: typeof sources[number]) => { s.segments.pop(); },
    (s: typeof sources[number]) => { s.segments[0].audioEnd = 99; },
    (s: typeof sources[number]) => { s.credit.license = 'unrestricted everywhere'; },
    (s: typeof sources[number]) => { s.sourceHash = '0'.repeat(64); },
    (s: typeof sources[number]) => { s.audio.author = 'Other reader'; },
  ]) { const input = structuredClone(sources); mutate(input[0]); expect(() => actionOrderListeningLesson(input, new Set(), 0)).toThrow(); }
  const lesson = actionOrderListeningLesson(sources, new Set(), 0)!;
  for (const change of [(m: typeof lesson.materials[number]) => { m.audio!.sha256 = '0'.repeat(64); }, (m: typeof lesson.materials[number]) => { m.blocks[0].text += ' invented'; }, (m: typeof lesson.materials[number]) => { m.credit!.license = 'public domain everywhere'; }]) { const copy = structuredClone(lesson); change(copy.materials[0]); expect(lessonSchema.safeParse(copy).success).toBe(false); }
});
