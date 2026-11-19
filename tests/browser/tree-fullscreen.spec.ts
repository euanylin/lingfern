import { expect, test } from '@playwright/test';

const long = 'the students read the old book in the quiet library and the teachers wrote a long letter to the new parents and the children played in the small garden near the school and the parents waited at the front door';

test('fullscreen expands the board and Escape restores it', async ({ page }) => {
  await page.setViewportSize({ width: 1120, height: 900 });
  await page.goto('/library/trees');
  const source = page.locator('#tree-source');
  await expect(source).toBeEnabled();
  await source.fill(long);
  await source.press('Enter');
  await expect(page.getByRole('treeitem', { name: 'door', exact: true })).toBeVisible();

  const read = () => page.evaluate(() => {
    const card = document.querySelector('.tree-frame') as HTMLElement;
    const canvas = document.querySelector('.tree-canvas') as HTMLElement;
    const rect = card.getBoundingClientRect();
    return {
      expanded: card.hasAttribute('data-expanded'),
      rect: [Math.round(rect.left), Math.round(rect.top), Math.round(rect.width), Math.round(rect.height)],
      canvasWidth: Math.round(canvas.getBoundingClientRect().width),
      level: Number.parseInt(document.querySelector('.tree-zoom-level')!.textContent!, 10),
      bodyOverflow: document.documentElement.style.overflow,
      viewport: [innerWidth, innerHeight],
      pageOverflow: document.documentElement.scrollWidth <= innerWidth + 1,
    };
  });

  const normal = await read();
  expect(normal.expanded).toBe(false);
  expect(normal.rect[2]).toBeLessThan(normal.viewport[0]);

  await page.getByRole('button', { name: '全屏', exact: true }).click();
  await expect(page.locator('.tree-frame')).toHaveAttribute('data-expanded', '');
  await expect(page.locator('.tree-scroll')).toHaveJSProperty('clientWidth', normal.viewport[0]);
  await expect(page.locator('.tree-scroll')).toHaveJSProperty('clientHeight', normal.viewport[1]);
  await expect.poll(async () => (await read()).canvasWidth).toBeGreaterThan(normal.canvasWidth);
  const full = await read();
  console.log('normal', JSON.stringify(normal), 'full', JSON.stringify(full));
  expect(full.rect[0]).toBe(0);
  expect(full.rect[1]).toBe(0);
  expect(full.rect[2]).toBe(full.viewport[0]);
  expect(full.rect[3]).toBe(full.viewport[1]);
  expect(full.bodyOverflow).toBe('hidden');
  expect(full.canvasWidth).toBeGreaterThan(normal.canvasWidth);
  expect(full.level).toBeGreaterThan(normal.level);
  expect(full.pageOverflow).toBe(true);
  await expect(page.getByRole('button', { name: '退出全屏', exact: true })).toBeVisible();

  // Esc leaves fullscreen and restores the page.
  const scrollBefore = await page.evaluate(() => Math.round(scrollY));
  await page.keyboard.press('Escape');
  await expect(page.locator('.tree-frame')).not.toHaveAttribute('data-expanded', '');
  await page.evaluate(y => scrollTo(0, y), scrollBefore);
  await expect.poll(async () => (await read()).rect[2]).toBe(normal.rect[2]);
  const restored = await read();
  expect(restored.rect[2]).toBe(normal.rect[2]);
  expect(restored.rect[3]).toBe(normal.rect[3]);
  expect(restored.canvasWidth).toBe(normal.canvasWidth);
  expect(restored.bodyOverflow).toBe('');
  await expect(page.getByRole('button', { name: '全屏', exact: true })).toBeVisible();

  // The button toggles back out too.
  await page.getByRole('button', { name: '全屏', exact: true }).click();
  await expect(page.locator('.tree-frame')).toHaveAttribute('data-expanded', '');
  await page.getByRole('button', { name: '退出全屏', exact: true }).click();
  await expect(page.locator('.tree-frame')).not.toHaveAttribute('data-expanded', '');
});

test('fullscreen works on a phone with a localised label', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: 'de-DE' });
  const page = await context.newPage();
  try {
    await page.goto('/library/trees');
    const source = page.locator('#tree-source');
    await expect(source).toBeEnabled();
    await source.fill('the cat sat on the mat');
    await source.press('Enter');
    await expect(page.getByRole('treeitem', { name: 'NN', exact: true })).toHaveCount(2);
    await page.getByRole('button', { name: 'Vollbild', exact: true }).tap();
    const info = await page.evaluate(() => {
      const rect = document.querySelector('.tree-scroll')!.getBoundingClientRect();
      return {
        edges: [rect.left, rect.top, rect.right, rect.bottom].map(Math.round),
        viewport: [0, 0, innerWidth, innerHeight],
        overflow: document.documentElement.scrollWidth <= innerWidth + 1,
      };
    });
    console.log('mobile full', JSON.stringify(info));
    expect(info.edges).toEqual(info.viewport);
    expect(info.overflow).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('fullscreen-mobile.png') });
  } finally { await context.close(); }
});

test('fullscreen keeps keyboard focus on the board and closes a node menu first', async ({ page }) => {
  await page.setViewportSize({ width: 1120, height: 900 });
  await page.goto('/library/trees');
  const source = page.locator('#tree-source');
  await expect(source).toBeEnabled();
  await source.fill('(S A B)');
  await source.press('Enter');
  const node = page.getByRole('treeitem', { name: 'B', exact: true });
  await expect(node).toBeVisible();
  const fullscreen = page.getByRole('button', { name: '全屏', exact: true });
  await fullscreen.click();

  await node.focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('.tree-zoom button:enabled').first()).toBeFocused();
  await node.click({ button: 'right' });
  await expect(page.getByRole('menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '退出全屏', exact: true })).toBeVisible();
  await expect(node).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(fullscreen).toBeFocused();
  await source.focus();
  await expect(source).toBeFocused();
});
