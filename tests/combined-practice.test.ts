import { readSourcePackFixture } from './fixtures/source-pack-regression';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { unzipSync, zipSync } from 'fflate';
import reading from './fixtures/content/a1-reading.json';
import listening from './fixtures/content/a1-listening.json';
import check from './fixtures/content/a1-check-reading.json';
import listeningChecks from './fixtures/retired-content/voa-listening-checks.json';
import { advance, attempts, beginCheck, claimSession, createCombinedCheck, createCombinedPractice, createSession, db, releaseSession, revealHint, saveDraft, sessions, settings, submit } from '../src/data/db';
import { exportBackup, importBackup, inspectBackup } from '../src/data/backup';
import { deleteLearningRecord } from '../src/data/deletion';
import { inspectCommunityPack } from '../src/data/communityPack';
import { spokenCorpusLesson } from '../src/core/spokenCorpus';
import { spokenConditionPrompt } from '../src/core/spokenCondition';

beforeEach(async () => { await Promise.all(db.tables.map(table => table.clear())); });
afterEach(() => vi.unstubAllGlobals());

it('creates reading then listening as ordinary practice and rejects checks or wrong skill order', async () => {
  for (const pair of [[listening, reading], [reading, reading], [check, listening]]) {
    await expect(createCombinedPractice(pair[0], pair[1])).rejects.toThrow('PRACTICE_RESTRICTED');
    expect(await sessions.count()).toBe(0);
  }
  const pair = await createCombinedPractice(reading, listening, 'learner');
  expect(pair.map(session => session.lesson.skill)).toEqual(['reading', 'listening']);
  expect(pair[0].practiceGroupId).toMatch(/^[a-f0-9-]{36}$/);
  expect(pair[1].practiceGroupId).toBe(pair[0].practiceGroupId);
  expect(pair.every(session => session.profileId === 'learner' && session.status === 'active' && session.assistance.teachingProvided)).toBe(true);
  expect(pair.every(session => !session.checkGroupId && !session.checkDeviceId && !session.checkStartedAt)).toBe(true);
  expect(await settings.get('check-device-id')).toBeUndefined();
  await claimSession(pair[0].id, 'reader', Date.now(), 'learner');
  await expect(beginCheck(pair[0].id, 'reader')).rejects.toThrow('CHECK_RESTRICTED');
  await expect(revealHint(pair[0].id, 'reader')).resolves.toBeDefined();
});

it('rolls back both snapshots on a second write failure and keeps generated instance deduplication', async () => {
  const fail = (_key: unknown, value: { lesson: { skill: string } }) => { if (value.lesson.skill === 'listening') throw new Error('disk failed'); };
  sessions.hook('creating', fail);
  try { await expect(createCombinedPractice(reading, listening)).rejects.toThrow('disk failed'); }
  finally { sessions.hook('creating').unsubscribe(fail); }
  expect(await sessions.count()).toBe(0);
  const generated = { ...reading, reviewStatus: 'draft', generation: { generator: 'corpus-v1', seed: 0, startingPoint: 'A1' } };
  const results = await Promise.allSettled([createCombinedPractice(generated, listening), createCombinedPractice(generated, listening)]);
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  expect(results.filter(result => result.status === 'rejected').map(result => result.reason.message)).toEqual(['VARIANT_ALREADY_SAVED']);
  expect(await sessions.count()).toBe(2);
  await expect(createSession(generated)).rejects.toThrow('VARIANT_ALREADY_SAVED');
});

it('retains ordinary-practice shared-root rules but fails closed for unavailable media', async () => {
  const shared = { ...listening, materials: listening.materials.map((material, index) => ({ ...material, ...(index === 0 ? { rootId: reading.materials[0].rootId } : {}) })) };
  await expect(createCombinedPractice(reading, shared)).resolves.toHaveLength(2);
  const primary = await inspectCommunityPack(readSourcePackFixture('wikipedia-listening-010'));
  const application = await inspectCommunityPack(readSourcePackFixture('wikipedia-listening-005'));
  const unavailable = spokenCorpusLesson(primary.spoken!, new Set(), 0, 91, 'C2', [], 'evidence', `evidence:${spokenConditionPrompt}`, [application.spoken!])!;
  vi.stubGlobal('window', {});
  await expect(createCombinedPractice(reading, unavailable, 'other')).rejects.toThrow('MISSING_MEDIA');
  expect(await sessions.where('profileId').equals('other').count()).toBe(0);
});

