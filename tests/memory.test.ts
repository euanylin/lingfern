import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { db, memories, memoryReviews, type MemoryReview } from '../src/data/db';
import { confirmReviewTime, reviewTimeline, enableReview, memoryConfigId, rateMemory, removeSense, replayMemory, saveSense, projectMemories, dueMemories, memoryDue } from '../src/data/memory';
import { validateSyncBatch, type SyncEvent } from '../src/shared/sync';
import * as dictionary from '../src/shared/dictionary';
import { receiveSyncBatch, appendSyncEvent } from '../src/data/sync';
import { exportBackup, importBackup, inspectBackup } from '../src/data/backup';

beforeEach(async () => { await Promise.all(db.tables.map(table => table.clear())); });

it('requires explicit saving and review opt-in, then preserves one event per retry', async () => {
  await saveSense('local-guest', 'sense-1', 'take off', 'to leave the ground');
  const item = await memories.get(['local-guest', 'sense-1']);
  expect(item?.reviewEnabled).toBe(false);
  await expect(rateMemory('local-guest', 'sense-1', 3)).rejects.toThrow('REVIEW_DISABLED');
  await enableReview('local-guest', 'sense-1');
  const time = new Date(Date.now() + 1000).toISOString();
  await rateMemory('local-guest', 'sense-1', 3, 'review-1', time);
  await rateMemory('local-guest', 'sense-1', 3, 'review-1', time);
  expect(await memoryReviews.count()).toBe(1);
  expect((await memories.get(['local-guest', 'sense-1']))?.card?.reps).toBe(1);
});

it('removes one bookmarked sense and its reviews without touching another sense', async () => {
  await saveSense('local-guest', 'sense-1', 'apple', 'a fruit');
  await saveSense('local-guest', 'sense-2', 'apple', 'a tree');
  await enableReview('local-guest', 'sense-1');
  await rateMemory('local-guest', 'sense-1', 3);
  await removeSense('local-guest', 'sense-1');
  expect(await memories.get(['local-guest', 'sense-1'])).toBeUndefined();
  expect(await memoryReviews.where('[profileId+memoryId]').equals(['local-guest', 'sense-1']).count()).toBe(0);
  expect(await memories.get(['local-guest', 'sense-2'])).toBeDefined();
});

it('replays the same event set regardless of upload order and rejects bad clocks', () => {
  const savedAt = '2026-09-01T10:00:00.000Z';
  const event = (id: string, occurredAt: string, rating: 1 | 2 | 3 | 4): MemoryReview => ({ id, profileId: 'p', memoryId: 'sense-1', occurredAt, rating, assistance: { answerRevealed: true, hintUsed: false }, configId: memoryConfigId });
  const a = event('a', '2026-09-02T10:00:00.000Z', 3);
  const b = event('b', '2026-09-03T10:00:00.000Z', 2);
  expect(replayMemory(savedAt, [a, b])).toEqual(replayMemory(savedAt, [b, a, a]));
  expect(() => replayMemory(savedAt, [event('early', '2026-08-31T10:00:00.000Z', 3)])).toThrow('REVIEW_CLOCK');
});

it('round-trips saved meanings and original review events in the private backup', async () => {
  await saveSense('local-guest', 'sense-1', 'apple', 'a fruit');
  await enableReview('local-guest', 'sense-1');
  await rateMemory('local-guest', 'sense-1', 1);
  const inspection = await inspectBackup(await exportBackup('local-guest'));
  expect(inspection.summary).toMatchObject({ memories: 1, memoryReviews: 1 });
  const importedId = await importBackup(inspection);
  expect((await memories.get([importedId, 'sense-1']))?.card).toEqual((await memories.get(['local-guest', 'sense-1']))?.card);
  expect(await memoryReviews.where('profileId').equals(importedId).count()).toBe(1);
});

