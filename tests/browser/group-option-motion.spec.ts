import { expect, test, webkit, type Locator, type Page } from '@playwright/test';

async function stableRow(page: Page, toggle: Locator) {
  await toggle.scrollIntoViewIfNeeded(); await page.mouse.move(1, 1);
  await expect(toggle).toHaveCSS('transform', 'none');
  const initial = (await toggle.boundingBox())!;
  await toggle.evaluate(element => {
    const state = { rows: [] as number[][], frame: 0 };
    (window as unknown as { groupMotion: typeof state }).groupMotion = state;
    const capture = () => {
      const box = element.getBoundingClientRect(), label = element.firstElementChild!.getBoundingClientRect();
      state.rows.push([box.x, box.width, box.height, label.x]); state.frame = requestAnimationFrame(capture);
    };
    capture();
  });
  await page.mouse.move(initial.x + initial.width / 2, initial.y + initial.height / 2);
  await page.waitForTimeout(190);
  for (let index = 0; index < 4; index++) {
    await page.mouse.down(); await page.waitForTimeout(70); await page.mouse.up(); await page.waitForTimeout(90);
  }
  await page.waitForTimeout(300);
  const frames = await page.evaluate(() => {
    const state = (window as unknown as { groupMotion: { rows: number[][]; frame: number } }).groupMotion;
    cancelAnimationFrame(state.frame); return state.rows;
  });
  const drift = Math.max(...frames.flatMap(frame => frame.map((value, index) => Math.abs(value - frames[0][index]))));
  expect(drift, `Row or label moved ${drift}px while hovering/pressing`).toBeLessThan(.1);
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.focus(); await toggle.press('Enter'); await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(() => toggle.locator('.offline-group-chevron').evaluate(element => new DOMMatrixReadOnly(getComputedStyle(element).transform).m22)).toBeCloseTo(-1, 2);
  await toggle.press('Space'); await expect(toggle).toHaveAttribute('aria-expanded', 'false');
}

for (const engine of ['chromium', 'webkit'] as const) test(`full-row group options stay fixed during hover and rapid toggles in ${engine}`, async ({ browser }) => {
  const alternate = engine === 'webkit' ? await webkit.launch({ channel: '' }) : undefined;
  const context = await (alternate ?? browser).newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN', colorScheme: 'dark' });
  const page = await context.newPage();
  try {
    await page.goto('http://127.0.0.1:5173/library');
    await stableRow(page, page.locator('.offline-source-group-toggle[aria-controls$=business]').first());
    await page.goto('http://127.0.0.1:5173/today');
    await page.locator('.reading-task .topic-picker .setting-trigger').first().click();
    await expect(page.locator('.practice-options-dialog')).toHaveAttribute('data-open', 'true');
    await expect(page.locator('.practice-options-dialog')).toHaveCSS('opacity', '1');
    await stableRow(page, page.locator('.practice-options-dialog .offline-source-group-toggle').first());
    await page.setViewportSize({ width: 320, height: 900 });
    const narrow = page.locator('.practice-options-dialog .offline-source-group-toggle').first();
    await stableRow(page, narrow);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await narrow.click(); await expect(narrow).toHaveAttribute('aria-expanded', 'true');
    expect(await narrow.locator('.offline-group-chevron').evaluate(element => element.getAnimations().length)).toBe(0);
    expect(await page.pageErrors()).toEqual([]);
  } finally { await context.close(); await alternate?.close(); }
});
