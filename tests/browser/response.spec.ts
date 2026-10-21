import { expect, test } from '@playwright/test';
import { openSnapshot, focusQuestion, submitWorkspace } from './workspace';

test('open responses restore drafts and optional self-assessment without automatic correctness', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  const { lesson, id } = await openSnapshot(page, 'b1-summary-reading');
  const response = 'We should wait for the Friday email before travelling. The room still needs an inspection, and the workshop may move online.';
  const first = await focusQuestion(page, lesson, 0);
  await expect(page.locator('.session-header')).toHaveCSS('position', 'fixed');
  await first.getByRole('textbox').fill(response);
  await expect.poll(() => page.evaluate(async id => Object.values((await (await import('/src/data/db.ts' as string)).sessions.get(id)).workspace.drafts), id)).toContain(response);
  await page.goto('/today'); await page.goto(`/learn/${id}`); await focusQuestion(page, lesson, 0);
  await expect(first.getByRole('textbox')).toHaveValue(response);
  const second = await focusQuestion(page, lesson, 1);
  await second.getByRole('textbox').fill('Call before eleven to arrange collection by three. There is no delivery.');
  await expect(page.locator('button[type=submit]')).toBeEnabled(); await submitWorkspace(page);
  await expect(page.locator('.slot-result')).toContainText(['未自动评分', '未自动评分']);
  const review = page.locator('.workspace-review').first(), criteria = review.locator('.self-assessment fieldset');
  await expect(review.locator('blockquote')).toHaveCount(2);
  for (const row of await criteria.all()) await row.getByRole('radio', { name: 'Included', exact: true }).check();
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(...args) {
      if (this.name === 'attempts') { IDBObjectStore.prototype.put = put; throw new DOMException('Synthetic storage failure', 'QuotaExceededError'); }
      return put.apply(this, args);
    };
  });
  await review.getByRole('button', { name: 'Save self-assessment' }).click();
  await expect(review.getByText('Could not save. Your response is still saved; try again.')).toBeVisible();
  await expect(review).toContainText(response);
  await expect(review.getByText('Self-assessment saved.', { exact: true })).toHaveCount(0);
  await review.getByRole('button', { name: 'Save self-assessment' }).click();
  await expect(review.getByText('Self-assessment saved.')).toBeVisible();
  await page.reload();
  for (const row of await criteria.all()) await expect(row.getByRole('radio', { name: 'Included', exact: true })).toBeChecked();
  await expect(page.locator('.workspace-review').nth(1).locator('.self-assessment input:checked')).toHaveCount(0);
  for (const width of [1440, 1200, 1024, 768, 375, 320]) {
    await page.setViewportSize({ width, height: 900 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.goto('/progress');
  await expect(page.getByRole('link', { name: /转述计划与限制/ })).toBeVisible();
  await expect(page.locator('.progress-source-list [role=img]')).toHaveText(['◇', '◇']);
  await expect(page.locator('.progress-skill-summary dd').nth(2)).toHaveText('0');
});
