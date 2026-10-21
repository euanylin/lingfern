import { expect, test } from '@playwright/test';
import { openSnapshot, completeWorkspace } from './workspace';

test('C1 email exchanges distinguish support, conditions and public commitments', async ({ page }) => {
  const { lesson } = await openSnapshot(page, 'c1-reading');
  await expect(page.locator('.passage')).toHaveCount(3);
  await completeWorkspace(page, lesson);
  await expect(page.locator('.workspace-review')).toHaveCount(4);
  for (const review of await page.locator('.workspace-review').all()) await expect(review.locator('blockquote')).toHaveCount(2);
  await expect(page.locator('.slot-result')).toHaveText(Array(4).fill(/✓/));
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 812 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`c1-reading-${width}.png`) });
  }
});
