import { expect, test } from '@playwright/test';
import { openSnapshot, completeWorkspace } from './workspace';

test('B2 survey cases retain sample limits and distinguish a pilot from an unsupported claim', async ({ page }) => {
  const { lesson } = await openSnapshot(page, 'b2-reading');
  await completeWorkspace(page, lesson);
  const reviews = page.locator('.workspace-review');
  await expect(reviews.nth(0).locator('blockquote')).toHaveCount(2);
  await expect(reviews.nth(0).locator('blockquote')).toContainText(['Thirty-two volunteers', 'responding volunteers']);
  await expect(reviews.nth(1).locator('blockquote')).toContainText(['small repeat', 'proven campus-wide success']);
  await expect(reviews.nth(2).locator('blockquote')).toContainText(['Forty visitors', 'did not collect responses']);
  await expect(page.locator('.slot-result')).toHaveText(Array(4).fill(/✓/));
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 812 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`b2-reading-${width}.png`) });
  }
});
