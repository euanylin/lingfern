import { afterEach, expect, it } from 'vitest';
import Dexie from 'dexie';
import { syncConflictReport, appendSyncEvent, confirmSyncUpload, nextSyncUpload, confirmSyncBatch, pendingSyncBatch, readSyncEvents, readSyncDownload, knownSyncFiles, receiveSyncPage, receiveSyncBatch } from '../src/data/sync';
import { projectSyncEvents, validateSyncBatch } from '../src/shared/sync';

const databases: Dexie[] = [];
function device() {
  const database = new Dexie(`sync-test-${crypto.randomUUID()}`);
  database.version(1).stores({ syncEvents: '[profileId+id], profileId', syncBatches: '[profileId+deviceId+batchId], profileId, [profileId+state]', syncClocks: 'profileId', syncConflicts: '[profileId+hash], profileId', syncDownloads: '[profileId+accountId+bindingVersion], profileId', syncReceipts: '[profileId+accountId+bindingVersion+deviceId+batchId], profileId', syncUploads: '[profileId+accountId+bindingVersion+deviceId+batchId], profileId' });
  databases.push(database);
  return database;
}
afterEach(async () => { await Promise.all(databases.splice(0).map(database => database.delete())); });

it('persists one immutable batch across concurrent tabs, reopening and lost acknowledgement', async () => {
  const database = device();
  await appendSyncEvent('p', { type: 'saved_item', payload: { memoryId: 'sense', saved: true, reviewEnabled: false } }, database);
  const [a, b] = await Promise.all([pendingSyncBatch('p', database), pendingSyncBatch('p', database)]);
  expect(a).toEqual(b);
  database.close(); await database.open();
  expect(await pendingSyncBatch('p', database)).toEqual(a);
  await expect(confirmSyncBatch('p', a!.deviceId, a!.batchId, 'wrong', database)).rejects.toThrow('SYNC_ACK_INVALID');
  expect(await pendingSyncBatch('p', database)).toEqual(a);
  await confirmSyncBatch('p', a!.deviceId, a!.batchId, a!.hash, database);
  await confirmSyncBatch('p', a!.deviceId, a!.batchId, a!.hash, database);
  expect(await pendingSyncBatch('p', database)).toBeUndefined();
});

it('two separate databases converge and increment the largest merged counter', async () => {
  const a = device(), b = device();
  await appendSyncEvent('p', { type: 'saved_item', payload: { memoryId: 'sense', saved: true, reviewEnabled: false } }, a);
  await appendSyncEvent('p', { type: 'saved_item', payload: { memoryId: 'other', saved: true, reviewEnabled: false } }, b);
  const ba = (await pendingSyncBatch('p', a))!, bb = (await pendingSyncBatch('p', b))!;
  expect(ba.deviceId).not.toBe(bb.deviceId);
  expect(await receiveSyncBatch('p', ba.batch, ba.hash, b)).toBe('received');
  expect(await receiveSyncBatch('p', bb.batch, bb.hash, a)).toBe('received');
  expect(await receiveSyncBatch('p', ba.batch, ba.hash, b)).toBe('duplicate');
  expect(await readSyncEvents('p', a)).toEqual(await readSyncEvents('p', b));
  await confirmSyncBatch('p', bb.deviceId, bb.batchId, bb.hash, b);
  const next = await appendSyncEvent('p', { type: 'saved_item', payload: { memoryId: 'sense', saved: false, reviewEnabled: false } }, b);
  expect(next.counter).toBe(2);
  const change = (await pendingSyncBatch('p', b))!;
  await receiveSyncBatch('p', change.batch, change.hash, a);
  expect(projectSyncEvents(await readSyncEvents('p', a)).savedItems.get('sense')?.payload.saved).toBe(false);
  expect(await readSyncEvents('p', a)).toEqual(await readSyncEvents('p', b));
});

