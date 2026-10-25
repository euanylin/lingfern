import { expect, test } from '@playwright/test';
import { selectPicker } from './picker';
import { autoSyncFixture, connectSync, lookup, syncNow, syncState, synced } from './autoSyncFixture';
import { languagePacks } from '../../src/locales';

test('GitHub card keeps compact rows, full-width sync and one identity disconnect action across themes and directions', async ({ page, context }) => {
  test.setTimeout(120000);
  const server = autoSyncFixture(); await server.attach(context); await connectSync(page); await synced(page);
  await page.goto('/settings');
  const card = page.locator('.github-identity'), controls = card.locator('.sync-controls');
  for (const [label, locale] of [['语言', 'zh-Hans'], ['语言', 'en'], ['Language', 'ar']] as const) {
    await selectPicker(page, label, locale);
    const t = languagePacks[locale];
    await controls.getByRole('button', { name: t.syncControls.sync, exact: true }).click(); await synced(page);
    for (const theme of ['light', 'dark'] as const) for (const width of [1440, 375, 320]) {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' }); await page.setViewportSize({ width, height: 900 });
      const sync = controls.getByRole('button', { name: t.syncControls.sync, exact: true });
      await expect(sync).toBeEnabled(); await expect(sync).toHaveClass('primary');
      await sync.hover(); const active = await sync.evaluate(el => getComputedStyle(el).backgroundColor);
      await page.mouse.move(0, 0); await page.keyboard.press('Tab'); await sync.focus(); await expect(sync).toHaveCSS('background-color', active);
      await sync.evaluate(el => (el as HTMLElement).blur());
      await sync.dispatchEvent('pointerdown', { isPrimary: true, pointerType: 'touch', pointerId: 1, clientX: 10, clientY: 10 });
      await expect(sync).toHaveAttribute('data-touch-active', ''); await expect(sync).toHaveCSS('background-color', active);
      await sync.dispatchEvent('pointercancel', { pointerId: 1 });

      expect(await sync.evaluate(el => Math.abs(el.getBoundingClientRect().width - el.parentElement!.getBoundingClientRect().width))).toBeLessThan(1);
      await expect(card.getByText(t.syncControls.detail, { exact: true })).toBeHidden();
      await expect(card.getByText(t.repositoryBinding.reset, { exact: true })).toBeHidden();
      await expect(card.locator('.repository-history')).toHaveCount(0);
      await expect(card.locator('.repository-reset')).toHaveCSS('border-bottom-width', '0px');
      const geometry = await card.locator('.github-session-actions button').evaluateAll(buttons => buttons.map(button => { const r = button.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, width: r.width, height: r.height }; }));
      expect(geometry).toHaveLength(1);
      await expect(card.locator('.github-session-actions button')).toHaveText(t.githubIdentity_disconnectLabels.action);
      expect(geometry.every(box => box.width >= 44 && box.height >= 44)).toBe(true);
      expect(await card.locator('.repository-reset>summary').evaluate(el => getComputedStyle(el, '::after').content)).toBe('"›"');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const reference = page.locator('.settings-start-link');
      await reference.hover();
      const feedback = await reference.evaluate(el => { const s = getComputedStyle(el); return { background: s.backgroundColor, radius: s.borderRadius }; });
      await page.mouse.move(0, 0); await page.keyboard.press('Tab'); await reference.focus();
      const keyboardFeedback = await reference.evaluate(el => getComputedStyle(el).backgroundColor);
      await reference.evaluate(el => (el as HTMLElement).blur());
      const rows = card.locator('.service-disclosure>summary:visible,.github-session-actions>button,.sync-controls .setting-trigger');
      for (const row of await rows.all()) {
        await row.hover();
        await expect(row).toHaveCSS('background-color', feedback.background);
        await expect(row).toHaveCSS('border-radius', feedback.radius);
        await page.mouse.move(0, 0); await page.keyboard.press('Tab'); await row.focus();
        await expect(row).toHaveCSS('background-color', keyboardFeedback);
        await row.evaluate(el => (el as HTMLElement).blur());
        await row.dispatchEvent('pointerdown', { pointerType: 'touch', isPrimary: true, pointerId: 1, clientX: 10, clientY: 10 });
        await expect(row).toHaveAttribute('data-touch-active', '');
        await expect(row).toHaveCSS('background-color', feedback.background);
        await row.dispatchEvent('pointercancel', { pointerType: 'touch', pointerId: 1 });
        await expect(row).not.toHaveAttribute('data-touch-active', '');
      }
      const reset = card.locator('.repository-reset>summary');
      await reset.click();
      const actions = card.locator('.repository-reset .repository-actions');
      await expect(actions.locator('button')).toHaveCount(1);
      await expect(actions.getByRole('button', { name: t.repositoryBinding.inspect, exact: true })).toHaveCount(0);
      const danger = actions.locator('.service-danger');
      await expect(danger).toHaveCSS('color', await card.locator('.github-session-actions .service-danger').evaluate(el => getComputedStyle(el).color));
      await reset.click();
      await page.mouse.move(0, 0);
      await card.screenshot({ path: `output/playwright/github-reference-${locale}-${theme}-${width}.png`, animations: 'disabled' });
    }
  }
  await controls.locator('.setting-field-label').click(); await expect(page.getByRole('listbox')).toBeVisible(); await page.keyboard.press('Escape');
  await card.locator('.repository-reset>summary').focus(); await page.keyboard.press('Enter');
  await expect(card.getByText(languagePacks.ar.syncControls.detail, { exact: true })).toBeVisible();
  await card.locator('.repository-reset>summary').press('Enter');
  let release!: () => void; const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/sync/changes**', async route => { await pending; await route.fallback(); });
  await controls.getByRole('button', { name: languagePacks.ar.syncControls.sync, exact: true }).click();
  try {
    await expect(controls.locator('[data-sync-status]')).toHaveAttribute('data-sync-status', 'syncing');
    const sync = controls.getByRole('button', { name: languagePacks.ar.syncControls.sync, exact: true });
    await expect(sync).toBeDisabled(); await expect(sync).not.toHaveClass('primary');
    await card.screenshot({ path: 'output/playwright/github-reference-ar-dark-320-syncing.png', animations: 'disabled' });
  } finally { release(); }
  await synced(page);
  server.summary.account.login = 'x'.repeat(39); await page.reload();
  await expect(card).toContainText('x'.repeat(39));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.pageErrors()).toEqual([]);
});

