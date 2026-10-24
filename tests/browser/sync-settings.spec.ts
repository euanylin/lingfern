import { expect, test } from '@playwright/test';
import { validateSyncBatch } from '../../src/shared/sync';

test('received settings apply to their profile and local picker edits remain captured after reopening', async ({ page }) => {
  const payloads = [
    { key: 'locale', value: 'en' }, { key: 'theme', value: 'dark' },
    { key: 'desktopNavDisplay', value: 'icon' }, { key: 'mobileNavDisplay', value: 'text' },
    { key: 'onlineDictionary', value: 'oxford' },
  ];
  const validated = await validateSyncBatch({ product: 'Lingfern', formatVersion: 1, profileId: 'remote-profile', deviceId: 'remote', batchId: 'settings-batch', events: [
    ...payloads.map((payload, index) => ({ id: `setting-${index}`, deviceId: 'remote', counter: index + 1, occurredAt: '2020-01-01T00:00:00.000Z', type: 'setting', payload })),
    { id: 'preferences', deviceId: 'remote', counter: 6, occurredAt: '2020-01-01T00:00:00.000Z', type: 'preferences', payload: { interests: ['travel'], reading: 'C2', step: 4, completed: true } },
  ] });
  await page.goto('/settings');
  await expect(page.locator('.profile-backup .setting-trigger')).toBeEnabled();
  await expect(page.locator('.profile-backup .setting-trigger')).toHaveAttribute('data-value', 'local-guest');
  await page.evaluate(async ({ batch, hash }) => {
    const dbPath = '/src/data/db.ts'; const syncPath = '/src/data/sync.ts';
    const data = await import(dbPath);
    await data.profiles.put({ id: 'remote-profile', name: 'Received profile', createdAt: new Date().toISOString() });
    await (await import(syncPath)).receiveSyncBatch('remote-profile', batch, hash);
  }, { batch: validated.batch, hash: validated.hash });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hans');
  await page.getByRole('button', { name: '当前档案' }).click();
  await page.getByRole('option', { name: 'Received profile' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.desktop-nav')).toHaveAttribute('data-display', 'icon');
  await expect(page.locator('.mobile-nav')).toHaveAttribute('data-display', 'text');
  await expect(page.getByRole('button', { name: 'Default online dictionary' })).toHaveAttribute('data-value', 'oxford');
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 812 });
    await page.evaluate(() => scrollTo(0, 0));
    if (width === 1440) await expect(page.locator('.mobile-nav')).toBeHidden();
    else await expect(page.locator('.mobile-nav')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `output/playwright/sync-settings-${width}-en-dark.png`, animations: 'disabled' });
  }
  await page.getByRole('button', { name: 'Appearance' }).click();
  await page.getByRole('option', { name: 'Light', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await page.evaluate(async () => {
    const path = '/src/data/sync.ts';
    const events = await (await import(path)).readSyncEvents('remote-profile');
    return events.filter((event: { type: string; deviceId: string }) => event.type === 'setting' && event.deviceId !== 'remote').length;
  })).toBe(1);
  await page.getByRole('button', { name: 'Current profile' }).click();
  await page.getByRole('option', { name: 'Local profile', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hans');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'system');
  await expect(page.locator('.desktop-nav')).toHaveAttribute('data-display', 'text');
});
