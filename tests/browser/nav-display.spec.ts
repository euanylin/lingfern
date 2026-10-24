import { expect, test } from '@playwright/test';
import { selectPicker } from './picker';

test('desktop and mobile navigation display modes are independent and persist', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/settings');
  const desktop = page.locator('.desktop-nav');
  const mobile = page.locator('.mobile-nav');
  await expect(desktop).toHaveAttribute('data-display', 'text');
  await expect(mobile).toHaveAttribute('data-display', 'both');
  for (const [mode, text, icons] of [['icon', 0, 3], ['both', 3, 3], ['text', 3, 0]] as const) {
    await selectPicker(page, '桌面端导航', mode);
    await expect(desktop).toHaveAttribute('data-display', mode);
    await expect(desktop.locator('.nav-label:visible')).toHaveCount(text);
    await expect(desktop.locator('svg:visible')).toHaveCount(icons);
  }
  await selectPicker(page, '桌面端导航', 'both');
  await expect(page.getByRole('button', { name: '桌面端导航' })).toHaveAttribute('data-value', 'both');
  await page.reload();
  await expect(desktop).toHaveAttribute('data-display', 'both');

  await page.setViewportSize({ width: 320, height: 640 });
  for (const [mode, text, icons] of [['text', 3, 0], ['icon', 0, 3], ['both', 3, 3]] as const) {
    await selectPicker(page, '移动端导航', mode);
    await expect(mobile).toHaveAttribute('data-display', mode);
    await expect(mobile).toHaveCSS('contain', 'paint');
    expect(await mobile.evaluate(el => getComputedStyle(el, '::before').zIndex)).toBe('0');
    await expect(mobile.locator('.nav-label:visible')).toHaveCount(text);
    await expect(mobile.locator('svg:visible')).toHaveCount(icons);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  }
  await selectPicker(page, '移动端导航', 'icon');
  await expect(page.getByRole('button', { name: '移动端导航' })).toHaveAttribute('data-value', 'icon');
  await page.reload();
  await expect(mobile).toHaveAttribute('data-display', 'icon');
  await expect(desktop).toHaveAttribute('data-display', 'both');
  for (const label of ['今日', '资料库', '设置']) await expect(mobile.getByRole('link', { name: label })).toBeAttached();
  await mobile.getByRole('link', { name: '今日' }).click();
  await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
  await page.goto('/settings');
  await selectPicker(page, '语言', 'en');
  await expect(page.getByRole('button', { name: 'Language' })).toHaveAttribute('data-value', 'en');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.setViewportSize({ width: 768, height: 800 });
  await expect(desktop).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(768);
  await page.setViewportSize({ width: 320, height: 640 });
  await selectPicker(page, 'Language', 'zh-Hant');
  await expect(page.getByRole('button', { name: '語言' })).toHaveAttribute('data-value', 'zh-Hant');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('mobile controls suppress native tap flashes and retain keyboard focus', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const path of ['/today', '/library', '/settings', '/library/dictionary', '/library/ipa', '/library/grammar']) {
    await page.goto(path);
    await expect(page.locator('.mobile-nav')).toBeVisible();
    const controls = page.locator('a:visible,button:visible,label:visible,input:visible,summary:visible');
    expect(await controls.count()).toBeGreaterThan(0);
    expect(await controls.evaluateAll(items => items.every(item => getComputedStyle(item).getPropertyValue('-webkit-tap-highlight-color') === 'rgba(0, 0, 0, 0)'))).toBe(true);
  }
  const link = page.locator('.mobile-nav a').first();
  await link.focus();
  await expect(link).toBeFocused();
  expect(await link.evaluate(item => getComputedStyle(item).outlineStyle)).toBe('solid');
});

test('mobile navigation stays at the bottom through transient browser-bar heights and rapid scrolls', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const path of ['/library', '/today', '/settings']) {
    await page.goto(path);
    await expect(page.locator('.mobile-nav')).toBeVisible();
    const errors = await page.evaluate(async () => {
      const viewport = window.visualViewport!;
      const errors: number[] = [];
      try {
        for (const inset of [56, 0, 32, 0, 56, 0]) {
          Object.defineProperty(viewport, 'height', { configurable: true, value: innerHeight - inset });
          viewport.dispatchEvent(new Event('scroll'));
          scrollTo(0, inset ? document.documentElement.scrollHeight : 0);
          await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
          errors.push(Math.abs(document.querySelector('.mobile-nav')!.getBoundingClientRect().bottom - innerHeight), Math.abs(document.querySelector('#root>header')!.getBoundingClientRect().top));
        }
      } finally {
        Reflect.deleteProperty(viewport, 'height');
        viewport.dispatchEvent(new Event('resize'));
      }
      return errors;
    });
    expect(Math.max(...errors)).toBeLessThanOrEqual(1);
  }
  await page.goto('/library');
  const search = page.locator('.offline-search input');
  await search.focus();
  await expect(page.locator('.mobile-nav')).toHaveCSS('position', 'fixed');
  await search.blur();
  await expect(page.locator('.mobile-nav')).toHaveCSS('position', 'fixed');
  await page.locator('.package-row:visible input[type=checkbox]').first().focus();
  await expect(page.locator('.mobile-nav')).toHaveCSS('position', 'fixed');
  await page.setViewportSize({ width: 375, height: 480 });
  await expect(page.locator('.mobile-nav')).toHaveCSS('position', 'fixed');
  expect(await page.locator('.mobile-nav a').evaluateAll(items => items.every(item => item.getBoundingClientRect().height >= 44))).toBe(true);
});

