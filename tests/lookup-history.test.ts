import { beforeEach, expect, it, vi } from 'vitest';
import { db, settings } from '../src/data/db';
import { clearLookupHistory, lookupHistoryUrl, readLookupHistory, recordLookup, removeLookup } from '../src/data/lookupHistory';
import Dexie from 'dexie';
import { pendingSyncBatch, readSyncEvents, receiveSyncBatch } from '../src/data/sync';
import { bootstrapSyncEvents } from '../src/data/db';
import { exportBackup, importBackup, inspectBackup } from '../src/data/backup';

beforeEach(async () => { vi.restoreAllMocks(); await Promise.all(db.tables.map(table => table.clear())); });

it('keeps recent unique lookups per profile and preserves concurrent additions', async () => {
  await Promise.all([recordLookup('p', 'dictionary', ' apple '), recordLookup('p', 'grammar', 'since / for'), recordLookup('other', 'dictionary', 'pear')]);
  await recordLookup('p', 'dictionary', 'APPLE');
  const rows = await readLookupHistory('p');
  expect(rows.map(row => [row.kind, row.term])).toEqual([['dictionary', 'APPLE'], ['grammar', 'since / for']]);
  expect((await readLookupHistory('other')).map(row => row.term)).toEqual(['pear']);
  expect(await readLookupHistory('empty')).toEqual([]);
});

it('bounds history, validates terms and encodes internal destinations', async () => {
  for (let i = 0; i < 105; i++) await recordLookup('p', 'dictionary', `word ${i}`);
  const rows = await readLookupHistory('p');
  expect(rows).toHaveLength(100); expect(rows.at(-1)?.term).toBe('word 5');
  await expect(recordLookup('p', 'grammar', '')).rejects.toThrow();
  await expect(recordLookup('p', 'grammar', 'a'.repeat(81))).rejects.toThrow();
  await expect(recordLookup('p', 'grammar', 'a\u0000b')).rejects.toThrow();
  expect(lookupHistoryUrl({ kind: 'grammar', term: 'since / for & ?#', lookedUpAt: new Date().toISOString() })).toBe('/library/grammar?q=since%20%2F%20for%20%26%20%3F%23');
  expect(await readLookupHistory('p')).toEqual(rows);
});

it('retains valid history after failed writes and rejects corrupt storage without replacing it', async () => {
  await recordLookup('p', 'ipa', 'ɪ');
  const before = await readLookupHistory('p');
  const write = vi.spyOn(db.table('syncEvents'), 'add').mockRejectedValueOnce(new Error('WRITE_FAILED'));
  await expect(recordLookup('p', 'ipa', 'i')).rejects.toThrow('WRITE_FAILED');
  expect(await readLookupHistory('p')).toEqual(before); write.mockRestore();
  await settings.put({ key: 'profile:p:lookupHistory', value: '{broken' });
  await expect(recordLookup('p', 'dictionary', 'apple')).rejects.toThrow();
  expect((await settings.get('profile:p:lookupHistory'))?.value).toBe('{broken');
  expect(db.verno).toBe(10);
});

it('backfills legacy history even after the previous bootstrap, without re-creating removed entries', async () => {
  await settings.put({ key: 'profile:p:syncBootstrap', value: '1' });
  const legacy = [{ kind: 'grammar', term: 'since / for', lookedUpAt: '2026-10-01T00:00:00.000Z' }, { kind: 'ipa', term: 'ɪ', lookedUpAt: '2026-09-01T00:00:00.000Z' }];
  await settings.put({ key: 'profile:p:lookupHistory', value: JSON.stringify(legacy) });
  await bootstrapSyncEvents('p');
  const rows = await readLookupHistory('p');
  expect(rows.map(({ id, ...record }) => { expect(id).toBeTruthy(); return record; })).toEqual(legacy);
  await removeLookup('p', rows[0].id);
  await bootstrapSyncEvents('p');
  expect((await readLookupHistory('p')).map(row => row.term)).toEqual(['ɪ']);
  expect((await readSyncEvents('p')).filter(event => event.type === 'lookup')).toHaveLength(2);
});

