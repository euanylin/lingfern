import { beforeEach, expect, it, vi } from 'vitest';
import { unzipSync, zipSync } from 'fflate';
import raw from './fixtures/content/a1-reading.json';
import check from './fixtures/content/a1-check-reading.json';
import { createSession, markExposure, exposures, db, sessions, claimSession, beginCheck } from '../src/data/db';
import { appendSyncEvent, readSyncEvents, pendingSyncBatch, receiveSyncBatch } from '../src/data/sync';
import { exportBackup, inspectBackup } from '../src/data/backup';

beforeEach(async () => { vi.useRealTimers(); await Promise.all(db.tables.map(table => table.clear())); });
it('records only the shown question, coalesces repeats and retains related variants', async () => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-09-28T00:00:00Z'));
  const session = await createSession(raw);
  await Promise.all([markExposure(session), markExposure(session)]);
  let exposure = (await exposures.toArray())[0];
  expect(exposure.contacts).toHaveLength(1);
  expect(exposure.contacts?.[0]).toMatchObject({ sessionId: session.id, materialId: raw.materials[0].id, questionId: raw.materials[0].questions[0].id });
  expect(exposure.firstSeenAt).toBe('2026-09-28T00:00:00.000Z');
  expect(await readSyncEvents(session.profileId)).toHaveLength(1);
  vi.setSystemTime(new Date('2026-09-29T00:00:00Z')); await markExposure(session);
  exposure = (await exposures.toArray())[0];
  expect(exposure.contacts).toHaveLength(1);
  expect(exposure.lastSeenAt).toBe('2026-09-29T00:00:00.000Z');
  expect(exposure.contacts?.[0].firstSeenAt).toBe(exposure.firstSeenAt);
  expect(await readSyncEvents(session.profileId)).toHaveLength(1);
  await expect(markExposure({ ...session, profileId: 'other' })).rejects.toThrow('CONFLICT');
  await sessions.update(session.id, { position: 1 });
  await expect(markExposure(session)).rejects.toThrow('CONFLICT');
  await markExposure({ ...session, position: 1 });
  expect((await exposures.toArray())[0].contacts).toHaveLength(2);
  expect(await readSyncEvents(session.profileId)).toHaveLength(2);
  vi.useRealTimers();
});
it('keeps old root history and does not invent historical contacts', async () => {
  const session = await createSession(raw);
  await exposures.add({ profileId: session.profileId, rootId: raw.materials[0].rootId, firstSeenAt: '2020-01-01T00:00:00.000Z' });
  await markExposure(session);
  const exposure = (await exposures.toArray())[0];
  expect(exposure.firstSeenAt).toBe('2020-01-01T00:00:00.000Z');
  expect(exposure.contacts).toHaveLength(1);
  expect(exposure.contacts?.[0].firstSeenAt).not.toBe(exposure.firstSeenAt);
  await expect(inspectBackup(await exportBackup(session.profileId))).resolves.toBeDefined();
});
it('starts a reading check and its first exposure atomically, with rollback on failure', async () => {
  const session = await createSession(check); await claimSession(session.id, 'tab');
  await expect(markExposure(session)).rejects.toThrow('CHECK_NOT_STARTED');
  const fail = () => { throw new Error('disk failed'); }; exposures.hook('creating', fail);
  try { await expect(beginCheck(session.id, 'tab')).rejects.toThrow('disk failed'); }
  finally { exposures.hook('creating').unsubscribe(fail); }
  expect((await sessions.get(session.id))?.checkStartedAt).toBeUndefined();
  expect(await exposures.count()).toBe(0);
  await beginCheck(session.id, 'tab');
  expect((await exposures.toArray())[0].contacts).toHaveLength(1);
});
it('rejects a stale check start after another session exposes or reserves its source', async () => {
  for (const exposed of [false, true]) {
    await Promise.all(db.tables.map(table => table.clear()));
    const candidate = await createSession(check); await claimSession(candidate.id, 'check');
    const practice = await createSession({ ...raw, materials: raw.materials.map((material, index) => ({ ...material, ...(index === 0 ? { rootId: check.materials[0].rootId } : {}) })) });
    if (exposed) await markExposure(practice);
    const before = await sessions.get(candidate.id), contacts = await exposures.toArray();
    await expect(beginCheck(candidate.id, 'check')).rejects.toThrow('CHECK_EXPOSED');
    expect(await sessions.get(candidate.id)).toEqual(before);
    expect(await exposures.toArray()).toEqual(contacts);
  }
});
it('serializes overlapping check starts while preserving resume and profile isolation', async () => {
  const first = await createSession(check), second = await createSession(check);
  await claimSession(first.id, 'one'); await claimSession(second.id, 'two');
  const results = await Promise.allSettled([beginCheck(first.id, 'one'), beginCheck(second.id, 'two')]);
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  expect(results.filter(result => result.status === 'rejected').map(result => result.reason.message)).toEqual(['CHECK_EXPOSED']);
  const winner = results[0].status === 'fulfilled' ? first : second;
  await expect(beginCheck(winner.id, winner.id === first.id ? 'one' : 'two')).resolves.toHaveProperty('checkStartedAt');
  const other = await createSession(check, 'other-profile'); await claimSession(other.id, 'other');
  await expect(beginCheck(other.id, 'other')).resolves.toHaveProperty('checkStartedAt');
});
it('checks synchronised contacts without local exposure rows before revealing a check', async () => {
  const candidate = await createSession(check); await claimSession(candidate.id, 'check');
  await appendSyncEvent(candidate.profileId, { type: 'exposure', payload: { sessionId: 'remote-session', questionId: 'remote-question', rootId: check.materials[0].rootId, materialId: 'remote-material', variantGroup: 'remote-question' } });
  expect(await exposures.count()).toBe(0);
  await expect(beginCheck(candidate.id, 'check')).rejects.toThrow('CHECK_EXPOSED');
  expect((await sessions.get(candidate.id))?.checkStartedAt).toBeUndefined();
  expect(await exposures.count()).toBe(0);
});
it('reserves a listening-check root before the first playback creates an exposure', async () => {
  const { default: drafts } = await import('./fixtures/retired-content/voa-listening-checks.json');
  const first = await createSession(drafts[0]), second = await createSession(drafts[0]);
  await claimSession(first.id, 'one'); await claimSession(second.id, 'two');
  await beginCheck(first.id, 'one');
  expect(await exposures.count()).toBe(0);
  expect(await readSyncEvents(first.profileId)).toEqual([]);
  await markExposure(first);
  expect((await readSyncEvents(first.profileId)).map(event => event.type)).toEqual(['exposure']);
  await expect(beginCheck(second.id, 'two')).rejects.toThrow('CHECK_EXPOSED');
  expect((await sessions.get(second.id))?.checkStartedAt).toBeUndefined();
});
it('rejects well-hashed exposure files with foreign or fabricated references', async () => {
  const session = await createSession(raw); await markExposure(session);
  const original = unzipSync(await exportBackup(session.profileId));
  for (const property of ['sessionId', 'materialId', 'questionId', 'variantGroup']) {
    const files = { ...original };
    const records = JSON.parse(new TextDecoder().decode(files['exposures.json']));
    records[0].contacts[0][property] = 'forged';
    files['exposures.json'] = new TextEncoder().encode(JSON.stringify(records));
    const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json']));
    manifest.files['exposures.json'].bytes = files['exposures.json'].length;
    manifest.files['exposures.json'].sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', files['exposures.json'])), b => b.toString(16).padStart(2, '0')).join('');
    files['manifest.json'] = new TextEncoder().encode(JSON.stringify(manifest));
    await expect(inspectBackup(zipSync(files))).rejects.toThrow('BACKUP_REFERENCE');
    expect(await exposures.count()).toBe(1);
  }
});

