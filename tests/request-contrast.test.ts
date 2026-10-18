import { readSourcePackFixture } from './fixtures/source-pack-regression';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { corpusLesson, corpusRequests, corpusSchema, corpusStartingPoint, corpusWorkedExample } from '../src/core/corpus';
import { corpusOperation } from '../src/core/corpusPractice';
import { reviewedReading } from '../src/data/corpus';
import { inspectCommunityPack } from '../src/data/communityPack';
import { asTestLesson, lessonSchema, score } from '../src/shared/content';

const sentence = 'Let the weight of the matter rest upon me now, and do not let your mind dwell upon it further.';
const operation = 'matching:Match each action to what the request asks for or rules out.';
const quoted = (request: string) => `“I shall help you,” said Morgan, “I will look at the matter. ${request} Keep the letter with you.”`;

async function actual() {
  const original = corpusSchema.parse(JSON.parse(readFileSync('content/corpus/gutenberg.json', 'utf8')));
  const source = (await reviewedReading(original.records)).find(record => record.rootId === 'gutenberg-book-1661')!;
  const passage = source.passages.find(passage => passage.id === 'f97f124624734f375ade627232284b53174e426abef688654b018d76252c7e83')!;
  expect(source.sourceHash).toBe('922e2a12ccb43a4c9544c260b2166c6ad2097aeb5957faeee113f173bb857cd0');
  expect(passage.wordCount).toBe(229);
  const pack = await inspectCommunityPack(readSourcePackFixture('wikipedia-reading-017'));
  const lego = (await reviewedReading(pack.corpus!.records)).find(record => record.rootId === 'wikipedia-article-18362')!;
  return corpusSchema.parse({ version: 1, failures: [], records: [
    { ...source, passages: [passage] },
    { ...lego, passages: lego.passages.filter(passage => passage.id === 'dd6eee7077c0d048b0ddad4f5b25b08b98bb4517578e4d2ffb69bc519f029995') },
  ] });
}

it('retains the actual complete spoken request, explicit speaker and exact positive and negative actions', async () => {
  const source = (await actual()).records[0], text = source.passages[0].text;
  expect(createHash('sha256').update(text).digest('hex')).toBe(source.passages[0].id);
  for (let seed = 0; seed < 7; seed++) {
    const task = corpusRequests(text, seed)!;
    expect(task.pairs.find(pair => pair.answer === 'Requested')?.label).toBe('Let the weight of the matter rest upon me now');
    expect(task.pairs.find(pair => pair.answer === 'Ruled out')?.label).toBe('let your mind dwell upon it further');
    expect(text.slice(task.evidence.start, task.evidence.end)).toBe(task.sentence);
    expect(task.sentence).toContain('said Holmes, rising');
    expect(task.sentence).toContain(sentence);
    expect(task.sentence.startsWith('“')).toBe(true); expect(task.sentence.endsWith('”')).toBe(true);
  }
});

it('provides the same request operation across real book and Lego roots with scoring, unscored context and Test safeguards', async () => {
  const corpus = await actual();
  for (let seed = 0; seed < 7; seed++) {
    const lesson = corpusLesson(corpus, new Set(), seed, 1200, 'C2', [], 'matching', [], operation)!;
    lessonSchema.parse(lesson);
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    expect(lesson.materials.map(material => corpusOperation(material.questions[0]))).toEqual([operation, operation]);
    for (const material of lesson.materials) {
      const question = material.questions[0], response = material.questions[1];
      if (!('kind' in question) || question.kind !== 'matching' || !('kind' in response) || response.kind !== 'response') throw Error('Expected request matching and open interpretation');
      expect(score(question, question.pairs.map(pair => pair.answer)).correct).toBe(true);
      expect(score(question, question.pairs.map(pair => pair.answer === 'Requested' ? 'Ruled out' : 'Requested')).correct).toBe(false);
      expect(response.evidence).toEqual(question.evidence); expect(response.prompt).toContain('figurative');
      expect(score(response, 'I preserve the source request and interpret it in context.').correct).toBeNull();
    }
    const tested = asTestLesson(lesson);
    expect(tested.mode).toBe('test'); expect(tested.id).toBe(lesson.id);
    expect(tested.teaching).toBeUndefined(); expect(tested.workedExample).toBeUndefined();
    expect(tested.materials.flatMap(material => material.questions).every(question => question.hints === undefined)).toBe(true);
    expect(tested.materials.map(material => material.questions[0].evidence)).toEqual(lesson.materials.map(material => material.questions[0].evidence));
  }
  expect(corpusLesson(corpus, new Set(corpus.records.flatMap(source => source.passages.map(passage => passage.id))), 0, 1200, 'C2', [], 'matching', [], operation)).toBeUndefined();
  expect(corpusLesson({ ...corpus, records: corpus.records.slice(0, 1) }, new Set(), 0, 1200, 'C2', [], 'matching', [], operation)).toBeUndefined();
});