it('retains both conflicting payloads and applies none of a conflicting batch', async () => {
  const a = device(), b = device();
  await appendSyncEvent('p', { type: 'saved_item', payload: { memoryId: 'sense', saved: true, reviewEnabled: false } }, a);
  const original = (await pendingSyncBatch('p', a))!;
  await receiveSyncBatch('p', original.batch, original.hash, b);
  const altered = { ...original.batch, events: original.batch.events.map(event => ({ ...event, occurredAt: '2026-01-01T00:00:00.000Z' })) };
  const changed = await validateSyncBatch(altered);
  expect(await receiveSyncBatch('p', changed.batch, changed.hash, b)).toBe('conflict');
  expect(await b.table('syncConflicts').count()).toBe(1);
  const differentId = await validateSyncBatch({ ...altered, batchId: 'different' });
  expect(await receiveSyncBatch('p', differentId.batch, differentId.hash, b)).toBe('conflict');
  expect(await b.table('syncBatches').get(['p', altered.deviceId, 'different'])).toMatchObject({ state: 'conflict', batch: differentId.batch });
  expect(await readSyncEvents('p', b)).toEqual(original.batch.events);
  await expect(receiveSyncBatch('another-profile', original.batch, original.hash, b)).rejects.toThrow('SYNC_INTEGRITY');
});

it('transaction failure saves neither event nor logical counter', async () => {
  const database = device();
  const fail = () => { throw new Error('STORAGE_FAILURE'); };
  database.table('syncEvents').hook('creating', fail);
  await expect(appendSyncEvent('p', { type: 'saved_item', payload: { memoryId: 'sense', saved: true, reviewEnabled: false } }, database)).rejects.toThrow('STORAGE_FAILURE');
  expect(await database.table('syncClocks').count()).toBe(0);
  expect(await database.table('syncEvents').count()).toBe(0);
});

it('rolls back the complete downloaded batch and clock when an event write fails', async () => {
  const a = device(), b = device();
  await appendSyncEvent('p', { type: 'saved_item', payload: { memoryId: 'sense', saved: true, reviewEnabled: false } }, a);
  const batch = (await pendingSyncBatch('p', a))!;
  b.table('syncEvents').hook('creating', () => { throw new Error('STORAGE_FAILURE'); });
  await expect(receiveSyncBatch('p', batch.batch, batch.hash, b)).rejects.toThrow('STORAGE_FAILURE');
  expect(await b.table('syncBatches').count()).toBe(0);
  expect(await b.table('syncClocks').count()).toBe(0);
  expect(await b.table('syncEvents').count()).toBe(0);
});


it('commits a complete page atomically, retries duplicates and quarantines conflicts', async () => {
  const a = device(), b = device(), destination = device();
  await appendSyncEvent('p', { type: 'saved_item', payload: { memoryId: 'first', saved: true, reviewEnabled: false } }, a);
  await appendSyncEvent('p', { type: 'saved_item', payload: { memoryId: 'second', saved: true, reviewEnabled: false } }, b);
  const batches = [(await pendingSyncBatch('p', a))!, (await pendingSyncBatch('p', b))!];
  const page = { commit: 'a'.repeat(40), cursor: 'current', nextCursor: 'next', total: 2,
    files: batches.map(batch => ({ deviceId: batch.deviceId, batchId: batch.batchId, blobSha: 'b'.repeat(40), bytes: 2000 })),
    batches: batches.map(batch => ({ batch: batch.batch, hash: batch.hash, blobSha: 'b'.repeat(40) })) };
  let writes = 0;
  const fail = () => { if (++writes === 2) throw new Error('STORAGE_FAILURE'); };
  destination.table('syncEvents').hook('creating', fail);
  await expect(receiveSyncPage('p', page, destination)).rejects.toThrow('STORAGE_FAILURE');
  for (const name of ['syncEvents', 'syncBatches', 'syncClocks', 'syncConflicts']) expect(await destination.table(name).count()).toBe(0);
  destination.table('syncEvents').hook('creating').unsubscribe(fail);
  expect(await receiveSyncPage('p', page, destination)).toEqual({ results: ['received', 'received'], commit: page.commit, nextCursor: 'next' });
  expect((await receiveSyncPage('p', page, destination)).results).toEqual(['duplicate', 'duplicate']);
  expect(await destination.table('syncEvents').count()).toBe(2);
  const changed = await validateSyncBatch({ ...batches[1].batch, events: batches[1].batch.events.map(event => ({ ...event, occurredAt: '2026-01-01T00:00:00.000Z' })) });
  const conflict = { ...page, batches: [page.batches[0], { batch: changed.batch, hash: changed.hash, blobSha: page.batches[1].blobSha }] };
  expect((await receiveSyncPage('p', conflict, destination)).results).toEqual(['duplicate', 'conflict']);
  expect(await destination.table('syncConflicts').count()).toBe(1);
  expect(await destination.table('syncEvents').count()).toBe(2);
  await expect(receiveSyncPage('p', { ...page, batches: [page.batches[0]] }, destination)).rejects.toThrow('SYNC_PAGE_INVALID');
  await expect(receiveSyncPage('p', { ...page, batches: [page.batches[0], page.batches[0]] }, destination)).rejects.toThrow('SYNC_INTEGRITY');
  await expect(receiveSyncPage('wrong', page, destination)).rejects.toThrow('SYNC_INTEGRITY');
  const fresh = device();
  const foreign = await validateSyncBatch({ ...batches[1].batch, profileId: 'other' });
  await expect(receiveSyncPage('p', { ...page, batches: [page.batches[0], { batch: foreign.batch, hash: foreign.hash, blobSha: page.batches[1].blobSha }] }, fresh)).rejects.toThrow('SYNC_INTEGRITY');
  expect(await fresh.table('syncEvents').count()).toBe(0);
  expect(await fresh.table('syncBatches').count()).toBe(0);
  await expect(receiveSyncPage('p', { ...page, batches: [page.batches[0], { ...page.batches[1], hash: '0'.repeat(64) }] }, fresh)).rejects.toThrow('SYNC_INTEGRITY');
  expect(await fresh.table('syncClocks').count()).toBe(0);
});


