import { expect, test } from '@playwright/test';

for (const width of [390, 1120]) test(`generates movement without manual linking at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/library/trees');
  const source = page.locator('#tree-source');
  await expect(source).toBeEnabled();
  for (const [sentence, filler] of [
    ['the man who caught the ball is my uncle', 'who₁'],
    ['the birds that grew tired fell', 'that₁'],
    ['who wrote this letter', 'who₁'],
    ['who do you think wrote the letter', 'who₁'],
    ['what did Mary say John thought Bill bought', 'what₁'],
    ['I know where she lives', 'where₁'],
    ['I asked to whom she spoke', 'whom₁'],
    ['the chair was sat on', 'chair₁'],
    ['which student won the prize', 'which₁'],
    ['what has she written', 'what₁'],
    ['who did you talk to', 'who₁'],
    ['to whom did you speak', 'whom₁'],
    ['where did he put the book', 'where₁'],
    ['the city was founded', 'city₁'],
    ['the students were given a test', 'students₁'],
  ]) {
    await source.fill(sentence);
    await source.press('Enter');
    await expect(page.getByRole('treeitem', { name: sentence.split(' ').at(-1)!, exact: true })).toHaveCount(1);
    await expect(page.getByRole('treeitem', { name: filler, exact: true })).toHaveCount(1);
    await expect(page.getByRole('treeitem', { name: 't₁', exact: true })).toHaveCount(1);
    await expect(page.locator('.tree-board svg path:not(.tree-arrow)')).toHaveCount(1);
    await expect(page.locator('.tree-actions').getByRole('button', { name: '移位', exact: true })).toHaveAttribute('aria-pressed', 'false');
  }
  if (width === 1120) {
    for (const form of ['xbar', 'bare', 'tag', 'cst', 'ast', 'feature', 'ccg', 'dependency']) {
      await page.locator('.tree-form .setting-trigger').click();
      await page.locator(`[role=option][data-value=${form}]`).click();
      await expect(page.locator('.tree-form .setting-trigger')).toHaveAttribute('data-value', form);
      if (form === 'ccg' || form === 'dependency') await expect(page.locator('.tree-board')).not.toContainText('t₁');
      else await expect(page.locator('.tree-board')).toContainText('t₁');
    }
  }
});

test('retains independent and shared movement chains through named save and SVG export', async ({ page }) => {
  await page.setViewportSize({ width: 1120, height: 900 });
  await page.goto('/library/trees');
  const source = page.locator('#tree-source');
  await expect(source).toBeEnabled();
  const arrows = page.locator('.tree-board svg path:not(.tree-arrow)');
  await source.fill('I asked what she bought');
  await source.press('Enter');
  await expect(page.getByRole('treeitem', { name: 'what₁', exact: true })).toHaveCount(1);
  await expect(arrows).toHaveCount(1);
  await source.fill('the letter from Mary was written by John');
  await source.press('Enter');
  await expect(page.getByRole('treeitem', { name: 'letter₁', exact: true })).toHaveCount(1);
  await expect(page.getByRole('treeitem', { name: 'Mary₁', exact: true })).toHaveCount(0);
  await source.fill('the book which John read was written by Mary');
  await source.press('Enter');
  await expect(page.getByRole('treeitem', { name: 'book₂', exact: true })).toHaveCount(1);
  await expect(page.getByRole('treeitem', { name: 'which₁', exact: true })).toHaveCount(1);
  await expect(arrows).toHaveCount(2);
  await source.fill('the book I read was written by Mary');
  await source.press('Enter');
  await expect(page.getByRole('treeitem', { name: 'book₁', exact: true })).toHaveCount(1);
  await expect(page.getByRole('treeitem', { name: 't₁', exact: true })).toHaveCount(2);
  await expect(arrows).toHaveCount(2);
  await page.locator('.tree-save-actions').getByRole('button', { name: '保存', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').fill('shared-chain');
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.goto('/library/trees?q=shared-chain');
  await expect(page.getByRole('treeitem', { name: 't₁', exact: true })).toHaveCount(2);
  await expect(arrows).toHaveCount(2);
  await page.locator('.tree-save-actions').getByRole('button', { name: '导出', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click();
  const file = await download;
  const svg = (await import('node:fs')).readFileSync((await file.path())!, 'utf8');
  expect(svg.match(/<path[^>]*stroke-width="1.5"/g)).toHaveLength(2);
});
