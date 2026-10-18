import { expect, test } from '@playwright/test';

for (const [locale, wanted, clear] of [['zh-Hans', '已记下安装意向', '清除未安装的意向'], ['zh-Hant', '已記下安裝意向', '清除未安裝的意向'], ['en', 'Installation intended', 'Clear uninstalled intentions']]) test(`received installation intentions do not install files or select downloads (${locale})`, async ({ page }) => {
  const downloads: string[] = [];
  page.on('request', request => { if (request.url().includes('offline-install=')) downloads.push(request.url()); });
  await page.goto('/today');
  await page.evaluate(async locale => {
    const data = '/src/data/db.ts', sync = '/src/data/sync.ts', intent = '/src/data/installationIntent.ts';
    const { appendSyncEvent } = await import(sync);
    const { officialContentHash } = await import(intent);
    await appendSyncEvent('local-guest', { type: 'installation', payload: { contentId: 'grammar', contentHash: await officialContentHash('grammar'), wanted: true } });
    await appendSyncEvent('local-guest', { type: 'installation', payload: { contentId: 'audio-a1', contentHash: 'a'.repeat(64), wanted: true } });
    await (await import(data)).settings.put({ key: 'profile:local-guest:locale', value: locale });
  }, locale);
  await page.setViewportSize({ width: 320, height: 812 });
  await page.goto('/library');
  const row = page.locator('.package-row').filter({ hasText: locale === 'en' ? 'English usage dictionary' : locale === 'zh-Hant' ? '英語用法詞典' : '英语用法词典' });
  await expect(row).toContainText(wanted);
  await expect(page.locator('.installation-intent-notice')).toBeVisible();
  await expect(page.locator('.package-row input:checked')).toHaveCount(0);
  expect(downloads).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `output/playwright/installation-intent-320-${locale}-light.png`, fullPage: true });
  await page.getByRole('button', { name: clear, exact: true }).click();
  await expect(row).not.toContainText(wanted);
  await expect(page.locator('.installation-intent-notice')).toHaveCount(0);
  expect(downloads).toEqual([]);
});
