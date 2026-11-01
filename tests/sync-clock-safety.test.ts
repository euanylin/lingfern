import { afterEach, beforeEach, expect, it } from 'vitest';
import { unzipSync, zipSync } from 'fflate';
import Dexie from 'dexie';
import { advance, attempts, claimSession, createSession, db, profiles, saveSetting, sessions, submit } from '../src/data/db';
import { exportBackup, importBackup, inspectBackup } from '../src/data/backup';
import { appendSyncEvent, pendingSyncBatch, confirmSyncBatch, readSyncEvents, receiveSyncBatch, receiveSyncPage } from '../src/data/sync';
import { canonicalJson, projectLookupHistory, validateSyncBatch, type SyncBatch } from '../src/shared/sync';
import { clearLookupHistory, readLookupHistory, recordLookup, removeLookup } from '../src/data/lookupHistory';
import reading from './fixtures/content/a1-reading.json';

beforeEach(async () => { await Promise.all(db.tables.map(table => table.clear())); });
afterEach(async () => { await Promise.all(db.tables.map(table => table.clear())); });

// Construct hostile wire fixtures independently of the production validator.
async function wireBatch(batch: SyncBatch) {
  const bytes = new TextEncoder().encode(canonicalJson(batch));
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join('');
  return { batch, bytes, hash };
}

it('continues local saves after receiving the largest legacy numeric clock', async () => {
  await profiles.add({ id: 'clock-source', name: 'Synthetic profile', createdAt: new Date().toISOString() });
  const incoming = await validateSyncBatch({ product: 'Lingfern', formatVersion: 1, profileId: 'clock-source', deviceId: 'remote', batchId: 'numeric-boundary', events: [{ id: 'numeric-boundary', deviceId: 'remote', counter: Number.MAX_SAFE_INTEGER, occurredAt: '2026-01-01T00:00:00.000Z', type: 'setting', payload: { key: 'theme', value: 'dark' } }] });
  expect(incoming.hash).toBe('6402deb5d493f31d2b756599123f0ae4fe289d25dcb4974c9ca55776cb1372cb');
  expect(await receiveSyncBatch('clock-source', incoming.batch, incoming.hash)).toBe('received');
  await expect(saveSetting('clock-source', 'theme', 'system')).resolves.toBeUndefined();
  expect((await db.table('syncClocks').get('clock-source')).counter).toBe('9007199254740992');
  expect((await validateSyncBatch((await db.table('syncBatches').get(['clock-source', 'remote', 'numeric-boundary'])).batch)).hash).toBe(incoming.hash);
  const pending = (await pendingSyncBatch('clock-source'))!;
  expect(pending.batch.formatVersion).toBe(2);
  expect(pending.batch.events[0].counter).toBe('9007199254740992');
  await expect(validateSyncBatch({ ...pending.batch, formatVersion: 1 })).rejects.toThrow('Extended counters require batch format 2');
});

it('continues writing after restoring numeric exhaustion and round-trips the extended backup', async () => {
  await profiles.add({ id: 'clock-source', name: 'Synthetic profile', createdAt: new Date().toISOString() });
  const files = unzipSync(await exportBackup('clock-source'));
  const encoder = new TextEncoder(), decoder = new TextDecoder();
  const clocks = [{ profileId: 'clock-source', deviceId: 'remote', counter: Number.MAX_SAFE_INTEGER }];
  files['syncClocks.json'] = encoder.encode(JSON.stringify(clocks));
  const manifest = JSON.parse(decoder.decode(files['manifest.json']));
  expect(manifest.version).toBe(6);
  manifest.files['syncClocks.json'] = { count: 1, bytes: files['syncClocks.json'].length, sha256: [...new Uint8Array(await crypto.subtle.digest('SHA-256', files['syncClocks.json']))].map(value => value.toString(16).padStart(2, '0')).join('') };
  files['manifest.json'] = encoder.encode(JSON.stringify(manifest));
  const restored = await importBackup(await inspectBackup(zipSync(files)));
  await expect(saveSetting(restored, 'theme', 'dark')).resolves.toBeUndefined();
  const extended = await exportBackup(restored);
  expect(JSON.parse(decoder.decode(unzipSync(extended)['manifest.json'])).version).toBe(7);
  const mislabeled = unzipSync(extended), header = JSON.parse(decoder.decode(mislabeled['manifest.json']));
  header.version = 6; mislabeled['manifest.json'] = encoder.encode(JSON.stringify(header));
  await expect(inspectBackup(zipSync(mislabeled))).rejects.toThrow('BACKUP_REFERENCE');
  const again = await importBackup(await inspectBackup(extended));
  await expect(saveSetting(again, 'theme', 'light')).resolves.toBeUndefined();
  expect((await db.table('syncClocks').get(again)).counter).toBe('9007199254740993');
});

