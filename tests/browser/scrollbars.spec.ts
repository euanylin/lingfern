import { expect, test } from '@playwright/test';
import { selectPicker } from './picker';

for (const [locale, theme] of [['zh-Hans','light'],['en','dark'],['ar','dark']] as const) test(`native scrollbar styling preserves menu scrolling and keyboard selection in ${locale}/${theme}`, async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 }); await page.goto('/settings');
  await selectPicker(page, (await page.locator('.settings-language .setting-trigger').getAttribute('aria-label'))!, locale);
  await selectPicker(page, (await page.locator('.settings-appearance .setting-trigger').first().getAttribute('aria-label'))!, theme);
  const trigger = page.locator('.settings-language .setting-trigger'); await trigger.click();
  const menu = page.getByRole('listbox'); await expect(menu).toBeVisible();
  expect(await menu.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
  await expect(menu).toHaveAttribute('data-scrollbar-y','true');
  const styles = await menu.evaluate(el => ({ width: getComputedStyle(el,'::-webkit-scrollbar').width, radius: getComputedStyle(el,'::-webkit-scrollbar-thumb').borderRadius, color: getComputedStyle(el,'::-webkit-scrollbar-thumb').backgroundColor }));
  expect(styles.width).toBe('6px'); expect(styles.radius).toBe('999px'); expect(styles.color).not.toBe('rgba(0, 0, 0, 0)');
  await menu.evaluate(el => el.scrollTop = el.scrollHeight); expect(await menu.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  await page.keyboard.press('End'); await page.keyboard.press('Enter'); await expect(menu).toHaveCount(0);
  await expect(trigger).toHaveAttribute('data-value','es'); await expect(trigger).toBeFocused();
  await test.info().attach('scrollbar-theme', { body: JSON.stringify(styles), contentType: 'application/json' });
});

test('short overflow hides the thumb while native scrolling, resizing and content changes remain available', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 }); await page.goto('/settings');
  await page.locator('.settings-appearance .setting-trigger').first().click();
  const menu = page.getByRole('listbox'); await expect(menu).toBeVisible();
  await expect(menu).toHaveAttribute('data-scrollbar-y','false');
  await menu.evaluate(el => el.style.maxHeight = `${el.scrollHeight - 40}px`);
  await expect.poll(() => menu.evaluate(el => el.scrollHeight - el.clientHeight)).toBeGreaterThan(0);
  expect(await menu.evaluate(el => el.scrollHeight - el.clientHeight)).toBeLessThan(48);
  await expect(menu).toHaveAttribute('data-scrollbar-y','false');
  const before = await menu.evaluate(el => ({ width: el.clientWidth, text: el.firstElementChild!.getBoundingClientRect().width }));
  await menu.hover(); await page.mouse.wheel(0, 80);
  await expect.poll(() => menu.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  await menu.evaluate(el => { const content = document.createElement('div'); content.dataset.scrollFixture = ''; content.style.height = '200px'; el.appendChild(content); });
  await expect(menu).toHaveAttribute('data-scrollbar-y','true');
  expect(await menu.evaluate(el => ({ width: el.clientWidth, text: el.firstElementChild!.getBoundingClientRect().width }))).toEqual(before);
  await menu.evaluate(el => el.querySelector('[data-scroll-fixture]')!.remove());
  await expect(menu).toHaveAttribute('data-scrollbar-y','false');
  await menu.evaluate(el => el.style.maxHeight = `${el.scrollHeight - 80}px`);
  await expect(menu).toHaveAttribute('data-scrollbar-y','true');
  await menu.evaluate(el => el.style.maxHeight = '340px');
  await expect(menu).toHaveAttribute('data-scrollbar-y','false');
  await page.keyboard.press('Escape');
  await page.goto('/library/ipa');
  await page.locator('.ipa-view-switch button').nth(1).click();
  await expect(page.locator('.ipa-table-scroll').filter({ has: page.locator('.ipa-table-consonants') })).toHaveAttribute('data-scrollbar-x','true');
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.scrollbarY)).toBe('true');
});
