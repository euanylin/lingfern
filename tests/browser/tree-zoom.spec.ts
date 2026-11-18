import { expect, test } from '@playwright/test';

const long = 'the students read the old book in the quiet library and the teachers wrote a long letter to the new parents and the children played in the small garden near the school and the parents waited at the front door';

test('a fitted wide tree zooms one step at a time below ten percent', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/library/trees');
  const source = page.locator('#tree-source');
  await expect(source).toBeEnabled();
  await source.fill(long);
  await source.press('Enter');
  await expect(page.getByRole('treeitem', { name: 'door', exact: true })).toBeVisible();
  const scale = () => page.locator('.tree-board').evaluate(board => new DOMMatrix(getComputedStyle(board).transform).a);
  const fitted = await scale();
  expect(fitted).toBeLessThan(0.08);
  const smaller = page.getByRole('button', { name: '缩小' });
  await expect(smaller).toBeDisabled();
  await page.getByRole('button', { name: '放大' }).click();
  expect(Math.abs(await scale() - fitted * 1.25)).toBeLessThan(0.001);
  await smaller.click();
  expect(Math.abs(await scale() - fitted)).toBeLessThan(0.001);
});

test('board fits, zooms, and only scrolls inside the card once zoomed', async ({ page }) => {
  await page.setViewportSize({ width: 1120, height: 900 });
  await page.goto('/library/trees');
  const source = page.locator('#tree-source');
  await expect(source).toBeEnabled();
  await source.fill(long);
  await source.press('Enter');
  await expect(page.getByRole('treeitem', { name: 'door', exact: true })).toBeVisible();

  const read = () => page.evaluate(() => {
    const scroll = document.querySelector('.tree-scroll') as HTMLElement;
    const canvas = document.querySelector('.tree-canvas') as HTMLElement;
    return {
      overflow: getComputedStyle(scroll).overflowY, level: document.querySelector('.tree-zoom-level')!.textContent,
      canvasWidth: Math.round(canvas.getBoundingClientRect().width), frameWidth: Math.round(scroll.clientWidth),
      insideScrolls: scroll.scrollHeight > scroll.clientHeight + 1,
      sideways: scroll.hasAttribute('data-sideways'),
    };
  });

  const fitted = await read();
  console.log('fit', JSON.stringify(fitted));
  // A fitted board is scaled down and adds no scrollbar, so the page keeps the wheel.
  expect(fitted.overflow).toBe('auto');
  expect(fitted.insideScrolls).toBe(false);
  expect(fitted.sideways).toBe(false);
  expect(fitted.canvasWidth).toBeLessThanOrEqual(fitted.frameWidth + 1);
  expect(Number.parseInt(fitted.level!, 10)).toBeLessThan(100);

  // A plain wheel leaves a fitted board to the page; Ctrl + wheel zooms it.
  const startLevel = Number.parseInt(fitted.level!, 10);
  await page.mouse.move(600, 400);
  await page.mouse.wheel(0, -120);
  await page.waitForTimeout(200);
  expect(Number.parseInt((await read()).level!, 10)).toBe(startLevel);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -120);
  await page.keyboard.up('Control');
  await page.waitForTimeout(200);
  expect(Number.parseInt((await read()).level!, 10)).toBeGreaterThan(startLevel);

  await page.getByRole('button', { name: /适应宽度/ }).click();
  await page.getByRole('button', { name: '放大' }).click();
  const zoomedIn = await read();
  console.log('zoom in', JSON.stringify(zoomedIn));
  expect(Number.parseInt(zoomedIn.level!, 10)).toBeGreaterThan(Number.parseInt(fitted.level!, 10));
  // Past the card's height the board becomes natively scrollable inside it.
  for (let step = 0; step < 12 && !(await read()).insideScrolls; step++) await page.getByRole('button', { name: '放大' }).click();
  expect((await read()).insideScrolls).toBe(true);

  await page.getByRole('button', { name: /适应宽度/ }).click();
  const refit = await read();
  expect(refit.level).toBe(fitted.level);
  expect(refit.insideScrolls).toBe(false);

  await page.getByRole('button', { name: '缩小' }).click();
  const zoomedOut = await read();
  expect(Number.parseInt(zoomedOut.level!, 10)).toBeLessThan(Number.parseInt(fitted.level!, 10));
});