it('saves a completed answer transaction after numeric clock exhaustion', async () => {
  await appendSyncEvent('clock-source', { type: 'setting', payload: { key: 'theme', value: 'light' } });
  const clock = await db.table('syncClocks').get('clock-source');
  await db.table('syncClocks').put({ ...clock, counter: Number.MAX_SAFE_INTEGER });
  const session = await createSession(reading, 'clock-source');
  await claimSession(session.id, 'synthetic-tab');
  for (const question of reading.materials.flatMap(material => material.questions)) {
    const saved = await submit(session.id, 'synthetic-tab', question.answer);
    expect(saved.answer).toBe(question.answer);
    expect(await attempts.get(saved.id)).toEqual(saved);
    await advance(session.id, 'synthetic-tab');
  }
  expect((await sessions.get(session.id))?.status).toBe('completed');
  const completions = (await readSyncEvents('clock-source')).filter(event => event.type === 'completion');
  expect(completions).toHaveLength(reading.materials.flatMap(material => material.questions).length);
  expect(completions.map(event => event.counter)).toContain('9007199254740992');
});

it('keeps local saves available when an oversized decimal clock exceeds the unchanged upload limit', async () => {
  await profiles.add({ id: 'clock-source', name: 'Synthetic profile', createdAt: new Date().toISOString() });
  await db.table('syncClocks').put({ profileId: 'clock-source', deviceId: 'synthetic', counter: '9'.repeat(250 * 1024) });
  await expect(saveSetting('clock-source', 'theme', 'dark')).resolves.toBeUndefined();
  expect((await db.table('syncClocks').get('clock-source')).counter).toHaveLength(250 * 1024 + 1);
  await expect(pendingSyncBatch('clock-source')).rejects.toThrow('SYNC_CAPACITY');
  await expect(saveSetting('clock-source', 'theme', 'light')).resolves.toBeUndefined();
});

it('preserves deletion causality and future lookups across two devices after numeric overflow', async () => {
  const other = new Dexie(`extended-sync-${crypto.randomUUID()}`);
  other.version(1).stores({ settings: 'key', syncEvents: '[profileId+id], profileId, [profileId+type]', syncClocks: 'profileId', syncBatches: '[profileId+deviceId+batchId], profileId, [profileId+state]', syncConflicts: '[profileId+hash], profileId' });
  const incoming = await validateSyncBatch({ product: 'Lingfern', formatVersion: 1, profileId: 'clock-source', deviceId: 'remote', batchId: 'boundary', events: [{ id: 'boundary', deviceId: 'remote', counter: Number.MAX_SAFE_INTEGER, occurredAt: '2026-01-01T00:00:00.000Z', type: 'setting', payload: { key: 'theme', value: 'dark' } }] });
  const exchange = async (from: Dexie, to: Dexie) => {
    const batch = (await pendingSyncBatch('clock-source', from))!;
    expect(batch.batch.formatVersion).toBe(2);
    expect(await receiveSyncBatch('clock-source', batch.batch, batch.hash, to)).toBe('received');
    await confirmSyncBatch('clock-source', batch.deviceId, batch.batchId, batch.hash, from);
  };
  try {
    await receiveSyncBatch('clock-source', incoming.batch, incoming.hash);
    await receiveSyncBatch('clock-source', incoming.batch, incoming.hash, other);
    await recordLookup('clock-source', 'dictionary', 'old');
    await clearLookupHistory('clock-source');
    await recordLookup('clock-source', 'dictionary', 'later');
    await exchange(db, other);
    expect((await readLookupHistory('clock-source', other)).map(row => row.term)).toEqual(['later']);
    await removeLookup('clock-source', (await readLookupHistory('clock-source', other))[0].id, other);
    await exchange(other, db);
    expect(await readLookupHistory('clock-source')).toEqual([]);
    await recordLookup('clock-source', 'dictionary', 'new');
    await exchange(db, other);
    expect(await readLookupHistory('clock-source', other)).toEqual(await readLookupHistory('clock-source'));
    expect((await readLookupHistory('clock-source')).map(row => row.term)).toEqual(['new']);
    expect((await db.table('syncClocks').get('clock-source')).counter).toBe('9007199254740996');
  } finally { await other.delete(); }
});

