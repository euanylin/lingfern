import { expect, test, webkit, type Locator } from '@playwright/test';

async function heights(control: Locator) {
  return control.evaluate(async element => {
    const result: number[] = [], until = performance.now() + 320;
    while (performance.now() < until) { await new Promise(requestAnimationFrame); result.push(element.getBoundingClientRect().height); }
    return result;
  });
}

for (const engine of ['chromium', 'webkit'] as const) test(`shared disclosures animate settings, About, grammar and Library in ${engine}`, async ({ browser }) => {
  const alternate = engine === 'webkit' ? await webkit.launch({ channel: '' }) : undefined;
  const context = await (alternate ?? browser).newContext({ viewport: { width: engine === 'webkit' ? 320 : 1440, height: 900 }, colorScheme: engine === 'webkit' ? 'dark' : 'light', locale: 'zh-CN', hasTouch: engine === 'webkit' });
  const page = await context.newPage(), errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto('http://127.0.0.1:5173/settings');
    const trigger = page.locator('.settings-language .setting-trigger');
    await trigger.focus(); await trigger.press('Enter');
    const menu = page.locator('.setting-menu');
    await expect(menu).toHaveAttribute('data-open', 'true');
    expect(await menu.evaluate(element => element.getAnimations().some(animation => animation.effect?.getTiming().duration === 160))).toBe(true);
    await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
    await expect(menu).toHaveCount(0);
    await page.goto('http://127.0.0.1:5173/settings/about');
    const detail = page.locator('.about-credit-details').first(), summary = detail.locator(':scope>summary');
    const closed = (await detail.boundingBox())!.height;
    await summary.focus(); await summary.press('Enter');
    const opening = await heights(detail), full = (await detail.boundingBox())!.height;
    expect(opening.some(height => height > closed + 1 && height < full - 1)).toBe(true);
    await summary.press('Space');
    const closing = await heights(detail);
    expect(closing.some(height => height > closed + 1 && height < full - 1)).toBe(true);
    await expect(detail).not.toHaveAttribute('open', '');
    expect(closing.at(-1)).toBeCloseTo(closed, 0);
    await summary.evaluate(async element => {
      for (let index = 0; index < 5; index++) { (element as HTMLElement).click(); await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); }
    });
    await expect.poll(() => detail.evaluate(element => element.getAnimations().length)).toBe(0);
    await expect(detail).toHaveAttribute('open', '');
    await expect(detail.locator(':scope>[inert]')).toHaveCount(0);
    await page.goto('http://127.0.0.1:5173/library/grammar');
    await page.getByRole('searchbox').fill('since / for');
    const grammar = page.locator('.grammar-results details').first();
    expect(await grammar.evaluate(async element => {
      const summary = element.querySelector('summary')!; summary.click(); summary.click();
      const until = performance.now() + 280; let interactiveWhileClosing = false;
      while (performance.now() < until) {
        await new Promise(requestAnimationFrame);
        if (element.getAttribute('data-expanded') === 'false' && element.querySelector<HTMLElement>('.grammar-detail')?.inert === false) interactiveWhileClosing = true;
      }
      return interactiveWhileClosing;
    })).toBe(false);
    await expect(grammar.locator('.grammar-detail')).toHaveCount(0);
    await grammar.locator('summary').click();
    await expect(grammar.locator('.grammar-detail')).toBeVisible();
    await expect.poll(() => grammar.evaluate(element => element.getAnimations().length)).toBe(0);
    await grammar.evaluate(element => { (element as HTMLDetailsElement).open = false; });
    await expect(grammar.locator('.grammar-detail')).toHaveCount(0);
    await grammar.evaluate(element => { (element as HTMLDetailsElement).open = true; });
    await expect(grammar.locator('.grammar-detail')).toBeVisible();
    await page.goto('http://127.0.0.1:5173/library');
    const group = page.locator('.offline-source-group').filter({ has: page.locator('.offline-source-group-toggle:not([aria-controls$=":general"])') }).first();
    const panel = group.locator('.disclosure-panel');
    await group.locator('.offline-source-group-toggle').click();
    const expanding = await heights(panel), expanded = (await panel.boundingBox())!.height;
    expect(expanding.some(height => height > 1 && height < expanded - 1)).toBe(true);
    await group.locator('.offline-source-group-toggle').click();
    await expect(group.locator('.package-row')).toHaveCount(0);
    await page.evaluate(async () => {
      const { communityPacks } = await import('/src/data/db.ts' as string);
      await communityPacks.put({ profileId: 'local-guest', hash: 'a'.repeat(64), id: 'synthetic-motion-package', lessons: [], sources: [{ id: 'synthetic', title: 'Synthetic source', attribution: 'Motion regression fixture', license: 'CC0-1.0' }], state: 'ready', installedAt: new Date().toISOString() });
    });
    const installed = page.locator('.installed-resources'), sources = installed.locator('.installed-resource-sources');
    await installed.locator(':scope>summary').click();
    await sources.locator('summary').click(); await expect(sources.locator('li')).toBeVisible();
    await sources.locator('summary').click(); await expect(sources).not.toHaveAttribute('open', '');
    await expect(installed).toHaveAttribute('open', '');
    await installed.locator(':scope>summary').click(); await expect(installed).not.toHaveAttribute('open', '');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('http://127.0.0.1:5173/settings/about');
    const reduced = page.locator('.about-credit-details').first();
    await reduced.locator('summary').click(); await expect(reduced).toHaveAttribute('open', '');
    expect(await reduced.evaluate(element => element.getAnimations().length)).toBe(0);
    await reduced.locator('summary').click(); await expect(reduced).not.toHaveAttribute('open', '');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  } finally { await context.close(); await alternate?.close(); }
});
