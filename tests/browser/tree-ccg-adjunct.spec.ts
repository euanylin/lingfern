import { expect, test } from '@playwright/test';

for (const width of [390, 1120]) test(`derives reason and manner questions at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/library/trees');
  const source = page.locator('#tree-source');
  await expect(source).toBeEnabled();
  await page.locator('.tree-form .setting-trigger').click();
  await page.locator('[role=option][data-value=ccg]').click();
  for (const [sentence, marker] of [
    ['why did she leave', 'why'],
    ['how did he solve the problem', 'problem'],
    ['how quickly did she leave', 'quickly'],
    ['I asked why she left', 'asked'],
    ['why has she left', 'has'],
  ]) {
    await source.fill(sentence);
    await source.press('Enter');
    await expect(page.getByRole('treeitem', { name: new RegExp(`^${marker}\\s`, 'u') }).first()).toBeVisible();
    await expect(page.getByRole('treeitem', { name: '?', exact: true })).toHaveCount(0);
    await expect(page.getByRole('treeitem', { name: 'S', exact: true }).first()).toBeVisible();
    await expect(page.locator('#tree-generated-note')).toHaveText('自动生成，仅供参考。');
    await expect(page.getByRole('alert')).toHaveCount(0);
  }
});
