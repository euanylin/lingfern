import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { db, memories } from '../src/data/db';
import { removeSense, saveSense, projectMemories } from '../src/data/memory';
import { validateSyncBatch, type SyncEvent } from '../src/shared/sync';
import * as dictionary from '../src/shared/dictionary';
import { receiveSyncBatch, appendSyncEvent, readSyncEvents } from '../src/data/sync';
import { exportBackup, importBackup, inspectBackup } from '../src/data/backup';

beforeEach(async () => { await Promise.all(db.tables.map(table => table.clear())); });
afterEach(() => { vi.restoreAllMocks(); });

async function receive(events: SyncEvent[], batchId: string) {
  const value = await validateSyncBatch({ product: 'Lingfern', formatVersion: 1, profileId: 'p', deviceId: events[0].deviceId, batchId, events });
  await receiveSyncBatch('p', value.batch, value.hash);
}
const savedEvent = (saved: boolean, counter = 1, deviceId = 'a'): Extract<SyncEvent, { type: 'saved_item' }> => ({ id: `saved-${deviceId}-${counter}`, deviceId, counter, occurredAt: '2026-09-01T10:00:00.000Z', type: 'saved_item', payload: { memoryId: 'apple%1:13:00::', saved } });

it('saves each meaning once and records only bookmark changes', async () => {
  await saveSense('p', 'sense-1', 'take off', 'to leave the ground');
  const item = await memories.get(['p', 'sense-1']);
  await saveSense('p', 'sense-1', 'take off', 'to leave the ground');
  expect(await memories.get(['p', 'sense-1'])).toEqual(item);
  expect(await readSyncEvents('p')).toHaveLength(1);
  expect(Object.keys(item!).sort()).toEqual(['definition', 'memoryId', 'profileId', 'savedAt', 'term']);
  expect(db.tables.map(table => table.name)).not.toContain('memoryReviews');
});

it('removes one meaning without touching another meaning or profile', async () => {
  await saveSense('p', 'sense-1', 'apple', 'a fruit');
  await saveSense('p', 'sense-2', 'apple', 'a tree');
  await saveSense('other', 'sense-1', 'apple', 'a fruit');
  await removeSense('p', 'sense-1');
  await removeSense('p', 'sense-1');
  expect(await memories.get(['p', 'sense-1'])).toBeUndefined();
  expect(await memories.get(['p', 'sense-2'])).toBeDefined();
  expect(await memories.get(['other', 'sense-1'])).toBeDefined();
  expect((await readSyncEvents('p')).filter(event => event.type === 'saved_item').map(event => event.payload.saved)).toEqual([true, true, false]);
});

it('round-trips saved meanings and original bookmark IDs in the backup', async () => {
  await saveSense('p', 'sense-1', 'apple', 'a fruit');
  const original = await memories.get(['p', 'sense-1']);
  const inspection = await inspectBackup(await exportBackup('p'));
  expect(inspection.summary.memories).toBe(1);
  const restored = await importBackup(inspection);
  expect(await memories.get([restored, 'sense-1'])).toEqual({ ...original, profileId: restored });
  expect(await readSyncEvents(restored)).toEqual(await readSyncEvents('p'));
});

it('resolves public senses, keeps removals ahead of stale devices and permits re-saving', async () => {
  vi.spyOn(dictionary, 'lookupDictionarySense').mockResolvedValue({ term: 'apple', definition: 'fruit' });
  await receive([savedEvent(true)], 'first');
  expect((await projectMemories('p')).items[0]).toMatchObject({ term: 'apple', definition: 'fruit' });
  await receive([savedEvent(false, 9)], 'remove');
  await receive([savedEvent(true, 2, 'b')], 'old-device');
  expect((await projectMemories('p')).items).toEqual([]);
  const savedAgain = savedEvent(true, 10); savedAgain.occurredAt = '2026-09-04T10:00:00.000Z';
  await receive([savedAgain], 'new-cycle');
  expect((await projectMemories('p')).items[0].savedAt).toBe(savedAgain.occurredAt);
  expect((await inspectBackup(await exportBackup('p'))).records.syncEvents).toHaveLength(4);
});

