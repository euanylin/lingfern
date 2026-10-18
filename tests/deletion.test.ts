import { beforeEach, expect, it } from 'vitest';
import raw from './fixtures/content/a1-reading.json';
import { advance, attempts, claimSession, createSession, db, exposures, feedbackNotes, markExposure, saveReadingAnnotation, sessions, settings, submit } from '../src/data/db';
import { deleteLearningRecord, purgeDeletedRecords } from '../src/data/deletion';
import { appendSyncEvent, pendingSyncBatch, readSyncEvents, receiveSyncBatch } from '../src/data/sync';
import { projectSyncEvents, validateSyncBatch } from '../src/shared/sync';
import { exportBackup, inspectBackup } from '../src/data/backup';
import { bootstrapSyncEvents } from '../src/data/db';

beforeEach(async () => { await Promise.all(db.tables.map(table => table.clear())); });
async function completed() {
  const session = await createSession(raw, 'p'); await claimSession(session.id, 'owner'); await markExposure(session);
  for (const answer of [1, 2, 1]) { await submit(session.id, 'owner', answer); await advance(session.id, 'owner'); }
  await submit(session.id, 'owner', 2);
  const record = (await attempts.where('sessionId').equals(session.id).toArray()).find(item => item.questionId === session.lesson.materials[0].questions[0].id)!;
  await feedbackNotes.put({ id: 'note', profileId: 'p', attemptId: record.id, kind: 'text', content: 'private feedback', unknownReferences: false, createdAt: new Date().toISOString() });
  return { session, record };
}

it('deletes private answer/feedback atomically, keeps exposure and immutable batches, and prevents old replay', async () => {
  const { session, record } = await completed();
  await saveReadingAnnotation(session.id, 'owner', { materialId: session.lesson.materials[0].id, note: 'private reading note', highlights: [] });
  const sealed = (await pendingSyncBatch('p'))!;
  await deleteLearningRecord('p', record.id);
  expect(await attempts.get(record.id)).toBeUndefined(); expect(await feedbackNotes.get('note')).toBeUndefined();
  expect(await exposures.count()).toBe(1); expect(await attempts.count()).toBe(3);
  expect((await sessions.get(session.id))?.draft).toBeUndefined();
  expect((await sessions.get(session.id))?.readingAnnotations).toBeUndefined();
  expect((await sessions.get(session.id))?.recordsDeleted).toBe(true);
  expect(await db.table('syncBatches').get(['p', sealed.deviceId, sealed.batchId])).toEqual(sealed);
  await receiveSyncBatch('p', sealed.batch, sealed.hash);
  expect(projectSyncEvents(await readSyncEvents('p')).completions.some(event => event.payload.recordId === record.id)).toBe(false);
  await deleteLearningRecord('p', record.id);
  expect((await readSyncEvents('p')).filter(event => event.type === 'deletion')).toHaveLength(1);
  await claimSession(session.id, 'other');
  await expect(submit(session.id, 'other', 2)).rejects.toThrow('RECORD_DELETED');
});

it('failed deletion rolls back the marker and private text; active or foreign profiles cannot be deleted', async () => {
  const { record } = await completed();
  const fail = () => { throw new Error('STORAGE_FAILURE'); };
  db.table('feedbackNotes').hook('deleting', fail);
  try { await expect(deleteLearningRecord('p', record.id)).rejects.toThrow('STORAGE_FAILURE'); }
  finally { db.table('feedbackNotes').hook('deleting').unsubscribe(fail); }
  expect(await attempts.get(record.id)).toEqual(record); expect(await feedbackNotes.get('note')).toBeDefined();
  expect((await readSyncEvents('p')).some(event => event.type === 'deletion')).toBe(false);
  await settings.put({ key: 'activeProfile', value: 'other' });
  await expect(deleteLearningRecord('p', record.id)).rejects.toThrow('SYNC_SCOPE_CHANGED');
  await settings.delete('activeProfile');
  const active = await createSession(raw, 'p'); await claimSession(active.id, 'reader');
  const answer = await submit(active.id, 'reader', 1);
  await expect(deleteLearningRecord('p', answer.id)).rejects.toThrow('BUSY');
});

