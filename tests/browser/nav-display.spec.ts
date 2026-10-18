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
