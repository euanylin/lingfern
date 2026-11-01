import { expect, test, webkit } from '@playwright/test';

for (const engine of ['chromium', 'webkit'] as const) for (const touch of [false, true]) test(`picker pointer toggles once and restores focus in ${engine}, touch=${touch}`, async ({ browser }) => {
  const alternate = engine === 'webkit' ? await webkit.launch({ channel: '' }) : undefined;
  const context = await (alternate ?? browser).newContext({ viewport: { width: touch ? 375 : 1440, height: 900 }, hasTouch: touch, colorScheme: 'dark', locale: 'zh-CN' });
  const page = await context.newPage();
  const activate = async (control: import('@playwright/test').Locator) => { if (touch) await control.tap(); else await control.click(); };
  try {
    await page.goto('http://127.0.0.1:5173/settings');
    for (const selector of ['.settings-language', '.settings-appearance']) {
      const root = page.locator(selector), trigger = root.locator('.setting-trigger').first(), menu = root.locator('.setting-menu');
      const value = await trigger.getAttribute('data-value');
      for (let index = 0; index < 3; index++) {
        await activate(trigger);
        await expect(trigger).toHaveAttribute('aria-expanded', 'true');
        await expect(menu.getByRole('option', { selected: true })).toBeFocused();
        await activate(trigger);
        await expect(trigger).toHaveAttribute('aria-expanded', 'false');
        await expect(menu).toHaveCount(0);
        await expect(trigger).toBeFocused();
        await expect(trigger).toHaveAttribute('data-value', value!);
      }
      await trigger.press('Enter');
      await expect(menu).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(menu).toHaveCount(0);
      await expect(trigger).toBeFocused();
    }
    const language = page.locator('.settings-language .setting-trigger'), appearance = page.locator('.settings-appearance .setting-trigger').first();
    await activate(language); await activate(appearance);
    await expect(language).toHaveAttribute('aria-expanded', 'false');
    await expect(appearance).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await page.goto('http://127.0.0.1:5173/today');
    await page.locator('.reading-task [data-practice-skill=reading]').first().click();
    const dialog = page.locator('.practice-options-dialog[open]'), field = dialog.locator('.setting-trigger').first();
    await activate(field); await expect(field).toHaveAttribute('aria-expanded', 'true');
    await activate(field); await expect(field).toHaveAttribute('aria-expanded', 'false');
    await expect(dialog.locator('.setting-menu')).toHaveCount(0); await expect(field).toBeFocused();
    await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
  } finally { await context.close(); await alternate?.close(); }
});
