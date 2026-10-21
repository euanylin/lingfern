import { expect, test } from '@playwright/test';
import { selectPicker } from './picker';
import { languagePacks } from '../../src/locales';

test('advertises and updates the active color scheme for browser and dark-mode extensions', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/settings');
  await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute('content', 'light');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#F7F6F2');
  await selectPicker(page, '外观', 'dark');
  await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute('content', 'dark');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#1F1E1D');
  expect(await page.locator('html').evaluate(el => getComputedStyle(el).colorScheme)).toBe('dark');
  await page.reload();
  await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute('content', 'dark');
  await selectPicker(page, '外观', 'system');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute('content', 'dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute('content', 'light');
  await selectPicker(page, '外观', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute('content', 'light');
});

test('all settings pickers keep their shape and use a themed keyboard-accessible menu', async ({ page, browser }) => {
  await page.goto('/settings');
  await page.getByRole('button', { name: '语言' }).click();
  await expect(page.locator('.setting-menu')).toHaveCSS('backdrop-filter', 'blur(24px) saturate(1.4)');
  expect(await page.locator('.setting-menu').evaluate(el => getComputedStyle(el).backgroundColor)).toMatch(/^(?:rgba\(234, 232, 226, 0\.55\)|color\(srgb 0\.917647 0\.909804 0\.886275 \/ 0\.55\))$/);
  await expect(page.locator('.setting-menu')).toHaveCSS('background-image', 'none');
  const expectPlacement = async () => {
    const placement = await page.locator('.setting-menu').evaluate(menu => {
      const popup = menu.getBoundingClientRect();
      const anchor = menu.parentElement!.querySelector('.setting-trigger')!.getBoundingClientRect();
      return { within: popup.left >= 8 && popup.right <= innerWidth - 8 && popup.top >= 8 && popup.bottom <= innerHeight - 8,
        separate: popup.top >= anchor.bottom + 2 || popup.bottom <= anchor.top - 2 };
    });
    expect(placement).toEqual({ within: true, separate: true });
  };
  await expectPlacement();
  await page.keyboard.press('Escape');
  await selectPicker(page, '外观', 'dark');
  for (const [index, value] of [[0, 'en'], [1, 'dark'], [4, 'oxford']] as const) {
    const picker = page.locator('.settings-preferences .setting-trigger').nth(index);
    const shape = () => picker.evaluate(el => {
      const style = getComputedStyle(el);
      return { height: (el as HTMLElement).offsetHeight, radius: style.borderRadius, border: style.borderWidth, shadow: style.boxShadow };
    });
    const resting = await shape();
    expect(resting.border).toBe('0px');
    await picker.hover();
    expect(await shape()).toEqual(resting);
    await picker.click();
    const menu = page.locator('.settings-preferences .setting-menu');
    await expect(menu).toBeVisible();
    await expectPlacement();
    await expect(menu.locator('[role=option]').first()).toHaveCSS('font-size', '15px');
    if (index === 0) await page.screenshot({ path: 'output/playwright/select-dark-refined.png' });
    const glass = await menu.evaluate(el => ({ background: getComputedStyle(el).backgroundColor, blur: getComputedStyle(el).backdropFilter }));
    expect(glass.background).toMatch(/^(?:rgba\(48, 48, 46, 0\.55\)|color\(srgb 0\.188235 0\.188235 0\.180392 \/ 0\.55\))$/);
    expect(glass.blur).toContain('blur(24px)');
    expect(await menu.locator('[role=option]').evaluateAll(options => options.every(option => option.getBoundingClientRect().height >= 44))).toBe(true);
    await picker.press('Escape');
    await expect(menu).toHaveCount(0);
    if (index !== 1) {
      const label = (await picker.getAttribute('aria-label'))!;
      await selectPicker(page, label, value);
      await expect(picker).toHaveAttribute('data-value', value);
    }
    await expect(picker).toBeFocused();
    const focused = await shape();
    expect({ ...focused, shadow: resting.shadow }).toEqual(resting);
    if (await picker.evaluate(el => el.matches(':focus-visible'))) {
      expect(focused.shadow).toBe('none'); await expect(picker.locator('span').first()).toHaveCSS('text-decoration-line', 'underline');
    }
    else expect(focused.shadow).toBe(resting.shadow);
    await picker.evaluate(el => (el as HTMLElement).blur());
    expect(await shape()).toEqual(resting);
  }
  await page.getByRole('button', { name: 'Language' }).click();
  await expectPlacement();
  await page.locator('.settings-preferences').screenshot({ path: 'output/playwright/select-native-dark-en.png' });
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 320, height: 640 });
  const language = page.getByRole('button', { name: 'Language' });
  await language.focus();
  await language.press('ArrowDown');
  await expect(page.getByRole('listbox', { name: 'Language' })).toBeVisible();
  expect(await page.getByRole('listbox', { name: 'Language' }).locator('[role=option]').evaluateAll(options => options.every(option => option.getBoundingClientRect().height >= 44))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: languagePacks.fr.app.language })).toHaveAttribute('data-value', 'fr');
  const touch = await browser.newContext({ viewport: { width: 320, height: 640 }, hasTouch: true, isMobile: true });
  try {
    const mobile = await touch.newPage();
    await mobile.goto('/settings');
    await mobile.getByRole('button', { name: '语言' }).click();
    expect(await mobile.getByRole('listbox', { name: '语言' }).locator('[role=option]').evaluateAll(options => options.every(option => option.getBoundingClientRect().height >= 44))).toBe(true);
  } finally {
    await touch.close();
  }
});
