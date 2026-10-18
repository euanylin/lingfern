import { readSourcePackFixture } from './fixtures/source-pack-regression';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { concessionPrompt, corpusLesson, corpusSchema, selectCorpusPassage, type Corpus } from '../src/core/corpus';
import { loadReadingCorpus, reviewedReading } from '../src/data/corpus';
import { inspectCommunityPack } from '../src/data/communityPack';
import { communityPacks, createSession, db, sessions } from '../src/data/db';
import { exportBackup, importBackup, inspectBackup } from '../src/data/backup';

const rootId = 'wikipedia-article-40685706';
const ids = ['28028b0ca63d1a78ee049099bc81bdf22438f437d476e673f61746d0ac37e314', '7ecc20b135cce6da2b6762e72e804eed055d005aedc012e6a7ceed9bf7680913'];
const bank = (records: Corpus['records']): Corpus => ({ version: 1, failures: [], records });
beforeEach(async () => { await Promise.all(db.tables.map(table => table.clear())); });
afterEach(() => vi.unstubAllGlobals());
async function actual() {
  const packs = await Promise.all(['001', '007'].map(id => inspectCommunityPack(readSourcePackFixture(`wikipedia-reading-${id}`))));
  const source = packs[0].corpus!.records.find(record => record.rootId === rootId)!;
  const first = source.passages.findIndex(passage => passage.id === ids[0]);
  const scoped = { ...source, passages: source.passages.slice(first, first + 3) };
  const current = (await reviewedReading([scoped], 900))[0];
  const old = (await reviewedReading([scoped], 1400))[0];
  const merged = current.passages.find(passage => passage.wordCount === 732)!;
  const overlapping = current.passages.find(passage => passage.wordCount === 845)!;
  const prior = old.passages.find(passage => passage.wordCount === 1211)!;
  expect([merged, overlapping, prior].every(Boolean)).toBe(true);
  return { packs, source, scoped, current, merged, overlapping, prior };
}

it('does not count a joined window containing a seen original component as new', async () => {
  const { current, merged, overlapping } = await actual();
  const selected = selectCorpusPassage(bank([{ ...current, passages: [current.passages[0], merged] }]), new Set([ids[0]]), 0, 900, [], [], 'C1');
  expect(selected).toBeUndefined();
  // The adjacent window starts after the first old component and remains eligible.
  expect(selectCorpusPassage(bank([current]), new Set([ids[0]]), 0, 900, [], [], 'C1')?.passage.id).toBe(overlapping.id);
});

it('preserves overlapping short beginner excerpts as separate supported materials', () => {
  const corpus = corpusSchema.parse(JSON.parse(readFileSync('public/corpus/voa.json', 'utf8')));
  const overlaps = (source: Corpus['records'][number], a: Corpus['records'][number]['passages'][number], b: Corpus['records'][number]['passages'][number]) => {
    const left = source.originalText!.indexOf(a.text), right = source.originalText!.indexOf(b.text);
    return a.id !== b.id && left >= 0 && right >= 0 && left < right + b.text.length && right < left + a.text.length;
  };
  const source = corpus.records.find(record => record.originalText && record.passages.some(a => record.passages.some(b => overlaps(record, a, b))))!;
  const longer = source.passages.find(a => source.passages.some(b => overlaps(source, a, b)))!;
  const shorter = source.passages.find(b => overlaps(source, longer, b))!;
  expect(selectCorpusPassage(bank([{ ...source, passages: [longer, shorter] }]), new Set([longer.id]), 0, 220)?.passage.id).toBe(shorter.id);
});

it('excludes intersecting new hashes and old components before lesson eligibility is filtered', async () => {
  const { current, merged, overlapping } = await actual();
  expect(merged.id).not.toBe(overlapping.id);
  const seen = new Set([merged.id]);
  const next = selectCorpusPassage(bank([current]), seen, 0, 900, [], [], 'C1')!;
  expect(next.passage.id).not.toBe(overlapping.id);
  expect(ids).not.toContain(next.passage.id);
  const original = current.originalText!, end = original.indexOf(merged.text) + merged.text.length;
  expect(original.indexOf(next.passage.text)).toBeGreaterThanOrEqual(end);
  const selected = { ...current, passages: current.passages.filter(passage => ids.includes(passage.id) || [merged.id, overlapping.id].includes(passage.id)) };
  expect(corpusLesson(bank([selected]), seen, 0, 900, 'C1', [], 'evidence', [], `evidence:${concessionPrompt}`, bank([current]))).toBeUndefined();
});

