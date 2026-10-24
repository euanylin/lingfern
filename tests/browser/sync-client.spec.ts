import { expect, test } from '@playwright/test';

// Exercise transport primitives without starting a competing app coordinator.
test.beforeEach(async ({ context }) => { await context.route('**/__sync-client-test', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Isolated sync transport</title>' })); });

test('explicit upload round retries fixed batches and stops after local consent is withdrawn', async ({ page }) => {
  const scope = { accountId: 1, profileId: 'sync-client-browser', bindingVersion: 'a'.repeat(43) };
  const summary = { account: { id: 1, login: 'synthetic' }, csrfToken: 't'.repeat(43), syncAvailable: true, bindings: [{ name: 'lingfern-data', owner: 'synthetic', profileId: scope.profileId, disabled: false, bindingVersion: scope.bindingVersion }] };
  let lost = true;
  const batches: string[] = [];
  await page.route('**/api/session', route => route.fulfill({ json: summary }));
  await page.route('**/api/sync/batches', async route => {
    expect(route.request().headers()['x-csrf-token']).toBe(summary.csrfToken);
    const value = route.request().postDataJSON(); expect(value.scope).toEqual(scope);
    batches.push(value.batch.batchId);
    if (lost) return route.abort('failed');
    await route.fulfill({ json: { scope, batchId: value.batch.batchId, hash: value.hash, previouslyWritten: true } });
  });
  await page.goto('/__sync-client-test');
  const consent = await page.evaluate(async ({ scope, summary }) => {
    const { db } = await import('/src/data/db.ts' as string);
    const { appendSyncEvent } = await import('/src/data/sync.ts' as string);
    const { allowSyncUpload } = await import('/src/data/syncClient.ts' as string);
    await db.table('profiles').put({ id: scope.profileId, name: 'Synthetic profile', createdAt: new Date().toISOString() });
    await db.table('settings').bulkPut([{ key: 'activeProfile', value: scope.profileId }, { key: `profile:${scope.profileId}:syncAccount`, value: JSON.stringify({ accountId: 1, profileId: scope.profileId }) }]);
    await appendSyncEvent(scope.profileId, { type: 'saved_item', payload: { memoryId: 'synthetic-sense', saved: true } });
    return allowSyncUpload(scope.profileId, scope, summary);
  }, { scope, summary });
  expect(batches).toHaveLength(0);
  await expect(page.evaluate(async ({ scope, consent }) => {
    const { uploadSyncBatch } = await import('/src/data/syncClient.ts' as string);
    return uploadSyncBatch(scope.profileId, consent);
  }, { scope, consent })).rejects.toThrow();
  lost = false;
  expect(await page.evaluate(async ({ scope, consent }) => {
    const { uploadSyncBatch } = await import('/src/data/syncClient.ts' as string);
    return uploadSyncBatch(scope.profileId, consent);
  }, { scope, consent })).toBe('uploaded');
  expect(batches).toHaveLength(2); expect(new Set(batches).size).toBe(1);
  expect(await page.evaluate(async ({ scope, consent }) => {
    const { stopSyncUpload, uploadSyncBatch } = await import('/src/data/syncClient.ts' as string);
    await stopSyncUpload(scope.profileId);
    try { await uploadSyncBatch(scope.profileId, consent); return 'unexpected'; } catch (error) { return (error as Error).message; }
  }, { scope, consent })).toBe('SYNC_CONSENT_CHANGED');
  expect(batches).toHaveLength(2);
});

test('download pages commit in Chrome and repeated rounds reuse verified blob receipts', async ({ page }) => {
  const scope = { accountId: 1, profileId: 'sync-download-browser', bindingVersion: 'a'.repeat(43) };
  const summary = { account: { id: 1, login: 'synthetic' }, csrfToken: 't'.repeat(43), syncAvailable: true, bindings: [{ name: 'lingfern-data', owner: 'synthetic', profileId: scope.profileId, disabled: false, bindingVersion: scope.bindingVersion }] };
  await page.route('**/api/session', route => route.fulfill({ json: summary }));
  await page.goto('/__sync-client-test');
  const remote = await page.evaluate(async scope => {
    const { db } = await import('/src/data/db.ts' as string);
    const { validateSyncBatch } = await import('/src/shared/sync.ts' as string);
    await db.table('profiles').put({ id: scope.profileId, name: 'Synthetic download profile', createdAt: new Date().toISOString() });
    await db.table('settings').bulkPut([{ key: 'activeProfile', value: scope.profileId }, { key: `profile:${scope.profileId}:syncAccount`, value: JSON.stringify({ accountId: scope.accountId, profileId: scope.profileId }) }]);
    const value = await validateSyncBatch({ product: 'Lingfern', formatVersion: 1, profileId: scope.profileId, deviceId: 'remote', batchId: 'remote-batch', events: [{ id: 'remote-event', deviceId: 'remote', counter: 1, occurredAt: '2026-01-01T00:00:00.000Z', type: 'saved_item', payload: { memoryId: 'synthetic-sense', saved: true } }] });
    return { scope, commit: 'c'.repeat(40), cursor: 'first', total: 1, files: [{ deviceId: 'remote', batchId: 'remote-batch', blobSha: 'b'.repeat(40), bytes: value.bytes.length }], batches: [{ batch: value.batch, hash: value.hash, blobSha: 'b'.repeat(40) }] };
  }, scope);
  let round = 0;
  const known: unknown[] = [];
  await page.route('**/api/sync/changes?*', route => {
    const query = new URL(route.request().url()).searchParams;
    expect(query.get('profileId')).toBe(scope.profileId);
    const cursor = round === 0 ? 'first' : 'again';
    if (query.has('metadata')) return route.fulfill({ json: { ...remote, cursor, batches: [] } });
    expect(query.get('cursor')).toBe(cursor);
    const cached = JSON.parse(query.get('known')!); known.push(cached);
    return route.fulfill({ json: { ...remote, cursor, batches: cached.length ? [] : remote.batches } });
  });
  for (round = 0; round < 2; round++) {
    expect((await page.evaluate(async scope => {
      const { downloadSyncPage } = await import('/src/data/syncClient.ts' as string);
      return downloadSyncPage(scope.profileId, scope);
    }, scope)).nextCursor).toBeUndefined();
  }
  expect(known).toEqual([[], [{ deviceId: 'remote', batchId: 'remote-batch', blobSha: 'b'.repeat(40) }]]);
  const state = await page.evaluate(async scope => {
    const { db } = await import('/src/data/db.ts' as string);
    return { events: await db.table('syncEvents').where('profileId').equals(scope.profileId).count(), receipts: await db.table('syncReceipts').where('profileId').equals(scope.profileId).count(), cursor: (await db.table('syncDownloads').get([scope.profileId, scope.accountId, scope.bindingVersion])).cursor };
  }, scope);
  expect(state).toEqual({ events: 1, receipts: 1, cursor: 'again' });
});

test('native browser lock prevents another tab from sending a simultaneous sync request', async ({ page, context }) => {
  const scope = { accountId: 1, profileId: 'sync-lock-browser', bindingVersion: 'a'.repeat(43) };
  const summary = { account: { id: 1, login: 'synthetic' }, csrfToken: 't'.repeat(43), syncAvailable: true, bindings: [{ name: 'lingfern-data', owner: 'synthetic', profileId: scope.profileId, disabled: false, bindingVersion: scope.bindingVersion }] };
  await page.goto('/__sync-client-test');
  const consent = await page.evaluate(async ({ scope, summary }) => {
    const { db } = await import('/src/data/db.ts' as string);
    const { allowSyncUpload } = await import('/src/data/syncClient.ts' as string);
    await db.table('profiles').put({ id: scope.profileId, name: 'Synthetic lock profile', createdAt: new Date().toISOString() });
    await db.table('settings').bulkPut([{ key: 'activeProfile', value: scope.profileId }, { key: `profile:${scope.profileId}:syncAccount`, value: JSON.stringify({ accountId: 1, profileId: scope.profileId }) }]);
    return allowSyncUpload(scope.profileId, scope, summary);
  }, { scope, summary });
  const other = await context.newPage(); await other.goto('/__sync-client-test');
  await other.evaluate(async profileId => {
    await new Promise<void>(ready => {
      void navigator.locks.request(`lingfern-sync:${profileId}`, async () => {
        await new Promise<void>(release => { (globalThis as unknown as { syncTestRelease: () => void }).syncTestRelease = release; ready(); });
      });
    });
  }, scope.profileId);
  let requests = 0;
  page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) requests++; });
  const result = await page.evaluate(async ({ scope, consent }) => {
    const { uploadSyncBatch } = await import('/src/data/syncClient.ts' as string);
    try { await uploadSyncBatch(scope.profileId, consent); return 'unexpected'; } catch (error) { return (error as Error).message; }
  }, { scope, consent });
  expect(result).toBe('SYNC_BUSY'); expect(requests).toBe(0);
  await other.close();
  // WebKit may finish closing the page before its native lock has been released.
  await expect.poll(() => page.evaluate(async ({ scope, consent }) => {
    const { uploadSyncBatch } = await import('/src/data/syncClient.ts' as string);
    try { return await uploadSyncBatch(scope.profileId, consent); }
    catch (error) { if ((error as Error).message === 'SYNC_BUSY') return 'SYNC_BUSY'; throw error; }
  }, { scope, consent })).toBe('idle');
  expect(requests).toBe(0);
});