it('persists account-bound receipts and progress with page data, rejects stale tabs and missing cached batches', async () => {
  const source = device(), destination = device();
  await appendSyncEvent('p', { type: 'saved_item', payload: { memoryId: 'sense', saved: true, reviewEnabled: false } }, source);
  const stored = (await pendingSyncBatch('p', source))!;
  const scope = { accountId: 1, profileId: 'p', bindingVersion: 'a'.repeat(43) };
  const file = { deviceId: stored.deviceId, batchId: stored.batchId, blobSha: 'b'.repeat(40), bytes: 2000 };
  const page = { scope, commit: 'a'.repeat(40), cursor: 'first', nextCursor: 'second', total: 2, files: [file], batches: [{ batch: stored.batch, hash: stored.hash, blobSha: file.blobSha }] };
  const known = [{ deviceId: file.deviceId, batchId: file.batchId, blobSha: file.blobSha }];
  expect(await knownSyncFiles('p', scope, known, destination)).toEqual([]);
  const fail = () => { throw new Error('STORAGE_FAILURE'); };
  destination.table('syncDownloads').hook('creating', fail);
  await expect(receiveSyncPage('p', page, destination, scope)).rejects.toThrow('STORAGE_FAILURE');
  for (const name of ['syncEvents', 'syncBatches', 'syncClocks', 'syncReceipts', 'syncDownloads']) expect(await destination.table(name).count()).toBe(0);
  destination.table('syncDownloads').hook('creating').unsubscribe(fail);
  await receiveSyncPage('p', page, destination, scope);
  destination.close(); await destination.open();
  expect(await readSyncDownload('p', scope, destination)).toMatchObject({ cursor: 'first', nextCursor: 'second', commit: page.commit });
  expect(await knownSyncFiles('p', scope, known, destination)).toEqual(known);
  const otherAccount = { ...scope, accountId: 2 }, rebound = { ...scope, bindingVersion: 'c'.repeat(43) };
  expect(await readSyncDownload('p', otherAccount, destination)).toBeUndefined();
  expect(await knownSyncFiles('p', otherAccount, known, destination)).toEqual([]);
  expect(await knownSyncFiles('p', rebound, known, destination)).toEqual([]);
  await expect(receiveSyncPage('p', page, destination, otherAccount)).rejects.toThrow('SYNC_SCOPE_CHANGED');
  const second = { ...page, cursor: 'second', nextCursor: undefined, batches: [] };
  await expect(receiveSyncPage('p', second, destination, scope)).rejects.toThrow('SYNC_DOWNLOAD_CHANGED');
  await receiveSyncPage('p', second, destination, { ...scope, expectedCursor: 'second' });
  expect(await readSyncDownload('p', scope, destination)).toMatchObject({ cursor: 'second' });
  expect((await readSyncDownload('p', scope, destination))?.nextCursor).toBeUndefined();
  await expect(receiveSyncPage('p', page, destination, { ...scope, expectedCursor: 'second' })).rejects.toThrow('SYNC_DOWNLOAD_CHANGED');
  await destination.table('syncBatches').delete(['p', file.deviceId, file.batchId]);
  expect(await knownSyncFiles('p', scope, known, destination)).toEqual([]);
  await expect(receiveSyncPage('p', { ...page, cursor: 'new-round', batches: [] }, destination, { ...scope, previousCursor: 'second' })).rejects.toThrow('SYNC_RECEIPT_MISSING');
  expect((await readSyncDownload('p', scope, destination))?.cursor).toBe('second');
});

