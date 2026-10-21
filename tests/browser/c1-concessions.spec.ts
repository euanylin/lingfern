import { expect, test } from '@playwright/test';
import { openSnapshot, completeWorkspace, verifyWorkspace } from './workspace';
import { selectPicker } from './picker';

for (const locale of ['zh-Hans', 'zh-Hant', 'en']) test(`C1 concessions retain scope and cross-source responsibility (${locale})`, async ({ page }) => {
  await page.goto('/settings'); await selectPicker(page, '语言', locale);
  const { lesson } = await openSnapshot(page, 'c1-concessions-reading');
  await completeWorkspace(page, lesson); await verifyWorkspace(page, lesson);
  for (const width of [1440, 1200, 1024, 768, 375, 320]) {
    await page.setViewportSize({ width, height: 812 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`c1-concessions-${width}-${locale}.png`) });
  }
  await page.reload(); await verifyWorkspace(page, lesson);
});