test('automatic controls use one retry and an enduring opt-out in three languages and widths', async ({ page, context }) => {
  await page.setViewportSize({ width: 375, height: 812 }); await page.emulateMedia({ colorScheme: 'dark' }); await page.clock.install();
  const server = autoSyncFixture(); await server.attach(context); await connectSync(page); await synced(page);
  await page.goto('/settings'); const controls = page.locator('.sync-controls'); await expect(controls).toBeVisible();
  expect(await controls.getByRole('button').count()).toBe(2);
  await page.evaluate(async () => { const { pauseSyncConfiguration } = await import('/src/data/syncClient.ts' as string); (window as unknown as { resumeSyncTest: () => Promise<void> }).resumeSyncTest = await pauseSyncConfiguration('local-guest'); });
  await expect(controls.locator('.setting-trigger')).toBeDisabled();
  await expect(controls.locator('.backup-actions')).toHaveCount(0);
  await page.evaluate(() => (window as unknown as { resumeSyncTest: () => Promise<void> }).resumeSyncTest());
  await expect(controls.locator('.setting-trigger')).toBeEnabled();
  await context.setOffline(true);
  await expect(controls.locator('[data-sync-status]')).toHaveAttribute('data-sync-status', 'offline');
  await expect(controls.locator('.backup-actions')).toHaveCount(0);
  await context.setOffline(false); await expect(controls.locator('.backup-actions')).toBeVisible();

  server.loseAck(); await lookup(page, 'test'); await syncNow(page);
  await expect(controls.locator('[data-sync-status]')).toHaveAttribute('data-sync-status', 'error');
  await controls.getByRole('button', { name: '重试', exact: true }).click(); await synced(page);
  await expect(controls.locator('time')).toBeVisible();
  expect(new Set(server.uploads.map(batch => batch.batchId)).size).toBe(1);
  await selectPicker(page, '自动同步', 'off');
  await expect(controls.locator('[data-sync-status]')).toHaveAttribute('data-sync-status', 'disabled');
  await expect(controls.locator('.backup-actions')).toHaveCount(0);
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