it('checks restored logical profiles and retained conflict payloads before skipping immutable files', async () => {
  const source = device(), destination = device();
  await appendSyncEvent('p', { type: 'saved_item', payload: { memoryId: 'sense', saved: true, reviewEnabled: false } }, source);
  const original = (await pendingSyncBatch('p', source))!;
  const changed = await validateSyncBatch({ ...original.batch, events: original.batch.events.map(event => ({ ...event, occurredAt: '2026-01-01T00:00:00.000Z' })) });
  await destination.table('syncClocks').put({ profileId: 'restored', logicalProfileId: 'p', deviceId: 'restored-device', counter: 0 });
  await receiveSyncBatch('restored', original.batch, original.hash, destination);
  const scope = { accountId: 1, profileId: 'p', bindingVersion: 'a'.repeat(43) };
  const file = { deviceId: original.deviceId, batchId: original.batchId, blobSha: 'b'.repeat(40), bytes: 2000 };
  const page = { scope, commit: 'a'.repeat(40), cursor: 'first', total: 1, files: [file], batches: [{ batch: changed.batch, hash: changed.hash, blobSha: file.blobSha }] };
  expect((await receiveSyncPage('restored', page, destination, scope)).results).toEqual(['conflict']);
  const known = [{ deviceId: file.deviceId, batchId: file.batchId, blobSha: file.blobSha }];
  expect(await knownSyncFiles('restored', scope, known, destination)).toEqual(known);
  await destination.table('syncConflicts').update(['restored', changed.hash], { batch: original.batch });
  expect(await knownSyncFiles('restored', scope, known, destination)).toEqual([]);
  await expect(receiveSyncPage('wrong-profile', { ...page, files: [], batches: [] }, destination, scope)).rejects.toThrow('SYNC_INTEGRITY');
  expect(await destination.table('syncDownloads').get(['wrong-profile', 1, scope.bindingVersion])).toBeUndefined();
});


