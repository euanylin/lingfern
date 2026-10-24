import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { beforeEach, expect, it } from 'vitest';
import { corpusLesson, corpusSchema, selectCorpusPassage } from '../src/core/corpus';
import { corpusOperation } from '../src/core/corpusPractice';
import { asTestLesson, lessonSchema, score } from '../src/shared/content';
import { advance, attempts, claimSession, createSession, db, sessions, submit } from '../src/data/db';
import { exportBackup, importBackup, inspectBackup } from '../src/data/backup';

const bank = () => corpusSchema.parse(JSON.parse(readFileSync('content/corpus/gutenberg.json', 'utf8')));
const roots = ['gutenberg-book-1661', 'gutenberg-book-35'];
const sources = () => bank().records.filter(record => roots.includes(record.rootId));
const sha = (text: string) => createHash('sha256').update(text).digest('hex');
beforeEach(async () => { await Promise.all(db.tables.map(table => table.clear())); });

it('uses exactly two prepared continuous long texts and preserves source identity and short supply', () => {
  const records = sources();
  expect(records).toHaveLength(2);
  for (const source of records) {
    const long = source.passages.filter(passage => passage.wordCount > 700);
    expect(long).toHaveLength(1);
    expect(long[0].wordCount).toBe(source.rootId === roots[0] ? 986 : 1051);
    expect(long[0].id).toBe(sha(long[0].text));
    expect(source.originalText).toBeUndefined();
    expect(source.licence).toContain('other jurisdictions require verification');
    expect(source.reviewStatus).toBe('draft');
    const contained = source.passages.filter(passage => passage.wordCount <= 700 && long[0].text.includes(passage.text));
    expect(contained).toHaveLength(4);
    expect(contained.reduce((words, passage) => words + passage.wordCount, 0)).toBe(long[0].wordCount);
  }
});

it('keeps word bounds and blocks known long/short containment without changing ordinary short exposure', () => {
  for (const source of sources()) {
    const long = source.passages.find(passage => passage.wordCount > 700)!;
    const short = source.passages.filter(passage => passage.wordCount <= 700 && long.text.includes(passage.text));
    const scoped = { version: 1 as const, failures: [], records: [{ ...source, passages: [long, ...short] }] };
    for (const limit of [120, 300, 700]) expect(selectCorpusPassage(scoped, new Set(), 0, limit)?.passage.wordCount ?? 0).toBeLessThanOrEqual(limit);
    expect(selectCorpusPassage(scoped, new Set([long.id]), 0, 1200)).toBeUndefined();
    for (const passage of short) {
      const next = selectCorpusPassage(scoped, new Set([passage.id]), 0, 1200, [], 'C2');
      expect(next?.passage.id).not.toBe(long.id);
      expect(next).toBeDefined();
    }
    const untouched = selectCorpusPassage({ ...scoped, records: [{ ...source, passages: short }] }, new Set([short[0].id]), 0, 700);
    expect(untouched).toBeDefined();
    expect(untouched?.passage.id).not.toBe(short[0].id);
  }
});

it('generates same-operation long practice/test across actual different books with exact evidence and scoring', () => {
  const records = sources().map(source => ({ ...source, passages: source.passages.filter(passage => passage.wordCount > 700) }));
  for (const level of ['C1', 'C2'] as const) for (let seed = 0; seed < 7; seed++) {
    const lesson = corpusLesson({ version: 1, failures: [], records }, new Set(), seed, 1200, level, [], 'completion')!;
    lessonSchema.parse(lesson);
    expect(new Set(lesson.materials.map(material => material.rootId)).size).toBe(2);
    for (const material of lesson.materials) {
      const source = records.find(source => source.rootId === material.rootId)!;
      expect(material.blocks[0].text).toBe(source.passages[0].text);
      expect(corpusOperation(material.questions[0])).toBe('completion');
      const question = material.questions[0];
      if (!('kind' in question) || question.kind !== 'completion') throw new Error('Expected word restoration');
      expect(score(question, question.answer).correct).toBe(true);
      expect(score(question, 'incorrect-response').correct).toBe(false);
      expect(material.blocks[0].text.slice(question.evidence.start, question.evidence.end)).toContain(question.answer);
      expect(score(material.questions[1], 'The quotation supports this interpretation.').correct).toBeNull();
    }
    const tested = asTestLesson(lesson);
    expect(tested.materials.map(material => material.blocks)).toEqual(lesson.materials.map(material => material.blocks));
    expect(tested.materials.every(material => material.questions.every(question => !question.hints))).toBe(true);
    expect(tested.teaching).toBeUndefined();
    expect(tested.workedExample).toBeUndefined();
  }
});

it('saves all long responses transactionally and restores the unchanged snapshot from the current backup', async () => {
  const records = sources().map(source => ({ ...source, passages: source.passages.filter(passage => passage.wordCount > 700) }));
  const lesson = corpusLesson({ version: 1, failures: [], records }, new Set(), 0, 1200, 'C2', [], 'completion')!;
  const session = await createSession(lesson);
  await claimSession(session.id, 'long-source');
  const questions = lesson.materials.flatMap(material => material.questions);
  for (const [index, question] of questions.entries()) {
    if (index) await advance(session.id, 'long-source');
    const answer = 'kind' in question && question.kind === 'completion' ? question.answer : 'I retain the source wording and stated limits.';
    await submit(session.id, 'long-source', answer);
  }
  expect(await attempts.count()).toBe(4);
  expect((await sessions.get(session.id))?.status).toBe('completed');
  const inspection = await inspectBackup(await exportBackup('local-guest'));
  const profile = await importBackup(inspection);
  expect((await sessions.where('profileId').equals(profile).toArray())[0].lesson).toEqual(lesson);
  expect(await attempts.where('profileId').equals(profile).count()).toBe(4);
});
