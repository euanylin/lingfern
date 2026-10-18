import { expect, test } from '@playwright/test';
import { selectPicker } from './picker';

test('sync controls require upload consent, recover expired scans and remain usable in three languages', async ({ page }) => {
  // Browser/HTTP simulation only: no real GitHub authorisation or writes.
  await page.setViewportSize({ width: 375, height: 812 }); await page.emulateMedia({ colorScheme: 'dark' });
  const scope = { accountId: 1, profileId: 'local-guest', bindingVersion: 'a'.repeat(43) };
  const summary = { account: { id: 1, login: 'synthetic' }, csrfToken: 't'.repeat(43), syncAvailable: true, bindings: [{ name: 'lingfern-data', owner: 'synthetic', profileId: scope.profileId, disabled: false, bindingVersion: scope.bindingVersion }] };
  await page.route('**/api/session', route => route.fulfill({ json: summary }));
  let lost = true, expired = false, rescan = false;
  const sent: { batch: { deviceId: string; batchId: string }; hash: string }[] = [];
  await page.route('**/api/sync/batches', route => {
    const value = route.request().postDataJSON(); sent.push(value);
    return route.fulfill({ status: lost ? 503 : 200, json: lost ? { error: 'SYNC_PENDING' } : { scope, batchId: value.batch.batchId, hash: value.hash, previouslyWritten: true } });
  });
  await page.route('**/api/sync/changes?*', route => {
    const query = new URL(route.request().url()).searchParams;
    if (expired && !rescan) { rescan = true; return route.fulfill({ status: 400, json: { error: 'SYNC_CURSOR_INVALID' } }); }
    const value = sent[0], blobSha = 'b'.repeat(40), cursor = rescan ? 'fresh' : 'first';
    const file = { deviceId: value.batch.deviceId, batchId: value.batch.batchId, blobSha, bytes: new TextEncoder().encode(JSON.stringify(value.batch)).length };
    const cached = query.get('known') && JSON.parse(query.get('known')!).length;
    if (!query.has('metadata')) expired = !rescan;
    return route.fulfill({ json: { scope, commit: 'c'.repeat(40), cursor, total: rescan ? 1 : 2, ...(rescan ? {} : { nextCursor: 'later' }), files: [file], batches: query.has('metadata') || cached ? [] : [{ batch: value.batch, hash: value.hash, blobSha }] } });
  });
  await page.goto('/today');
  await page.evaluate(async () => {
    const { settings } = await import('/src/data/db.ts' as string);
    const { appendSyncEvent } = await import('/src/data/sync.ts' as string);
    await settings.put({ key: 'profile:local-guest:syncAccount', value: JSON.stringify({ accountId: 1, profileId: 'local-guest' }) });
    await appendSyncEvent('local-guest', { type: 'saved_item', payload: { memoryId: 'synthetic-sense', saved: true, reviewEnabled: false } });
  });
  await page.goto('/settings');
  const controls = page.locator('.sync-controls');
  await expect(controls).toBeVisible();
  await expect(controls.getByRole('button', { name: '上传一批记录', exact: true })).toBeDisabled();
  expect(sent).toHaveLength(0);
  await controls.getByRole('button', { name: '允许上传到此资料库' }).click();
  await expect(controls.getByRole('button', { name: '上传一批记录', exact: true })).toBeEnabled();
  expect(sent).toHaveLength(0);
  await controls.getByRole('button', { name: '上传一批记录', exact: true }).click();
  await expect(controls).toContainText('同步未完成'); lost = false;
  await controls.getByRole('button', { name: '上传一批记录', exact: true }).click();
  await expect(controls).toContainText('本批记录已确认写入');
  expect(sent).toHaveLength(2); expect(sent[0].batch.batchId).toBe(sent[1].batch.batchId);
  await controls.getByRole('button', { name: '下载并合并记录' }).click();
  await expect(controls).toContainText('还有记录待下载');
  await controls.getByRole('button', { name: '继续下载' }).click();
  await expect(controls).toContainText('下载进度已过期');
  await controls.getByRole('button', { name: '重新扫描资料库' }).click();
  await expect(controls).toContainText('本页记录已合并');
  await controls.getByRole('button', { name: '停止上传' }).click();
  await expect(controls).toContainText('已停止上传');
  await expect(controls.getByRole('button', { name: '上传一批记录', exact: true })).toBeDisabled();
  expect(sent).toHaveLength(2);
  const controlsNode = await controls.elementHandle();
  for (const [locale, name, width] of [['zh-Hans', '语言', 375], ['zh-Hant', '语言', 320], ['en', '語言', 320]] as const) {
    await page.setViewportSize({ width, height: 812 });
    await selectPicker(page, name, locale);
    await expect(controls.getByRole('heading', { name: locale === 'en' ? 'Batch sync' : '批次同步', exact: true })).toBeVisible();
    expect(await controls.evaluate((element, original) => element === original, controlsNode)).toBe(true);
    await controls.scrollIntoViewIfNeeded();
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(controls).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const heights = await controls.locator('button').evaluateAll(buttons => buttons.map(button => button.getBoundingClientRect().height));
    expect(heights.every(height => height >= 44)).toBe(true);
    await page.screenshot({ path: `output/playwright/sync-controls-${width}-${locale}-dark.png`, animations: 'disabled' });
  }
});


test('server availability withdrawal preserves consent and shows refresh without acknowledging upload', async ({ page }) => {
  const scope = { accountId: 1, profileId: 'local-guest', bindingVersion: 'a'.repeat(43) };
  let available = true, attempts = 0;
  const summary = () => ({ account: { id: 1, login: 'synthetic' }, csrfToken: 't'.repeat(43), syncAvailable: available, bindings: [{ name: 'lingfern-data', owner: 'synthetic', profileId: scope.profileId, disabled: false, bindingVersion: scope.bindingVersion }] });
  await page.route('**/api/session', route => route.fulfill({ json: summary() }));
  await page.route('**/api/sync/batches', route => { attempts++; available = false; return route.fulfill({ status: 503, json: { error: 'SYNC_UNAVAILABLE' } }); });
  await page.goto('/today');
  await page.evaluate(async () => {
    const { settings } = await import('/src/data/db.ts' as string);
    const { appendSyncEvent } = await import('/src/data/sync.ts' as string);
    await settings.put({ key: 'profile:local-guest:syncAccount', value: JSON.stringify({ accountId: 1, profileId: 'local-guest' }) });
    await appendSyncEvent('local-guest', { type: 'saved_item', payload: { memoryId: 'synthetic-sense', saved: true, reviewEnabled: false } });
  });
  await page.goto('/settings');
  const controls = page.locator('.sync-controls');
  await controls.getByRole('button', { name: '允许上传到此资料库' }).click();
  await controls.getByRole('button', { name: '上传一批记录', exact: true }).click();
  await expect(controls.getByRole('button', { name: '重新检查连接' })).toBeVisible();
  expect(attempts).toBe(1);
  await controls.getByRole('button', { name: '重新检查连接' }).click();
  await expect(controls).toHaveCount(0);
  await expect(page.locator('.repository-binding')).toContainText('批次同步尚未开放');
  const retained = await page.evaluate(async () => {
    const { db, settings } = await import('/src/data/db.ts' as string);
    return { events: await db.table('syncEvents').count(), uploads: await db.table('syncUploads').count(), consent: Boolean(await settings.get('profile:local-guest:syncConsent')) };
  });
  expect(retained.events).toBeGreaterThan(0); expect(retained.uploads).toBe(0); expect(retained.consent).toBe(true);
});
