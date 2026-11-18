import { expect, test } from '@playwright/test';

for (const touch of [false, true]) test(`movement mode links without reparenting with ${touch ? 'touch' : 'mouse'}`, async ({ browser }, info) => {
  const context = await browser.newContext({ locale: 'zh-CN', viewport: { width: touch ? 390 : 1120, height: 900 }, hasTouch: touch });
  await context.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { Reflect.set(window, 'copiedMovementTree', text); } } }));
  const page = await context.newPage();
  try {
    await page.goto('/library/trees');
    const source = page.locator('#tree-source');
    await expect(source).toBeEnabled();
    await source.fill('(Root (A) (B) (C))');
    await source.press('Enter');
    const mode = page.getByRole('button', { name: '移位', exact: true });
    await mode.click();
    await expect(mode).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.tree-move-picker')).toHaveCount(0);
    const drag = async (from: string, to: string, cancel = false) => {
      const first = page.getByRole('treeitem', { name: from, exact: true });
      await first.scrollIntoViewIfNeeded();
      const a = (await first.boundingBox())!;
      const b = (await page.getByRole('treeitem', { name: to, exact: true }).boundingBox())!;
      const x = a.x + a.width / 2, y = a.y + a.height / 2;
      const endX = b.x + b.width / 2, endY = b.y + b.height / 2;
      if (touch) {
        const session = await context.newCDPSession(page);
        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: endX, y: endY }] });
        await session.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] });
        await session.detach();
      } else {
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(endX, endY, { steps: 8 });
        if (cancel) await page.keyboard.press('Escape');
        await page.mouse.up();
      }
    };
    await drag('A', 'B', true);
    await expect(page.getByRole('treeitem', { name: 'A', exact: true })).toHaveCount(1);
    if (!touch) await mode.click();
    await drag('A', 'B');
    await expect(page.getByRole('treeitem', { name: 'A₁', exact: true })).toBeVisible();
    await expect(page.getByRole('treeitem', { name: 'B₁', exact: true })).toBeVisible();
    await expect(mode).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: '复制文本', exact: true }).click();
    await expect.poll(() => page.evaluate(() => Reflect.get(window, 'copiedMovementTree'))).toBe('[Root A₁ B₁ C]');
    await expect(page.locator('.tree-board svg path')).not.toHaveCount(0);
    await page.getByRole('button', { name: '撤销', exact: true }).click();
    await expect(page.getByRole('treeitem', { name: 'A', exact: true })).toHaveCount(1);
    await page.getByRole('button', { name: '重做', exact: true }).click();
    await expect(page.getByRole('treeitem', { name: 'A₁', exact: true })).toHaveCount(1);
    await page.getByRole('button', { name: '取消移位', exact: true }).click();
    await expect(page.getByRole('treeitem', { name: 'B', exact: true })).toHaveCount(1);
    // A drop onto the source itself must not create another movement or change the hierarchy.
    await drag('A', 'A');
    await expect(page.getByRole('treeitem', { name: 'A', exact: true })).toHaveCount(1);
    await mode.click();
    await expect(mode).toHaveAttribute('aria-pressed', 'false');
    await page.getByRole('treeitem', { name: 'A', exact: true }).dragTo(page.getByRole('treeitem', { name: 'C', exact: true }));
    await page.getByRole('button', { name: '复制文本', exact: true }).click();
    await expect.poll(() => page.evaluate(() => Reflect.get(window, 'copiedMovementTree'))).toBe('[Root B C A]');
    await page.screenshot({ path: info.outputPath('movement-mode.png'), fullPage: true });
  } finally { await context.close(); }
});

test('movement mode supports keyboard targets and Escape', async ({ page }) => {
  await page.goto('/library/trees');
  const source = page.locator('#tree-source');
  await expect(source).toBeEnabled();
  await source.fill('(Root (A) (B))');
  await source.press('Enter');
  await page.getByRole('treeitem', { name: 'A', exact: true }).click();
  const mode = page.getByRole('button', { name: '移位', exact: true });
  await mode.click();
  await page.getByRole('treeitem', { name: 'B', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('treeitem', { name: 'B₁', exact: true })).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(mode).toHaveAttribute('aria-pressed', 'false');
});
