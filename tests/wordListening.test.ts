import { expect, it } from 'vitest';
import fc from 'fast-check';
import sources from '../public/ipa/SOURCES.json';
import { wordListeningLesson } from '../src/core/wordListening';
import { score, practiceLocale } from '../src/shared/content';

it('generates bounded individual-word practice from actual attributed recordings without exposing answers or repeating sources', () => {
  fc.assert(fc.property(fc.integer({ min: 0, max: 0xffffffff }), seed => {
    const lesson = wordListeningLesson(sources, new Set(), seed)!;
    expect(lesson).toEqual(wordListeningLesson(sources, new Set(), seed));
    expect(practiceLocale(lesson, 'zh-Hant')).toBe('zh-Hant');
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    for (const material of lesson.materials) {
      const source = sources.find(source => source.sha256 === material.audio!.sha256)!;
      expect(material.audio!.src).toBe(source.path);
      expect(material.audio!.duration).toBe(source.duration);
      expect(material.audio!.synthetic).toBe(false);
      expect(material.title).not.toContain(source.word);
      const question = material.questions[0];
      expect(question.id.length).toBeLessThanOrEqual(80);
      expect(score(question, source.word).correct).toBe(true);
      expect(score(question, 'unheard').correct).toBe(false);
      expect(question.evidence.audioEnd).toBe(source.duration);
    }
    const seen = new Set(lesson.materials.map(material => material.audio!.sha256));
    expect(wordListeningLesson(sources, seen, seed)!.materials.every(material => !seen.has(material.audio!.sha256))).toBe(true);
  }));
  expect(wordListeningLesson(sources, new Set(sources.map(source => source.sha256)), 0)).toBeUndefined();
  expect(() => wordListeningLesson(sources, new Set(), -1)).toThrow();
  expect(() => wordListeningLesson([{ ...sources[0], path: '/ipa/audio/other.mp3' }], new Set(), 0)).toThrow();
});
