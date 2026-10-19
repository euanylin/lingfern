import { confirmTask } from './task-start';
import { showLearningPane } from './learning-pane';
import { expect, test } from '@playwright/test';
import { selectPicker } from './picker';

test('open responses restore drafts and optional self-assessment without automatic correctness', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/today');
  const task = page.locator('.task-row').filter({ has: page.getByRole('heading', { name: '转述计划与限制' }) });
  await task.getByRole('button').click();
  await confirmTask(page);
  await showLearningPane(page, 'question');
  await expect(page.locator('.session-header')).toHaveCSS('position', 'fixed');
  const response = 'We should wait for the Friday email before travelling. The room still needs an inspection, and the workshop may move online.';
  await expect(page.getByRole('button', { name: '保存答案' })).toBeDisabled();
  await page.getByRole('textbox', { name: 'Write your response in English.' }).fill(response);
  await page.waitForTimeout(500);
  await page.getByRole('link', { name: '离开任务' }).click();
  await page.goto('/today');
  await task.getByRole('button').click();
  await confirmTask(page);
  await showLearningPane(page, 'question');
  await expect(page.locator('.response-answer textarea')).toHaveValue(response);
  await page.getByRole('button', { name: '保存答案' }).click();
  await expect(page.getByRole('heading', { name: '已保存 · 未自动评分' })).toBeVisible();
  await expect(page.locator('.feedback > p').filter({ hasText: '一种参考回答:' })).toBeVisible();
  await expect(page.locator('.feedback blockquote')).toHaveCount(2);
  const criteria = page.locator('.self-assessment fieldset');
  for (const row of await criteria.all()) await row.getByRole('radio', { name: 'Included', exact: true }).check();
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(...args) {
      if (this.name === 'attempts') {
        IDBObjectStore.prototype.put = put;
        throw new DOMException('Synthetic storage failure', 'QuotaExceededError');
      }
      return put.apply(this, args);
    };
  });
  await page.getByRole('button', { name: 'Save self-assessment' }).click();
  await expect(page.getByText('Could not save. Your response is still saved; try again.')).toBeVisible();
  await expect(page.locator('.response-answer textarea')).toHaveValue(response);
  await expect(page.getByText('Self-assessment saved.', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Save self-assessment' }).click();
  await expect(page.getByText('Self-assessment saved.')).toBeVisible();
  await page.reload();
  await showLearningPane(page, 'question');
  for (const row of await criteria.all()) await expect(row.getByRole('radio', { name: 'Included', exact: true })).toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('.self-assessment').screenshot({ path: 'output/playwright/response-self-assessment-320-light-zh-Hans.png' });
  await page.getByRole('button', { name: '下一题' }).click();
  await showLearningPane(page, 'question');
  await page.locator('.response-answer textarea').fill('Call before eleven to arrange collection by three. There is no delivery.');
  await page.getByRole('button', { name: '保存答案' }).click();
  await expect(page.getByText('阅读任务已保存')).toBeVisible();
  await expect(page.locator('.self-assessment input:checked')).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: 'output/playwright/response-1440-light-zh-Hans.png', fullPage: true });
  const savedTask = page.url();
  await page.goto('/progress');
  await expect(page.getByRole('link', { name: /转述计划与限制/ })).toBeVisible();
  await expect(page.locator('.progress-source-list [role=img]')).toHaveText(['◇', '◇']);
  await expect(page.locator('.progress-skill-summary dd').nth(2)).toHaveText('0');
  for (const width of [1200, 1024, 768, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(savedTask);
    await showLearningPane(page, 'question');
    await expect(page.getByRole('heading', { name: '已保存 · 未自动评分' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.goto('/settings');
  await selectPicker(page, '语言', 'en');
  await selectPicker(page, 'Appearance', 'dark');
  await page.goto(savedTask);
  await showLearningPane(page, 'question');
  await expect(page.getByRole('heading', { name: 'Review your response' })).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.locator('.self-assessment').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'output/playwright/response-375-dark-en.png' });
  await page.goto('/settings');
  await selectPicker(page, 'Language', 'zh-Hant');
  await page.goto(savedTask);
  await showLearningPane(page, 'question');
  await expect(page.getByRole('heading', { name: 'Review your response' })).toBeVisible();
});