it('preserves same-device review order when timestamps tie across backup restoration', async () => {
  const memoryId = 'apple%1:13:00::';
  await memories.put({ profileId: 'p', memoryId, term: 'apple', definition: 'fruit', savedAt: '2026-09-01T10:00:00.000Z', reviewEnabled: true });
  const first = reviewEvent('z-first', 2), second = reviewEvent('a-second', 3);
  if (first.type !== 'memory_review' || second.type !== 'memory_review') throw new Error('Expected reviews');
  first.payload.rating = 1; second.payload.rating = 4;
  await receive([savedEvent(true), first, second], 'tied-reviews');
  const original = await projectMemories('p');
  expect(original.problems).toEqual([]);
  const reviews = await memoryReviews.where('profileId').equals('p').toArray();
  const restoredId = await importBackup(await inspectBackup(await exportBackup('p')));
  expect((await memories.get([restoredId, memoryId]))?.card).toEqual(original.items[0].card);
  expect(await memoryReviews.where('profileId').equals(restoredId).toArray()).toEqual(reviews.map(review => ({ ...review, profileId: restoredId })));
  expect((await projectMemories(restoredId)).items[0].card).toEqual(original.items[0].card);
});


afterEach(() => { vi.restoreAllMocks(); });
async function receive(events: SyncEvent[], batchId: string) {
  const value = await validateSyncBatch({ product: 'Lingfern', formatVersion: 1, profileId: 'p', deviceId: events[0].deviceId, batchId, events });
  await receiveSyncBatch('p', value.batch, value.hash);
}
const savedEvent = (saved: boolean, counter = 1, deviceId = 'a'): SyncEvent => ({ id: `saved-${deviceId}-${counter}`, deviceId, counter, occurredAt: '2026-09-01T10:00:00.000Z', type: 'saved_item', payload: { memoryId: 'apple%1:13:00::', saved, reviewEnabled: saved } });
const reviewEvent = (id: string, counter: number, deviceId = 'a', occurredAt = '2026-09-02T10:00:00.000Z'): SyncEvent => ({ id, counter, deviceId, occurredAt, type: 'memory_review', payload: { memoryId: 'apple%1:13:00::', rating: 3, configId: memoryConfigId, assistance: { answerRevealed: true, hintUsed: false } } });

it('resolves a received exact public sense and deterministically replays originals, then removal wins over an old device', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ apple: [{ id: 'apple%1:13:00::', pos: 'noun', definition: 'fruit' }] })));
  await receive([reviewEvent('later', 3, 'a', '2026-09-03T10:00:00.000Z'), savedEvent(true), reviewEvent('earlier', 2)], 'first');
  const result = await projectMemories('p');
  expect(result.problems).toEqual([]); expect(result.items[0]).toMatchObject({ term: 'apple', definition: 'fruit', reviewEnabled: true, card: { reps: 2 } });
  expect(fetch).toHaveBeenCalledWith('/dictionary/oewn-2025/a.json');
  const events = await memoryReviews.where('profileId').equals('p').toArray();
  expect(result.items[0].card).toEqual(replayMemory('2026-09-01T10:00:00.000Z', events));
  expect((await projectMemories('p')).items[0].card).toEqual(result.items[0].card);
  expect(await memoryReviews.count()).toBe(2);
  await receive([savedEvent(false, 9)], 'remove');
  await receive([savedEvent(true, 2, 'b')], 'old-device');
  expect((await projectMemories('p')).items).toEqual([]);
  expect(await memories.count()).toBe(0); expect(await memoryReviews.count()).toBe(0);
  const savedAgain = savedEvent(true, 10); savedAgain.occurredAt = '2026-09-04T10:00:00.000Z';
  await receive([savedAgain, reviewEvent('new-cycle', 11, 'a', '2026-09-05T10:00:00.000Z')], 'new-cycle');
  expect((await projectMemories('p')).items[0].card?.reps).toBe(1);
  expect((await memoryReviews.toArray()).map(event => event.id)).toEqual(['new-cycle']);
  expect((await inspectBackup(await exportBackup('p'))).records.syncEvents!.length).toBeGreaterThan(3);
});

