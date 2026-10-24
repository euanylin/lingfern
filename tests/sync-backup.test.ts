import { beforeEach, expect, it } from 'vitest';
import { db, profiles } from '../src/data/db';
import { saveSense, removeSense } from '../src/data/memory';
import { exportBackup, inspectBackup, importBackup } from '../src/data/backup';
import { appendSyncEvent, confirmSyncUpload, nextSyncUpload, pendingSyncBatch, confirmSyncBatch, readSyncEvents } from '../src/data/sync';

beforeEach(async () => { await Promise.all(db.tables.map(table => table.clear())); });

it('restores fixed pending batch identity/hash and event IDs into a separate local profile with a new device', async () => {
  await profiles.add({ id: 'p', name: 'Local', createdAt: new Date().toISOString() });
  await saveSense('p', 'sense', 'word', 'definition');
  const pending = (await pendingSyncBatch('p'))!;
  const restored = await importBackup(await inspectBackup(await exportBackup('p')));
  expect(restored).not.toBe('p');
  expect(await readSyncEvents(restored)).toEqual(await readSyncEvents('p'));
  const retry = (await pendingSyncBatch(restored))!;
  expect(retry.batch).toEqual(pending.batch);
  expect(retry.hash).toBe(pending.hash);
  await confirmSyncBatch(restored, retry.deviceId, retry.batchId, retry.hash);
  const event = await appendSyncEvent(restored, { type: 'saved_item', payload: { memoryId: 'sense', saved: false } });
  expect(event.deviceId).not.toBe(pending.deviceId);
  expect(event.counter).toBe(2);
  expect((await pendingSyncBatch(restored))?.batch.profileId).toBe('p');
  expect((await readSyncEvents('p'))).toHaveLength(1);
});

it('can seal inherited unbatched events without changing their original device or event IDs', async () => {
  await saveSense('p', 'sense', 'word', 'definition');
  const original = await readSyncEvents('p');
  const restored = await importBackup(await inspectBackup(await exportBackup('p')));
  await removeSense(restored, 'sense');
  const inherited = (await pendingSyncBatch(restored))!;
  expect(inherited.batch.events).toEqual(original);
  expect(inherited.deviceId).toBe(original[0].deviceId);
  await confirmSyncBatch(restored, inherited.deviceId, inherited.batchId, inherited.hash);
  const next = (await pendingSyncBatch(restored))!;
  expect(next.deviceId).not.toBe(inherited.deviceId);
  expect(next.batch.events).toHaveLength(1);
});

it('keeps canonical task identity when an interrupted local session is restored twice', async () => {
  const { createSession, sessions } = await import('../src/data/db');
  const { default: raw } = await import('./fixtures/content/a1-reading.json');
  const original = await createSession(raw, 'p');
  const first = await importBackup(await inspectBackup(await exportBackup('p')));
  const second = await importBackup(await inspectBackup(await exportBackup(first)));
  const restored = await sessions.where('profileId').equals(second).first();
  expect(restored?.id).not.toBe(original.id);
  expect(restored?.syncSessionId).toBe(original.id);
  expect((await db.table('syncClocks').get(second)).logicalProfileId).toBe('p');
});

it('rejects a batch hash mismatch even after the enclosing ZIP manifest is rehashed', async () => {
  const { unzipSync, zipSync } = await import('fflate');
  await saveSense('p', 'sense', 'word', 'definition');
  await pendingSyncBatch('p');
  const files = unzipSync(await exportBackup('p'));
  const decoder = new TextDecoder(), encoder = new TextEncoder();
  const batches = JSON.parse(decoder.decode(files['syncBatches.json']));
  batches[0].hash = 'a'.repeat(64);
  files['syncBatches.json'] = encoder.encode(JSON.stringify(batches));
  const manifest = JSON.parse(decoder.decode(files['manifest.json']));
  manifest.files['syncBatches.json'].bytes = files['syncBatches.json'].length;
  manifest.files['syncBatches.json'].sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', files['syncBatches.json'])), byte => byte.toString(16).padStart(2, '0')).join('');
  files['manifest.json'] = encoder.encode(JSON.stringify(manifest));
  await expect(inspectBackup(zipSync(files))).rejects.toThrow('BACKUP_INTEGRITY');
});

it('rolls back restored records/profile when sync event restoration fails', async () => {
  await saveSense('p', 'sense', 'word', 'definition');
  const inspection = await inspectBackup(await exportBackup('p'));
  const fail = () => { throw new Error('STORAGE_FAILURE'); };
  db.table('syncEvents').hook('creating', fail);
  try {
    await expect(importBackup(inspection)).rejects.toThrow('STORAGE_FAILURE');
    expect(await profiles.count()).toBe(0);
    expect(await db.table('memories').count()).toBe(1);
    expect(await readSyncEvents('p')).toHaveLength(1);
  } finally { db.table('syncEvents').hook('creating').unsubscribe(fail); }
});

it('does not transfer account-bound download cursors or immutable-file receipts through learner backups', async () => {
  await profiles.add({ id: 'p', name: 'Local', createdAt: new Date().toISOString() });
  await saveSense('p', 'sense', 'word', 'definition');
  const pending = (await pendingSyncBatch('p'))!;
  const scope = { profileId: 'p', accountId: 1, bindingVersion: 'a'.repeat(43) };
  await db.table('syncDownloads').put({ ...scope, commit: 'b'.repeat(40), cursor: 'private-cursor', nextCursor: 'private-next' });
  await db.table('syncReceipts').put({ ...scope, deviceId: pending.deviceId, batchId: pending.batchId, hash: pending.hash, blobSha: 'c'.repeat(40) });
  const restored = await importBackup(await inspectBackup(await exportBackup('p')));
  expect(await readSyncEvents(restored)).toEqual(await readSyncEvents('p'));
  expect(await db.table('syncDownloads').where('profileId').equals(restored).count()).toBe(0);
  expect(await db.table('syncReceipts').where('profileId').equals(restored).count()).toBe(0);
  expect(await db.table('syncDownloads').where('profileId').equals('p').count()).toBe(1);
  expect(await db.table('syncReceipts').where('profileId').equals('p').count()).toBe(1);
});


it('does not inherit upload receipts when restoring a confirmed batch on a new device', async () => {
  await profiles.add({ id: 'p', name: 'Local', createdAt: new Date().toISOString() });
  await saveSense('p', 'sense', 'word', 'definition');
  const scope = { accountId: 1, profileId: 'p', bindingVersion: 'a'.repeat(43) };
  const stored = (await nextSyncUpload('p', scope))!;
  await confirmSyncUpload('p', { scope, deviceId: stored.deviceId, batchId: stored.batchId, hash: stored.hash }, { scope, batchId: stored.batchId, hash: stored.hash, previouslyWritten: false });
  expect(await nextSyncUpload('p', scope)).toBeUndefined();
  const restored = await importBackup(await inspectBackup(await exportBackup('p')));
  expect(await db.table('syncUploads').where('profileId').equals(restored).count()).toBe(0);
  expect((await nextSyncUpload(restored, scope))?.batch).toEqual(stored.batch);
  expect(await nextSyncUpload('p', scope)).toBeUndefined();
});
