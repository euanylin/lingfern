import { beforeEach, expect, it } from 'vitest';
import { attempts, bootstrapSyncEvents, claimSession, createSession, db, profiles, releaseSession, sessions, settings, syncClocks } from '../src/data/db';
import { deleteLocalProfile } from '../src/data/deletion';
import { appendSyncEvent, pendingSyncBatch, receiveSyncBatch } from '../src/data/sync';
import { saveSense } from '../src/data/memory';
import { exportBackup, importBackup, inspectBackup } from '../src/data/backup';
import raw from './fixtures/content/a1-reading.json';

beforeEach(async () => {
  await Promise.all(db.tables.map(table => table.clear()));
  await profiles.bulkAdd(['one', 'two'].map(id => ({ id, name: 'Same name', createdAt: new Date().toISOString() })));
  await settings.put({ key: 'activeProfile', value: 'one' });
});

it('atomically removes all owned stores and exact settings prefixes while preserving other profiles and device settings', async () => {
  for (const profileId of ['one', 'two']) {
    for (const table of db.tables.filter(table => !['profiles', 'settings'].includes(table.name))) {
      await table.put({ id: profileId, profileId, rootId: 'root', memoryId: 'memory', hash: 'hash', deviceId: 'device', batchId: 'batch', accountId: 1, bindingVersion: 'binding', state: 'ready' });
    }
    await settings.put({ key: `profile:${profileId}:syncAccount`, value: 'synthetic' });
  }
  await settings.bulkPut([{ key: 'check-device-id', value: 'device' }, { key: 'profile:one-extra:theme', value: 'dark' }]);
  const retained = await Promise.all(db.tables.filter(table => table.name !== 'settings').map(async table => [table.name, await table.toArray()] as const));
  expect(await deleteLocalProfile('one', 'Same name')).toBe('two');
  for (const [tableName, rows] of retained) {
    const table = db.table(tableName);
    const remaining = await table.toArray();
    expect(remaining.filter(row => row.profileId === 'two' || tableName === 'profiles' && row.id === 'two')).toEqual(rows.filter(row => row.profileId === 'two' || tableName === 'profiles' && row.id === 'two'));
    const removed = remaining.filter(row => row.profileId === 'one' || tableName === 'profiles' && row.id === 'one');
    expect(removed).toHaveLength(tableName === 'syncClocks' ? 1 : 0);
  }
  expect(await syncClocks.get('one')).toMatchObject({ profileId: 'one', counter: 0, deleted: true });
  expect(await settings.where('key').startsWith('profile:one:').count()).toBe(0);
  expect((await settings.get('profile:one-extra:theme'))?.value).toBe('dark');
  expect((await settings.get('check-device-id'))?.value).toBe('device');
  expect((await settings.get('activeProfile'))?.value).toBe('two');
});

it('creates an empty new identity after the last profile and can restore its prior backup separately', async () => {
  await profiles.delete('two');
  await createSession(raw, 'one');
  const backup = await inspectBackup(await exportBackup('one'));
  const next = await deleteLocalProfile('one', 'Same name');
  expect(next).not.toBe('one');
  expect(await profiles.count()).toBe(1);
  expect((await profiles.get(next))?.name).toBe('Local profile');
  expect(await sessions.count()).toBe(0);
  const restored = await importBackup(backup);
  expect(restored).not.toBe('one');
  expect(await sessions.where('profileId').equals(restored).count()).toBe(1);
  expect((await profiles.get(restored))?.name).toBe('Same name');
});

it('rejects stale selection, changed names and active editing without deleting records', async () => {
  await expect(deleteLocalProfile('two', 'Same name')).rejects.toThrow('SYNC_SCOPE_CHANGED');
  await expect(deleteLocalProfile('one', 'Old name')).rejects.toThrow('SYNC_SCOPE_CHANGED');
  const session = await createSession(raw, 'one');
  await claimSession(session.id, 'editor');
  await expect(deleteLocalProfile('one', 'Same name')).rejects.toThrow('BUSY');
  await releaseSession(session.id, 'editor');
  await settings.put({ key: 'profile:one:syncLease', value: JSON.stringify({ expiresAt: Date.now() + 60000 }) });
  await expect(deleteLocalProfile('one', 'Same name')).rejects.toThrow('BUSY');
  await settings.delete('profile:one:syncLease');
  expect(await profiles.count()).toBe(2);
  expect(await sessions.get(session.id)).toBeDefined();
});

it('can delete an abandoned staged installation without late completion recreating its association', async () => {
  await db.table('communityPacks').put({ profileId: 'one', hash: 'pending', state: 'staged' });
  expect(await deleteLocalProfile('one', 'Same name')).toBe('two');
  expect(await db.table('communityPacks').update(['one', 'pending'], { state: 'ready' })).toBe(0);
  expect(await db.table('communityPacks').where('profileId').equals('one').count()).toBe(0);
});

it('rolls back all deletion and active-profile changes after a storage failure', async () => {
  await createSession(raw, 'one');
  const before = await Promise.all(db.tables.map(table => table.toArray()));
  const fail = () => { throw new Error('disk failed'); };
  profiles.hook('deleting', fail);
  try { await expect(deleteLocalProfile('one', 'Same name')).rejects.toThrow('disk failed'); }
  finally { profiles.hook('deleting').unsubscribe(fail); }
  expect(await Promise.all(db.tables.map(table => table.toArray()))).toEqual(before);
});

it('blocks delayed session, bookmark, bootstrap and remote batch writes after deletion', async () => {
  await saveSense('one', 'word', 'word', 'definition');
  const batch = (await pendingSyncBatch('one'))!;
  await deleteLocalProfile('one', 'Same name');
  await expect(createSession(raw, 'one')).rejects.toThrow('PROFILE_DELETED');
  await expect(saveSense('one', 'other', 'other', 'definition')).rejects.toThrow('PROFILE_DELETED');
  await expect(bootstrapSyncEvents('one')).rejects.toThrow('PROFILE_DELETED');
  await expect(appendSyncEvent('one', { type: 'setting', payload: { key: 'theme', value: 'dark' } })).rejects.toThrow('PROFILE_DELETED');
  await expect(receiveSyncBatch('one', batch.batch, batch.hash)).rejects.toThrow('PROFILE_DELETED');
  expect(await sessions.count()).toBe(0); expect(await attempts.count()).toBe(0);
  expect(await db.table('memories').count()).toBe(0); expect(await db.table('syncEvents').count()).toBe(0);
});
