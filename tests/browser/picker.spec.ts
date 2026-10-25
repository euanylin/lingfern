import { expect, test } from '@playwright/test';
import { expectPickerAlignment } from './picker';

for (const [width, colorScheme] of [[1440, 'light'], [375, 'dark']] as const) test(`keyboard profile picker ignores an already-settled scroll event: ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 800 });
  await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
  await page.goto('/settings');
  const trigger = page.locator('.profile-backup .setting-trigger');
  await trigger.scrollIntoViewIfNeeded();
  await trigger.focus();
  await trigger.press('Enter');
  const menu = page.getByRole('listbox', { name: '当前档案', exact: true });
  await expect(menu).toBeVisible();
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  // Focus can finish scrolling before its queued notification is delivered.
  await page.evaluate(() => document.dispatchEvent(new Event('scroll')));
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(menu.getByRole('option', { selected: true })).toBeFocused();
  expect(await menu.getByRole('option', { selected: true }).evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  const before = await page.evaluate(() => scrollY);
  await page.evaluate(() => scrollBy(0, scrollY > 80 ? -80 : 80));
  await expect.poll(() => page.evaluate(() => scrollY)).not.toBe(before);
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

for (const [width, locale, colorScheme] of [[830, 'zh-CN', 'dark'], [1440, 'en', 'light'], [375, 'ar', 'dark']] as const) test.describe(`picker anchors ${width}/${locale}`, () => {
  test.use({ viewport: { width, height: 780 }, locale, colorScheme, hasTouch: width < 768, isMobile: width < 768, reducedMotion: width < 768 ? 'reduce' : 'no-preference' });
  test('wide fields follow their logical start edge through selection and resizing', async ({ page }, info) => {
    await page.goto('/today');
    const positions = [];
    for (const skill of ['reading', 'listening']) {
      await page.locator(`[data-practice-skill=${skill}]`).first().click();
      const dialog = page.locator('.practice-options-dialog[open]'); await expect(dialog).toHaveCSS('opacity', '1');
      for (let index = 0; index < 2; index++) {
        const trigger = dialog.locator('.practice-option-fields .setting-trigger').nth(index);
        await trigger.click(); await expect(dialog.getByRole('listbox')).toBeVisible();
        await page.screenshot({ path: info.outputPath(`${skill}-field-${index}.png`) });
        positions.push(await expectPickerAlignment(trigger));
        await dialog.getByRole('option').nth(1).click(); await expect(dialog.getByRole('listbox')).toBeVisible();
        positions.push(await expectPickerAlignment(trigger));
        await page.keyboard.press('End'); await expect(dialog.getByRole('option').last()).toBeFocused();
        await page.keyboard.press('Home'); await expect(dialog.getByRole('option').first()).toBeFocused();
        await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
      }
      const trigger = dialog.locator('.practice-option-fields .setting-trigger').first(); await trigger.click();
      await page.setViewportSize({ width: width - 15, height: 780 });
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      if (!(await dialog.getByRole('listbox').isVisible())) {
        // A resize may scroll the owning surface, which intentionally dismisses menus.
        await expect(trigger).toHaveAttribute('aria-expanded', 'false'); await expect(trigger).toBeFocused(); await trigger.click();
      }
      await expect(dialog.getByRole('listbox')).toBeVisible(); positions.push(await expectPickerAlignment(trigger));
      await page.keyboard.press('Escape'); await dialog.locator('header button').click();
      await expect(dialog).toHaveCount(0);
      await page.setViewportSize({ width, height: 780 });
    }
    await info.attach('positions', { body: JSON.stringify(positions), contentType: 'application/json' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test('row menus follow logical end edges and account for their containing border', async ({ page }, info) => {
    await page.goto('/settings'); const positions = [];
    for (const selector of ['.settings-language .setting-trigger', '.settings-appearance .setting-trigger', '.profile-backup .setting-trigger']) {
      const trigger = page.locator(selector).first(); await trigger.scrollIntoViewIfNeeded();
      await trigger.focus(); await trigger.press('Enter'); await expect(page.getByRole('listbox')).toBeVisible();
      positions.push(await expectPickerAlignment(trigger)); await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
    }
    const trigger = page.locator('.profile-backup .setting-trigger');
    await trigger.locator('..').evaluate(element => { element.style.border = '3px solid transparent'; });
    await trigger.click(); await expect(page.getByRole('listbox')).toBeVisible();
    await page.screenshot({ path: info.outputPath('bordered-row.png') });
    positions.push(await expectPickerAlignment(trigger));
    await info.attach('positions', { body: JSON.stringify(positions), contentType: 'application/json' });
  });
});