it('keeps future, incompatible and ambiguous review events in sync storage while blocking scheduling and preserving backup', async () => {
  await memories.put({ profileId: 'p', memoryId: 'apple%1:13:00::', term: 'apple', definition: 'fruit', savedAt: '2026-09-01T10:00:00.000Z', reviewEnabled: true });
  await receive([savedEvent(true), reviewEvent('future', 2, 'a', '2099-01-01T00:00:00.000Z')], 'future');
  expect((await projectMemories('p')).problems).toEqual([{ memoryId: 'apple%1:13:00::', code: 'REVIEW_CLOCK' }]);
  await expect(rateMemory('p', 'apple%1:13:00::', 3)).rejects.toThrow('REVIEW_CLOCK');
  expect(await memoryReviews.count()).toBe(0);
  expect((await inspectBackup(await exportBackup('p'))).records.syncEvents).toHaveLength(2);
  await db.table('syncEvents').clear(); await db.table('syncBatches').clear();
  const incompatible = reviewEvent('different-config', 2);
  if (incompatible.type === 'memory_review') incompatible.payload.configId = 'unavailable-config';
  await receive([savedEvent(true), incompatible], 'config');
  expect((await projectMemories('p')).problems[0].code).toBe('REVIEW_INVALID');
  expect(await memoryReviews.count()).toBe(0);
  await db.table('syncEvents').clear(); await db.table('syncBatches').clear();
  await receive([savedEvent(true), reviewEvent('same-time-a', 2)], 'a');
  await receive([reviewEvent('same-time-b', 2, 'b')], 'b');
  expect((await projectMemories('p')).problems[0].code).toBe('REVIEW_ORDER');
  expect(await memoryReviews.count()).toBe(0);
});

it('rolls back projection writes on failure and permits removing a saved ID whose meaning is unavailable', async () => {
  await memories.put({ profileId: 'p', memoryId: 'apple%1:13:00::', term: 'apple', definition: 'fruit', savedAt: '2026-09-01T10:00:00.000Z', reviewEnabled: true });
  await receive([savedEvent(true), reviewEvent('review', 2)], 'first');
  const fail = () => { throw new Error('STORAGE_FAILURE'); };
  memoryReviews.hook('creating', fail);
  try { await expect(projectMemories('p')).rejects.toThrow('STORAGE_FAILURE'); }
  finally { memoryReviews.hook('creating').unsubscribe(fail); }
  expect(await memoryReviews.count()).toBe(0);
  expect((await memories.get(['p', 'apple%1:13:00::']))?.card).toBeUndefined();
  const pending = savedEvent(true, 4); if (pending.type === 'saved_item') pending.payload.memoryId = 'private-expression';
  await receive([pending], 'pending');
  expect((await projectMemories('p')).problems).toContainEqual({ memoryId: 'private-expression', code: 'DICTIONARY_UNAVAILABLE' });
  await removeSense('p', 'private-expression');
  expect((await projectMemories('p')).problems).toEqual([]);
});


it('a concurrent event during public-sense resolution prevents stale projection writes', async () => {
  const change = savedEvent(true); if (change.type === 'saved_item') change.payload.memoryId = 'new-sense';
  await receive([change], 'new');
  vi.spyOn(dictionary, 'lookupDictionarySense').mockImplementation(async () => {
    await appendSyncEvent('p', { type: 'setting', payload: { key: 'theme', value: 'dark' } });
    return { term: 'word', definition: 'meaning' };
  });
  await expect(projectMemories('p')).rejects.toThrow('SYNC_LOCAL_CHANGED');
  expect(await memories.count()).toBe(0); expect(await memoryReviews.count()).toBe(0);
  expect(await db.table('syncEvents').count()).toBe(2);
});


