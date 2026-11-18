import { expect, test } from '@playwright/test';

test('adding a tree node by touch keeps the viewport at the board', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'zh-CN', isMobile: true, hasTouch: true, viewport: { width: 360, height: 640 } });
  try {
    const page = await context.newPage();
    await page.goto('/library/trees');
    const add = page.getByRole('button', { name: '添加子节点' });
    const label = page.locator('#tree-label');
    await expect(add).toBeEnabled();
    const before = await page.evaluate(() => scrollY);
    await add.tap();
    await expect(label).toHaveValue('X');
    await expect(page.getByRole('treeitem', { name: 'X', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(label).not.toBeFocused();
    expect(await page.evaluate(() => scrollY)).toBe(before);
    await label.tap();
    await expect(label).toBeFocused();
    await expect(label).toHaveAttribute('autocomplete', 'off');
    await expect(label).toHaveJSProperty('tagName', 'TEXTAREA');
    await label.press('Backspace');
    await label.press('N');
    await expect(page.getByRole('treeitem', { name: 'N', exact: true })).toBeVisible();
    await label.fill('N\nP');
    await label.press('Enter');
    await expect(label).toHaveValue('NP');
  } finally {
    await context.close();
  }
});

test('touch symbols preserve the target, selection and scrolling beneath the canvas', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'zh-CN', hasTouch: true, viewport: { width: 390, height: 900 } });
  const page = await context.newPage();
  try {
    await page.goto('/library/trees');
    const source = page.locator('#tree-source');
    await expect(source).toBeEnabled();
    const symbols = page.locator('.tree-symbols');
    const lambda = symbols.locator('button').filter({ hasText: /^λ$/ });
    const prime = symbols.locator('button').filter({ hasText: /^′$/ });
    const slash = symbols.locator('button').filter({ hasText: /^\/$/ });
    expect(await page.locator('.tree-frame').evaluate(frame => frame.nextElementSibling?.className === 'tree-symbols')).toBe(true);
    expect(await symbols.evaluate(row => row.nextElementSibling?.classList.contains('tree-source'))).toBe(true);
    expect(await symbols.locator('button').evaluateAll(buttons => buttons.every(button => button.getBoundingClientRect().height >= 48 && button.getBoundingClientRect().width >= 44))).toBe(true);
    await source.fill('abcd');
    await source.evaluate(field => (field as HTMLTextAreaElement).setSelectionRange(1, 3));
    await symbols.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => scrollY);
    await lambda.tap();
    await expect(source).toHaveValue('aλd');
    await expect(source).toBeFocused();
    expect(await page.evaluate(() => scrollY)).toBeCloseTo(before, 0);
    await slash.tap();
    await expect(source).toHaveValue('aλ/d');
    const label = page.locator('#tree-label');
    await label.fill('NP');
    await label.evaluate(field => (field as HTMLTextAreaElement).setSelectionRange(2, 2));
    await prime.tap();
    await prime.tap();
    await expect(label).toHaveValue('NP′′');
    await expect(source).toHaveValue('aλ/d');
    const node = page.getByRole('treeitem', { name: 'NP′′', exact: true });
    await node.dblclick();
    const inline = page.locator('.tree-node-edit');
    await inline.fill('VP');
    await inline.evaluate(field => (field as HTMLTextAreaElement).setSelectionRange(2, 2));
    await lambda.tap();
    await expect(inline).toHaveValue('VPλ');
    await inline.press('Tab');
    await expect(inline).toHaveCount(0);
    await slash.tap();
    await expect(label).toHaveValue('VPλ/');
    await expect(label).toBeFocused();
    await expect(source).toHaveValue('aλ/d');
    await label.fill('x'.repeat(200));
    await label.evaluate(field => (field as HTMLTextAreaElement).setSelectionRange(200, 200));
    await prime.tap();
    await expect(label).toHaveValue('x'.repeat(200));
    await symbols.scrollIntoViewIfNeeded();
    const box = (await lambda.boundingBox())!;
    const session = await context.newCDPSession(page);
    const scroll = await page.evaluate(() => scrollY);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 + 80 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(scroll);
    await expect(label).toHaveValue('x'.repeat(200));
  } finally { await context.close(); }
});
