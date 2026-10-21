import { expect, test } from '@playwright/test';

test('foreground timer batches pending records after consent and stays idle once confirmed', async ({ page }) => {
  await page.clock.install();
  const scope = { accountId: 1, profileId: 'local-guest', bindingVersion: 'a'.repeat(43) };
  const summary = { account: { id: 1, login: 'synthetic' }, csrfToken: 't'.repeat(43), syncAvailable: true, bindings: [{ name: 'lingfern-data', owner: 'synthetic', profileId: scope.profileId, disabled: false, bindingVersion: scope.bindingVersion }] };
  let uploads = 0, calls = 0;
  await page.route('**/api/session', route => { calls++; return route.fulfill({ json: summary }); });
  await page.route('**/api/sync/changes?*', route => {
    calls++;
    return route.fulfill({ json: { scope, commit: 'c'.repeat(40), cursor: 'first', total: 0, files: [], batches: [] } });
  });
  await page.route('**/api/sync/batches', route => {
    calls++; uploads++; const value = route.request().postDataJSON();
    return route.fulfill({ json: { scope, batchId: value.batch.batchId, hash: value.hash, previouslyWritten: false } });
  });
  await page.goto('/today'); await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
  await page.clock.fastForward(60000); expect(calls).toBe(0);
  await page.evaluate(async ({ scope, summary }) => {
    const { settings } = await import('/src/data/db.ts' as string);
    const { appendSyncEvent } = await import('/src/data/sync.ts' as string);
    const { allowSyncUpload } = await import('/src/data/syncClient.ts' as string);
    await settings.put({ key: 'profile:local-guest:syncAccount', value: JSON.stringify({ accountId: 1, profileId: 'local-guest' }) });
    await appendSyncEvent('local-guest', { type: 'saved_item', payload: { memoryId: 'synthetic-sense', saved: true, reviewEnabled: false } });
    await allowSyncUpload('local-guest', scope, summary);
  }, { scope, summary });
  expect(calls).toBe(0);
  await page.clock.fastForward(60000);
  await expect.poll(() => uploads).toBe(1);
  await expect.poll(async () => page.evaluate(async () => {
    const { db } = await import('/src/data/db.ts' as string); return db.table('syncUploads').count();
  })).toBe(1);
  const finished = calls;
  await page.clock.fastForward(180000); expect(calls).toBe(finished);
  await page.evaluate(async () => {
    const { stopSyncUpload } = await import('/src/data/syncClient.ts' as string);
    const { appendSyncEvent } = await import('/src/data/sync.ts' as string);
    await stopSyncUpload('local-guest');
    await appendSyncEvent('local-guest', { type: 'saved_item', payload: { memoryId: 'another-sense', saved: true, reviewEnabled: false } });
  });
  await page.clock.fastForward(60000); expect(uploads).toBe(1);
});

