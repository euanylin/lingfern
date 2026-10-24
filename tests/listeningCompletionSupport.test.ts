import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { unzipSync } from 'fflate';
import { expect, it } from 'vitest';
import sourceBanks from './fixtures/listening-support-source-packs.json';
import historicalMaterials from './fixtures/listening-completion-historical-materials.json';
import { corpusStartingPoint, corpusWorkedExample } from '../src/core/corpus';
import { spokenCorpusLesson, spokenCorpusSchema } from '../src/core/spokenCorpus';
import { asTestLesson, score, type Lesson } from '../src/shared/content';

const sha = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const sentence = 'Nora puts the blue cup on the shelf.', gap = 'Nora puts the ________ cup on the shelf.';
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
const generate = (point: 'A2' | 'B2', seed = 9) => spokenCorpusLesson(banks[0], new Set(), seed, 91, point, [], 'completion', undefined, banks.slice(1))!;
const assertDemo = (lesson: Lesson) => {
  for (const locale of ['en', 'zh-Hans', 'zh-Hant'] as const) {
    const example = lesson.workedExample![locale];
    expect(example).toContain(sentence); expect(example).toContain(gap); expect(example).toContain('blue');
    expect(example.indexOf(sentence)).toBeLessThan(example.indexOf(gap));
    expect(example.lastIndexOf('blue')).toBeGreaterThan(example.indexOf(gap));
    expect(example).not.toContain('…');
    for (const material of lesson.materials) {
      const q = material.questions[0];
      if (!('kind' in q) || q.kind !== 'completion') throw Error('Expected completion');
      expect(example).not.toContain(q.answer);
      expect(material.blocks.some(block => block.text.includes(sentence))).toBe(false);
    }
  }
  expect(lesson.workedExample!.en).toContain('Example:'); expect(lesson.workedExample!.en).not.toMatch(/made-up|unscored|illustrative|虚构|虛構|不评分|不評分/i);
};

it('fills the real seed9 advanced listening gap without changing assessed material, scoring or Test', () => {
  const lesson = generate('B2');
  expect(lesson.materials[0].id).toBe('corpus-a207303e8239bd8efd5ba2675423ce8a99591edbd0987cb6f29246a5644b8891');
  expect(corpusWorkedExample(lesson.materials[0], 9, 'B2', true)).toBeUndefined();
  expect(sha(JSON.stringify(historicalMaterials))).toBe('bddf6c56f9b4724c5529cfc43b8ed176a643684fca7259e7eeff28e4bbacff1b');
  const expected = structuredClone(historicalMaterials);
  expected[0].questions[0].prompt = "Listen and complete the sentence:\nIn the old house were\r\nthe two first volumes of Cooper's novel, called _The Prairie_, a\r\nrelic--probably a dishonest relic--of some subscription to Hookham's\r\n________.";
  expected[1].questions[0].prompt = 'Listen and complete the sentence:\nA dozen soldiers turned their\r\nfaces quickly toward him and ________ with vague displeasure.';
  expect(lesson.materials).toEqual(expected); // Change prompt context only; preserve exact source, audio, and scoring fields.
  expect(sha(JSON.stringify(lesson.materials))).toBe('fee75357b8fe97d0c238831122adf217b2d4250e92349c75b32ae4a5bca4c375');
  assertDemo(lesson);
  expect(lesson.workedExample!['zh-Hans']).toBe(lesson.workedExample!.en);
  expect(lesson.workedExample!['zh-Hant']).toBe(lesson.workedExample!.en);
  expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
  for (const material of lesson.materials) {
    const q = material.questions[0];
    if (!('kind' in q) || q.kind !== 'completion') throw Error('Expected completion');
    expect(score(q, q.answer).correct).toBe(true); expect(score(q, 'wrong-answer').correct).toBe(false);
  }
  const tested = asTestLesson(lesson);
  expect(tested.workedExample).toBeUndefined(); expect(tested.teaching).toBeUndefined();
  for (const [index, material] of tested.materials.entries())
    expect(material.questions[0]).toEqual({ ...lesson.materials[index].questions[0], hints: undefined });
});

it('keeps existing source examples before fallback completion demonstrations', () => {
  for (const [point, seed] of [['A2', 9], ['B2', 0]] as const) {
    const lesson = generate(point, seed), source = corpusWorkedExample(lesson.materials[0], seed, point, true);
    expect(source).toBeDefined(); expect(lesson.workedExample).toEqual(source);
    expect(lesson.workedExample!.en).not.toMatch(/made-up|unscored|虚构|虛構|不评分|不評分/i);
  }
});

it('provides three-language beginner support at the controlled no-unused-source boundary', () => {
  for (const point of ['A1', 'A2'] as const) {
    // Test controlled evidence coverage without claiming installed beginner coverage.
    const input = structuredClone(generate('A2')), material = input.materials[0], question = material.questions[0];
    if (!('kind' in question) || question.kind !== 'completion') throw Error('Expected completion');
    question.evidence = { ...question.evidence, start: 0, end: material.blocks[0].text.length };
    expect(corpusWorkedExample(material, 9, point, true)).toBeUndefined();
    const snapshot = structuredClone(input), supported = corpusStartingPoint(input, point);
    expect(input).toEqual(snapshot); expect(supported.materials).toEqual(snapshot.materials);
    assertDemo(supported);
    expect(supported.workedExample!['zh-Hans']).toContain('示例：'); expect(supported.workedExample!['zh-Hans']).not.toMatch(/made-up|unscored|illustrative|虚构|虛構|不评分|不評分/i);
    expect(supported.workedExample!['zh-Hant']).toContain('示例：'); expect(supported.workedExample!['zh-Hant']).not.toMatch(/made-up|unscored|illustrative|虚构|虛構|不评分|不評分/i);
    expect(asTestLesson(supported).workedExample).toBeUndefined();
  }
});