it('persists scoped upload receipts without trusting another account or binding generation', async () => {
  const database = device(), scope = { accountId: 1, profileId: 'p', bindingVersion: 'a'.repeat(43) };
  await appendSyncEvent('p', { type: 'saved_item', payload: { memoryId: 'sense', saved: true, reviewEnabled: false } }, database);
  const stored = (await nextSyncUpload('p', scope, database))!;
  const expected = { scope, deviceId: stored.deviceId, batchId: stored.batchId, hash: stored.hash };
  const ack = { scope, batchId: stored.batchId, hash: stored.hash, previouslyWritten: false };
  for (const invalid of [{ ...ack, hash: '0'.repeat(64) }, { ...ack, batchId: 'other' }, { ...ack, scope: { ...scope, accountId: 2 } }, { ...ack, scope: { ...scope, bindingVersion: 'b'.repeat(43) } }]) {
    await expect(confirmSyncUpload('p', expected, invalid, database)).rejects.toThrow('SYNC_ACK_INVALID');
  }
  expect(await database.table('syncUploads').count()).toBe(0);
  const fail = () => { throw new Error('STORAGE_FAILURE'); };
  database.table('syncBatches').hook('updating', fail);
  await expect(confirmSyncUpload('p', expected, ack, database)).rejects.toThrow('STORAGE_FAILURE');
  expect(await database.table('syncUploads').count()).toBe(0);
  expect(await nextSyncUpload('p', scope, database)).toEqual(stored);
  database.table('syncBatches').hook('updating').unsubscribe(fail);
  await confirmSyncUpload('p', expected, ack, database);
  await confirmSyncUpload('p', expected, { ...ack, previouslyWritten: true }, database);
  database.close(); await database.open();
  expect(await nextSyncUpload('p', scope, database)).toBeUndefined();
  for (const changed of [{ ...scope, accountId: 2 }, { ...scope, bindingVersion: 'b'.repeat(43) }]) {
    expect((await nextSyncUpload('p', changed, database))?.batch).toEqual(stored.batch);
  }
  await expect(nextSyncUpload('p', { ...scope, profileId: 'foreign' }, database)).rejects.toThrow('SYNC_SCOPE_CHANGED');
  await database.table('syncBatches').update(['p', stored.deviceId, stored.batchId], { hash: '0'.repeat(64) });
  await expect(nextSyncUpload('p', scope, database)).rejects.toThrow('SYNC_INTEGRITY');
});


it('does not upload quarantined profiles and does not inherit another destination receipt for received batches', async () => {
  const source = device(), destination = device(), scope = { accountId: 1, profileId: 'p', bindingVersion: 'a'.repeat(43) };
  await appendSyncEvent('p', { type: 'saved_item', payload: { memoryId: 'sense', saved: true, reviewEnabled: false } }, source);
  const stored = (await nextSyncUpload('p', scope, source))!;
  await receiveSyncBatch('p', stored.batch, stored.hash, destination);
  expect((await nextSyncUpload('p', scope, destination))?.batch).toEqual(stored.batch);
  const changed = await validateSyncBatch({ ...stored.batch, events: stored.batch.events.map(event => ({ ...event, occurredAt: '2025-01-01T00:00:00.000Z' })) });
  expect(await receiveSyncBatch('p', changed.batch, changed.hash, destination)).toBe('conflict');
  await expect(nextSyncUpload('p', scope, destination)).rejects.toThrow('SYNC_BATCH_CONFLICT');
});


it('exports both validated conflict copies without mutations or foreign-profile access', async () => {
  const database = device();
  const event = { id: 'conflicting-event', deviceId: 'remote', counter: 1, occurredAt: '2026-09-30T00:00:00.000Z', type: 'saved_item', payload: { memoryId: 'sense', saved: true, reviewEnabled: false } };
  const original = await validateSyncBatch({ product: 'Lingfern', formatVersion: 1, profileId: 'p', deviceId: 'remote', batchId: 'fixed', events: [event] });
  await receiveSyncBatch('p', original.batch, original.hash, database);
  for (const batchId of ['fixed', 'different']) {
    const incoming = await validateSyncBatch({ ...original.batch, batchId, events: [{ ...event, payload: { ...event.payload, saved: false } }] });
    expect(await receiveSyncBatch('p', incoming.batch, incoming.hash, database)).toBe('conflict');
    const before = await Promise.all(database.tables.map(table => table.toArray()));
    const report = await syncConflictReport('p', incoming.hash, database);
    expect(report.incoming).toEqual({ batch: incoming.batch, hash: incoming.hash });
    expect(report.originalEvents).toEqual([original.batch.events[0]]);
    expect(report.originalBatch).toEqual(batchId === 'fixed' ? { batch: original.batch, hash: original.hash } : undefined);
    expect(await Promise.all(database.tables.map(table => table.toArray()))).toEqual(before);
    await expect(syncConflictReport('other', incoming.hash, database)).rejects.toThrow('NOT_FOUND');
    await expect(syncConflictReport('p', '../invalid', database)).rejects.toThrow('SYNC_INTEGRITY');
  }
  await expect(nextSyncUpload('p', { accountId: 1, profileId: 'p', bindingVersion: 'a'.repeat(43) }, database)).rejects.toThrow('SYNC_BATCH_CONFLICT');
});
