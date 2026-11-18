import { expect, test } from '@playwright/test';

const long = 'the students read the old book in the quiet library and the teachers wrote a long letter to the new parents and the children played in the small garden near the school and the parents waited at the front door';

const state = (page: import('@playwright/test').Page) => page.evaluate(() => {
  const card = document.querySelector('.tree-scroll') as HTMLElement;
  return {
    pageY: Math.round(scrollY),
    cardTop: Math.round(card.scrollTop),
    insideScrolls: card.scrollHeight > card.clientHeight + 1,
    sideways: card.hasAttribute('data-sideways'),
    touchAction: getComputedStyle(card).touchAction,
    canvasLeft: Math.round((document.querySelector('.tree-canvas') as HTMLElement).getBoundingClientRect().left),
  };
});

test('a fully visible board lets the page scroll', async ({ page }) => {
  await page.setViewportSize({ width: 1120, height: 900 });
  await page.goto('/library/trees');
  const source = page.locator('#tree-source');
  await expect(source).toBeEnabled();
  await source.fill('the cat sat on the mat');
  await source.press('Enter');
  await expect(page.getByRole('treeitem', { name: 'cat', exact: true })).toBeVisible();

  const fit = await state(page);
  console.log('fit', JSON.stringify(fit));
  expect(fit.insideScrolls).toBe(false);
  expect(fit.touchAction).toBe('pan-y');

  // A trackpad glide over a fitted board scrolls the page, not the card.
  await page.evaluate(() => scrollTo(0, 0));
  await page.locator('.tree-scroll').scrollIntoViewIfNeeded();
  const box = (await page.locator('.tree-scroll').boundingBox())!;
  const before = await page.evaluate(() => Math.round(scrollY));
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let step = 0; step < 4; step++) { await page.mouse.wheel(0, 30); await page.waitForTimeout(60); }
  await page.waitForTimeout(400);
  const glided = await state(page);
  console.log('glide', JSON.stringify(glided));
  expect(glided.pageY).toBeGreaterThan(before);
  expect(glided.cardTop).toBe(0);

  // Zooming in gives the card its own native scrolling; a vertical glide stays inside it.
  await page.evaluate(() => scrollTo(0, 0));
  for (let index = 0; index < 4; index++) await page.getByRole('button', { name: '放大' }).click();
  const zoomed = await state(page);
  expect(zoomed.insideScrolls).toBe(true);
  expect(zoomed.sideways).toBe(true);
  await page.locator('.tree-scroll').scrollIntoViewIfNeeded();
  const zoomBox = (await page.locator('.tree-scroll').boundingBox())!;
  await page.mouse.move(zoomBox.x + zoomBox.width / 2, zoomBox.y + zoomBox.height / 2);
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(200);
  const inner = await state(page);
  expect(inner.cardTop).toBeGreaterThan(0);
  expect(inner.pageY).toBe(zoomed.pageY);

  // A horizontal glide pans the wide board instead of scrolling anything.
  await page.mouse.wheel(120, 0);
  await page.waitForTimeout(200);
  const panned = await state(page);
  expect(panned.canvasLeft).toBeLessThan(inner.canvasLeft);
  expect(panned.pageY).toBe(inner.pageY);

  // Fitting again restores page scrolling.
  await page.getByRole('button', { name: /适应宽度/ }).click();
  expect((await state(page)).insideScrolls).toBe(false);
});

test('a long sentence still fits and scrolls the page', async ({ page }) => {
  await page.setViewportSize({ width: 1120, height: 900 });
  await page.goto('/library/trees');
  const source = page.locator('#tree-source');
  await expect(source).toBeEnabled();
  await source.fill(long);
  await source.press('Enter');
  await expect(page.getByRole('treeitem', { name: 'door', exact: true })).toBeVisible();
  const fit = await state(page);
  console.log('long fit', JSON.stringify(fit));
  expect(fit.insideScrolls).toBe(false);
  await page.evaluate(() => scrollTo(0, 0));
  await page.locator('.tree-scroll').scrollIntoViewIfNeeded();
  const box = (await page.locator('.tree-scroll').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const before = await page.evaluate(() => Math.round(scrollY));
  for (let step = 0; step < 4; step++) { await page.mouse.wheel(0, 30); await page.waitForTimeout(60); }
  await page.waitForTimeout(400);
  // The board fits, so this gesture belongs to the page.
  expect(await page.evaluate(() => Math.round(scrollY))).toBeGreaterThan(before);
});