it('rejects detached, reported, malformed, conditional, double-negative and incomplete imperative contrasts', () => {
  expect(corpusRequests(quoted(sentence), 0)).toBeDefined();
  for (const request of [
    sentence.replace('Let the weight of the matter rest upon me now', 'Let the rest of the matter now'),
    sentence.replace('let your mind dwell upon it further', 'let your mind'),
    sentence.replace('let your mind dwell upon it further', 'let your mind not dwell upon it further'),
    sentence.replace('let your mind dwell upon it further', 'let your mind dwell upon it further or rest'),
    sentence.replace('Let the weight', 'If you let the weight'),
    sentence.replace('Let the weight', 'Let only the weight'),
    sentence.replace('and do not', 'and do not not'),
    sentence.replace('and do not', 'and do not only'),
    sentence.replace('and do not', 'and'),
    sentence.replace('and do not', 'unless you'),
    sentence.replace('Let the weight', 'She said to let the weight'),
    sentence.replace('rest upon me', 'might rest upon me'),
    'Let your mind dwell upon it further, and do not let your mind dwell upon it further.',
  ]) expect(corpusRequests(quoted(request), 0), request).toBeUndefined();
  for (const text of [sentence, quoted(sentence).replace('said Morgan', 'said she'), quoted(sentence).slice(0, -1), quoted(sentence) + '\n\n' + quoted(sentence)]) expect(corpusRequests(text, 0), text).toBeUndefined();
});


it('demonstrates requested and ruled-out actions without replacing unused-source examples or scored evidence', async () => {
  const corpus = await actual();
  let fallbacks = 0;
  for (const level of ['B1', 'B2', 'C1', 'C2'] as const) for (let seed = 0; seed < 12; seed++) {
    const lesson = corpusLesson(corpus, new Set(), seed, 1200, level, [], 'matching', [], operation)!;
    expect(lesson).toBeDefined();
    const unused = corpusWorkedExample(lesson.materials[0], seed, level);
    if (unused) expect(lesson.workedExample).toEqual(unused);
    else {
      fallbacks++;
      expect(lesson.workedExample!.en).toContain('Example:'); expect(lesson.workedExample!.en).not.toMatch(/made-up|unscored|illustrative|虚构|虛構|不评分|不評分/i);
      expect(lesson.workedExample!.en).toContain('Requested: check the front door before leaving');
      expect(lesson.workedExample!.en).toContain('Ruled out: open the side gate');
      expect(lesson.workedExample!.en).toContain('A request does not show completion');
    }
    for (const material of lesson.materials) {
      const question = material.questions[0]; if (!('kind' in question) || question.kind !== 'matching') throw Error('Expected request matching');
      expect(corpusOperation(question)).toBe(operation);
      for (const pair of question.pairs) expect(lesson.workedExample!.en).not.toContain(pair.label);
      expect(score(question, question.pairs.map(pair => pair.answer)).correct).toBe(true);
      expect(score(question, question.pairs.map(pair => pair.answer === 'Requested' ? 'Ruled out' : 'Requested')).correct).toBe(false);
      expect(score(material.questions[1], 'I retain the request and its limits.').correct).toBeNull();
    }
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    const original = structuredClone(lesson); expect(corpusStartingPoint(lesson, level).materials).toEqual(original.materials); expect(lesson).toEqual(original);
    expect(lesson.workedExample!['zh-Hans']).toBe(lesson.workedExample!.en); expect(lesson.workedExample!['zh-Hant']).toBe(lesson.workedExample!.en);
    const test = asTestLesson(lesson); expect(test.workedExample).toBeUndefined(); expect(test.teaching).toBeUndefined(); expect(test.nextStep).toBeUndefined();
  }
  expect(fallbacks).toBeGreaterThan(0);
  // Isolated regression wording, never distributed source text or a scored item.
  const fixture = corpusLesson(corpus, new Set(), 0, 1200, 'B2', [], 'matching', [], operation)!;
  const other = 'Please refer to the group as "garden club" and not "tree club".';
  fixture.materials[0].blocks[0].text += '\n\n' + other;
  const unused = corpusWorkedExample(fixture.materials[0], 0, 'B2');
  expect(unused).toBeDefined(); expect(unused!.en).toContain(other);
  expect(corpusStartingPoint(fixture, 'B2').workedExample).toEqual(unused);
});