test.describe('fixed navigation inertia', () => {
  test.use({ hasTouch: true });
  test('top and bottom bars stay on viewport edges through native swipes, wheel bursts and zoom', async ({ page }) => {
    for (const width of [375, 1440]) {
      await page.setViewportSize({ width, height: 812 }); await page.goto('/settings');
      const header = page.locator('#root>header'); await expect(header).toHaveCSS('position', 'fixed');
      await expect(page.locator('.profile-backup')).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeGreaterThan(80);
      await page.evaluate(() => {
        const rows: { scroll: number; top: number; bottom: number }[] = [];
        let running = true;
        const sample = () => { const nav = document.querySelector<HTMLElement>('.mobile-nav')!; rows.push({ scroll: scrollY, top: Math.abs(document.querySelector('#root>header')!.getBoundingClientRect().top), bottom: getComputedStyle(nav).display === 'none' ? 0 : Math.abs(nav.getBoundingClientRect().bottom - innerHeight) }); if (running) requestAnimationFrame(sample); };
        sample(); (window as unknown as { stopBarSample: () => unknown }).stopBarSample = () => { running = false; return rows; };
      });
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 20, y: 680 }] });
      for (const y of [600, 500, 400, 300, 180]) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 20, y }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.mouse.wheel(0, 500); await page.mouse.wheel(0, -300);
      await page.evaluate(() => new Promise<void>(resolve => { let left = 30; const frame = () => --left ? requestAnimationFrame(frame) : resolve(); requestAnimationFrame(frame); }));
      const rows = await page.evaluate(() => (window as unknown as { stopBarSample: () => { scroll: number; top: number; bottom: number }[] }).stopBarSample());
      expect(Math.max(...rows.map(row => row.scroll))).toBeGreaterThan(80);
      expect(Math.max(...rows.map(row => Math.max(row.top, row.bottom)))).toBeLessThanOrEqual(1);
      await page.evaluate(() => document.documentElement.style.fontSize = '200%');
      await expect.poll(() => page.locator('#root').evaluate(el => parseFloat(getComputedStyle(el).paddingTop) - document.querySelector('#root>header')!.getBoundingClientRect().height)).toBeGreaterThanOrEqual(-1);
      expect(await header.locator('a:visible').evaluateAll(items => items.every(el => el.getBoundingClientRect().height >= 44))).toBe(true);
      await page.getByRole('heading', { level: 1 }).scrollIntoViewIfNeeded();
      await expect(header).toHaveCSS('position', 'fixed');
      await test.info().attach(`fixed-bars-${width}`, { body: JSON.stringify(rows), contentType: 'application/json' }); await cdp.detach();
    }
  });
});

for (const [locale, theme, width] of [['zh-Hans', 'light', 375], ['en', 'dark', 767], ['ar', 'dark', 320]] as const) test(`mobile icons lift for mouse hover and keyboard focus: ${locale}/${theme}`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 812 }); await page.goto('/settings');
  await selectPicker(page, (await page.locator('.settings-language .setting-trigger').getAttribute('aria-label'))!, locale);
  await selectPicker(page, (await page.locator('.settings-appearance .setting-trigger').first().getAttribute('aria-label'))!, theme);
  const link = page.locator('.mobile-nav a[href="/library"]'), icon = link.locator('svg');
  const height = () => icon.evaluate(el => { const value = getComputedStyle(el).transform; return value === 'none' ? 0 : new DOMMatrixReadOnly(value).m42; });
  await page.mouse.move(0, 0); await expect(icon).toHaveCSS('transform', 'none');
  const before = (await link.boundingBox())!;
  await link.hover(); await expect.poll(height).toBeCloseTo(-2, 1);
  const hovered = (await link.boundingBox())!;
  expect(hovered).toEqual(before); expect(hovered.width).toBeGreaterThanOrEqual(44); expect(hovered.height).toBeGreaterThanOrEqual(44);
  await page.locator('.mobile-nav').screenshot({ path: info.outputPath('mouse-nav-lift.png') });
  await page.mouse.move(0, 0); await expect(icon).toHaveCSS('transform', 'none');
  await link.focus(); await link.press('Tab'); await page.keyboard.press('Shift+Tab');
  await expect(link).toBeFocused(); await expect.poll(height).toBeCloseTo(-2, 1);
  await link.blur(); await expect(icon).toHaveCSS('transform', 'none');
  await page.emulateMedia({ reducedMotion: 'reduce' }); await link.hover(); await expect(icon).toHaveCSS('transform', 'none');
  await page.mouse.move(0, 0); await link.focus(); await link.press('Tab'); await page.keyboard.press('Shift+Tab');
  await expect(link).toBeFocused(); await expect(icon).toHaveCSS('transform', 'none');
  await link.press('Enter'); await expect(page).toHaveURL(/\/library$/);
  await expect(page.locator('.mobile-nav a[aria-current]')).toHaveAttribute('href', '/library');
});
