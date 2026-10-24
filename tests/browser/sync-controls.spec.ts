import { expect, test } from '@playwright/test';
import { selectPicker } from './picker';
import { autoSyncFixture, connectSync, lookup, syncNow, syncState, synced } from './autoSyncFixture';

test('automatic controls use one retry and an enduring opt-out in three languages and widths', async ({ page, context }) => {
  await page.setViewportSize({ width: 375, height: 812 }); await page.emulateMedia({ colorScheme: 'dark' }); await page.clock.install();
  const server = autoSyncFixture(); await server.attach(context); await connectSync(page); await synced(page);
  await page.goto('/settings'); const controls = page.locator('.sync-controls'); await expect(controls).toBeVisible();
  expect(await controls.getByRole('button').count()).toBe(2);
  await page.evaluate(async () => { const { pauseSyncConfiguration } = await import('/src/data/syncClient.ts' as string); (window as unknown as { resumeSyncTest: () => Promise<void> }).resumeSyncTest = await pauseSyncConfiguration('local-guest'); });
  await expect(controls.locator('.setting-trigger')).toBeDisabled();
  await page.evaluate(() => (window as unknown as { resumeSyncTest: () => Promise<void> }).resumeSyncTest());
  await expect(controls.locator('.setting-trigger')).toBeEnabled();

  server.loseAck(); await lookup(page, 'test'); await syncNow(page);
  await expect(controls.locator('[data-sync-status]')).toHaveAttribute('data-sync-status', 'error');
  await controls.getByRole('button', { name: '重试', exact: true }).click(); await synced(page);
  await expect(controls.locator('time')).toBeVisible();
  expect(new Set(server.uploads.map(batch => batch.batchId)).size).toBe(1);
  await selectPicker(page, '自动同步', 'off');
  await expect(controls.locator('[data-sync-status]')).toHaveAttribute('data-sync-status', 'disabled');
  const controlsNode = await controls.elementHandle();
  for (const [locale, name, width, theme] of [['zh-Hans', '语言', 375, 'dark'], ['zh-Hant', '语言', 320, 'light'], ['en', '語言', 1440, 'dark']] as const) {
    await page.setViewportSize({ width, height: 900 }); await page.emulateMedia({ colorScheme: theme });
    await selectPicker(page, name, locale);
    expect(await controls.evaluate((element, original) => element === original, controlsNode)).toBe(true);
    await controls.scrollIntoViewIfNeeded(); await expect(controls).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const heights = await controls.locator('button:visible').evaluateAll(buttons => buttons.map(button => button.getBoundingClientRect().height));
    expect(heights.every(height => height >= 44)).toBe(true);
    await page.screenshot({ path: `output/playwright/auto-sync-${width}-${locale}-${theme}.png`, animations: 'disabled' });
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await controls.getByRole('button').first().focus(); await expect(controls.getByRole('button').first()).toBeFocused();
  await page.keyboard.press('Enter'); await expect(page.getByRole('listbox')).toBeVisible(); await page.keyboard.press('Escape');
  const sent = server.uploads.length; await page.clock.fastForward(300000); expect(server.uploads).toHaveLength(sent);
  expect(await page.pageErrors()).toEqual([]);
});

test('availability withdrawal preserves pending data and consent while offering connection refresh', async ({ page, context }) => {
  const server = autoSyncFixture(); await server.attach(context); await connectSync(page); await synced(page);
  await page.goto('/settings'); server.fail(1, 'SYNC_UNAVAILABLE'); await lookup(page, 'still-local'); await syncNow(page);
  const controls = page.locator('.sync-controls'); await expect(controls.getByRole('button', { name: '重新检查连接' })).toBeVisible();
  server.summary.syncAvailable = false; await controls.getByRole('button', { name: '重新检查连接' }).click();
  await expect(controls).toHaveCount(0); await expect(page.locator('.repository-binding')).toContainText('同步暂时不可用');
  const retained = await page.evaluate(async () => { const { db, settings } = await import('/src/data/db.ts' as string); return { events: await db.table('syncEvents').count(), uploads: await db.table('syncUploads').count(), consent: Boolean(await settings.get('profile:local-guest:syncConsent')) }; });
  expect(retained.events).toBeGreaterThan(0); expect(retained.uploads).toBe(0); expect(retained.consent).toBe(true);
  expect((await syncState(page)).lastSuccessAt).toBeDefined();
});
