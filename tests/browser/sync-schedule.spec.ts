import { expect, test } from '@playwright/test';
import { autoSyncFixture, connectSync, history, lookup, syncNow, syncState, synced } from './autoSyncFixture';

test.afterEach(async ({ page }) => { expect(await page.pageErrors()).toEqual([]); });

test('automatic debounce batches edits; idle polling is conditional and opt-out persists', async ({ page, context }) => {
  const server = autoSyncFixture(); await server.attach(context); await page.clock.install();
  await connectSync(page); await synced(page);
  const initial = server.calls.length;
  await lookup(page, 'apple'); await lookup(page, 'pear'); await lookup(page, 'i', 'ipa');
  await page.clock.fastForward(16000); await expect.poll(() => server.uploads.length).toBe(1); await synced(page);
  expect(server.uploads[0].events.filter(event => event.type === 'lookup')).toHaveLength(3);
  const before = server.calls.length;
  await page.clock.fastForward(60000); expect(server.calls.length).toBe(before);
  await page.clock.fastForward(65000); await expect.poll(() => server.calls.length).toBe(before + 2);
  expect(server.uploads).toHaveLength(1); expect(before - initial).toBe(5);
  await page.evaluate(async () => { const { stopSyncUpload } = await import('/src/data/syncClient.ts' as string); await stopSyncUpload('local-guest'); });
  await lookup(page, 'offline-choice'); await page.reload();
  const stopped = server.calls.filter(call => call.startsWith('/api/sync')).length;
  await page.clock.fastForward(300000); expect(server.calls.filter(call => call.startsWith('/api/sync'))).toHaveLength(stopped);
  expect(server.uploads).toHaveLength(1);
});

test('two browser devices restore, merge and update all history kinds live without refresh', async ({ browser }) => {
  const server = autoSyncFixture(), one = await browser.newContext(), two = await browser.newContext();
  try {
    await server.attach(one); await server.attach(two);
    const a = await one.newPage(), b = await two.newPage(); await a.clock.install(); await b.clock.install();
    await connectSync(a); await synced(a); await lookup(a, 'apple'); await lookup(a, 'each / every', 'grammar'); await syncNow(a); await synced(a);
    await b.goto('/today'); await lookup(b, 'i', 'ipa'); await connectSync(b); await synced(b);
    expect((await history(b)).map(row => row.term).sort()).toEqual(['apple', 'each / every', 'i']);
    await a.goto('/library/history'); await expect(a.locator('.history')).toHaveCount(2);
    await a.clock.fastForward(125000); await expect(a.locator('.history')).toHaveCount(3);
    await lookup(a, 'pear'); await lookup(b, 'since / for', 'grammar');
    await syncNow(a); await synced(a); await syncNow(b); await synced(b); await syncNow(a);
    await expect(a.locator('.history')).toHaveCount(5);
    expect((await history(a)).map(row => [row.kind, row.term, row.lookedUpAt, row.id]).sort()).toEqual((await history(b)).map(row => [row.kind, row.term, row.lookedUpAt, row.id]).sort());
    await synced(a);
    const sent = server.uploads.length; await a.clock.fastForward(125000); await b.clock.fastForward(125000);
    await synced(a); await synced(b); expect(server.uploads).toHaveLength(sent);
    expect(await a.pageErrors()).toEqual([]); expect(await b.pageErrors()).toEqual([]);
  } finally { await one.close(); await two.close(); }
});

test('observed deletion and clear survive an old offline device, reload and reconnect', async ({ browser }) => {
  const server = autoSyncFixture(), one = await browser.newContext(), two = await browser.newContext();
  try {
    await server.attach(one); await server.attach(two);
    const a = await one.newPage(), b = await two.newPage(); await a.clock.install(); await b.clock.install();
    await connectSync(a); await synced(a); await lookup(a, 'apple'); await lookup(a, 'pear'); await syncNow(a); await synced(a);
    await connectSync(b); await synced(b);
    await b.evaluate(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, value: false }); window.dispatchEvent(new Event('offline')); });
    await a.evaluate(async () => { const { readLookupHistory, removeLookup } = await import('/src/data/lookupHistory.ts' as string); const row = (await readLookupHistory('local-guest')).find((row: { term: string }) => row.term === 'apple')!; await removeLookup('local-guest', row.id); });
    await syncNow(a); await synced(a);
    await a.evaluate(async () => (await import('/src/data/lookupHistory.ts' as string)).clearLookupHistory('local-guest'));
    await lookup(a, 'after-clear'); await syncNow(a); await synced(a);
    await lookup(b, 'concurrent-offline'); await b.reload();
    await b.evaluate(() => window.dispatchEvent(new Event('online')));
    await b.clock.fastForward(16000);
    await expect.poll(async () => (await history(b)).map(row => row.term).sort()).toEqual(['after-clear', 'concurrent-offline']); await synced(b);
    await syncNow(a); await expect.poll(async () => (await history(a)).map(row => row.term).sort()).toEqual(['after-clear', 'concurrent-offline']);
    expect(server.uploads.flatMap(batch => batch.events).some(event => event.type === 'lookup_remove')).toBe(true);
    expect(server.uploads.flatMap(batch => batch.events).some(event => event.type === 'lookup_clear')).toBe(true);
  } finally { await one.close(); await two.close(); }
});

test('temporary failures back off, preserve the outbox and only mark success after an acknowledged retry', async ({ page, context }) => {
  const server = autoSyncFixture(); await server.attach(context); await page.clock.install();
  await connectSync(page); await synced(page); const success = (await syncState(page)).lastSuccessAt;
  await lookup(page, 'reliable'); server.loseAck(); await syncNow(page);
  await expect.poll(async () => (await syncState(page))?.phase).toBe('error');
  expect((await syncState(page)).lastSuccessAt).toBe(success);
  server.fail(2); await page.clock.fastForward(16000); await expect.poll(async () => (await syncState(page))?.attempts).toBe(2);
  await page.clock.fastForward(31000); await expect.poll(async () => (await syncState(page))?.attempts).toBe(3);
  const before = server.calls.length; await page.clock.fastForward(180000); expect(server.calls).toHaveLength(before);
  await page.clock.setFixedTime(new Date((await syncState(page)).retryAt + 1000));
  await page.clock.fastForward(15000); await synced(page);
  expect(await history(page)).toHaveLength(1);
  expect(new Set(server.uploads.map(batch => batch.batchId)).size).toBe(1);
  expect((await syncState(page)).lastSuccessAt).not.toBe(success);
});

test('two tabs coordinate one round and hidden/offline/configuring states stop traffic', async ({ page, context }) => {
  const server = autoSyncFixture(); await server.attach(context); await page.clock.install();
  await connectSync(page); await synced(page);
  const other = await context.newPage(); await other.clock.install(); await other.goto('/today');
  await lookup(page, 'one-upload'); await syncNow(page); await synced(page);
  expect(server.uploads).toHaveLength(1);
  await Promise.all([page, other].map(tab => tab.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); })));
  const hidden = server.calls.length; await page.clock.fastForward(150000); await other.clock.fastForward(150000); expect(server.calls).toHaveLength(hidden);
  await page.evaluate(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, value: false }); Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
  await lookup(page, 'offline'); await page.clock.fastForward(150000); expect(server.calls).toHaveLength(hidden);
  await page.evaluate(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, value: true }); window.dispatchEvent(new Event('online')); });
  await expect.poll(() => server.uploads.length).toBe(2); await synced(page);
});