it('incoming tombstones erase restored private answers and keep unrelated profiles intact', async () => {
  const { record } = await completed();
  await attempts.put({ ...record, id: 'foreign', profileId: 'other' });
  const event = { id: 'remote-delete', deviceId: 'remote', counter: 50, occurredAt: '2026-09-30T00:00:00.000Z', type: 'deletion', payload: { target: 'record', targetId: record.id } };
  const batch = await validateSyncBatch({ product: 'Lingfern', formatVersion: 1, profileId: 'p', deviceId: 'remote', batchId: 'remote-batch', events: [event] });
  await receiveSyncBatch('p', batch.batch, batch.hash);
  const backup = await inspectBackup(await exportBackup('p'));
  expect(backup.records.attempts.some(item => item.id === record.id)).toBe(false);
  expect(backup.records.feedbackNotes).toEqual([]);
  await purgeDeletedRecords('p');
  expect(await attempts.get(record.id)).toBeUndefined(); expect(await feedbackNotes.count()).toBe(0);
  expect(await attempts.get('foreign')).toBeDefined();
  await expect(deleteLearningRecord('other', record.id)).rejects.toThrow('NOT_FOUND');
  await appendSyncEvent('p', { type: 'deletion', payload: { target: 'record', targetId: 'unknown-summary' } });
  await purgeDeletedRecords('p'); expect(await attempts.count()).toBe(4);
});

it('optional contact removal defeats old replay and bootstrap while allowing a genuine new session', async () => {
  const { session, record } = await completed();
  const sealed = (await pendingSyncBatch('p'))!;
  await deleteLearningRecord('p', record.id, true);
  expect(await exposures.get(['p', record.rootId])).toBeUndefined();
  await receiveSyncBatch('p', sealed.batch, sealed.hash);
  await bootstrapSyncEvents('p');
  const effective = projectSyncEvents(await readSyncEvents('p'));
  expect(effective.exposures.some(event => event.payload.sessionId === session.id && event.payload.questionId === record.questionId)).toBe(false);
  expect(effective.exposures.length).toBeGreaterThan(0);
  await deleteLearningRecord('p', record.id, true);
  expect((await readSyncEvents('p')).filter(event => event.type === 'deletion')).toHaveLength(2);
  const fresh = await createSession(raw, 'p'); await markExposure(fresh);
  await purgeDeletedRecords('p');
  expect((await exposures.get(['p', record.rootId]))?.contacts?.[0].sessionId).toBe(fresh.id);
  expect(projectSyncEvents(await readSyncEvents('p')).exposures.some(event => event.payload.sessionId === fresh.id)).toBe(true);
  expect((await inspectBackup(await exportBackup('p'))).records.exposures[0].contacts?.[0].sessionId).toBe(fresh.id);
});

it('contact purge failure rolls back answer deletion and both tombstones', async () => {
  const { record } = await completed();
  const fail = () => { throw new Error('EXPOSURE_FAILURE'); };
  db.table('exposures').hook('deleting', fail);
  try { await expect(deleteLearningRecord('p', record.id, true)).rejects.toThrow('EXPOSURE_FAILURE'); }
  finally { db.table('exposures').hook('deleting').unsubscribe(fail); }
  expect(await attempts.get(record.id)).toEqual(record);
  expect(await feedbackNotes.get('note')).toBeDefined(); expect(await exposures.count()).toBe(1);
  expect((await readSyncEvents('p')).some(event => event.type === 'deletion')).toBe(false);
});

it('contact removal preserves sibling contacts and recomputes their exposure time range', async () => {
  const { session, record } = await completed();
  const exposure = (await exposures.get(['p', record.rootId]))!;
  const contact = exposure.contacts![0];
  const time = new Date(Date.parse(contact.lastSeenAt) + 1000).toISOString();
  const sibling = { ...contact, questionId: session.lesson.materials[0].questions[1].id, variantGroup: session.lesson.materials[0].questions[1].id, firstSeenAt: time, lastSeenAt: time };
  await exposures.put({ ...exposure, lastSeenAt: time, contacts: [contact, sibling] });
  await deleteLearningRecord('p', record.id, true);
  expect(await exposures.get(['p', record.rootId])).toEqual({ ...exposure, firstSeenAt: time, lastSeenAt: time, contacts: [sibling] });
});
