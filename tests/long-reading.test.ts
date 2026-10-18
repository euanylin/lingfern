import { readSourcePackFixture } from './fixtures/source-pack-regression';
import { createHash } from 'node:crypto';
import { beforeEach, expect, it, vi } from 'vitest';
import { corpusLesson, corpusSchema, validCorpusLanguage, type Corpus } from '../src/core/corpus';
import { lessonSchema, score } from '../src/shared/content';
import { reviewedReading, loadReadingCorpus } from '../src/data/corpus';
import { inspectCommunityPack } from '../src/data/communityPack';
import { attempts, claimSession, communityPacks, createSession, db, sessions, submit } from '../src/data/db';
import { exportBackup, importBackup, inspectBackup } from '../src/data/backup';
import rules from '../content/corpus/text-review-rules.json';

const digest = (text: string) => createHash('sha256').update(text).digest('hex');
const rootId = 'wikipedia-article-445112';
const ids = ['5c12790fa68f97d759bde154a11f4e85960cc2a54d7603c71f43b6115bff8408', '972c45ece79179ebda66f0212557c6ea8b300ca8279da8001a806ec116bafdfa'];
async function actual() {
  const pack = await inspectCommunityPack(readSourcePackFixture('wikipedia-reading-001'));
  const source = pack.corpus!.records.find(record => record.rootId === rootId)!;
  return { pack, source: { ...source, passages: source.passages.filter(passage => ids.includes(passage.id)) } };
}
const bank = (records: Corpus['records']): Corpus => ({ version: 1, failures: [], records });
const longOnly = (records: Corpus['records']) => records.flatMap(record => record.passages).filter(passage => passage.wordCount > 700);
beforeEach(async () => { vi.unstubAllGlobals(); await Promise.all(db.tables.map(table => table.clear())); });

it('appends a uniquely continuous reviewed original excerpt without rewriting old passages or NLP offsets', async () => {
  const { source } = await actual(), before = structuredClone(source);
  const short = await reviewedReading([source]);
  const advanced = await reviewedReading([source], 1200);
  expect(short[0].passages).toEqual(source.passages);
  expect(advanced[0].passages.filter(passage => ids.includes(passage.id))).toEqual(short[0].passages);
  const merged = longOnly(advanced).find(passage => passage.wordCount === 782)!;
  expect(merged).toBeDefined();
  const start = source.originalText!.indexOf(source.passages[0].text);
  const end = source.originalText!.indexOf(source.passages[1].text) + source.passages[1].text.length;
  expect(merged.text).toBe(source.originalText!.slice(start, end));
  expect(digest(merged.text)).toBe('7c81e7c82e2ff9be3bcf8cfa7ad685b0c474a8b9b22f8d9e15c2e91fabeea517');
  expect(merged.id).not.toBe(ids[0]); expect(merged.id).not.toBe(ids[1]);
  expect(validCorpusLanguage(merged.text, merged.language)).toBe(true);
  expect(merged.language).toBeDefined();
  const expected = source.passages.flatMap(passage => passage.language!.tokens.map(token => ({ ...token,
    start: token.start + source.originalText!.indexOf(passage.text) - start,
    end: token.end + source.originalText!.indexOf(passage.text) - start })));
  expect(merged.language!.tokens).toEqual(expected);
  expect(source).toEqual(before);
  expect(corpusSchema.parse(bank(advanced)).records[0].passages).toEqual(advanced[0].passages);
});

