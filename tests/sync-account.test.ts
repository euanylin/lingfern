import { beforeEach, expect, it } from 'vitest';
import { db, profiles, settings, syncClocks } from '../src/data/db';
import { saveSense } from '../src/data/memory';
import { accountProfiles, copyProfileForAccount, readSyncAccount, switchAccountProfile } from '../src/data/syncAccount';
import { confirmSyncBatch, pendingSyncBatch, readSyncEvents, receiveSyncBatch } from '../src/data/sync';
import { validateSyncBatch } from '../src/shared/sync';
import { exportBackup, importBackup, inspectBackup } from '../src/data/backup';

beforeEach(async () => { await Promise.all(db.tables.map(table => table.clear())); });

it('copies originals explicitly without transferring another account acknowledgement or changing the source', async () => {
  await profiles.put({ id: 'p', name: 'Original', createdAt: new Date().toISOString() });
  await settings.put({ key: 'activeProfile', value: 'p' });
  await settings.put({ key: 'profile:p:syncAccount', value: JSON.stringify({ accountId: 1, profileId: 'p' }) });
  await saveSense('p', 'sense', 'private term', 'private definition');
  const batch = (await pendingSyncBatch('p'))!;
  await confirmSyncBatch('p', batch.deviceId, batch.batchId, batch.hash);
  const incoming = await validateSyncBatch({ product: 'Lingfern', formatVersion: 1, profileId: 'p', deviceId: 'remote', batchId: 'remote-batch', events: [{ type: 'saved_item', id: 'received', deviceId: 'remote', counter: 2, occurredAt: '2020-01-01T00:00:00.000Z', payload: { memoryId: 'remote-sense', saved: true, reviewEnabled: false } }] });
  await receiveSyncBatch('p', incoming.batch, incoming.hash);
  const originals = await readSyncEvents('p');
  expect(await accountProfiles(2)).toEqual([]);
  const copied = await copyProfileForAccount('p', 2);
  expect(copied).not.toBe('p');
  expect(await readSyncEvents(copied)).toEqual(originals);
  expect(await readSyncAccount(copied)).toEqual({ accountId: 2, profileId: 'p' });
  expect(await readSyncAccount('p')).toEqual({ accountId: 1, profileId: 'p' });
  const batches = await db.table('syncBatches').where('profileId').equals(copied).toArray();
  expect(batches).toHaveLength(2);
  expect(batches.every(row => row.state === 'pending')).toBe(true);
  expect(batches.find(row => row.deviceId === batch.deviceId)).toMatchObject({ batch: batch.batch, hash: batch.hash });
  expect((await db.table('syncBatches').get(['p', batch.deviceId, batch.batchId])).state).toBe('confirmed');
  expect((await db.table('syncBatches').get(['p', 'remote', 'remote-batch'])).state).toBe('received');
  expect((await syncClocks.get(copied)).deviceId).not.toBe((await syncClocks.get('p')).deviceId);
  const restored = await importBackup(await inspectBackup(await exportBackup(copied)));
  expect(await readSyncAccount(restored)).toBeUndefined();
  expect(await accountProfiles(2)).toHaveLength(1);
});

it('switches only to an explicitly selected account profile and creates an empty profile when needed', async () => {
  const account = { id: 2, login: 'learner' };
  const first = await switchAccountProfile(account, 'remote-profile');
  expect(await readSyncEvents(first)).toEqual([]);
  expect(await readSyncAccount(first)).toEqual({ accountId: 2, profileId: 'remote-profile' });
  expect(await switchAccountProfile(account, 'remote-profile')).toBe(first);
  const second = await copyProfileForAccount(first, 2);
  expect(await switchAccountProfile(account, 'remote-profile', second)).toBe(second);
  await expect(switchAccountProfile({ id: 3, login: 'other' }, 'remote-profile', second)).rejects.toThrow('NOT_FOUND');
  expect((await settings.get('activeProfile'))?.value).toBe(second);
  await expect(switchAccountProfile(account, '../escape')).rejects.toThrow();
  await expect(copyProfileForAccount(first, -1)).rejects.toThrow();
  await expect(copyProfileForAccount('missing', 2)).rejects.toThrow('NOT_FOUND');
  await settings.put({ key: `profile:${first}:syncAccount`, value: JSON.stringify({ accountId: 2, profileId: 'forged-other-profile' }) });
  expect((await accountProfiles(2)).map(profile => profile.id)).toEqual([second]);
  await settings.put({ key: `profile:${first}:syncAccount`, value: 'corrupt' });
  expect(await readSyncAccount(first)).toBeUndefined();
});

it('rolls back account switch and copy completely when metadata cannot be stored', async () => {
  await profiles.put({ id: 'p', name: 'Original', createdAt: new Date().toISOString() });
  await settings.put({ key: 'activeProfile', value: 'p' });
  await saveSense('p', 'sense', 'word', 'definition');
  await exportBackup('p');
  const originals = await readSyncEvents('p');
  const fail = () => { throw new Error('STORAGE_FAILURE'); };
  settings.hook('updating', fail);
  try { await expect(switchAccountProfile({ id: 2, login: 'learner' }, 'remote-profile')).rejects.toThrow('STORAGE_FAILURE'); }
  finally { settings.hook('updating').unsubscribe(fail); }
  settings.hook('creating', fail);
  try { await expect(copyProfileForAccount('p', 2)).rejects.toThrow('STORAGE_FAILURE'); }
  finally { settings.hook('creating').unsubscribe(fail); }
  expect(await profiles.count()).toBe(1);
  expect((await settings.get('activeProfile'))?.value).toBe('p');
  expect(await readSyncEvents('p')).toEqual(originals);
  expect(await readSyncAccount('p')).toBeUndefined();
});
