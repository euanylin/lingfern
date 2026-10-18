import { confirmTask } from './task-start';
import { showLearningPane } from './learning-pane';
import { expect, test } from '@playwright/test';

test('C1 email exchanges distinguish support, conditions and public commitments', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/today');
  await page.locator('.task-row').filter({ has: page.getByRole('heading', { name: '读懂支持与承诺' }) }).getByRole('button', { name: '开始阅读' }).click();
  await confirmTask(page);
  await expect(page.locator('.passage')).toHaveCount(3);
  await page.locator('input[type=radio]').nth(0).check();
  await page.getByRole('button', { name: '保存答案' }).click();
  await expect(page.locator('.feedback blockquote')).toHaveCount(2);
  await expect(page.locator('.evidence-source')).toContainText(['Arun', 'Arun']);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: 'output/playwright/c1-reading-1440x900-light-zh-Hans-one-answer.png', fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: 'output/playwright/c1-reading-375x812-light-zh-Hans-one-answer.png', fullPage: true });
  for (const [index, choice] of [1, 1, 1].entries()) {
    await page.getByRole('button', { name: '下一题' }).click();
    await showLearningPane(page, 'question');
    await expect(page.locator('.question-number > span')).toHaveText(`${index + 2} / 4`);
    await page.locator('input[type=radio]').nth(choice).check();
    await page.getByRole('button', { name: '保存答案' }).click();
    await expect(page.locator('.feedback blockquote')).toHaveCount(2);
  }
  await expect(page.getByRole('heading', { name: '阅读任务已保存' })).toBeVisible();
});
