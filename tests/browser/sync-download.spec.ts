import { expect, test } from '@playwright/test';

test('Chrome saves and reopens account-bound page progress without duplicating events', async ({ page }) => {
  await page.goto('/today');
  const result = await page.evaluate(async () => {
    const syncPath = '/src/data/sync.ts', databasePath = '/src/data/db.ts', sharedPath = '/src/shared/sync.ts';
    const sync = await import(syncPath), { db } = await import(databasePath), shared = await import(sharedPath);
    const batch = { product: 'Lingfern', formatVersion: 1, profileId: 'browser-sync', deviceId: 'other-device', batchId: 'page-batch', events: [{ id: 'event-one', deviceId: 'other-device', counter: 1, occurredAt: '2026-09-30T00:00:00.000Z', type: 'saved_item', payload: { memoryId: 'sense', saved: true, reviewEnabled: false } }] };
    const validated = await shared.validateSyncBatch(batch);
    const scope = { accountId: 1, profileId: 'browser-sync', bindingVersion: 'a'.repeat(43) };
    const file = { deviceId: batch.deviceId, batchId: batch.batchId, blobSha: 'b'.repeat(40), bytes: 2000 };
    const incoming = { scope, commit: 'c'.repeat(40), cursor: 'first', nextCursor: 'second', total: 2, files: [file], batches: [{ batch, hash: validated.hash, blobSha: file.blobSha }] };
    await sync.receiveSyncPage('browser-sync', incoming, db, scope);
    db.close(); await db.open();
    const progress = await sync.readSyncDownload('browser-sync', scope, db);
    const known = await sync.knownSyncFiles('browser-sync', scope, [{ deviceId: file.deviceId, batchId: file.batchId, blobSha: file.blobSha }], db);
    await sync.receiveSyncPage('browser-sync', { ...incoming, cursor: 'second', nextCursor: undefined, batches: [] }, db, { ...scope, expectedCursor: progress.nextCursor });
    return { version: db.verno, uploadKey: db.table('syncUploads').schema.primKey.keyPath, known: known.length, events: (await sync.readSyncEvents('browser-sync', db)).length, progress: await sync.readSyncDownload('browser-sync', scope, db), otherAccount: await sync.readSyncDownload('browser-sync', { ...scope, accountId: 2 }, db) };
  });
  expect(result.version).toBe(8);
  expect(result.uploadKey).toEqual(['profileId', 'accountId', 'bindingVersion', 'deviceId', 'batchId']);
  expect(result.known).toBe(1);
  expect(result.events).toBe(1);
  expect(result.progress.cursor).toBe('second');
  expect(result.progress.nextCursor).toBeUndefined();
  expect(result.otherAccount).toBeUndefined();
});