it('rolls back projection writes and permits removing an unavailable meaning', async () => {
  vi.spyOn(dictionary, 'lookupDictionarySense').mockResolvedValue({ term: 'apple', definition: 'fruit' });
  await receive([savedEvent(true)], 'first');
  const fail = () => { throw new Error('STORAGE_FAILURE'); };
  memories.hook('creating', fail);
  try { await expect(projectMemories('p')).rejects.toThrow('STORAGE_FAILURE'); }
  finally { memories.hook('creating').unsubscribe(fail); }
  expect(await memories.count()).toBe(0);
  vi.mocked(dictionary.lookupDictionarySense).mockResolvedValue(undefined);
  expect((await projectMemories('p')).problems).toEqual([{ memoryId: 'apple%1:13:00::', code: 'DICTIONARY_UNAVAILABLE' }]);
  await removeSense('p', 'apple%1:13:00::');
  expect((await projectMemories('p')).problems).toEqual([]);
});

it('a concurrent event during public-sense resolution prevents stale projection writes', async () => {
  await receive([savedEvent(true)], 'new');
  vi.spyOn(dictionary, 'lookupDictionarySense').mockImplementation(async () => {
    await appendSyncEvent('p', { type: 'setting', payload: { key: 'theme', value: 'dark' } });
    return { term: 'word', definition: 'meaning' };
  });
  await expect(projectMemories('p')).rejects.toThrow('SYNC_LOCAL_CHANGED');
  expect(await memories.count()).toBe(0);
  expect(await db.table('syncEvents').count()).toBe(2);
});

it('preserves valid legacy wire fields and archives review events without restoring review state', async () => {
  vi.spyOn(dictionary, 'lookupDictionarySense').mockResolvedValue({ term: 'apple', definition: 'fruit' });
  const saved = savedEvent(true);
  const events: SyncEvent[] = [{ ...saved, payload: { ...saved.payload, reviewEnabled: true } }, { id: 'legacy-review', deviceId: 'a', counter: 2, occurredAt: saved.occurredAt, type: 'memory_review', payload: { memoryId: 'apple%1:13:00::', rating: 3, configId: 'legacy-config', assistance: { answerRevealed: true, hintUsed: false } } }, { id: 'legacy-time', deviceId: 'a', counter: 3, occurredAt: saved.occurredAt, type: 'review_timing', payload: { memoryId: 'apple%1:13:00::', sourceId: 'legacy-review', sourceHash: 'a'.repeat(64), time: saved.occurredAt } }];
  const raw = { product: 'Lingfern', formatVersion: 1, profileId: 'p', deviceId: 'a', batchId: 'legacy', events };
  const validated = await validateSyncBatch(raw); expect(validated.batch).toEqual(raw);
  await receiveSyncBatch('p', validated.batch, validated.hash);
  expect(await readSyncEvents('p')).toEqual(events);
  expect((await projectMemories('p')).items[0]).toEqual({ profileId: 'p', memoryId: 'apple%1:13:00::', term: 'apple', definition: 'fruit', savedAt: saved.occurredAt });
  expect((await inspectBackup(await exportBackup('p'))).records.syncEvents.map(({ profileId: _profile, batchId: _batch, ...event }) => { void _profile; void _batch; return event; }).sort((a, b) => a.counter - b.counter)).toEqual(events);
  await expect(validateSyncBatch({ ...raw, events: [{ ...events[1], payload: {} }] })).rejects.toThrow();
  await expect(validateSyncBatch({ ...raw, events: [{ ...events[2], payload: {} }] })).rejects.toThrow();
});

it('permits concurrent readers to persist the same projection while retaining event race guards', async () => {
  vi.spyOn(dictionary, 'lookupDictionarySense').mockResolvedValue({ term: 'apple', definition: 'fruit' });
  await receive([savedEvent(true)], 'parallel');
  const results = await Promise.all([projectMemories('p'), projectMemories('p')]);
  expect(results[0]).toEqual(results[1]); expect(await memories.count()).toBe(1);
  await receive([savedEvent(false, 2)], 'parallel-remove');
  expect(await Promise.all([projectMemories('p'), projectMemories('p')])).toEqual([{ items: [], problems: [] }, { items: [], problems: [] }]);
});