it.each((['lookup_clear', 'lookup_remove'] as const).flatMap(type => [Number.MAX_SAFE_INTEGER, 1, 100].map(counter => ({ type, counter }))))('keeps future local lookups visible after $type claims observation $counter at clock 1', async ({ type, counter }) => {
  const lookup = { kind: 'dictionary' as const, term: 'word', lookedUpAt: '2026-01-01T00:00:00.000Z' };
  const original = await appendSyncEvent('clock-source', { type: 'lookup', payload: lookup });
  const seen = { [original.deviceId]: counter };
  const event = type === 'lookup_clear' ? { type, payload: { seen } } : { type, payload: { seen, kind: lookup.kind, term: lookup.term } };
  const incoming = await wireBatch({ product: 'Lingfern', formatVersion: 1, profileId: 'clock-source', deviceId: 'remote', batchId: 'exhausted-seen', events: [{ id: 'exhausted-seen', deviceId: 'remote', counter: 1, occurredAt: '2026-01-01T00:00:00.000Z', ...event }] });
  await expect(validateSyncBatch(incoming.batch)).rejects.toThrow('SYNC_CLOCK_INVALID');
  let error: unknown;
  try { await receiveSyncBatch('clock-source', incoming.batch, incoming.hash); } catch (caught) { error = caught; }
  const next = await appendSyncEvent('clock-source', { type: 'lookup', payload: { ...lookup, lookedUpAt: '2026-01-02T00:00:00.000Z' } });
  expect(projectLookupHistory(await readSyncEvents('clock-source')).map(record => record.id)).toEqual([next.id]);
  expect(error).toMatchObject({ message: 'SYNC_CLOCK_INVALID' });
});

it('rolls back the entire page when a later batch claims an impossible observation', async () => {
  const scope = { accountId: 1, profileId: 'clock-source', bindingVersion: 'b'.repeat(43) };
  await appendSyncEvent('clock-source', { type: 'setting', payload: { key: 'theme', value: 'light' } });
  const normal = await validateSyncBatch({ product: 'Lingfern', formatVersion: 1, profileId: 'clock-source', deviceId: 'remote', batchId: 'normal', events: [{ id: 'normal', deviceId: 'remote', counter: 2, occurredAt: '2026-01-01T00:00:00.000Z', type: 'setting', payload: { key: 'theme', value: 'dark' } }] });
  const invalid = await wireBatch({ ...normal.batch, batchId: 'invalid', events: [{ id: 'invalid', deviceId: 'remote', counter: 3, occurredAt: '2026-01-01T00:00:00.000Z', type: 'lookup_clear', payload: { seen: { remote: 100 } } }] });
  const batches = [normal, invalid], tables = ['syncEvents', 'syncBatches', 'syncClocks', 'syncDownloads', 'syncReceipts', 'syncConflicts'];
  const before = await Promise.all(tables.map(name => db.table(name).toArray()));
  const files = batches.map(({ batch, bytes }, index) => ({ deviceId: batch.deviceId, batchId: batch.batchId, blobSha: String(index + 1).repeat(40), bytes: bytes.length }));
  await expect(receiveSyncPage('clock-source', { scope, commit: 'c'.repeat(40), cursor: 'first', total: 2, files, batches: batches.map(({ batch, hash }, index) => ({ batch, hash, blobSha: files[index].blobSha })) }, db, scope)).rejects.toThrow('SYNC_CLOCK_INVALID');
  expect(await Promise.all(tables.map(name => db.table(name).toArray()))).toEqual(before);
});

