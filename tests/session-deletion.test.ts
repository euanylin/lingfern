import { beforeEach, expect, it } from 'vitest';
import reading from './fixtures/content/a1-reading.json';
import listening from './fixtures/content/a1-listening.json';
import check from './fixtures/content/a1-check-reading.json';
import { advance, attempts, claimSession, createCombinedPractice, createSession, db, exposures, feedbackNotes, markExposure, releaseSession, saveDraft, sessions, settings, submit } from '../src/data/db';
import { deleteLearningSession, purgeDeletedRecords } from '../src/data/deletion';
import { exportBackup, importBackup, inspectBackup } from '../src/data/backup';
import { pendingSyncBatch, readSyncEvents, receiveSyncBatch } from '../src/data/sync';
import { projectSyncEvents, validateSyncBatch } from '../src/shared/sync';

beforeEach(async () => { await Promise.all(db.tables.map(table => table.clear())); });
async function saved() {
  const session = await createSession(reading, 'p');
  await claimSession(session.id, 'reader'); await markExposure(session);
  const record = await submit(session.id, 'reader', 1);
  await feedbackNotes.put({ id: crypto.randomUUID(), profileId: 'p', attemptId: record.id, kind: 'text', content: 'Synthetic private feedback', unknownReferences: false, createdAt: new Date().toISOString() });
  await releaseSession(session.id, 'reader');
  return session;
}

it.each(['active', 'completed', 'ended'] as const)('deletes a %s session atomically, retaining exposure and preventing replay', async status => {
  const current = await saved();
  if (status === 'completed') {
    await claimSession(current.id, 'reader');
    for (const answer of [2, 1, 2]) { await advance(current.id, 'reader'); await submit(current.id, 'reader', answer); }
    await releaseSession(current.id, 'reader');
  }
  await sessions.update(current.id, { status });
  const other = await createSession(reading, 'other');
  const sealed = (await pendingSyncBatch('p'))!, contacts = await exposures.toArray();
  if (status === 'completed') expect(sealed.batch.events.some(event => event.type === 'completion')).toBe(true);
  await deleteLearningSession('p', current.id);
  expect(await sessions.get(current.id)).toBeUndefined();
  expect(await attempts.count()).toBe(0); expect(await feedbackNotes.count()).toBe(0);
  expect(await exposures.toArray()).toEqual(contacts.map(exposure => ({ ...exposure, contacts: [] }))); expect(await sessions.get(other.id)).toEqual(other);
  expect(await db.table('syncBatches').get(['p', sealed.deviceId, sealed.batchId])).toEqual(sealed);
  await receiveSyncBatch('p', sealed.batch, sealed.hash);
  expect(projectSyncEvents(await readSyncEvents('p')).completions).toEqual([]);
  const backup = await inspectBackup(await exportBackup('p'));
  expect(backup.records.sessions).toEqual([]); expect(backup.records.attempts).toEqual([]); expect(backup.records.feedbackNotes).toEqual([]);
  const restored = await importBackup(backup);
  expect((await exposures.where('profileId').equals(restored).toArray()).map(exposure => exposure.rootId)).toEqual(contacts.map(exposure => exposure.rootId));
});

it('deletes both combined parts, including an unanswered draft, and leaves another pair intact', async () => {
  const pair = await createCombinedPractice(reading, listening, 'p');
  const other = await createCombinedPractice(reading, listening, 'p');
  await claimSession(pair[0].id, 'reader'); await saveDraft(pair[0].id, 'reader', 1); await releaseSession(pair[0].id, 'reader');
  await sessions.update(pair[0].id, { status: 'completed' });
  await deleteLearningSession('p', pair[1].id);
  expect((await sessions.toArray()).map(session => session.id).sort()).toEqual(other.map(session => session.id).sort());
  await expect(claimSession(pair[0].id, 'reader')).rejects.toThrow('NOT_FOUND');
});

it('keeps profile and live-editor guards and rolls back all changes on storage failure', async () => {
  const current = await saved();
  await expect(deleteLearningSession('other', current.id)).rejects.toThrow('NOT_FOUND');
  await settings.put({ key: 'activeProfile', value: 'other' });
  await expect(deleteLearningSession('p', current.id)).rejects.toThrow('SYNC_SCOPE_CHANGED');
  await settings.delete('activeProfile'); await claimSession(current.id, 'other-tab');
  await expect(deleteLearningSession('p', current.id)).rejects.toThrow('BUSY');
  await releaseSession(current.id, 'other-tab');
  const before = await Promise.all(db.tables.map(table => table.toArray()));
  const fail = () => { throw new Error('DISK_FAILED'); };
  sessions.hook('deleting', fail);
  try { await expect(deleteLearningSession('p', current.id)).rejects.toThrow('DISK_FAILED'); }
  finally { sessions.hook('deleting').unsubscribe(fail); }
  expect(await Promise.all(db.tables.map(table => table.toArray()))).toEqual(before);
});

it('uses original identities after backup restore and removes unowned strict-check groups', async () => {
  const current = await saved();
  const restored = await importBackup(await inspectBackup(await exportBackup('p')));
  const copy = (await sessions.where('profileId').equals(restored).toArray())[0];
  await deleteLearningSession(restored, copy.id);
  expect(await sessions.get(current.id)).toBeDefined();
  expect(projectSyncEvents(await readSyncEvents(restored)).completions).toEqual([]);
  const strict = await createSession(check, restored), sibling = await createSession(check, restored);
  await sessions.update(strict.id, { checkGroupId: 'synthetic-group' });
  await sessions.update(sibling.id, { checkGroupId: 'synthetic-group' });
  await deleteLearningSession(restored, strict.id);
  expect(await sessions.where('profileId').equals(restored).count()).toBe(0);
});

it('incoming deletion removes a restored snapshot without reviving it from an old device', async () => {
  const current = await saved();
  const restored = await importBackup(await inspectBackup(await exportBackup('p')));
  const copy = (await sessions.where('profileId').equals(restored).toArray())[0];
  await settings.put({ key: 'activeProfile', value: 'p' });
  await deleteLearningSession('p', current.id);
  const events = (await readSyncEvents('p')).filter(event => event.type === 'deletion');
  const batch = await validateSyncBatch({ product: 'Lingfern', formatVersion: 1, profileId: 'p', deviceId: events[0].deviceId, batchId: crypto.randomUUID(), events });
  await receiveSyncBatch(restored, batch.batch, batch.hash); await purgeDeletedRecords(restored);
  expect(await sessions.get(copy.id)).toBeUndefined();
  expect(await attempts.where('profileId').equals(restored).count()).toBe(0);
  expect((await inspectBackup(await exportBackup(restored))).records.sessions).toEqual([]);
});
