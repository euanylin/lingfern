import { expect, it } from 'vitest';
import fc from 'fast-check';
import { travelVariant, VARIANT_ATTEMPTS, VARIANT_COUNT } from './fixtures/variants';
import { lessonSchema, questions, score } from '../src/shared/content';

it('produces bounded, reproducible, evidence-supported finite variants (500 seeds)', () => {
  fc.assert(fc.property(fc.integer({ min: 0, max: 0xffffffff }), seed => {
    const result = travelVariant(seed);
    expect(result).toEqual(travelVariant(seed));
    expect(result.attempts).toBe(1);
    const lesson = result.lesson!;
    expect(lessonSchema.safeParse(lesson).success).toBe(true);
    expect(lesson.generation?.generator === 'travel-v1' ? lesson.generation.index : undefined).toBe(seed % VARIANT_COUNT);
    for (const { material, question } of questions(lesson)) {
      if (!('options' in question)) throw new Error('Expected choice');
      const notice = material.blocks[0].text;
      const clock = [...notice.matchAll(/(\d{2}):(\d{2})/g)].map(match => Number(match[1]) * 60 + Number(match[2]));
      expect(clock).toHaveLength(2);
      expect([5, 10, 15]).toContain(clock[1] - clock[0]);
      expect(clock[1]).toBeLessThan(24 * 60);
      const places = [...notice.matchAll(/(?:platform|bay) (\d)/g)].map(match => Number(match[1]));
      expect(places[0]).not.toBe(places[1]);
      expect(places.every(place => place >= 1 && place <= 4)).toBe(true);
      const evidence = notice.slice(question.evidence.start, question.evidence.end);
      expect(evidence).toContain(question.options[question.answer]);
      expect(new Set(question.options).size).toBe(question.options.length);
      expect(score(question, question.answer).correct).toBe(true);
      question.options.forEach((_, index) => expect(score(question, index).correct).toBe(index === question.answer));
      expect(material.rootId).not.toContain(String(seed));
    }
    expect(lessonSchema.safeParse({ ...lesson, reviewStatus: 'approved' }).success).toBe(false);
    expect(lessonSchema.safeParse({ ...lesson, mode: 'check' }).success).toBe(false);
  }), { numRuns: 500, seed: 20260928 });
});
it('never repeats excluded instances and stops after exactly 30 rejected candidates (500 seeds)', () => {
  fc.assert(fc.property(fc.integer({ min: 0, max: 0xfffffff0 }), fc.integer({ min: 0, max: 30 }), (seed, count) => {
    const excluded = new Set(Array.from({ length: count }, (_, n) => `travel-variant-v1-${(seed + n) % VARIANT_COUNT}`));
    const result = travelVariant(seed, excluded);
    expect(result.attempts).toBe(Math.min(count + 1, VARIANT_ATTEMPTS));
    if (count === 30) expect(result.lesson).toBeNull();
    else expect(excluded.has(result.lesson!.id)).toBe(false);
  }), { numRuns: 500, seed: 20260929 });
});
it('keeps only two root groups across every possible instance and rejects invalid seeds', () => {
  const roots = new Set<string>(); const ids = new Set<string>();
  for (let index = 0; index < VARIANT_COUNT; index++) {
    const lesson = travelVariant(index).lesson!;
    ids.add(lesson.id); lesson.materials.forEach(material => roots.add(material.rootId));
  }
  expect(ids.size).toBe(VARIANT_COUNT); expect(roots.size).toBe(2);
  for (const seed of [-1, NaN, Infinity, 1.5, 0x100000000]) expect(() => travelVariant(seed)).toThrow('INVALID_SEED');
});
