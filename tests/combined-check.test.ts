import { beforeEach, expect, it } from 'vitest';
import { unzipSync, zipSync } from 'fflate';
import reading from './fixtures/content/a1-check-reading.json';
import practice from './fixtures/content/a1-reading.json';
import listeningChecks from './fixtures/retired-content/voa-listening-checks.json';
import { attempts, beginCheck, claimSession, createCombinedCheck, createSession, db, endCheck, saveDraft, sessions, settings, submit } from '../src/data/db';
import { exportBackup, importBackup, inspectBackup } from '../src/data/backup';
import { deleteLearningRecord } from '../src/data/deletion';

const listening = listeningChecks[0];
beforeEach(async () => { await Promise.all(db.tables.map(table => table.clear())); });

it('creates two independent snapshots atomically and rejects wrong skills, practice or shared roots', async () => {
  for (const pair of [[listening, reading], [practice, listening], [reading, { ...listening, materials: listening.materials.map(material => ({ ...material, rootId: reading.materials[0].rootId })) }]]) {
    await expect(createCombinedCheck(pair[0], pair[1])).rejects.toThrow('CHECK_RESTRICTED');
    expect(await sessions.count()).toBe(0);
  }
  const fail = (_key: unknown, value: { lesson: { skill: string } }) => { if (value.lesson.skill === 'listening') throw new Error('disk failed'); };
  sessions.hook('creating', fail);
  try { await expect(createCombinedCheck(reading, listening)).rejects.toThrow('disk failed'); }
  finally { sessions.hook('creating').unsubscribe(fail); }
  expect(await sessions.count()).toBe(0);
  const pair = await createCombinedCheck(reading, listening);
  expect(pair.map(session => session.lesson.skill)).toEqual(['reading', 'listening']);
  expect(pair[0].checkGroupId).toMatch(/^[a-f0-9-]{36}$/);
  expect(pair[1].checkGroupId).toBe(pair[0].checkGroupId);
  expect(pair[1].checkDeviceId).toBe(pair[0].checkDeviceId);
  expect(pair.every(session => session.profileId === 'local-guest' && session.status === 'active' && !session.checkStartedAt)).toBe(true);
  expect(await sessions.count()).toBe(2);
});

it('retains generated-instance uniqueness across simultaneous combined creation and single checks', async () => {
  const generated = { ...reading, generation: { generator: 'corpus-check-v1', seed: 0, startingPoint: 'A1' } };
  const results = await Promise.allSettled([createCombinedCheck(generated, listening), createCombinedCheck(generated, listening)]);
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  expect(results.filter(result => result.status === 'rejected').map(result => result.reason.message)).toEqual(['VARIANT_ALREADY_SAVED']);
  expect(await sessions.count()).toBe(2);
  await expect(createSession(generated)).rejects.toThrow('VARIANT_ALREADY_SAVED');
  expect(await sessions.count()).toBe(2);
});

it('does not promote imported practice media into a check', async () => {
  const unavailable = { ...listening, materials: listening.materials.map(material => ({ ...material, communityPackageId: 'a'.repeat(64) })) };
  await expect(createCombinedCheck(reading, unavailable)).rejects.toThrow('Material package ownership is restricted');
  expect(await sessions.count()).toBe(0);
});