it('restores both skills, draft and saved answers together without check-device restrictions', async () => {
  const pair = await createCombinedPractice(reading, listening);
  await claimSession(pair[0].id, 'reader');
  await submit(pair[0].id, 'reader', 1); await advance(pair[0].id, 'reader');
  await saveDraft(pair[0].id, 'reader', 2); await releaseSession(pair[0].id, 'reader');
  const inspection = await inspectBackup(await exportBackup('local-guest'));
  await settings.put({ key: 'check-device-id', value: crypto.randomUUID() });
  for (let index = 0; index < 2; index++) {
    const profileId = await importBackup(inspection);
    const restored = await sessions.where('profileId').equals(profileId).toArray();
    expect(restored).toHaveLength(2);
    expect(restored.every(session => session.practiceGroupId === pair[0].practiceGroupId && !session.checkGroupId)).toBe(true);
    const first = restored.find(session => session.lesson.skill === 'reading')!;
    const second = restored.find(session => session.lesson.skill === 'listening')!;
    expect(first).toMatchObject({ position: 1, draft: 2, status: 'active', leaseUntil: 0 });
    expect(second).toMatchObject({ position: 0, status: 'active', leaseUntil: 0 });
    expect(first.id).not.toBe(pair[0].id); expect(second.id).not.toBe(pair[1].id);
    expect(await attempts.where('profileId').equals(profileId).count()).toBe(1);
    await expect(claimSession(first.id, 'restored', Date.now(), profileId)).resolves.toBeDefined();
    await expect(claimSession(first.id, 'foreign', Date.now(), 'wrong-profile')).rejects.toThrow('NOT_FOUND');
    await expect(inspectBackup(await exportBackup(profileId))).resolves.toBeDefined();
  }
});

it('preserves group association when a saved answer is deleted', async () => {
  const pair = await createCombinedPractice(reading, listening);
  await claimSession(pair[0].id, 'reader'); const saved = await submit(pair[0].id, 'reader', 1);
  for (const answer of [2, 1, 2]) { await advance(pair[0].id, 'reader'); await submit(pair[0].id, 'reader', answer); }
  await releaseSession(pair[0].id, 'reader');
  await deleteLearningRecord('local-guest', saved.id);
  const inspection = await inspectBackup(await exportBackup('local-guest'));
  expect(inspection.records.sessions).toHaveLength(2);
  expect(inspection.records.attempts).toHaveLength(3);
  expect(inspection.records.sessions.find(session => session.id === pair[0].id)).toMatchObject({ practiceGroupId: pair[0].practiceGroupId, recordsDeleted: true });
  const profileId = await importBackup(inspection);
  expect((await sessions.where('profileId').equals(profileId).toArray()).every(session => session.practiceGroupId === pair[0].practiceGroupId)).toBe(true);
});

it('rolls back a failed pair restore without importing its profile or saved answers', async () => {
  const pair = await createCombinedPractice(reading, listening);
  await claimSession(pair[0].id, 'reader'); await submit(pair[0].id, 'reader', 1);
  const inspection = await inspectBackup(await exportBackup('local-guest'));
  const before = await Promise.all(db.tables.map(table => table.count()));
  const fail = (_key: unknown, value: { lesson: { skill: string } }) => { if (value.lesson.skill === 'listening') throw new Error('restore failed'); };
  sessions.hook('creating', fail);
  try { await expect(importBackup(inspection)).rejects.toThrow('restore failed'); }
  finally { sessions.hook('creating').unsubscribe(fail); }
  expect(await Promise.all(db.tables.map(table => table.count()))).toEqual(before);
  expect(await sessions.get(pair[0].id)).toMatchObject({ practiceGroupId: pair[0].practiceGroupId });
  expect(await settings.get('activeProfile')).toBeUndefined();
});

it('rejects well-hashed orphan, oversized, duplicate-skill, foreign-profile and mixed-mode groups', async () => {
  const pair = await createCombinedPractice(reading, listening);
  const extra = await createSession(reading); const [independent] = await createCombinedCheck(check, listeningChecks[0]);
  const files = unzipSync(await exportBackup('local-guest'));
  const rows = JSON.parse(new TextDecoder().decode(files['sessions.json']));
  for (const mutate of [
    (saved: typeof rows) => { delete saved.find((row: { id: string }) => row.id === pair[1].id).practiceGroupId; },
    (saved: typeof rows) => { saved.find((row: { id: string }) => row.id === extra.id).practiceGroupId = pair[0].practiceGroupId; },
    (saved: typeof rows) => { delete saved.find((row: { id: string }) => row.id === pair[1].id).practiceGroupId; saved.find((row: { id: string }) => row.id === extra.id).practiceGroupId = pair[0].practiceGroupId; },
    (saved: typeof rows) => { saved.find((row: { id: string }) => row.id === pair[1].id).profileId = 'foreign'; },
    (saved: typeof rows) => { saved.find((row: { id: string }) => row.id === pair[0].id).checkGroupId = crypto.randomUUID(); },
    (saved: typeof rows) => { saved.find((row: { id: string }) => row.id === independent.id).practiceGroupId = pair[0].practiceGroupId; },
    (saved: typeof rows) => { for (const row of saved.filter((row: { practiceGroupId?: string }) => row.practiceGroupId === pair[0].practiceGroupId)) row.practiceGroupId = independent.checkGroupId; },
  ]) {
    const changed = { ...files }, saved = structuredClone(rows); mutate(saved);
    changed['sessions.json'] = new TextEncoder().encode(JSON.stringify(saved));
    const manifest = JSON.parse(new TextDecoder().decode(changed['manifest.json']));
    manifest.files['sessions.json'].bytes = changed['sessions.json'].length;
    manifest.files['sessions.json'].sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', changed['sessions.json']))].map(value => value.toString(16).padStart(2, '0')).join('');
    changed['manifest.json'] = new TextEncoder().encode(JSON.stringify(manifest));
    await expect(inspectBackup(zipSync(changed))).rejects.toThrow('BACKUP_REFERENCE');
  }
  expect(await sessions.count()).toBe(5);
});
