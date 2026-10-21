import { beforeEach, expect, it } from 'vitest';
import check from './fixtures/content/a1-check-reading.json';
import practice from './fixtures/content/a1-reading.json';
import { db, sessions, settings, attempts, exposures, createSession, checkDeviceId, claimSession, releaseSession, beginCheck, endCheck, saveDraft, submit, advance, recordPlayback, markExposure } from '../src/data/db';
import { exportBackup, inspectBackup, importBackup } from '../src/data/backup';
beforeEach(async () => { await Promise.all(db.tables.map(table => table.clear())); });
it('binds checks to one installation across profiles, restores on that installation and retains completed review elsewhere', async () => {
  const source = await createSession(check);
  expect(source.checkDeviceId).toBe(await checkDeviceId());
  const other = await createSession(check, 'other-profile');
  expect(other.checkDeviceId).toBe(source.checkDeviceId);
  await claimSession(source.id, 'original'); await beginCheck(source.id, 'original'); await submit(source.id, 'original', 0); await advance(source.id, 'original');
  const restore = await importBackup(await inspectBackup(await exportBackup(source.profileId)));
  const restored = (await sessions.where('profileId').equals(restore).toArray())[0];
  expect(restored.checkDeviceId).toBe(source.checkDeviceId);
  await claimSession(restored.id, 'same-installation');
  for (let position = 1; position < 4; position++) { await submit(restored.id, 'same-installation', 0); if (position < 3) await advance(restored.id, 'same-installation'); }
  expect((await sessions.get(restored.id))?.status).toBe('completed');
  await settings.put({ key: 'check-device-id', value: crypto.randomUUID() });
  await releaseSession(restored.id, 'same-installation');
  await expect(claimSession(restored.id, 'review')).resolves.toMatchObject({ status: 'completed' });
  expect(await attempts.where('sessionId').equals(restored.id).count()).toBe(4);
});
it('blocks foreign-device resume and every direct write without losing active checks, drafts or saved responses', async () => {
  const original = await createSession(check); await claimSession(original.id, 'owner'); await beginCheck(original.id, 'owner'); await submit(original.id, 'owner', 0); await advance(original.id, 'owner'); await saveDraft(original.id, 'owner', 1);
  const backup = await inspectBackup(await exportBackup(original.profileId));
  await settings.put({ key: 'check-device-id', value: crypto.randomUUID() });
  const profile = await importBackup(backup), copied = (await sessions.where('profileId').equals(profile).toArray())[0];
  const before = await sessions.get(copied.id), saved = await attempts.where('sessionId').equals(copied.id).toArray();
  await expect(claimSession(copied.id, 'foreign')).rejects.toThrow('CHECK_DEVICE');
  expect(await sessions.get(copied.id)).toEqual(before);
  // Reject stale original-device leases at the write guard.
  for (const action of [() => saveDraft(original.id, 'owner', 0), () => submit(original.id, 'owner', 0), () => advance(original.id, 'owner'), () => beginCheck(original.id, 'owner'), () => endCheck(original.id, 'owner'), () => recordPlayback(original.id, 'owner', original.lesson.materials[0].questions[1].id, false), async () => markExposure((await sessions.get(original.id))!)]) await expect(action()).rejects.toThrow('CHECK_DEVICE');
  expect(await attempts.where('sessionId').equals(copied.id).toArray()).toEqual(saved);
  expect((await sessions.get(copied.id))?.draft).toBe(1);
  expect((await sessions.get(original.id))?.status).toBe('active');
  expect(await exposures.where('profileId').equals(original.profileId).count()).toBe(1);
  await expect(inspectBackup(await exportBackup(profile))).resolves.toBeDefined();
});
it('blocks unknown check origin without inventing a device and leaves practice recovery available', async () => {
  const original = await createSession(check); await sessions.update(original.id, { checkDeviceId: undefined });
  const saved = await sessions.get(original.id);
  await expect(claimSession(original.id, 'unknown-origin')).rejects.toThrow('CHECK_DEVICE');
  expect(await sessions.get(original.id)).toEqual(saved);
  const bytes = await exportBackup(original.profileId);
  const copiedProfile = await importBackup(await inspectBackup(bytes));
  const copy = (await sessions.where('profileId').equals(copiedProfile).toArray())[0];
  await expect(claimSession(copy.id, 'restored-unknown-origin')).rejects.toThrow('CHECK_DEVICE');
  const learning = await createSession(practice, 'learning'); await claimSession(learning.id, 'learner'); await saveDraft(learning.id, 'learner', 1);
  const restoredProfile = await importBackup(await inspectBackup(await exportBackup('learning')));
  await settings.put({ key: 'check-device-id', value: crypto.randomUUID() });
  const restored = (await sessions.where('profileId').equals(restoredProfile).toArray())[0];
  await expect(claimSession(restored.id, 'restored-learning')).resolves.toMatchObject({ draft: 1 });
  await expect(submit(restored.id, 'restored-learning', 1)).resolves.toHaveProperty('correct', true);
});