it('confirmed timing preserves original reviews, deterministic replay and ZIP restoration', async () => {
  await memories.put({ profileId: 'p', memoryId: 'apple%1:13:00::', term: 'apple', definition: 'fruit', savedAt: '2026-09-01T10:00:00.000Z', reviewEnabled: true });
  await receive([savedEvent(true), reviewEvent('future-review', 2, 'a', '2099-01-01T00:00:00.000Z')], 'timing');
  expect((await projectMemories('p')).problems[0].code).toBe('REVIEW_CLOCK');
  const source = (await reviewTimeline('p', 'apple%1:13:00::')).find(row => row.id === 'future-review')!;
  await expect(confirmReviewTime('p', 'apple%1:13:00::', source.id, 'a'.repeat(64), '2026-09-02T10:00:00.000Z')).rejects.toThrow('REVIEW_INVALID');
  await expect(confirmReviewTime('p', 'apple%1:13:00::', source.id, source.hash, '2099-01-01T00:00:00.000Z')).rejects.toThrow('REVIEW_CLOCK');
  await confirmReviewTime('p', 'apple%1:13:00::', source.id, source.hash, '2026-09-02T10:00:00.000Z');
  const result = await projectMemories('p');
  expect(result.problems).toEqual([]); expect(result.items[0].card?.reps).toBe(1);
  expect((await memoryReviews.get(['p', source.id]))?.occurredAt).toBe('2099-01-01T00:00:00.000Z');
  expect((await reviewTimeline('p', 'apple%1:13:00::')).find(row => row.id === source.id)).toMatchObject({ originalTime: '2099-01-01T00:00:00.000Z', time: '2026-09-02T10:00:00.000Z' });
  const inspection = await inspectBackup(await exportBackup('p'));
  const restored = await importBackup(inspection);
  expect((await projectMemories(restored)).items[0].card).toEqual(result.items[0].card);
  await rateMemory('p', 'apple%1:13:00::', 3, 'next-review');
  expect((await memories.get(['p', 'apple%1:13:00::']))?.card?.reps).toBe(2);
});

it('confirmed distinct times resolve cross-device order without changing original timestamps', async () => {
  await memories.put({ profileId: 'p', memoryId: 'apple%1:13:00::', term: 'apple', definition: 'fruit', savedAt: '2026-09-01T10:00:00.000Z', reviewEnabled: true });
  await receive([savedEvent(true), reviewEvent('first-device', 2)], 'first-device');
  await receive([reviewEvent('second-device', 2, 'b')], 'second-device');
  expect((await projectMemories('p')).problems[0].code).toBe('REVIEW_ORDER');
  const source = (await reviewTimeline('p', 'apple%1:13:00::')).find(row => row.id === 'second-device')!;
  await confirmReviewTime('p', 'apple%1:13:00::', source.id, source.hash, source.originalTime);
  expect((await projectMemories('p')).problems[0].code).toBe('REVIEW_ORDER');
  await confirmReviewTime('p', 'apple%1:13:00::', source.id, source.hash, new Date(Date.parse(source.originalTime) + 1000).toISOString());
  expect((await projectMemories('p')).problems).toEqual([]);
  expect((await memories.get(['p', 'apple%1:13:00::']))?.card?.reps).toBe(2);
  expect((await memoryReviews.get(['p', source.id]))?.occurredAt).toBe(source.originalTime);
});

it('timing confirmation fences profile changes and rolls back a failed write', async () => {
  await receive([savedEvent(true), reviewEvent('source', 2)], 'source');
  const source = (await reviewTimeline('p', 'apple%1:13:00::')).find(row => row.id === 'source')!;
  const { settings } = await import('../src/data/db');
  await settings.put({ key: 'activeProfile', value: 'other' });
  await expect(confirmReviewTime('p', 'apple%1:13:00::', source.id, source.hash, source.originalTime)).rejects.toThrow('SYNC_SCOPE_CHANGED');
  await settings.delete('activeProfile');
  const fail = () => { throw new Error('STORAGE_FAILURE'); };
  db.table('syncEvents').hook('creating', fail);
  try { await expect(confirmReviewTime('p', 'apple%1:13:00::', source.id, source.hash, source.originalTime)).rejects.toThrow('STORAGE_FAILURE'); }
  finally { db.table('syncEvents').hook('creating').unsubscribe(fail); }
  expect(await db.table('syncEvents').count()).toBe(2);
});

