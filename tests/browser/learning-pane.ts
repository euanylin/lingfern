import { expect, type Page } from '@playwright/test';

export async function showLearningPane(page: Page, pane: 'material' | 'question') {
  await expect(page.locator('.learning-grid')).toBeVisible();
  if (await page.locator('.listening-layout').count()) return;
  const sheet = page.locator('.question-panel');
  const toggle = sheet.locator('.question-sheet-toggle');
  if (await page.evaluate(() => matchMedia('(min-width: 1200px)').matches)) return;
  await expect(sheet).toHaveAttribute('aria-busy', 'false');
  if (await sheet.getAttribute('data-open') !== String(pane === 'question')) {
    if (pane === 'question') {
      await expect(toggle).toBeEnabled();
      await toggle.click();
    } else await page.locator('.question-sheet-scrim').click({ position: { x: 48, y: 100 } });
  }
  await expect(sheet).toHaveAttribute('data-open', String(pane === 'question'));
}
