import { expect, test, type Page } from '@playwright/test';
import { autoSyncFixture } from '../browser/autoSyncFixture';

// Read/write only synthetic browser state; exercise the compiled app and Service Worker.
async function stored(page: Page, table: string) {
  return page.evaluate(table => new Promise<Record<string, unknown>[]>((resolve, reject) => {
    const open = indexedDB.open('lingfern'); open.onerror = () => reject(open.error);
    open.onsuccess = () => { const database = open.result, tx = database.transaction(table), request = tx.objectStore(table).getAll(); request.onsuccess = () => resolve(request.result); tx.oncomplete = () => database.close(); tx.onerror = () => reject(tx.error); };
  }), table);
}
async function configure(page: Page, legacy = false) {
  await page.goto('/today'); await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
  await page.evaluate(legacy => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('lingfern'); open.onerror = () => reject(open.error);
    open.onsuccess = () => { const database = open.result, tx = database.transaction('settings', 'readwrite'), settings = tx.objectStore('settings');
      settings.put({ key: 'profile:local-guest:syncAccount', value: JSON.stringify({ accountId: 1, profileId: 'local-guest' }) });
      if (legacy) settings.put({ key: 'profile:local-guest:lookupHistory', value: JSON.stringify([{ kind: 'dictionary', term: 'apple', lookedUpAt: '2026-10-01T01:00:00.000Z' }, { kind: 'grammar', term: 'each / every', lookedUpAt: '2026-10-01T02:00:00.000Z' }, { kind: 'ipa', term: 'ɪ', lookedUpAt: '2026-10-01T03:00:00.000Z' }]) });
      tx.oncomplete = () => { database.close(); resolve(); }; tx.onerror = () => reject(tx.error);
    };
  }), legacy);
  await page.goto('/library/history');
}
async function settled(page: Page) {
  await expect.poll(async () => {
    const rows = await stored(page, 'settings'), key = `profile:local-guest:autoSync:1:local-guest:${'a'.repeat(43)}:`;
    const state = JSON.parse(rows.find(row => row.key === key + 'state')?.value as string || '{}');
    const clock = (await stored(page, 'syncClocks'))[0];
    return state.phase === 'synced' && state.localRevision === (clock?.localRevision ?? 0);
  }).toBe(true);
}

test('compiled automatic sync migrates history, preserves offline reloads, restores a new device and applies remote clear live', async ({ page, context, browser }) => {
  const server = autoSyncFixture(); await server.attach(context); await page.clock.install();
  await configure(page, true); await expect(page.locator('.history')).toHaveCount(3); await settled(page);
  await page.goto('/library'); await page.getByRole('button', { name: /^通用材料/ }).last().click();
  const grammar = page.locator('.package-row').filter({ hasText: '英语用法词典' });
  await grammar.locator('input').check(); await page.getByRole('button', { name: '下载所选资源', exact: true }).click(); await expect(grammar).toContainText('已安装');
  await page.clock.fastForward(16000); await settled(page);
  await page.evaluate(() => navigator.serviceWorker.ready); await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.goto('/library/grammar?q=since%20%2F%20for'); await expect(page.locator('#grammar-since-for')).toHaveAttribute('open', '');
  await page.goto('/library/history'); await expect(page.locator('.history')).toHaveCount(4); await page.reload(); await expect(page.locator('.history')).toHaveCount(4);
  const before = server.uploads.length;
  await page.clock.fastForward(150000); expect(server.uploads).toHaveLength(before);
  await context.setOffline(false); await page.clock.fastForward(16000); await settled(page);
  expect(server.uploads.length).toBeGreaterThan(before);
  const lookupEvents = server.uploads.flatMap(batch => batch.events).filter(event => event.type === 'lookup');
  expect(lookupEvents.map(event => event.payload.term).sort()).toEqual(['apple', 'each / every', 'since / for', 'ɪ']);
  const second = await browser.newContext();
  try {
    await server.attach(second); const fresh = await second.newPage(); await fresh.clock.install();
    await configure(fresh); await expect(fresh.locator('.history')).toHaveCount(4); await settled(fresh);
    expect(server.uploads).toHaveLength(before + 1);
    const seen: Record<string, number> = {};
    for (const event of lookupEvents) seen[event.deviceId] = Math.max(seen[event.deviceId] ?? 0, event.counter);
    await server.add({ product: 'Lingfern', formatVersion: 1, profileId: server.scope.profileId, deviceId: 'synthetic-clear', batchId: 'clear-history', events: [{ id: 'observed-clear', deviceId: 'synthetic-clear', counter: Math.max(...Object.values(seen)) + 1, occurredAt: new Date().toISOString(), type: 'lookup_clear', payload: { seen } }] });
    await page.clock.fastForward(125000); await expect(page.locator('.history')).toHaveCount(0); await settled(page);
    await fresh.clock.fastForward(125000); await expect(fresh.locator('.history')).toHaveCount(0);
    expect(server.uploads).toHaveLength(before + 1);
    expect(await fresh.pageErrors()).toEqual([]);
  } finally { await second.close(); }
  expect(await page.pageErrors()).toEqual([]);
});
