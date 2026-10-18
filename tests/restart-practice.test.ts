import { beforeEach, expect, it } from 'vitest';
import reading from './fixtures/content/a1-reading.json';
import listening from './fixtures/content/a1-listening.json';
import check from './fixtures/content/a1-check-reading.json';
import { advance, attempts, claimSession, createCombinedPractice, createSession, db, exposures, feedbackNotes, markExposure, releaseSession, saveDraft, sessions, settings, submit } from '../src/data/db';
import { restartPractice } from '../src/data/deletion';
import { exportBackup, importBackup, inspectBackup } from '../src/data/backup';
import { pendingSyncBatch, readSyncEvents, receiveSyncBatch } from '../src/data/sync';
import { asTestLesson, lessonSchema } from '../src/shared/content';
import { projectSyncEvents } from '../src/shared/sync';

beforeEach(async () => { await Promise.all(db.tables.map(table => table.clear())); });
async function finishReading(id: string) {
  await claimSession(id, 'reader');
  for (const [index, answer] of [1, 2, 1, 2].entries()) {
    if (index) await advance(id, 'reader');
    await submit(id, 'reader', answer);
  }
  await releaseSession(id, 'reader');
}
async function partial(id: string) {
  const session = await claimSession(id, 'reader');
  await markExposure(session);
  if (session.lesson.skill === 'listening') await sessions.update(id, { assistance: { ...session.assistance, audioCompleted: true } });
  const answer = await submit(id, 'reader', 1);
  await advance(id, 'reader'); await saveDraft(id, 'reader', 2);
  await feedbackNotes.put({ id: crypto.randomUUID(), profileId: session.profileId, attemptId: answer.id, kind: 'text', content: 'private text', unknownReferences: false, createdAt: new Date().toISOString() });
  await releaseSession(id, 'reader');
  return answer;
}

it('clears active answers, draft and feedback; preserves sibling exposure and permits a fresh same snapshot', async () => {
  const current = await createSession(reading, 'p'), sibling = await createSession(reading, 'p');
  await partial(current.id); await markExposure(sibling);
  const before = await sessions.get(sibling.id);
  await restartPractice('p', current.id);
  expect(await sessions.get(current.id)).toBeUndefined();
  expect(await attempts.where('sessionId').equals(current.id).count()).toBe(0);
  expect(await feedbackNotes.count()).toBe(0);
  expect(await sessions.get(sibling.id)).toEqual(before);
  expect((await exposures.toArray()).flatMap(x => x.contacts ?? []).every(c => c.sessionId === sibling.id)).toBe(true);
  await expect(submit(current.id, 'reader', 1)).rejects.toThrow('NOT_FOUND');
  await expect(claimSession(current.id, 'reader')).rejects.toThrow('NOT_FOUND');
  const fresh = await createSession(reading, 'p');
  expect(fresh.contentHash).toBe(current.contentHash); expect(fresh.lesson).toEqual(current.lesson);
  expect(fresh.position).toBe(0); expect(fresh.draft).toBeUndefined();
});

it('clears both current combined parts including completed reading and defeats sealed old replay and restored records', async () => {
  const pair = await createCombinedPractice(reading, listening, 'p');
  await finishReading(pair[0].id); await partial(pair[1].id);
  const other = await createCombinedPractice(reading, listening, 'p');
  const otherBefore = await Promise.all(other.map(s => sessions.get(s.id)));
  const sealed = (await pendingSyncBatch('p'))!;
  await restartPractice('p', pair[1].id);
  expect(await sessions.where('profileId').equals('p').count()).toBe(2);
  expect(await attempts.count()).toBe(0); expect(await feedbackNotes.count()).toBe(0);
  expect(await Promise.all(other.map(s => sessions.get(s.id)))).toEqual(otherBefore);
  expect(await db.table('syncBatches').get(['p', sealed.deviceId, sealed.batchId])).toEqual(sealed);
  await receiveSyncBatch('p', sealed.batch, sealed.hash);
  const projected = projectSyncEvents(await readSyncEvents('p'));
  expect(projected.completions).toEqual([]);
  expect(projected.exposures).toEqual([]);
  const inspection = await inspectBackup(await exportBackup('p'));
  expect(inspection.records.sessions.map(s => s.id).sort()).toEqual(other.map(s => s.id).sort());
  expect(inspection.records.attempts).toEqual([]); expect(inspection.records.feedbackNotes).toEqual([]);
  const restored = await importBackup(inspection);
  expect(await sessions.where('profileId').equals(restored).count()).toBe(2);
  expect(await attempts.where('profileId').equals(restored).count()).toBe(0);
  expect(projectSyncEvents(await readSyncEvents(restored)).completions).toEqual([]);
});

