import { expect, test } from '@playwright/test';

test('draws large trees without hitting the old node and child caps', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.goto('/library/trees');
  const source = page.getByRole('textbox', { name: '句子、括号、缩进或依存' });
  await expect(source).toBeEnabled();
  const tree = `[S ${Array.from({ length: 400 }, (_, index) => `[X${index}]`).join(' ')}]`;
  await source.fill(tree);
  await source.press('Enter');
  await expect(page.getByRole('treeitem', { name: 'X399', exact: true })).toBeVisible();
  await expect(page.locator('.tree-node')).toHaveCount(401);
  await expect(page.getByRole('alert')).toHaveCount(0);
  // A dependency tree keeps every dependent on one head.
  const rows = Array.from({ length: 400 }, (_, index) => `${index + 1} w${index + 1} ${index === 0 ? 0 : 1} ${index === 0 ? 'root' : 'dep'}`).join('\n');
  await source.fill(rows);
  await source.press('Enter');
  await expect(page.getByRole('treeitem', { name: 'w400', exact: true })).toBeVisible();
  await expect(page.locator('.tree-node')).toHaveCount(400);
});
