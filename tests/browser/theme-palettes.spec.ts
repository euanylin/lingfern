import { readFile, writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { paletteIds, paletteOrder } from '../../src/shared/palettes';

const readColors = async (page: import('@playwright/test').Page) => page.evaluate(() => {
  const probe = document.createElement('span');
  document.body.appendChild(probe);
  const color = (name: string) => { probe.style.color = `var(--${name})`; return getComputedStyle(probe).color; };
  const values = Object.fromEntries(['bg', 'raised', 'line', 'button-hover', 'selection', 'tag-surface', 'ink', 'muted', 'accent', 'on-accent', 'button-surface', 'primary-surface', 'primary-ink', 'primary-hover', 'focus', 'control', 'success', 'success-surface', 'error', 'error-surface', 'warning', 'warning-surface'].map(name => [name, color(name)]));
  probe.remove();
  return values;
});
const contrast = (a: string, b: string) => {
  const luminance = (value: string) => {
    const rgb = value.match(/[\d.]+/gu)!.slice(0, 3).map(Number).map(x => { const v = x / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
  };
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
};

for (const width of [1120, 390]) test(`all 33 palettes work in both modes at ${width}px`, async ({ page }, info) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/settings');
  await expect(page.getByRole('button', { name: '主题配色: 默认', exact: true })).toBeVisible();
  const samples = [];
  for (const mode of ['light', 'dark'] as const) {
    await page.getByRole('button', { name: /^显示模式:|^外观:|^主题:|^外观模式:/u }).click();
    await page.locator(`[role=option][data-value=${mode}]`).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
    for (const palette of paletteIds) {
      await page.getByRole('button', { name: /^主题配色:/u }).click();
      await expect(page.locator('[role=option]')).toHaveCount(33);
      await expect(page.locator(`[role=option][data-value=${palette}] .palette-swatches`)).toHaveCount(1);
      await page.locator(`[role=option][data-value=${palette}]`).click();
      await expect(page.locator('html')).toHaveAttribute('data-palette', palette);
      const colors = await readColors(page);
      if (palette !== 'original') {
        expect(contrast(colors.line, colors.bg), `${palette}/${mode}: subtle page dividers`).toBeLessThanOrEqual(1.6);
        expect(contrast(colors.line, colors.raised), `${palette}/${mode}: subtle card dividers`).toBeLessThanOrEqual(1.5);
      }
      if (mode === 'dark' && palette !== 'basic' && palette !== 'original') {
        for (const surface of ['bg', 'raised', 'button-surface', 'button-hover', 'selection']) {
          const rgb = colors[surface].match(/[\d.]+/gu)!.slice(0, 3).map(Number);
          expect(Math.max(...rgb) - Math.min(...rgb), `${palette}: subdued ${surface}`).toBeLessThanOrEqual(10);
        }
      }
      if (palette === 'basic') {
        expect(contrast(colors['on-accent'], colors['primary-hover'])).toBeGreaterThanOrEqual(4.5);
        for (const surface of ['bg', 'raised', 'button-surface', 'button-hover']) {
          const channels = colors[surface].match(/[\d.]+/gu)!.slice(0, 3).map(Number);
          expect(Math.max(...channels) - Math.min(...channels)).toBe(0);
        }
        for (const surface of ['accent', 'primary-surface', 'selection']) {
          const channels = colors[surface].match(/[\d.]+/gu)!.slice(0, 3).map(Number);
          expect(channels[2]).toBeGreaterThan(channels[0]);
        }
      }
      if (mode === 'dark' && palette === 'basic') expect(colors.bg).toBe('rgb(32, 32, 32)');
      if (mode === 'dark' && palette === 'original') expect(colors.bg).toBe('rgb(31, 30, 29)');
      for (const surface of ['bg', 'raised', 'button-surface', 'button-hover', 'selection']) for (const text of ['ink', 'muted', 'accent']) expect(contrast(colors[text], colors[surface]), `${palette}/${mode}: ${text} on ${surface}`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors.control, colors.raised)).toBeGreaterThanOrEqual(3);
      expect(contrast(colors.focus, colors.bg)).toBeGreaterThanOrEqual(3);
      expect(contrast(colors['primary-ink'], colors['primary-surface'])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(colors['on-accent'], colors.accent)).toBeGreaterThanOrEqual(4.5);
      for (const state of ['success', 'error', 'warning']) expect(contrast(colors[state], colors[`${state}-surface`])).toBeGreaterThanOrEqual(4.5);
      expect(await page.locator('.brand-symbol').first().evaluate(e => getComputedStyle(e).backgroundColor)).toBe(mode === 'light' ? 'rgb(83, 111, 91)' : 'rgb(168, 187, 163)');
      samples.push({ palette, mode, ...colors });
    }
  }
  await writeFile(info.outputPath('palette-colors.json'), JSON.stringify(samples, null, 2));
  await info.attach('palette-colors.json', { path: info.outputPath('palette-colors.json'), contentType: 'application/json' });
  await expect(page.locator('.backup-download')).toHaveCSS('background-color', (await readColors(page))['primary-surface']);
  await page.screenshot({ path: info.outputPath('settings-dark.png'), fullPage: true });
  await expect(page.getByRole('button', { name: '重置配色', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /^主题配色:/u }).click();
  await page.locator('[role=option][data-value=basic]').click();
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'basic');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'basic');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

for (const width of [1120, 390]) test(`introduction and Today preserve palette, mode and brand at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/settings');
  await page.getByRole('button', { name: /^主题配色:/u }).click();
  await page.locator('[role=option][data-value=plum]').click();
  for (const mode of ['light', 'dark'] as const) {
    await page.getByRole('button', { name: /^外观:/u }).click();
    await page.locator(`[role=option][data-value=${mode}]`).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
    for (const path of ['/introduction', '/today']) {
      await page.goto(path);
      await expect(page.locator('html')).toHaveAttribute('data-palette', 'plum');
      await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-palette', 'plum');
      await expect(page.locator('html')).toHaveAttribute('data-theme', mode);
      if (path === '/today') await expect(page.locator('.fern')).toHaveCSS('color', mode === 'dark' ? 'rgb(168, 187, 163)' : 'rgb(83, 111, 91)');
      else {
        await expect(page.locator('.welcome-main')).toBeVisible();
        await expect(page.locator('.welcome-site-header .brand-symbol:visible').first()).toBeVisible();
        await expect(page.locator('.welcome-site-header .brand-symbol:visible').first()).toHaveCSS('color', mode === 'dark' ? 'rgb(168, 187, 163)' : 'rgb(83, 111, 91)');
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      await page.screenshot({ path: info.outputPath(`${path.slice(1)}-${mode}.png`), fullPage: true });
    }
    await page.getByRole('link', { name: '设置', exact: true }).first().click();
    await expect(page.getByRole('button', { name: '主题配色: 梅紫', exact: true })).toBeVisible();
  }
});

test('migrates an old default to Basic, preserves explicit choice and follows system mode', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.getByRole('button', { name: '主题配色: 默认', exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const modulePath = '/src/data/db.ts';
    const { settings, profiles } = await import(modulePath);
    const profile = await profiles.toCollection().first();
    await settings.put({ key: `profile:${profile!.id}:theme`, value: 'dark' });
    localStorage.removeItem('lingfern-appearance-v1');
  });
  await page.goto('/introduction');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'basic');
  await page.goto('/settings');
  await page.getByRole('button', { name: /^主题配色:/u }).click();
  await page.locator('[role=option][data-value=original]').click();
  await page.getByRole('button', { name: '外观: 深色', exact: true }).click();
  await page.locator('[role=option][data-value=system]').click();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(31, 30, 29)');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(247, 246, 242)');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'original');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'system');
});

test('compiled introduction restores its first visible colors and reloads offline', async ({ page, context }) => {
  test.setTimeout(90000);
  const sw = await page.request.get('http://127.0.0.1:8787/sw.js');
  expect(await sw.text()).toBe(await readFile('dist/sw.js', 'utf8'));
  await page.goto('http://127.0.0.1:8787/settings');
  await expect(page.getByRole('button', { name: /^主题配色:/u })).toBeVisible();
  await page.getByRole('button', { name: /^主题配色:/u }).click();
  await page.locator('[role=option][data-value=ruby]').click();
  await page.getByRole('button', { name: /^外观:/u }).click();
  await page.locator('[role=option][data-value=dark]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const expectedBackground = (await readColors(page)).bg;
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.addInitScript(() => {
    const inspect = () => {
      if (!document.body || getComputedStyle(document.body).visibility === 'hidden') return requestAnimationFrame(inspect);
      Object.assign(window, { firstAppearance: { palette: document.documentElement.dataset.palette, mode: document.documentElement.dataset.theme, background: getComputedStyle(document.body).backgroundColor } });
    };
    requestAnimationFrame(inspect);
  });
  await page.goto('http://127.0.0.1:8787/introduction');
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'ruby');
  await page.waitForFunction(() => 'firstAppearance' in window);
  expect(await page.evaluate(() => (window as unknown as { firstAppearance: unknown }).firstAppearance)).toMatchObject({ palette: 'ruby', mode: 'dark', background: expectedBackground });
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'ruby');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('.welcome-main')).toBeVisible();
  await page.goto('http://127.0.0.1:8787/settings');
  await expect(page.getByRole('button', { name: '主题配色: 红宝石', exact: true })).toBeVisible();
  await page.goto('http://127.0.0.1:8787/today');
  await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
});

test('keyboard selection, library input, export dialog and RTL use the selected palette', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/settings');
  const picker = page.getByRole('button', { name: /^主题配色:/u });
  await picker.focus();
  await picker.press('Home');
  await expect(page.locator('[role=option][data-value=basic]')).toBeFocused();
  expect(await page.getByRole('option').evaluateAll(options => options.map(option => option.getAttribute('data-value')))).toEqual([...paletteOrder]);
  await page.keyboard.press('End');
  await expect(page.locator('[role=option][data-value=blush]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'blush');
  await page.getByRole('button', { name: /^外观:/u }).click();
  await page.locator('[role=option][data-value=dark]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.goto('/library/trees');
  await expect(page.locator('#tree-source')).toBeEnabled();
  await page.locator('#tree-source').focus();
  const colors = await readColors(page);
  await expect(page.locator('#tree-source')).toHaveCSS('background-color', colors['button-surface']);
  await page.getByRole('button', { name: '导出', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCSS('background-color', colors.raised);
  await page.screenshot({ path: info.outputPath('library-export-dark.png'), fullPage: true });
  await page.keyboard.press('Escape');
  await page.goto('/settings');
  await page.locator('.settings-language .setting-trigger').click();
  await page.locator('[role=option][data-value=ar]').click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.locator('.settings-appearance .setting-trigger[data-value=blush]').click();
  await expect(page.getByRole('option')).toHaveCount(33);
  const swatch = page.getByRole('option').locator('.palette-swatches').first();
  await expect(swatch.locator('*')).toHaveCount(0);
  await expect(swatch).toHaveCSS('width', '64px');
  await expect(swatch).toHaveCSS('height', '32px');
  const radius = await swatch.evaluate(element => parseFloat(getComputedStyle(element).borderRadius));
  const cardRadius = await page.locator('.settings-preferences').evaluate(element => parseFloat(getComputedStyle(element).borderRadius));
  expect(radius).toBe(cardRadius / 2);
  expect(radius).toBeLessThan(16);
  await page.screenshot({ path: info.outputPath('palette-menu-rtl.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test('keeps the saved first-paint palette and mode when IndexedDB cannot open', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('lingfern-appearance-v1', JSON.stringify({ mode: 'dark', palette: 'plum' }));
    IDBFactory.prototype.open = () => { throw new DOMException('Storage unavailable', 'UnknownError'); };
  });
  await page.goto('/settings');
  await expect(page.getByRole('alert')).toContainText('暂时无法读取本地记录');
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'plum');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('lingfern-appearance-v1')!))).toEqual({ palette: 'plum', mode: 'dark' });
});
