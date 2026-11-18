import { expect, test } from '@playwright/test';

const long = 'the students read the old book in the quiet library and the teachers wrote a long letter to the new parents and the children played in the small garden near the school and the parents waited at the front door';

async function setup(page: import('@playwright/test').Page, width = 1120) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/library/trees');
  const source = page.locator('#tree-source');
  await expect(source).toBeEnabled();
  await source.fill(long);
  await source.press('Enter');
  await expect(page.getByRole('treeitem', { name: 'door', exact: true })).toBeVisible();
  await page.evaluate(() => scrollTo(0, 0));
}

const read = (page: import('@playwright/test').Page) => page.evaluate(() => {
  const card = document.querySelector('.tree-scroll') as HTMLElement;
  const canvas = document.querySelector('.tree-canvas') as HTMLElement;
  return {
    level: Number.parseInt(document.querySelector('.tree-zoom-level')!.textContent!, 10),
    canvasLeft: Math.round(canvas.getBoundingClientRect().left),
    cardTop: Math.round(card.scrollTop),
    insideScrolls: card.scrollHeight > card.clientHeight + 1,
    room: card.scrollHeight - card.clientHeight,
    scrollY: Math.round(scrollY),
    sideways: card.hasAttribute('data-sideways'),
  };
});

// Zoom until the board has real vertical room inside the card, so a glide cannot hit the edge.
async function zoomUntilScrolls(page: import('@playwright/test').Page) {
  for (let step = 0; step < 16 && (await read(page)).room < 240; step++) await page.getByRole('button', { name: '放大' }).click();
  expect((await read(page)).room).toBeGreaterThanOrEqual(240);
}

test('mouse wheel and trackpad gestures zoom, pan sideways and scroll the card', async ({ page }) => {
  await setup(page);
  const fit = await read(page);
  expect(fit.level).toBeLessThan(100);

  const box = (await page.locator('.tree-scroll').boundingBox())!;
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;

  // A fitted board leaves a plain wheel to the page.
  await page.mouse.move(cx, cy);
  await page.mouse.wheel(0, 30);
  await page.waitForTimeout(150);
  expect((await read(page)).level).toBe(fit.level);

  // Ctrl + wheel zooms (trackpad pinch reports the same modifier) without scrolling the page.
  await page.evaluate(() => scrollTo(0, 0));
  const scrollBeforeZoom = await page.evaluate(() => Math.round(scrollY));
  await page.mouse.move(cx, cy);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -50);
  await page.keyboard.up('Control');
  await page.waitForTimeout(150);
  const zoomed = await read(page);
  expect(zoomed.level).toBeGreaterThan(fit.level);
  expect(zoomed.scrollY).toBe(scrollBeforeZoom);

  // Once the board is taller than the card, a vertical glide scrolls the card, never the page.
  await zoomUntilScrolls(page);
  const preWheel = await read(page);
  await page.mouse.move(cx, cy);
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(200);
  const scrolled = await read(page);
  expect(scrolled.cardTop).toBeGreaterThan(preWheel.cardTop);
  expect(scrolled.scrollY).toBe(preWheel.scrollY);

  // A horizontal glide pans the wide board.
  if (scrolled.sideways) {
    await page.mouse.wheel(120, 0);
    await page.waitForTimeout(200);
    const panned = await read(page);
    expect(panned.canvasLeft).toBeLessThan(scrolled.canvasLeft);
    expect(panned.scrollY).toBe(scrolled.scrollY);
  }

  // Zooming out and the reset button return to fit.
  await page.getByRole('button', { name: /适应宽度/ }).click();
  expect((await read(page)).level).toBe(fit.level);
});

test('dragging the background pans sideways when zoomed in', async ({ page }) => {
  await setup(page);
  const fit = await read(page);
  const box = (await page.locator('.tree-scroll').boundingBox())!;
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -240);
  await page.keyboard.up('Control');
  await page.waitForTimeout(150);
  const start = await read(page);
  expect(start.level).toBeGreaterThan(fit.level);
  expect(start.sideways).toBe(true);
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 120, cy, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  expect((await read(page)).canvasLeft).toBeLessThan(start.canvasLeft);
});

test('touch pinch zooms and keeps native vertical scrolling', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: 'zh-CN' });
  const page = await context.newPage();
  try {
    await setup(page, 390);
    const fit = await read(page);
    expect(fit.sideways).toBe(false);
    const box = (await page.locator('.tree-scroll').boundingBox())!;
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await page.touchscreen.tap(cx, cy);
    // Synthesise a two-pointer pinch through pointer events.
    await page.evaluate(({ cx, cy }) => {
      const target = document.querySelector('.tree-scroll') as HTMLElement;
      const pointer = (type: string, id: number, x: number, y: number) => target.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: id === 1, clientX: x, clientY: y, bubbles: true, cancelable: true }));
      pointer('pointerdown', 1, cx - 40, cy);
      pointer('pointerdown', 2, cx + 40, cy);
      pointer('pointermove', 1, cx - 80, cy);
      pointer('pointermove', 2, cx + 80, cy);
      pointer('pointerup', 1, cx - 80, cy);
      pointer('pointerup', 2, cx + 80, cy);
    }, { cx, cy });
    await page.waitForTimeout(200);
    const pinched = await read(page);
    expect(pinched.level).toBeGreaterThan(fit.level);

    // The card keeps letting the platform scroll it vertically.
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('.tree-scroll')!).touchAction)).toBe('pan-y');

    // Once the board is wider than the card a one-finger sideways drag pans it.
    for (let step = 0; step < 12 && !(await read(page)).sideways; step++) await page.getByRole('button', { name: '放大' }).click();
    expect((await read(page)).sideways).toBe(true);
    const before = (await read(page)).canvasLeft;
    await page.evaluate(({ cx, cy }) => {
      const target = document.querySelector('.tree-scroll') as HTMLElement;
      const pointer = (type: string, id: number, x: number, y: number) => target.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true }));
      pointer('pointerdown', 3, cx, cy);
      pointer('pointermove', 3, cx - 20, cy);
      pointer('pointermove', 3, cx - 90, cy);
      pointer('pointerup', 3, cx - 90, cy);
    }, { cx, cy });
    await page.waitForTimeout(200);
    expect((await read(page)).canvasLeft).toBeLessThan(before);
  } finally { await context.close(); }
});
