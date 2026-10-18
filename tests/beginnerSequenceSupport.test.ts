import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { corpusLesson, corpusSchema, corpusStartingPoint, corpusWorkedExample } from '../src/core/corpus';
import { asTestLesson, lessonSchema, score } from '../src/shared/content';

const bank = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8')));
const demo = ['Mina opens a window.', 'She looks at the garden.', 'She closes the window.'];

it('keeps unused source demonstrations and supplies a complete unscored fallback for beginner reading order', () => {
  let sourceExamples = 0, fallbacks = 0;
  for (const level of ['A1', 'A2'] as const) for (let seed = 0; seed < 52; seed++) {
    const lesson = lessonSchema.parse(corpusLesson(bank, new Set(), seed, 160, level, [], 'sequence'));
    const material = lesson.materials[0], question = material.questions[0];
    if (!('kind' in question) || question.kind !== 'sequence') throw new Error('Expected sequence');
    const unused = corpusWorkedExample(material, seed, level);
    if (unused) {
      sourceExamples++; expect(lesson.workedExample).toEqual(unused);
      const sentences = [...unused.en.matchAll(/“([^”]+)”/g)].map(match => match[1]);
      expect(sentences).toHaveLength(3);
      for (const sentence of sentences) expect(sentence).toMatch(/[.!?]["'”’)]*$/);
    }
    else {
      fallbacks++;
      for (const locale of ['en', 'zh-Hans', 'zh-Hant'] as const) {
        const order = lesson.workedExample![locale];
        for (const sentence of demo) { expect(order).toContain(sentence); expect(order.split(sentence)).toHaveLength(2); }
        expect(order.indexOf(demo[0])).toBeLessThan(order.indexOf(demo[1]));
        expect(order.indexOf(demo[1])).toBeLessThan(order.indexOf(demo[2]));
        for (const step of question.steps) expect(lesson.workedExample![locale]).not.toContain(step);
      }
      expect(lesson.workedExample!.en).toContain('Example:'); expect(lesson.workedExample!.en).not.toMatch(/made-up|unscored|illustrative|虚构|虛構|不评分|不評分/i);
      expect(lesson.workedExample!['zh-Hans']).toContain('示例：'); expect(lesson.workedExample!['zh-Hans']).not.toMatch(/made-up|unscored|illustrative|虚构|虛構|不评分|不評分/i);
      expect(lesson.workedExample!['zh-Hant']).toContain('示例：'); expect(lesson.workedExample!['zh-Hant']).not.toMatch(/made-up|unscored|illustrative|虚构|虛構|不评分|不評分/i);
    }
    expect(lesson.teaching!.en).toContain('text order');
    expect(lesson.teaching!['zh-Hans']).toContain('按文中的顺序排列');
    expect(lesson.teaching!['zh-Hant']).toContain('按文中的順序排列');
    const before = structuredClone(lesson), reapplied = corpusStartingPoint(lesson, level);
    expect(reapplied.materials).toEqual(lesson.materials);
    expect(lesson).toEqual(before);
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    for (const material of lesson.materials) {
      const q = material.questions[0];
      if (!('kind' in q) || q.kind !== 'sequence') throw new Error('Expected same-operation application');
      expect(score(q, q.acceptedOrders[0]).correct).toBe(true);
      expect(score(q, q.acceptedOrders[0].toReversed()).correct).toBe(false);
      const text = material.blocks[0].text;
      const evidence = text.slice(q.evidence.start, q.evidence.end);
      let cursor = 0;
      for (const step of q.acceptedOrders[0]) { const start = evidence.indexOf(step, cursor); expect(start).toBeGreaterThanOrEqual(cursor); cursor = start + step.length; }
    }
    const test = asTestLesson(lesson);
    expect(test.workedExample).toBeUndefined(); expect(test.teaching).toBeUndefined();
    for (const [index, material] of test.materials.entries()) expect(material.questions[0]).toEqual({ ...lesson.materials[index].questions[0], hints: undefined });
  }
  expect(sourceExamples).toBeGreaterThan(0); expect(fallbacks).toBe(30);
});