it('merges two devices, propagates deletes and clears, and preserves concurrent and later lookups', async () => {
  const other = new Dexie(`lookup-test-${crypto.randomUUID()}`);
  other.version(1).stores({ settings: 'key', syncEvents: '[profileId+id], profileId, [profileId+type]', syncClocks: 'profileId', syncBatches: '[profileId+deviceId+batchId], profileId, [profileId+state]', syncConflicts: '[profileId+hash], profileId' });
  const exchange = async (from: Dexie, to: Dexie) => {
    let batch;
    while ((batch = await pendingSyncBatch('p', from))) {
      await receiveSyncBatch('p', batch.batch, batch.hash, to);
      await from.table('syncBatches').update(['p', batch.deviceId, batch.batchId], { state: 'confirmed' });
    }
  };
  try {
    await recordLookup('p', 'dictionary', 'apple'); await exchange(db, other);
    const old = (await readLookupHistory('p', other))[0];
    await removeLookup('p', old.id); await exchange(db, other);
    expect(await readLookupHistory('p', other)).toEqual([]);
    await recordLookup('p', 'grammar', 'since / for'); await exchange(db, other);
    await recordLookup('p', 'ipa', 'ɪ', other);
    await clearLookupHistory('p');
    await exchange(db, other); await exchange(other, db);
    expect((await readLookupHistory('p')).map(row => row.term)).toEqual(['ɪ']);
    expect(await readLookupHistory('p', other)).toEqual(await readLookupHistory('p'));
    await recordLookup('p', 'dictionary', 'apple', other); await exchange(other, db);
    expect((await readLookupHistory('p')).map(row => row.term)).toEqual(['apple', 'ɪ']);
    const original = (await other.table('syncBatches').toArray()).find(row => row.batch.events.some((event: { id: string }) => event.id === old.id));
    await receiveSyncBatch('p', original.batch, original.hash, db);
    expect((await readLookupHistory('p')).map(row => row.term)).toEqual(['apple', 'ɪ']);
    other.close(); await other.open();
    expect(await readLookupHistory('p', other)).toEqual(await readLookupHistory('p'));
  } finally { await other.delete(); }
});

it('keeps lookup IDs and source/time fields through actual ZIP restore', async () => {
  await db.table('profiles').put({ id: 'p', name: 'Local', createdAt: new Date().toISOString() });
  await recordLookup('p', 'dictionary', 'apple'); await recordLookup('p', 'grammar', 'each / every'); await recordLookup('p', 'ipa', 'æ');
  const original = await readLookupHistory('p');
  const restored = await importBackup(await inspectBackup(await exportBackup('p')));
  expect(await readLookupHistory(restored)).toEqual(original);
});

it('upgrades a DB9 history in place without changing learning rows or existing preferences', async () => {
  const name = `lookup-upgrade-${crypto.randomUUID()}`, original = new Dexie(name);
  original.version(9).stores({ settings: 'key', profiles: 'id', attempts: 'id', syncEvents: '[profileId+id], profileId', syncClocks: 'profileId' });
  const legacy = [{ kind: 'ipa', term: 'ɪ', lookedUpAt: '2026-10-01T00:00:00.000Z' }];
  const attempt = { id: 'learning-original', answer: 'synthetic private answer', correct: false };
  await original.table('attempts').put(attempt);
  await original.table('settings').bulkPut([{ key: 'profile:p:lookupHistory', value: JSON.stringify(legacy) }, { key: 'profile:p:theme', value: 'dark' }]);
  original.close();
  const upgraded = new Dexie(name); upgraded.version(9).stores({ settings: 'key', profiles: 'id', attempts: 'id', syncEvents: '[profileId+id], profileId', syncClocks: 'profileId' });
  upgraded.version(10).stores({ syncEvents: '[profileId+id], profileId, [profileId+type]' });
  try {
    const { migrateLookupHistory } = await import('../src/data/lookupHistory');
    await migrateLookupHistory('p', upgraded);
    expect((await readLookupHistory('p', upgraded)).map(({ kind, term, lookedUpAt }) => ({ kind, term, lookedUpAt }))).toEqual(legacy);
    expect(await upgraded.table('attempts').get(attempt.id)).toEqual(attempt);
    expect((await upgraded.table('settings').get('profile:p:theme')).value).toBe('dark');
    expect((await readSyncEvents('p', upgraded)).every(event => event.type === 'lookup')).toBe(true);
  } finally { await upgraded.delete(); }
});
