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
          errors.push(Math.abs(document.querySelector('.mobile-nav')!.getBoundingClientRect().bottom - innerHeight));
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
  await expect(page.locator('.mobile-nav')).toHaveCSS('position', 'relative');
  await search.blur();
  await expect(page.locator('.mobile-nav')).toHaveCSS('position', 'fixed');
  await page.locator('.package-row:visible input[type=checkbox]').first().focus();
  await expect(page.locator('.mobile-nav')).toHaveCSS('position', 'fixed');
  await page.setViewportSize({ width: 375, height: 480 });
  await expect(page.locator('.mobile-nav')).toHaveCSS('position', 'relative');
  expect(await page.locator('.mobile-nav a').evaluateAll(items => items.every(item => item.getBoundingClientRect().height >= 44))).toBe(true);
});