it('rolls back a shown practice contact when its sync event cannot be stored', async () => {
  const session = await createSession(raw);
  const fail = () => { throw new Error('disk failed'); };
  db.table('syncEvents').hook('creating', fail);
  try { await expect(markExposure(session)).rejects.toThrow('disk failed'); }
  finally { db.table('syncEvents').hook('creating').unsubscribe(fail); }
  expect(await exposures.count()).toBe(0);
  expect(await readSyncEvents(session.profileId)).toHaveLength(0);
  expect(await db.table('syncClocks').count()).toBe(0);
  await markExposure(session);
  expect(await exposures.count()).toBe(1);
  expect(await readSyncEvents(session.profileId)).toHaveLength(1);
});


it('shares started-check contact without answers and blocks a fresh check after two-device merge', async () => {
  const first = await createSession(check, 'p'); await claimSession(first.id, 'one');
  expect(await readSyncEvents('p')).toEqual([]);
  await beginCheck(first.id, 'one');
  await markExposure(first); await markExposure(first);
  const events = await readSyncEvents('p');
  expect(events).toHaveLength(1); expect(events[0].type).toBe('exposure');
  expect(events[0].payload).toMatchObject({ sessionId: first.id, rootId: check.materials[0].rootId, questionId: check.materials[0].questions[0].id });
  const sent = (await pendingSyncBatch('p'))!;
  expect(JSON.stringify(sent.batch)).not.toMatch(/"(?:answer|draft|blocks|correct|assistance|checkStartedAt)"/);
  await Promise.all(db.tables.map(table => table.clear()));
  const second = await createSession(check, 'p'); await claimSession(second.id, 'two');
  expect(await exposures.count()).toBe(0);
  expect(await receiveSyncBatch('p', sent.batch, sent.hash)).toBe('received');
  expect(await receiveSyncBatch('p', sent.batch, sent.hash)).toBe('duplicate');
  expect(await readSyncEvents('p')).toHaveLength(1);
  await expect(beginCheck(second.id, 'two')).rejects.toThrow('CHECK_EXPOSED');
  expect((await sessions.get(second.id))?.checkStartedAt).toBeUndefined();
  const isolated = await createSession(check, 'other'); await claimSession(isolated.id, 'other');
  await expect(beginCheck(isolated.id, 'other')).resolves.toHaveProperty('checkStartedAt');
});

it('rolls back a check start if its contact summary cannot commit', async () => {
  const session = await createSession(check); await claimSession(session.id, 'tab');
  const fail = () => { throw new Error('CONTACT_SYNC_FAILED'); };
  db.table('syncEvents').hook('creating', fail);
  try { await expect(beginCheck(session.id, 'tab')).rejects.toThrow('CONTACT_SYNC_FAILED'); }
  finally { db.table('syncEvents').hook('creating').unsubscribe(fail); }
  expect((await sessions.get(session.id))?.checkStartedAt).toBeUndefined();
  expect(await exposures.count()).toBe(0); expect(await readSyncEvents(session.profileId)).toEqual([]);
  expect(await db.table('syncClocks').count()).toBe(0);
  await beginCheck(session.id, 'tab'); await beginCheck(session.id, 'tab');
  expect(await readSyncEvents(session.profileId)).toHaveLength(1);
});