it('rolls back both snapshots, private answers, feedback, exposure and tombstones if pair deletion fails', async () => {
  const pair = await createCombinedPractice(reading, listening, 'p');
  await finishReading(pair[0].id); await partial(pair[1].id);
  const tables = [sessions, attempts, feedbackNotes, exposures, db.table('syncEvents'), db.table('syncClocks')];
  const before = await Promise.all(tables.map(t => t.toArray()));
  const fail = (key: string) => { if (key === pair[1].id) throw new Error('DISK_FAILED'); };
  sessions.hook('deleting', fail);
  try { await expect(restartPractice('p', pair[1].id)).rejects.toThrow('DISK_FAILED'); }
  finally { sessions.hook('deleting').unsubscribe(fail); }
  expect(await Promise.all(tables.map(t => t.toArray()))).toEqual(before);
});

it('rejects foreign profiles, checks, completed ordinary sessions and live tabs without changing progress', async () => {
  const current = await createSession(reading, 'p'); await partial(current.id);
  await expect(restartPractice('other', current.id)).rejects.toThrow('NOT_FOUND');
  await settings.put({ key: 'activeProfile', value: 'other' });
  await expect(restartPractice('p', current.id)).rejects.toThrow('SYNC_SCOPE_CHANGED');
  await settings.delete('activeProfile');
  await claimSession(current.id, 'other-tab');
  await expect(restartPractice('p', current.id)).rejects.toThrow('BUSY');
  await releaseSession(current.id, 'other-tab');
  const independent = await createSession(check, 'p');
  await expect(restartPractice('p', independent.id)).rejects.toThrow('PRACTICE_RESTRICTED');
  const completed = await createSession(reading, 'p'); await finishReading(completed.id);
  await expect(restartPractice('p', completed.id)).rejects.toThrow('PRACTICE_RESTRICTED');
  expect(await attempts.where('sessionId').equals(current.id).count()).toBe(1);
  expect((await readSyncEvents('p')).some(e => e.type === 'deletion')).toBe(false);
});

it('rejects malformed or cross-profile pairs and restarts generated Test without altering other snapshots', async () => {
  const pair = await createCombinedPractice(asTestLesson(lessonSchema.parse(reading)), asTestLesson(lessonSchema.parse(listening)), 'p');
  await sessions.update(pair[1].id, { profileId: 'other' });
  await expect(restartPractice('p', pair[0].id)).rejects.toThrow('PRACTICE_RESTRICTED');
  await sessions.update(pair[1].id, { profileId: 'p' });
  await restartPractice('p', pair[0].id);
  expect(await sessions.count()).toBe(0);
  const generated = { ...reading, reviewStatus: 'draft', generation: { generator: 'corpus-v1', seed: 0, startingPoint: 'A1' } };
  const current = await createSession(generated, 'p');
  await restartPractice('p', current.id);
  const fresh = await createSession(generated, 'p');
  expect(fresh.lesson).toEqual(current.lesson); expect(fresh.contentHash).toEqual(current.contentHash);
  expect(fresh.itemHashes).toEqual(current.itemHashes);
});

it('uses original sync identities when restarting a restored active combined pair', async () => {
  const pair = await createCombinedPractice(reading, listening, 'p');
  await finishReading(pair[0].id); await partial(pair[1].id);
  const originals = await Promise.all(pair.map(s => sessions.get(s.id)));
  const restoredProfile = await importBackup(await inspectBackup(await exportBackup('p')));
  const restored = await sessions.where('profileId').equals(restoredProfile).toArray();
  const active = restored.find(s => s.lesson.skill === 'listening')!;
  expect(active.id).not.toBe(pair[1].id); expect(active.syncSessionId).toBe(pair[1].id);
  await restartPractice(restoredProfile, active.id);
  expect(await sessions.where('profileId').equals(restoredProfile).count()).toBe(0);
  expect(await attempts.where('profileId').equals(restoredProfile).count()).toBe(0);
  expect(await exposures.where('profileId').equals(restoredProfile).count()).toBe(0);
  const projected = projectSyncEvents(await readSyncEvents(restoredProfile));
  expect(projected.completions).toEqual([]); expect(projected.exposures).toEqual([]);
  expect(await Promise.all(pair.map(s => sessions.get(s.id)))).toEqual(originals);
  const reexported = await inspectBackup(await exportBackup(restoredProfile));
  expect(reexported.records.sessions).toEqual([]); expect(reexported.records.attempts).toEqual([]);
});
