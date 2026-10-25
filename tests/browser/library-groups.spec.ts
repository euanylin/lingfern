import { expect, test } from '@playwright/test';
import { languagePacks } from '../../src/locales';
import { selectPicker } from './picker';

for (const locale of ['zh-Hans', 'zh-Hant', 'en', 'ar'] as const) test(`general reading and listening packages share category controls (${locale})`, async ({ page, context }) => {
  const pack = languagePacks[locale], t = pack.offlineInstall, ui = pack.offlineInstall_libraryLabels;
  await page.goto('/settings');
  await selectPicker(page, (await page.locator('.settings-language .setting-trigger').getAttribute('aria-label'))!, locale);
  await page.goto('/library');
  for (const [width, theme] of [[1440, 'light'], [320, 'dark']] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    for (const [skill, names] of [['reading', ['corpus', 'corpus-open-reading']], ['listening', ['audio-beginner', 'audio-a1', 'audio-a2', 'audio-b1', 'audio-b2', 'audio-c1', 'audio-c2']]] as const) {
      const category = page.locator('.offline-category').filter({ has: page.getByRole('heading', { name: t.categories[skill], exact: true }) });
      const group = category.getByRole('group', { name: ui.general, exact: true });
      const toggle = group.getByRole('button');
      await expect(group.locator('.package-title')).toHaveText(names.map(id => t.names[id]));
      await expect(group.locator('.package-row')).toHaveCount(names.length);
      const check = page.getByRole('checkbox', { name: `${t.categories[skill]} · ${ui.general}`, exact: true });
      await check.check();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await expect(group.locator('.package-row input:checked')).toHaveCount(names.length);
      await group.locator('.package-row input').first().uncheck();
      await expect(check).toHaveAttribute('aria-checked', 'mixed');
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await expect(group.locator('.package-row input:checked')).toHaveCount(names.length - 1);
      await toggle.focus(); await page.keyboard.press('Enter');
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await check.check();
      await check.uncheck();
      expect((await toggle.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    const rows = await page.locator('.package-row input').evaluateAll(inputs => inputs.map(input => input.getAttribute('aria-label')));
    expect(new Set(rows).size).toBe(rows.length);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `output/playwright/library-groups-${locale}-${width}-${theme}.png`, fullPage: true });
  }
  const search = page.getByRole('searchbox', { name: ui.search });
  await search.fill(t.names['audio-a1']);
  await expect(page.locator('.package-row')).toHaveCount(1);
  await page.getByRole('checkbox', { name: `${t.categories.listening} · ${ui.general}`, exact: true }).check();
  await search.fill('no-library-resource-47201');
  await expect(page.locator('.offline-package-heading')).toContainText(t.selectedCount.replace('{count}', '1'));
  await expect(page.locator('.offline-select-all')).toHaveCount(0);
  await search.fill('');
  await expect(page.locator('.offline-select-all')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: t.names['audio-a1'], exact: true })).toBeChecked();
  await context.setOffline(true);
  await expect(page.getByRole('button', { name: t.start, exact: true })).toBeDisabled();
});
