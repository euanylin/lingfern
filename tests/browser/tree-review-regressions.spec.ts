import { expect, test } from '@playwright/test';

for (const width of [390, 1120]) test(`renders comparative and prepositional passive CCG at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/library/trees');
  const source = page.locator('#tree-source');
  await expect(source).toBeEnabled();
  await page.locator('.tree-form .setting-trigger').click();
  await page.locator('[role=option][data-value=ccg]').click();
  for (const sentence of ['the more you read, the more you learn', 'the less she eats, the thinner she gets', 'the child was looked after by Mary', 'the bed has been slept in']) {
    await source.fill(sentence);
    await source.press('Enter');
    const terminal = sentence.includes('thinner') ? 'thinner Deg' : sentence.includes('more') ? 'more Deg' : sentence.includes('looked') ? 'after PP/NP' : 'in PP/NP';
    await expect(page.getByRole('treeitem', { name: terminal, exact: true }).first()).toBeVisible();
    await expect(page.getByRole('treeitem', { name: '?', exact: true })).toHaveCount(0);
    await expect(page.getByRole('treeitem', { name: 'S', exact: true }).first()).toBeVisible();
    await expect(page.locator('#tree-generated-note')).toHaveText('自动生成，仅供参考。');
    await expect(page.getByRole('alert')).toHaveCount(0);
  }
  await page.screenshot({ path: info.outputPath('prepositional-passive.png'), fullPage: true });
});