it('bounds opt-in length and fails closed on unreviewed, unmatched, altered or discontinuous sources', async () => {
  const { source } = await actual();
  expect(longOnly(await reviewedReading([source], 700))).toEqual([]);
  expect(longOnly(await reviewedReading([source], 780))).toEqual([]);
  for (const max of [0, 700.5, 1801, Infinity, NaN]) await expect(reviewedReading([source], max)).rejects.toThrow();
  for (const changed of [
    { ...source, rootId: 'wikipedia-article-999999999' },
    { ...source, sourceHash: '0'.repeat(64) },
    { ...source, originalText: source.originalText! + 'changed' },
    { ...source, originalText: undefined },
    { ...source, passages: [{ ...source.passages[0], text: 'unmatched original wording' }, source.passages[1]] },
    { ...source, passages: [{ ...source.passages[0], text: source.passages[0].text.slice(0, -30) }, source.passages[1]] },
    { ...source, passages: [{ ...source.passages[0], text: 'the' }, source.passages[1]] },
  ]) expect(longOnly(await reviewedReading([changed], 1800))).toEqual([]);
  const advanced = await reviewedReading([source], 1800);
  const merged = longOnly(advanced)[0];
  expect(corpusSchema.safeParse(bank([{ ...advanced[0], passages: [{ ...merged, wordCount: 1801 }] }])).success).toBe(false);
  expect(corpusSchema.safeParse({ ...bank(advanced), records: [{ ...advanced[0], passages: [{ ...merged, extra: true }] }] }).success).toBe(false);
});

it('never joins across excluded spans and keeps excluded restoration targets out of merged NLP', async () => {
  const { source } = await actual();
  const review = rules.records.find(record => record.rootId === rootId)!;
  const original = structuredClone(review);
  const start = source.originalText!.indexOf(source.passages[0].text);
  try {
    review.excludedSpans.push({ start, end: start + 20, sha256: digest(source.originalText!.slice(start, start + 20)) });
    expect(longOnly(await reviewedReading([source], 1800))).toEqual([]);
    review.excludedSpans = original.excludedSpans;
    const token = source.passages[1].language!.tokens[0];
    const target = source.passages[1].text.slice(token.start, token.end).toLowerCase();
    review.excludedTargets.push(target);
    const merged = longOnly(await reviewedReading([source], 1200))[0];
    expect(merged.language!.tokens.every(item => merged.text.slice(item.start, item.end).toLowerCase() !== target)).toBe(true);
    expect(validCorpusLanguage(merged.text, merged.language)).toBe(true);
  } finally { Object.assign(review, original); }
});

it('loads advanced text only on opt-in and saves exact long evidence through full backup and profile restore', async () => {
  const { pack } = await actual();
  vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
  await communityPacks.put({ ...pack, profileId: 'local-guest', state: 'ready', installedAt: '2026-10-08T00:00:00.000Z' });
  expect(longOnly((await loadReadingCorpus('local-guest')).records)).toEqual([]);
  const advanced = await loadReadingCorpus('local-guest', 1800);
  const record = advanced.records.find(source => source.rootId === rootId)!;
  const passages = longOnly([record]).filter(passage => passage.wordCount === 782);
  const lesson = corpusLesson(bank([{ ...record, passages }]), new Set(), 0, 1800, 'C2', [], 'completion', [], undefined, advanced)!;
  expect(lesson).toBeDefined(); lessonSchema.parse(lesson);
  const material = lesson.materials[0], question = material.questions[0];
  if (!('kind' in question) || question.kind !== 'completion') throw new Error('Expected long-text completion');
  expect(material.blocks.map(block => block.text).join('\n')).toBe(passages[0].text);
  expect(score(question, question.answer).correct).toBe(true);
  expect(score(question, 'incorrect response').correct).toBe(false);
  expect(material.blocks.find(block => block.id === question.blockId)!.text.slice(question.evidence.start, question.evidence.end)).toContain(question.answer);
  const session = await createSession(lesson); await claimSession(session.id, 'long-text');
  await submit(session.id, 'long-text', question.answer);
  const inspection = await inspectBackup(await exportBackup('local-guest'));
  const restoredProfile = await importBackup(inspection);
  const restored = (await sessions.where('profileId').equals(restoredProfile).toArray())[0];
  expect(restored.lesson).toEqual(lesson);
  expect(await attempts.where('profileId').equals(restoredProfile).count()).toBe(1);
  expect((await inspectBackup(await exportBackup(restoredProfile))).records.sessions[0].lesson).toEqual(lesson);
});
