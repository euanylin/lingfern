import { expect, test } from '@playwright/test';

for (const [locale, wanted, removedAction, width, colorScheme] of [['zh-Hans', '已记下安装意向', '清除未安装的意向', 320, 'light'], ['zh-Hant', '已記下安裝意向', '清除未安裝的意向', 375, 'dark'], ['en', 'Installation intended', 'Clear uninstalled intentions', 1440, 'light']] as const) test(`received installation intentions do not install files or select downloads (${locale})`, async ({ page }) => {
  const downloads: string[] = [];
  page.on('request', request => { if (request.url().includes('offline-install=')) downloads.push(request.url()); });
  await page.goto('/today');
  await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
  await page.evaluate(async locale => {
    const data = '/src/data/db.ts', sync = '/src/data/sync.ts', intent = '/src/data/installationIntent.ts';
    const { appendSyncEvent } = await import(sync);
    const { officialContentHash } = await import(intent);
    await appendSyncEvent('local-guest', { type: 'installation', payload: { contentId: 'grammar', contentHash: await officialContentHash('grammar'), wanted: true } });
    await appendSyncEvent('local-guest', { type: 'installation', payload: { contentId: 'audio-a1', contentHash: 'a'.repeat(64), wanted: true } });
    await (await import(data)).settings.put({ key: 'profile:local-guest:locale', value: locale });
  }, locale);
  await page.setViewportSize({ width, height: 812 });
  await page.emulateMedia({ colorScheme, reducedMotion: locale === 'zh-Hant' ? 'reduce' : 'no-preference' });
  await page.goto('/library');
  const row = page.locator('.package-row').filter({ hasText: locale === 'en' ? 'English usage dictionary' : locale === 'zh-Hant' ? '英語用法詞典' : '英语用法词典' });
  await expect(row).toContainText(wanted);
  await expect(page.getByRole('button', { name: removedAction, exact: true })).toHaveCount(0);
  await expect(page.locator('.offline-install > p.muted')).toHaveCount(0);
  await expect(page.locator('.package-row input:checked')).toHaveCount(0);
  expect(downloads).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `output/playwright/installation-intent-${width}-${locale}-${colorScheme}.png`, fullPage: true });
  await page.locator('nav a[href="/today"]:visible').first().click();
  await page.locator('nav a[href="/library"]:visible').first().click();
  await expect(row).toContainText(wanted);
  await expect(page.locator('.package-row input:checked')).toHaveCount(0);
  expect(await page.evaluate(async () => {
    const data = '/src/data/db.ts';
    return (await import(data)).syncEvents.where('profileId').equals('local-guest').filter((event: { type: string }) => event.type === 'installation').count();
  })).toBe(2);
  await row.locator('input').focus();
  await page.keyboard.press('Space');
  await expect(row.locator('input')).toBeChecked();
  await expect(page.locator('.offline-selection-actions')).toBeVisible();
  expect(downloads).toEqual([]);
});