it('bookmark-time confirmation repairs the replay start and keeps the original saved event', async () => {
  const saved = savedEvent(true); saved.occurredAt = '2099-01-01T00:00:00.000Z';
  await memories.put({ profileId: 'p', memoryId: 'apple%1:13:00::', term: 'apple', definition: 'fruit', savedAt: saved.occurredAt, reviewEnabled: true });
  await receive([saved, reviewEvent('review-before-bad-clock', 2)], 'bookmark-clock');
  expect((await projectMemories('p')).problems[0].code).toBe('REVIEW_CLOCK');
  const source = (await reviewTimeline('p', 'apple%1:13:00::')).find(row => row.type === 'saved_item')!;
  await confirmReviewTime('p', 'apple%1:13:00::', source.id, source.hash, '2026-09-01T10:00:00.000Z');
  const result = await projectMemories('p');
  expect(result.problems).toEqual([]); expect(result.items[0].card?.reps).toBe(1);
  expect((await db.table('syncEvents').get(['p', saved.id])).occurredAt).toBe(saved.occurredAt);
  expect((await inspectBackup(await exportBackup('p'))).records.memories[0].savedAt).toBe('2026-09-01T10:00:00.000Z');
  await appendSyncEvent('p', { type: 'review_timing', payload: { memoryId: 'apple%1:13:00::', sourceId: source.id, sourceHash: 'a'.repeat(64), time: '2026-09-01T10:00:00.000Z' } });
  expect((await projectMemories('p')).problems[0].code).toBe('REVIEW_TIMING_INVALID');
  const damagedTiming = await inspectBackup(await exportBackup('p'));
  const restored = await importBackup(damagedTiming);
  expect((await projectMemories(restored)).problems[0].code).toBe('REVIEW_TIMING_INVALID');
  const repair = (await reviewTimeline(restored, 'apple%1:13:00::')).find(row => row.id === source.id)!;
  await confirmReviewTime(restored, 'apple%1:13:00::', repair.id, repair.hash, '2026-09-01T10:00:00.000Z');
  expect((await projectMemories(restored)).problems).toEqual([]);
  await appendSyncEvent(restored, { type: 'review_timing', payload: { memoryId: 'apple%1:13:00::', sourceId: repair.id, sourceHash: repair.hash, time: '2099-01-01T00:00:00.000Z' } });
  expect((await projectMemories(restored)).problems[0].code).toBe('REVIEW_CLOCK');
  const futureRestore = await importBackup(await inspectBackup(await exportBackup(restored)));
  expect((await memories.get([futureRestore, 'apple%1:13:00::']))?.card).toBeUndefined();
  expect((await projectMemories(futureRestore)).problems[0].code).toBe('REVIEW_CLOCK');
});


it('uses actual FSRS due dates, opt-in and quarantine for material-filter candidates without rating them', async () => {
  await saveSense('p', 'sense-1', 'apple', 'a fruit');
  await saveSense('p', 'sense-2', 'apple', 'a tree');
  expect(await dueMemories('p')).toEqual([]);
  await enableReview('p', 'sense-1');
  expect((await dueMemories('p')).map(item => item.memoryId)).toEqual(['sense-1']);
  await rateMemory('p', 'sense-1', 3);
  const saved = (await memories.get(['p', 'sense-1']))!;
  const due = new Date(saved.card!.due).getTime();
  const count = await memoryReviews.count();
  expect(await dueMemories('p', due - 1)).toEqual([]);
  expect((await dueMemories('p', due)).map(item => item.memoryId)).toEqual(['sense-1']);
  expect(await dueMemories('other-profile', due)).toEqual([]);
  expect(await memoryReviews.count()).toBe(count);
  expect(memoryDue({ ...saved, savedAt: 'bad-time' }, due)).toBe(false);
  expect(memoryDue({ ...saved, savedAt: new Date(due + 1).toISOString() }, due)).toBe(false);
  await removeSense('p', 'sense-1');
  expect(await dueMemories('p', due)).toEqual([]);
  await receive([savedEvent(true), reviewEvent('future-candidate', 2, 'a', '2099-01-01T00:00:00.000Z')], 'due-quarantine');
  expect(await dueMemories('p')).toEqual([]);
});
