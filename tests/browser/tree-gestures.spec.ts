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

test('touch pinch zooms and lets one finger pan both axes', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: 'zh-CN' });
  const page = await context.newPage();
  try {
    await setup(page, 390);
    const fit = await read(page);
    expect(fit.sideways).toBe(false);
    await expect(page.locator('.tree-scroll')).toHaveCSS('touch-action', 'pan-y');
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

    await zoomUntilScrolls(page);
    const start = await page.locator('.tree-scroll').evaluate(card => {
      const bounds = card.getBoundingClientRect();
      const maxTop = card.scrollHeight - card.clientHeight;
      for (let top = 0; top <= maxTop - 110; top += 50) {
        card.scrollTop = top;
        for (let y = Math.max(bounds.top + 125, 170); y < Math.min(bounds.bottom - 20, innerHeight - 80); y += 16) {
          for (let x = bounds.left + 85; x < bounds.right - 8; x += 16) {
            if (document.elementFromPoint(x, y)?.closest('[data-tree-node]:not([aria-selected=true])')) return { x, y };
          }
        }
      }
      throw new Error('No visible node with space for the touch path');
    });
    const selected = await page.locator('.tree-node[aria-selected=true]').getAttribute('data-tree-node');
    const before = await read(page);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
    for (const [dx, dy] of [[2, 24], [5, 48], [24, 70], [70, 92]]) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x - dx, y: start.y - dy }] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(async () => (await read(page)).canvasLeft).toBeLessThan(before.canvasLeft - 55);
    expect((await read(page)).cardTop).toBeGreaterThan(before.cardTop + 70);
    expect((await read(page)).scrollY).toBe(before.scrollY);
    await expect(page.locator('.tree-node[aria-selected=true]')).toHaveAttribute('data-tree-node', selected!);

    const dispatch = (events: [string, number, number, number][]) => page.locator('.tree-scroll').evaluate((card, events) => {
      const rect = card.getBoundingClientRect();
      for (const [type, id, x, y] of events) card.dispatchEvent(new PointerEvent(type, {
        pointerId: id, pointerType: 'touch', isPrimary: id === 11, clientX: rect.left + x, clientY: rect.top + y, bubbles: true,
      }));
    }, events);
    const prePinch = await read(page);
    await dispatch([
      ['pointerdown', 11, 110, 210], ['pointerdown', 12, 210, 210],
      ['pointermove', 12, 245, 210], ['pointerup', 12, 245, 210],
    ]);
    await expect.poll(async () => (await read(page)).level).toBeGreaterThan(prePinch.level);
    const afterPinch = await read(page);
    await dispatch([['pointermove', 11, 55, 170], ['pointerup', 11, 55, 170]]);
    await expect.poll(async () => (await read(page)).canvasLeft).toBeLessThan(afterPinch.canvasLeft - 35);
    expect((await read(page)).cardTop).toBeGreaterThan(afterPinch.cardTop + 25);

    const edge = await page.locator('.tree-scroll').evaluate(card => {
      card.scrollTop = card.scrollHeight;
      const rect = card.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: Math.min(rect.bottom, innerHeight - 80) - 25 };
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [edge] });
    for (const dy of [25, 50, 80]) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: edge.x, y: edge.y - dy }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(async () => (await read(page)).scrollY).toBeGreaterThan(before.scrollY + 40);
  } finally { await context.close(); }
});

test('zoom buttons clear touch feedback and show a transparent keyboard focus state', async ({ browser }, info) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, colorScheme: 'dark', locale: 'zh-CN' });
  try {
    const page = await context.newPage();
    await page.goto('/library/trees');
    const toolbar = page.locator('.tree-zoom');
    const zoom = toolbar.getByRole('button', { name: '放大' });
    const fit = toolbar.getByRole('button', { name: /适应宽度/ });
    const glass = await toolbar.evaluate(element => getComputedStyle(element).backdropFilter);
    expect(glass).toContain('blur');
    await zoom.tap();
    await expect(zoom).not.toHaveAttribute('data-touch-active', '', { timeout: 1000 });
    await expect(zoom).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(zoom).toHaveCSS('outline-style', 'none');
    await toolbar.screenshot({ path: info.outputPath('zoom-after-touch.png') });
    await zoom.focus();
    await page.keyboard.press('Shift+Tab');
    await expect(fit).toBeFocused();
    await expect(fit).toHaveCSS('outline-style', 'solid');
    await expect(fit).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(toolbar).toHaveCSS('backdrop-filter', glass);
  } finally { await context.close(); }
});