it('recognises a saved larger window after a smaller request, with profile and root isolation', async () => {
  const { packs, prior } = await actual();
  vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
  for (const profileId of ['reader', 'other']) for (const pack of packs) await communityPacks.put({ ...pack, profileId, state: 'ready', installedAt: '2026-10-08T00:00:00.000Z' });
  const full = await loadReadingCorpus('reader', 1400);
  const oldSource = full.records.find(record => record.rootId === rootId)!;
  const first = { ...oldSource, passages: [prior] };
  const lesson = corpusLesson(bank([first]), new Set(), 0, 1400, 'C1', [], 'evidence', [], `evidence:${concessionPrompt}`, full)!;
  expect(lesson).toBeDefined();
  expect(lesson.materials[0].blocks[0].text).toBe(prior.text);
  const session = await createSession(lesson, 'reader');
  const seen = new Set(lesson.materials.map(material => material.id.slice('corpus-'.length)));
  const current = await loadReadingCorpus('reader', 900);
  const source = current.records.find(record => record.rootId === rootId)!;
  expect(source.passages.some(passage => passage.id === prior.id)).toBe(false);
  const prefix = { ...source, passages: source.passages.filter(passage => prior.text.includes(passage.text)) };
  expect(selectCorpusPassage(bank([source]), seen, 0, 900, [], [], 'C1')?.source.rootId).toBe(rootId);
  // Keep the original source object for its local historic-interval registration.
  const prefixes = new Set(prefix.passages.map(passage => passage.id));
  for (let seed = 0; seed < 7; seed++) expect(prefixes.has(selectCorpusPassage(bank([source]), seen, seed, 900, [], [], 'C1')!.passage.id)).toBe(false);
  const other = await loadReadingCorpus('other', 900);
  const otherSource = other.records.find(record => record.rootId === rootId)!;
  expect(prefixes.has(selectCorpusPassage(bank([otherSource]), seen, 0, 900, [], [], 'C1')!.passage.id)).toBe(true);
  const different = { ...otherSource, rootId: 'wikipedia-article-99999999' };
  expect(selectCorpusPassage(bank([different]), seen, 0, 900, [], [], 'C1')).toBeDefined();
  const restoredProfile = await importBackup(await inspectBackup(await exportBackup('reader')));
  for (const pack of packs) await communityPacks.put({ ...pack, profileId: restoredProfile, state: 'ready', installedAt: '2026-10-08T00:00:00.000Z' });
  const restored = await loadReadingCorpus(restoredProfile, 900);
  const restoredSource = restored.records.find(record => record.rootId === rootId)!;
  for (let seed = 0; seed < 7; seed++) expect(prefixes.has(selectCorpusPassage(bank([restoredSource]), seen, seed, 900, [], [], 'C1')!.passage.id)).toBe(false);
  expect((await sessions.get(session.id))?.lesson).toEqual(lesson);
});

it('does not infer saved ranges from tampered snapshots or foreign material identity', async () => {
  const { packs, prior } = await actual();
  vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
  for (const pack of packs) await communityPacks.put({ ...pack, profileId: 'reader', state: 'ready', installedAt: '2026-10-08T00:00:00.000Z' });
  const full = await loadReadingCorpus('reader', 1400), source = full.records.find(record => record.rootId === rootId)!;
  const lesson = corpusLesson(bank([{ ...source, passages: [prior] }]), new Set(), 0, 1400, 'C1', [], 'evidence', [], `evidence:${concessionPrompt}`, full)!;
  const saved = await createSession(lesson, 'reader');
  await sessions.update(saved.id, { contentHash: '0'.repeat(64) });
  const next = await loadReadingCorpus('reader', 900), current = next.records.find(record => record.rootId === rootId)!;
  expect(prior.text.includes(selectCorpusPassage(bank([current]), new Set([prior.id]), 0, 900, [], [], 'C1')!.passage.text)).toBe(true);
  const foreign = structuredClone(lesson);
  foreign.materials[0].sourceId = 'wikipedia-99999999';
  await sessions.update(saved.id, { lesson: foreign, contentHash: createHash('sha256').update(JSON.stringify(foreign)).digest('hex') });
  const unrelated = await loadReadingCorpus('reader', 900), unrelatedSource = unrelated.records.find(record => record.rootId === rootId)!;
  expect(prior.text.includes(selectCorpusPassage(bank([unrelatedSource]), new Set([prior.id]), 0, 900, [], [], 'C1')!.passage.text)).toBe(true);
});
