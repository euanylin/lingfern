import { sessionSummarySchema, syncAccountSchema } from '../shared/auth';
import { profileIdSchema } from '../shared/repository';
import { db, profiles, settings, syncClocks } from './db';
import { exportBackup, importBackup, inspectBackup } from './backup';

export async function readSyncAccount(profileId: string) {
  const row = await settings.get(`profile:${profileId}:syncAccount`);
  try { return row ? syncAccountSchema.parse(JSON.parse(row.value)) : undefined; }
  catch { return undefined; } // Reject corrupt associations without touching learner records.
}

export async function accountProfiles(accountId: number) {
  syncAccountSchema.shape.accountId.parse(accountId);
  return db.transaction('r', profiles, settings, syncClocks, async () => {
    const result = [];
    for (const profile of await profiles.toArray()) {
      const association = await readSyncAccount(profile.id);
      const logicalProfileId = (await syncClocks.get(profile.id))?.logicalProfileId ?? profile.id;
      if (association?.accountId === accountId && association.profileId === logicalProfileId) result.push({ ...profile, logicalProfileId });
    }
    return result;
  });
}

// Require explicit choices; make no remote requests here.
export async function switchAccountProfile(account: { id: number; login: string }, target?: string, localProfileId?: string) {
  account = sessionSummarySchema.shape.account.unwrap().parse(account);
  if (target) profileIdSchema.parse(target);
  if (localProfileId) profileIdSchema.parse(localProfileId);
  return db.transaction('rw', profiles, settings, syncClocks, async () => {
    const existing = (await accountProfiles(account.id)).find(profile => (!localProfileId || profile.id === localProfileId) && (!target || profile.logicalProfileId === target));
    if (localProfileId && !existing) throw new Error('NOT_FOUND');
    const id = existing?.id ?? crypto.randomUUID();
    if (!existing) {
      const logicalProfileId = target ?? crypto.randomUUID();
      await profiles.add({ id, name: `${account.login} · Local profile`, createdAt: new Date().toISOString() });
      await syncClocks.add({ profileId: id, deviceId: crypto.randomUUID(), counter: 0, logicalProfileId });
      await settings.put({ key: `profile:${id}:syncAccount`, value: JSON.stringify(syncAccountSchema.parse({ accountId: account.id, profileId: logicalProfileId })) });
    }
    await settings.put({ key: 'activeProfile', value: id });
    return id;
  });
}

export async function copyProfileForAccount(profileId: string, accountId: number) {
  syncAccountSchema.shape.accountId.parse(accountId);
  if (!await profiles.get(profileId)) throw new Error('NOT_FOUND');
  return importBackup(await inspectBackup(await exportBackup(profileId)), accountId);
}
