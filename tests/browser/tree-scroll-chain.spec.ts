import { expect, test } from '@playwright/test';

const long = 'the students read the old book in the quiet library and the teachers wrote a long letter to the new parents and the children played in the small garden near the school and the parents waited at the front door';

const read = (page: import('@playwright/test').Page) => page.evaluate(() => {
  const card = document.querySelector('.tree-scroll') as HTMLElement;
  return {
    pageY: Math.round(scrollY),
    cardTop: Math.round(card.scrollTop),
    cardHeight: card.clientHeight,
    scrollHeight: card.scrollHeight,
    overflowY: getComputedStyle(card).overflowY,
    sideways: card.hasAttribute('data-sideways'),
    level: document.querySelector('.tree-zoom-level')!.textContent,
  };
});

test('the card scrolls natively like a text area, then hands over to the page', async ({ page }) => {
  await page.setViewportSize({ width: 1120, height: 520 });
  await page.goto('/library/trees');
  const source = page.locator('#tree-source');
  await expect(source).toBeEnabled();
  await source.fill(long);
  await source.press('Enter');
  await expect(page.getByRole('treeitem', { name: 'door', exact: true })).toBeVisible();
  const card = page.locator('.tree-scroll');
  await expect(card).toHaveCSS('overscroll-behavior-x', 'contain');
  await expect(card).toHaveCSS('overscroll-behavior-y', 'auto');
  const toolbar = page.locator('.tree-zoom');
  await expect(toolbar).toHaveCSS('overflow-x', 'hidden');
  await expect(toolbar).toHaveCSS('overscroll-behavior-x', 'contain');

  const fitted = await read(page);
  console.log('fit', JSON.stringify(fitted));
  expect(fitted.overflowY).toBe('auto');
  expect(fitted.scrollHeight).toBeLessThanOrEqual(fitted.cardHeight + 1);

  // Zoom in for height, then the card scrolls internally first and the page stays put.
  for (let index = 0; index < 6; index++) await page.getByRole('button', { name: '放大' }).click();
  await expect.poll(async () => (await read(page)).scrollHeight).toBeGreaterThan(fitted.scrollHeight + 10);
  await page.evaluate(() => scrollTo(0, 150));
  await card.scrollIntoViewIfNeeded();
  const box = (await card.boundingBox())!;
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  const start = await read(page);
  await page.mouse.wheel(0, 60);
  await page.waitForTimeout(250);
  const inner = await read(page);
  console.log('start', JSON.stringify(start), 'inner', JSON.stringify(inner));
  expect(inner.cardTop).toBeGreaterThan(start.cardTop);
  expect(inner.pageY).toBe(start.pageY);

  // At the card's bottom edge the page continues, exactly like a text area.
  for (let step = 0; step < 30; step++) { await page.mouse.wheel(0, 300); await page.waitForTimeout(20); }
  await page.waitForTimeout(300);
  const bottom = await read(page);
  expect(bottom.cardTop).toBe(bottom.scrollHeight - bottom.cardHeight);
  expect(bottom.pageY).toBeGreaterThan(start.pageY);
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(300);
  const afterwards = await read(page);
  console.log('bottom', JSON.stringify(bottom), 'after', JSON.stringify(afterwards));
  expect(afterwards.pageY).toBeGreaterThanOrEqual(bottom.pageY);
  expect(afterwards.cardTop).toBe(bottom.cardTop);

  // Scrolling up inside the card goes back through its own content before the page moves.
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  const backPageY = (await read(page)).pageY;
  const back = (await card.boundingBox())!;
  await page.mouse.move(back.x + back.width / 2, back.y + back.height / 2);
  await page.mouse.wheel(0, -200);
  await page.waitForTimeout(250);
  const raised = await read(page);
  expect(raised.cardTop).toBeLessThan(bottom.cardTop);
  expect(raised.pageY).toBe(backPageY);
});

test('dragging sideways pans without touching vertical scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 1120, height: 800 });
  await page.goto('/library/trees');
  const source = page.locator('#tree-source');
  await expect(source).toBeEnabled();
  await source.fill(long);
  await source.press('Enter');
  await expect(page.getByRole('treeitem', { name: 'door', exact: true })).toBeVisible();
  for (let index = 0; index < 4; index++) await page.getByRole('button', { name: '放大' }).click();
  await expect.poll(async () => (await read(page)).sideways).toBe(true);
  const box = (await page.locator('.tree-scroll').boundingBox())!;
  const canvasLeft = () => page.evaluate(() => Math.round((document.querySelector('.tree-canvas') as HTMLElement).getBoundingClientRect().left));
  const before = await canvasLeft();
  const beforeTop = (await read(page)).cardTop;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 120, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  expect(await canvasLeft()).toBeLessThan(before);
  expect((await read(page)).cardTop).toBe(beforeTop);
});

test('diagonal glides move both axes without switching the dominant axis', async ({ page }) => {
  await page.setViewportSize({ width: 1120, height: 520 });
  await page.goto('/library/trees');
  const source = page.locator('#tree-source');
  await expect(source).toBeEnabled();
  await source.fill(long);
  await source.press('Enter');
  for (let index = 0; index < 7; index++) await page.getByRole('button', { name: '放大' }).click();
  const card = page.locator('.tree-scroll');
  await card.scrollIntoViewIfNeeded();
  await card.evaluate(element => { element.scrollTop = 0; });
  const box = (await card.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, Math.max(80, box.y + box.height / 2));
  const position = () => page.evaluate(() => ({ x: document.querySelector('.tree-canvas')!.getBoundingClientRect().left, y: document.querySelector('.tree-scroll')!.scrollTop }));
  for (const [dx, dy] of [[60, 40], [40, 60], [50, 50]]) {
    const before = await position();
    await page.mouse.wheel(dx, dy);
    await expect.poll(async () => (await position()).x).toBeLessThan(before.x);
    await expect.poll(async () => (await position()).y).toBeGreaterThan(before.y);
  }
});
