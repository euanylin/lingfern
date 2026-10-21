import { confirmTask } from './task-start';
import { expect, test } from '@playwright/test';

test('Today uses saved reading evidence without changing the listening starting example', async ({ page }) => {
  await page.goto('/today');
  await expect(page.locator('.primary-task.reading-task').getByRole('heading', { name: '阅读', exact: true })).toBeVisible();
  await page.locator('.primary-task.reading-task').getByRole('button', { name: '开始', exact: true }).click(); await confirmTask(page);
  for (const answer of ['At the library.', 'A student card.', 'At the café.', 'A pencil.']) {
    await page.getByRole('radio', { name: answer }).check();
    await page.getByRole('button', { name: '保存答案', exact: true }).click();
    if (answer !== 'A pencil.') await page.getByRole('button', { name: '下一题' }).click();
  }
  await page.getByRole('link', { name: '返回今日' }).click();
  await page.locator('.primary-task.reading-task').getByRole('button', { name: '开始', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: '配对活动安排', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '关闭' }).click();
  await page.locator('.primary-task:not(.reading-task):not(.combined-training)').getByRole('button', { name: '开始', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: '听出日常物品', exact: true })).toBeVisible();
});

test('Tasks clearly states that independent checks cannot start without reviewed unfamiliar material', async ({ page }) => {
  await page.goto('/today');
  await expect(page.locator('.task-catalogue-list .task-row').first()).toBeVisible();
  await expect(page.getByRole('button', { name: '模式', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '开始测试', exact: true })).toHaveCount(0);
});