it('restores the pair, saved answer and draft into isolated profiles while keeping device write guards', async () => {
  const pair = await createCombinedCheck(reading, listening);
  await claimSession(pair[0].id, 'original');
  await beginCheck(pair[0].id, 'original');
  await submit(pair[0].id, 'original', 0);
  await saveDraft(pair[0].id, 'original', 0);
  const inspected = await inspectBackup(await exportBackup('local-guest'));
  for (let count = 0; count < 2; count++) {
    const profileId = await importBackup(inspected);
    const restored = await sessions.where('profileId').equals(profileId).toArray();
    expect(restored).toHaveLength(2);
    expect(restored.every(session => session.checkGroupId === pair[0].checkGroupId)).toBe(true);
    const restoredReading = restored.find(session => session.lesson.skill === 'reading')!;
    expect(restoredReading.id).not.toBe(pair[0].id);
    expect(restoredReading.draft).toBe(0);
    expect(await attempts.where('profileId').equals(profileId).count()).toBe(1);
    await expect(claimSession(restoredReading.id, 'restored', Date.now(), profileId)).resolves.toHaveProperty('checkStartedAt');
    await expect(claimSession(restoredReading.id, 'foreign', Date.now(), 'wrong-profile')).rejects.toThrow('NOT_FOUND');
    await expect(inspectBackup(await exportBackup(profileId))).resolves.toBeDefined();
  }
  await settings.put({ key: 'check-device-id', value: crypto.randomUUID() });
  await expect(claimSession(pair[1].id, 'foreign-device')).rejects.toThrow('CHECK_DEVICE');
  expect(await attempts.where('profileId').equals('local-guest').count()).toBe(1);
});

it('keeps a partially ended pair restorable after deleting a saved response', async () => {
  const pair = await createCombinedCheck(reading, listening);
  await claimSession(pair[0].id, 'original'); await beginCheck(pair[0].id, 'original');
  const saved = await submit(pair[0].id, 'original', 0);
  await endCheck(pair[0].id, 'original');
  const partial = await inspectBackup(await exportBackup('local-guest'));
  expect(partial.records.sessions).toHaveLength(2);
  expect(partial.records.attempts).toHaveLength(1);
  await deleteLearningRecord('local-guest', saved.id);
  const deleted = await inspectBackup(await exportBackup('local-guest'));
  expect(deleted.records.sessions).toHaveLength(2);
  expect(deleted.records.attempts).toHaveLength(0);
  expect(deleted.records.sessions.find(session => session.id === pair[0].id)).toMatchObject({ status: 'ended', recordsDeleted: true, checkGroupId: pair[0].checkGroupId });
  const profileId = await importBackup(deleted);
  const restored = await sessions.where('profileId').equals(profileId).toArray();
  expect(restored).toHaveLength(2);
  expect(restored.find(session => session.lesson.skill === 'reading')?.recordsDeleted).toBe(true);
  await expect(inspectBackup(await exportBackup(profileId))).resolves.toBeDefined();
});

it('rejects well-hashed orphan, oversized, foreign-device and non-check backup groups', async () => {
  const pair = await createCombinedCheck(reading, listening);
  await createSession(practice);
  const original = unzipSync(await exportBackup('local-guest'));
  const rows = JSON.parse(new TextDecoder().decode(original['sessions.json']));
  for (const mutate of [
    (saved: typeof rows) => { delete saved.find((row: { id: string }) => row.id === pair[1].id).checkGroupId; },
    (saved: typeof rows) => { saved.find((row: { lesson: { mode?: string } }) => row.lesson.mode !== 'check').checkGroupId = pair[0].checkGroupId; },
    (saved: typeof rows) => { saved.find((row: { id: string }) => row.id === pair[1].id).checkDeviceId = crypto.randomUUID(); },
    (saved: typeof rows) => { saved.find((row: { id: string }) => row.id === pair[1].id).profileId = 'foreign'; },
  ]) {
    const files = { ...original }, saved = structuredClone(rows); mutate(saved);
    files['sessions.json'] = new TextEncoder().encode(JSON.stringify(saved));
    const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json']));
    manifest.files['sessions.json'].bytes = files['sessions.json'].length;
    manifest.files['sessions.json'].sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', files['sessions.json']))].map(value => value.toString(16).padStart(2, '0')).join('');
    files['manifest.json'] = new TextEncoder().encode(JSON.stringify(manifest));
    await expect(inspectBackup(zipSync(files))).rejects.toThrow('BACKUP_REFERENCE');
  }
  expect(await sessions.count()).toBe(3);
});