test('hidden and offline states suppress scheduled traffic, and a synthetic task completion wakes foreground work', async ({ page }) => {
  await page.clock.install();
  const scope = { accountId: 1, profileId: 'local-guest', bindingVersion: 'a'.repeat(43) };
  const summary = { account: { id: 1, login: 'synthetic' }, csrfToken: 't'.repeat(43), syncAvailable: true, bindings: [{ name: 'lingfern-data', owner: 'synthetic', profileId: scope.profileId, disabled: false, bindingVersion: scope.bindingVersion }] };
  let uploads = 0, calls = 0;
  await page.route('**/api/session', route => { calls++; return route.fulfill({ json: summary }); });
  await page.route('**/api/sync/changes?*', route => { calls++; return route.fulfill({ json: { scope, commit: 'c'.repeat(40), cursor: 'first', total: 0, files: [], batches: [] } }); });
  await page.route('**/api/sync/batches', route => { uploads++; const value = route.request().postDataJSON(); return route.fulfill({ json: { scope, batchId: value.batch.batchId, hash: value.hash, previouslyWritten: false } }); });
  await page.goto('/today'); await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
  await page.evaluate(async ({ scope, summary }) => {
    const { settings, db } = await import('/src/data/db.ts' as string);
    const { appendSyncEvent } = await import('/src/data/sync.ts' as string);
    const { allowSyncUpload } = await import('/src/data/syncClient.ts' as string);
    await settings.put({ key: 'profile:local-guest:syncAccount', value: JSON.stringify({ accountId: 1, profileId: 'local-guest' }) });
    await appendSyncEvent('local-guest', { type: 'saved_item', payload: { memoryId: 'synthetic-sense', saved: true, reviewEnabled: false } });
    await allowSyncUpload('local-guest', scope, summary);
    // Check observer contracts; verify full learning flows separately.
    await db.table('sessions').put({ id: 'synthetic-completion', profileId: 'local-guest', status: 'active' });
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange'));
  }, { scope, summary });
  await page.clock.fastForward(60000); expect(calls).toBe(0);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.clock.fastForward(60000); expect(calls).toBe(0);
  await page.evaluate(async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    const { db } = await import('/src/data/db.ts' as string);
    await db.table('sessions').update('synthetic-completion', { status: 'completed' });
  });
  await expect.poll(() => uploads).toBe(1);
});

test('automatic transient retries stop after two retries and preserve pending batches', async ({ page }) => {
  await page.clock.install();
  const scope = { accountId: 1, profileId: 'local-guest', bindingVersion: 'a'.repeat(43) };
  const summary = { account: { id: 1, login: 'synthetic' }, csrfToken: 't'.repeat(43), syncAvailable: true, bindings: [{ name: 'lingfern-data', owner: 'synthetic', profileId: scope.profileId, disabled: false, bindingVersion: scope.bindingVersion }] };
  let requests = 0;
  await page.route('**/api/session', route => { requests++; return route.fulfill({ status: 503, json: { error: 'AUTH_UNAVAILABLE' } }); });
  await page.goto('/today'); await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
  await page.evaluate(async ({ scope, summary }) => {
    const { settings } = await import('/src/data/db.ts' as string);
    const { appendSyncEvent } = await import('/src/data/sync.ts' as string);
    const { allowSyncUpload } = await import('/src/data/syncClient.ts' as string);
    await settings.put({ key: 'profile:local-guest:syncAccount', value: JSON.stringify({ accountId: 1, profileId: 'local-guest' }) });
    await appendSyncEvent('local-guest', { type: 'saved_item', payload: { memoryId: 'synthetic-sense', saved: true, reviewEnabled: false } });
    await allowSyncUpload('local-guest', scope, summary);
  }, { scope, summary });
  await page.clock.fastForward(60000); await expect.poll(() => requests).toBe(1);
  await expect.poll(async () => page.evaluate(async scope => { const { settings } = await import('/src/data/db.ts' as string); return (await settings.get(`profile:${scope.profileId}:syncSchedule:${scope.accountId}:${scope.bindingVersion}`))?.value; }, scope)).toBe('retry');
  await page.clock.fastForward(120000); await expect.poll(() => requests).toBe(2);
  await page.clock.fastForward(180000); await expect.poll(() => requests).toBe(3);
  await page.clock.fastForward(3600000); expect(requests).toBe(3);
  const state = await page.evaluate(async scope => {
    const { db } = await import('/src/data/db.ts' as string);
    return { batches: await db.table('syncBatches').where('profileId').equals(scope.profileId).toArray(), status: (await db.table('settings').get(`profile:${scope.profileId}:syncSchedule:${scope.accountId}:${scope.bindingVersion}`)).value, receipts: await db.table('syncUploads').count() };
  }, scope);
  expect(state.status).toBe('paused'); expect(state.receipts).toBe(0);
  expect(state.batches).toHaveLength(1); expect(state.batches[0].state).toBe('pending');
});
