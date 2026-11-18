import { expect, test } from '@playwright/test';

for (const width of [390, 1120]) test(`keeps checked analyses across all nine forms at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/library/trees');
  const source = page.locator('#tree-source');
  await expect(source).toBeEnabled();
  const forms = ['constituency', 'dependency', 'xbar', 'bare', 'tag', 'cst', 'ast', 'ccg', 'feature'];
  const cases = width === 390
    ? ['The man who caught the ball is my uncle']
    : ['The man who caught the ball is my uncle', 'what did you see', 'the book which I read is old', 'how old is she'];
  for (const sentence of cases) {
    if (await page.locator('.tree-form .setting-trigger').getAttribute('data-value') !== 'constituency') {
      await page.locator('.tree-form .setting-trigger').click();
      await page.locator('[role=option][data-value=constituency]').click();
    }
    await source.fill(sentence);
    await source.press('Enter');
    for (const form of forms) {
      if (await page.locator('.tree-form .setting-trigger').getAttribute('data-value') !== form) {
        await page.locator('.tree-form .setting-trigger').click();
        await page.locator(`[role=option][data-value=${form}]`).click();
      }
      await expect(page.locator('.tree-form .setting-trigger')).toHaveAttribute('data-value', form);
      await expect(page.getByRole('alert')).toHaveCount(0);
      const arrows = page.locator('.tree-board svg path:not(.tree-arrow)');
      const heads = form === 'xbar' || form === 'bare';
      const expected = form === 'dependency' || form === 'ccg' ? 0 : heads ? sentence === 'how old is she' ? 3 : 2 : 1;
      if (form === 'dependency') await expect(page.getByRole('treeitem', { name: /^t[₀-₉]+$/u })).toHaveCount(0);
      else await expect(arrows, `${sentence} ${form}`).toHaveCount(expected);
      if (form === 'ccg') {
        await expect(page.getByRole('treeitem', { name: '?', exact: true })).toHaveCount(0);
        await expect(page.getByRole('treeitem', { name: 'S', exact: true }).first()).toBeVisible();
        await expect(page.locator('#tree-generated-note')).toHaveText('自动生成，仅供参考。');
      }
      if (form === 'dependency' && sentence === 'how old is she') {
        await expect(page.locator('.tree-edge-label').filter({ hasText: /^cop$/u })).toHaveCount(1);
        await expect(page.locator('.tree-edge-label').filter({ hasText: /^nsubj$/u })).toHaveCount(1);
      }
    }
  }
});
