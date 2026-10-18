import { expect, test } from '@playwright/test';
import { languagePacks } from '../../src/locales';
import { selectPicker } from './picker';

for (const [locale, width] of [['zh-Hans', 1440], ['zh-Hant', 375], ['en', 640], ['ar', 320]] as const) for (const theme of ['light', 'dark'] as const) {
  test(`dictionary popup keeps search focus and rounded surfaces separate at ${width}/${theme}/${locale}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    await page.goto('/settings');
    await selectPicker(page, (await page.locator('.settings-language .setting-trigger').getAttribute('aria-label'))!, locale);
    await selectPicker(page, languagePacks[locale].app.theme, theme);
    await page.goto('/library/dictionary');
    const input = page.getByRole('combobox'), menu = page.getByRole('listbox');
    const before = (await input.boundingBox())!;
    await input.fill('d'); await expect(menu).toBeVisible();
    const field = (await input.boundingBox())!, popup = (await menu.boundingBox())!;
    expect(field).toEqual(before);
    expect(popup.y - field.y - field.height).toBeCloseTo(4, 0);
    expect(popup.x).toBeCloseTo(field.x, 0); expect(popup.width).toBeCloseTo(field.width, 0);
    for (const surface of [input, menu]) {
      const radii = await surface.evaluate(el => {
        const s = getComputedStyle(el);
        return [s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomRightRadius, s.borderBottomLeftRadius].map(parseFloat);
      });
      expect(radii.every(radius => radius > 0 && radius === radii[0])).toBe(true);
    }
    await expect(input).toBeFocused();
    expect(await input.evaluate(el => getComputedStyle(el).boxShadow)).toContain('inset');
    expect(await menu.getByRole('option').evaluateAll(items => items.every(item => item.getBoundingClientRect().height >= 44))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (locale === 'ar') await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await page.screenshot({ path: `output/playwright/dictionary-popup-${width}-${theme}-${locale}.png` });
    await input.press('ArrowDown'); await expect(input).toHaveAttribute('aria-activedescendant', 'dictionary-suggestion-0');
    await input.press('Escape'); await expect(menu).toBeHidden(); await expect(input).toBeFocused();
    expect(await input.boundingBox()).toEqual(field);
  });
}
