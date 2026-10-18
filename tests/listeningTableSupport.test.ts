import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { unzipSync } from 'fflate';
import { expect, it } from 'vitest';
import sourceBanks from './fixtures/listening-support-source-packs.json';
import { corpusWorkedExample } from '../src/core/corpus';
import { spokenCorpusLesson, spokenCorpusSchema } from '../src/core/spokenCorpus';
import { asTestLesson, lessonSchema, score, type Lesson } from '../src/shared/content';

const sha = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const bankFrom = (path: string, expected: string) => {
  const bytes = readFileSync(path); expect(sha(bytes)).toBe(expected);
  const raw = JSON.parse(new TextDecoder().decode(unzipSync(bytes)['spoken.json']));
  raw.communityPackageId = expected;
  for (const source of raw.records) for (const clip of source.clips)
    clip.audio.src = `/audio/community-${expected}/${clip.audio.src.split('/').at(-1)}`;
  return spokenCorpusSchema.parse(raw);
};
const banks = sourceBanks.map(entry => bankFrom(entry.path, entry.hash));
const tables = (lesson: Lesson) => lesson.materials.map(material => {
  const question = material.questions[0];
  if (!('kind' in question) || question.kind !== 'table') throw Error('Expected table');
  return question;
});

it('demonstrates numeric table entries while retaining approximate and boundary wording', () => {
  for (const point of ['B1', 'B2', 'C1', 'C2'] as const) {
    const lesson = spokenCorpusLesson(banks[1], new Set(), 0, 91, point, [], 'table', [], undefined, [banks[0], banks[2]])!;
    lessonSchema.parse(lesson);
    expect(corpusWorkedExample(lesson.materials[0], 0, point, true)).toBeUndefined();
    const example = lesson.workedExample!.en;
    expect(example).toContain('Example:'); expect(example).not.toMatch(/made-up|unscored|illustrative|虚构|虛構|不评分|不評分/i);
    expect(example).toContain('The museum opened before 2005. The tram service began around 2010.');
    expect(example).toContain('“The museum opened before ________.”: 2005');
    expect(example).toContain('“The tram service began around ________.”: 2010');
    expect(example).toContain('Enter only the digits.');
    expect(example).toContain('do not give exact event years');
    expect(example).toContain('dates do not establish a cause');
    expect(lesson.workedExample!['zh-Hans']).toBe(example); expect(lesson.workedExample!['zh-Hant']).toBe(example);
    for (const q of tables(lesson)) {
      expect(score(q, q.rows.map(row => row.answer)).correct).toBe(true);
      expect(score(q, q.rows.map(() => '9999')).correct).toBe(false);
      for (const row of q.rows) expect(example).not.toContain(row.answer);
    }
    const tested = asTestLesson(lesson);
    expect(tested.workedExample).toBeUndefined(); expect(tested.teaching).toBeUndefined();
    for (const [index, q] of tables(tested).entries()) expect(q).toEqual({ ...tables(lesson)[index], hints: undefined });
    if (point === 'B2') expect(sha(JSON.stringify(lesson.materials))).toBe('0a9a7955978588cb4f0380116872298f7dd20a6e7c2ffe20d31313023b003b05');
  }
});

it('reaches a real unused source year through the exact listening caller and preserves reading identification', () => {
  const bank = bankFrom('tests/fixtures/source-packs/listening-campus-25fa26bc4217.zip', '25bac3047538ee3a6e86d51d8a442b17617a316e778a3115feb792a5b92f78f4');
  const clipIds = ['83c9f62e09ee0123909c3b1aee1a6afac51cde6acdf8ae901740f6e45f48a16f', '7fe7d54f2d224e5b00126026686fe6015017984dfa90985fcf25e53c3f17e199'];
  const selected = { ...bank, records: bank.records.map(source => ({ ...source, clips: source.clips.filter(clip => clipIds.includes(clip.id)) })).filter(source => source.clips.length) };
  const lesson = spokenCorpusLesson(selected, new Set(), 0, 91, 'B2', [], 'table')!;
  const material = lesson.materials[0], source = corpusWorkedExample(material, 0, 'B2', true)!;
  expect(material.title).toBe('University of Rhode Island');
  expect(source).toBeDefined(); expect(lesson.workedExample).toEqual(source);
  expect(source.en).toContain('The speaker says'); expect(source.en).not.toContain('The passage says');
  expect(source.en).toContain('“1981”'); expect(source.en).not.toMatch(/made-up|unscored|虚构|虛構|不评分|不評分/i);
  const exactSentence = 'The Board of Governors for Higher Education appointed by the governor became the governing body of the University in 1981.';
  expect(source.en).toContain(exactSentence);
  const start = material.blocks[0].text.indexOf(exactSentence), end = start + exactSentence.length;
  expect(start).toBeGreaterThanOrEqual(0);
  for (const q of tables(lesson)) for (const row of q.rows) expect(source.en).not.toContain(row.answer);
  for (const span of [tables(lesson)[0].evidence, ...tables(lesson)[0].additionalEvidence!])
    expect(start < span.end && end > span.start).toBe(false);
  expect(new Set(lesson.materials.map(part => part.rootId)).size).toBe(2);
  expect(corpusWorkedExample(material, 0, 'B2', false)).toBeUndefined();
  const reading = structuredClone(material); reading.questions[0].prompt = 'Read and complete the year given for each event.';
  expect(corpusWorkedExample(reading, 0, 'B2')!.en).toContain('The passage says');
  const unknown = structuredClone(material); unknown.questions[0].prompt += ' Extra unsupported instruction.';
  expect(corpusWorkedExample(unknown, 0, 'B2', true)).toBeUndefined();
});
