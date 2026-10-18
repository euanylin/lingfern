import { confirmTask } from './task-start';
import { expect, test } from '@playwright/test';

test('B1 connected updates use causes and conditions across two materials', async ({ page }) => {
  await page.goto('/today');
  await page.locator('.task-row').filter({ has: page.getByRole('heading', { name: '读懂变化的原因与条件' }) }).getByRole('button', { name: '开始阅读' }).click();
  await confirmTask(page);
  await expect(page.getByRole('heading', { name: 'Why did the organisers move planting to Sunday?' })).toBeVisible();
  await page.locator('input[type=radio]').nth(0).check();
  await page.getByRole('button', { name: '保存答案' }).click();
  await expect(page.locator('.feedback blockquote')).toContainText('wet ground');
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: 'output/playwright/b1-reading-1440x900-light-zh-Hans-one-answer.png', fullPage: true });
  await page.getByRole('button', { name: '下一题' }).click();
  await page.locator('input[type=radio]').nth(1).check();
  await page.getByRole('button', { name: '保存答案' }).click();
  await expect(page.locator('.feedback blockquote')).toHaveCount(2);
  await page.getByRole('button', { name: '下一题' }).click();
  await expect(page.getByRole('heading', { name: 'What changed about the practice session?' })).toBeVisible();
  await page.locator('input[type=radio]').nth(1).check();
  await page.getByRole('button', { name: '保存答案' }).click();
  await expect(page.locator('.feedback blockquote')).toContainText('computer room at two');
  await page.getByRole('button', { name: '下一题' }).click();
  await page.locator('input[type=radio]').nth(0).check();
  await page.getByRole('button', { name: '保存答案' }).click();
  await expect(page.getByRole('heading', { name: '阅读任务已保存' })).toBeVisible();
});
