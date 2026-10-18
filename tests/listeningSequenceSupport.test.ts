import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { unzipSync } from 'fflate';
import { expect, it } from 'vitest';
import sourceBanks from './fixtures/listening-support-source-packs.json';
import { corpusStartingPoint, corpusWorkedExample } from '../src/core/corpus';
import { spokenCorpusLesson, spokenCorpusSchema } from '../src/core/spokenCorpus';
import { asTestLesson, lessonSchema, score } from '../src/shared/content';

const sha = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const demo = ['Mina opens a window.', 'She looks at the garden.', 'She closes the window.'];
const banks = sourceBanks.map(entry => {
  const bytes = readFileSync(entry.path), hash = sha(bytes);
  expect(hash).toBe(entry.hash);
  const member = unzipSync(bytes)['spoken.json']; expect(sha(member)).toBe(entry.spokenSha256);
  const value = JSON.parse(new TextDecoder().decode(member));
  value.communityPackageId = hash;
  for (const source of value.records) for (const clip of source.clips)
    clip.audio.src = `/audio/community-${hash}/${clip.audio.src.split('/').at(-1)}`;
  return spokenCorpusSchema.parse(value);
});
const generate = (point: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2', seed = 0) => {
  const lesson = spokenCorpusLesson(banks[0], new Set(), seed, 91, point, [], 'sequence', [], undefined, banks.slice(1))!;
  lessonSchema.parse(lesson);
  return lesson;
};

it('supplies complete unscored listening-order demonstrations only when unused source examples are absent', () => {
  let beginnerFallbacks = 0, advancedFallbacks = 0;
  for (const point of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const) {
    const lesson = generate(point), unused = corpusWorkedExample(lesson.materials[0], 0, point, true);
    if (unused) expect(lesson.workedExample).toEqual(unused);
    else {
      if (point === 'A1' || point === 'A2') beginnerFallbacks++;
      else advancedFallbacks++;
      for (const locale of ['en', 'zh-Hans', 'zh-Hant'] as const) {
        const example = lesson.workedExample![locale];
        for (const sentence of demo) { expect(example).toContain(sentence); expect(example.split(sentence)).toHaveLength(2); }
        const order = example;
        expect(order.indexOf(demo[0])).toBeLessThan(order.indexOf(demo[1]));
        expect(order.indexOf(demo[1])).toBeLessThan(order.indexOf(demo[2]));
        for (const material of lesson.materials) {
          expect(material.blocks.some(block => block.text.includes(demo.join(' ')))).toBe(false);
          const question = material.questions[0];
          if (!('kind' in question) || question.kind !== 'sequence') throw Error('Expected same operation');
          for (const step of question.steps) expect(example).not.toContain(step);
        }
      }
      expect(lesson.workedExample!.en).toContain('Example:'); expect(lesson.workedExample!.en).not.toMatch(/made-up|unscored|illustrative|虚构|虛構|不评分|不評分/i);
      if (point === 'A1' || point === 'A2') {
        expect(lesson.workedExample!['zh-Hans']).toContain('示例：'); expect(lesson.workedExample!['zh-Hans']).not.toMatch(/made-up|unscored|illustrative|虚构|虛構|不评分|不評分/i);
        expect(lesson.workedExample!['zh-Hant']).toContain('示例：'); expect(lesson.workedExample!['zh-Hant']).not.toMatch(/made-up|unscored|illustrative|虚构|虛構|不评分|不評分/i);
      } else {
        expect(lesson.workedExample!['zh-Hans']).toBe(lesson.workedExample!.en);
        expect(lesson.workedExample!['zh-Hant']).toBe(lesson.workedExample!.en);
      }
    }
    const original = structuredClone(lesson), reapplied = corpusStartingPoint(lesson, point);
    expect(reapplied.materials).toEqual(lesson.materials); expect(lesson).toEqual(original);
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    for (const material of lesson.materials) {
      const q = material.questions[0];
      if (!('kind' in q) || q.kind !== 'sequence') throw Error('Expected sequence');
      expect(score(q, q.acceptedOrders[0]).correct).toBe(true);
      expect(score(q, q.steps).correct).toBe(false);
    }
    const tested = asTestLesson(lesson);
    expect(tested.workedExample).toBeUndefined(); expect(tested.teaching).toBeUndefined();
    for (const [index, material] of tested.materials.entries())
      expect(material.questions[0]).toEqual({ ...lesson.materials[index].questions[0], hints: undefined });
  }
  expect(beginnerFallbacks).toBeGreaterThan(0); expect(advancedFallbacks).toBeGreaterThan(0);
});

it('uses only complete unused example sentences without revealing assessed steps', () => {
  for (const point of ['A2', 'B2'] as const) {
    const material = generate(point).materials[0];
    // Isolated synthetic suffix exercises unused-example selection, never public curriculum.
    const withSuffix = (suffix: string) => ({ ...material, blocks: material.blocks.map(block => ({ ...block, text: block.text + '\n\n' + suffix })) });
    const unused = corpusWorkedExample(withSuffix(demo.join(' ')), 0, point, true);
    expect(unused).toBeDefined();
    for (const sentence of demo) expect(unused!.en).toContain(sentence);
    const question = material.questions[0];
    if (!('kind' in question) || question.kind !== 'sequence') throw Error('Expected sequence');
    for (const step of question.steps) expect(unused!.en).not.toContain(step);
    const fragments = 'Mina opens the window before\nlooking at the garden and then\ncloses the window again.';
    expect(corpusWorkedExample(withSuffix(fragments), 0, point, true)).toBeUndefined();
  }
});

it('retains hash-bound complete assessed source-order snapshots after fragment exclusion', () => {
  expect(sha(JSON.stringify(generate('A2').materials))).toBe('16991998d8dc0c5eeb6aa61011181ff9e8f2dfc01d60984738f39d7543f722c1');
  expect(sha(JSON.stringify(generate('B2').materials))).toBe('7507051eca4f6e010eae97499332109d732115b00e720c44aa6ab464809a33ff');
});