it('rejects impossible observations in a fully rehashed ZIP without changing local records', async () => {
  await profiles.add({ id: 'clock-source', name: 'Synthetic profile', createdAt: new Date().toISOString() });
  await appendSyncEvent('clock-source', { type: 'setting', payload: { key: 'theme', value: 'light' } });
  const files = unzipSync(await exportBackup('clock-source'));
  const encoder = new TextEncoder(), decoder = new TextDecoder();
  const events = JSON.parse(decoder.decode(files['syncEvents.json']));
  events.push({ profileId: 'clock-source', event: { id: 'invalid', deviceId: 'remote', counter: 2, occurredAt: '2026-01-01T00:00:00.000Z', type: 'lookup_clear', payload: { seen: { remote: 100 } } } });
  const clocks = JSON.parse(decoder.decode(files['syncClocks.json'])); clocks[0].counter = 2;
  const manifest = JSON.parse(decoder.decode(files['manifest.json']));
  for (const [name, rows] of [['syncEvents.json', events], ['syncClocks.json', clocks]] as const) {
    files[name] = encoder.encode(JSON.stringify(rows));
    manifest.files[name] = { count: rows.length, bytes: files[name].length, sha256: [...new Uint8Array(await crypto.subtle.digest('SHA-256', files[name]))].map(value => value.toString(16).padStart(2, '0')).join('') };
  }
  files['manifest.json'] = encoder.encode(JSON.stringify(manifest));
  const before = await Promise.all(db.tables.map(table => table.toArray()));
  await expect(inspectBackup(zipSync(files))).rejects.toThrow('SYNC_CLOCK_INVALID');
  expect(await Promise.all(db.tables.map(table => table.toArray()))).toEqual(before);
});

it.each(['event', 'batch', 'conflict'] as const)('rechecks %s observations in an inspected backup before import commits', async kind => {
  await profiles.add({ id: 'clock-source', name: 'Synthetic profile', createdAt: new Date().toISOString() });
  await appendSyncEvent('clock-source', { type: 'setting', payload: { key: 'theme', value: 'light' } });
  const inspection = await inspectBackup(await exportBackup('clock-source'));
  const incoming = await wireBatch({ product: 'Lingfern', formatVersion: 1, profileId: 'clock-source', deviceId: 'remote', batchId: 'invalid', events: [{ id: 'invalid', deviceId: 'remote', counter: 2, occurredAt: '2026-01-01T00:00:00.000Z', type: 'lookup_clear', payload: { seen: { remote: 2 } } }] });
  if (kind === 'event') inspection.records.syncEvents.push({ ...incoming.batch.events[0], profileId: 'clock-source' });
  else if (kind === 'batch') inspection.records.syncBatches.push({ profileId: 'clock-source', deviceId: 'remote', batchId: 'invalid', batch: incoming.batch, hash: incoming.hash, state: 'received' });
  else inspection.records.syncConflicts.push({ profileId: 'clock-source', batch: incoming.batch, hash: incoming.hash, reason: 'SYNC_BATCH_CONFLICT' });
  const before = await Promise.all(db.tables.map(table => table.toArray()));
  await expect(importBackup(inspection)).rejects.toThrow('SYNC_CLOCK_INVALID');
  expect(await Promise.all(db.tables.map(table => table.toArray()))).toEqual(before);
});
