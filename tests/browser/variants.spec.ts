import { showLearningPane } from './learning-pane';
import { expect, test } from '@playwright/test';

test('generated practice saves exact notices, resumes and gives evidence for four responses', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/today');
  await page.getByRole('button', { name: '开始变式练习', exact: true }).click();
  await showLearningPane(page, 'question');
  await expect(page.getByRole('heading', { name: 'When does the train leave today?' })).toBeVisible();
  await showLearningPane(page, 'material');
  const text = await page.locator('.material').innerText();
  await showLearningPane(page, 'question');
  await page.getByRole('radio').nth(1).check();
  await page.getByRole('button', { name: '保存答案', exact: true }).click();
  await expect(page.getByRole('heading', { name: '✓ 回答正确' })).toBeVisible();
  const url = page.url();
  await page.getByRole('link', { name: '离开任务' }).click();
  await page.goto('/today');
  await page.getByRole('button', { name: '继续变式练习', exact: true }).click();
  await expect(page).toHaveURL(url);
  await showLearningPane(page, 'material');
  expect(await page.locator('.material').innerText()).toBe(text);
  await showLearningPane(page, 'question');
  for (const answer of [0, 1, 0]) {
    await page.getByRole('button', { name: '下一题', exact: true }).click();
    await showLearningPane(page, 'question');
    await page.getByRole('radio').nth(answer).check();
    await page.getByRole('button', { name: '保存答案', exact: true }).click();
    await expect(page.getByRole('heading', { name: '✓ 回答正确' })).toBeVisible();
    await expect(page.locator('.feedback blockquote')).toContainText('Today');
  }
  await expect(page.getByRole('heading', { name: '阅读任务已保存' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'output/playwright/variants-375-light-zh-Hans-completed.png' });
  await page.goto('/today');
  await page.getByRole('button', { name: '开始变式练习', exact: true }).click();
  await showLearningPane(page, 'question');
  await expect(page.getByRole('heading', { name: 'When does the train leave today?' })).toBeVisible();
  expect(page.url()).not.toBe(url);
  await page.goto('/progress');
  await expect(page.locator('.totals dd')).toHaveText(['4', '2']);
  const seen = await page.evaluate(async () => (await import('/src/data/db.ts' as string)).exposures.toArray());
  expect(seen).toHaveLength(2);
  expect(seen.flatMap((entry: { contacts: unknown[] }) => entry.contacts)).toHaveLength(5);
  expect(new Set(seen.flatMap((entry: { contacts: { variantGroup: string }[] }) => entry.contacts.map(contact => contact.variantGroup))).size).toBe(4);
});
