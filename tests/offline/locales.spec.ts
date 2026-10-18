import { expect, test } from '@playwright/test';
import { copy } from '../../src/app/i18n';
import { selectPicker } from '../browser/picker';

for (const locale of ['ja', 'ko', 'fr', 'es', 'de', 'pt', 'it', 'ru', 'ar', 'hi', 'id'] as const) test(`${locale} package and saved choice reopen offline without a language download`, async ({ page, context }) => {
  await page.goto('/settings');
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await selectPicker(page, (await page.locator('.settings-language .setting-trigger').getAttribute('aria-label'))!, locale);
  const t = copy[locale];
  await page.goto('/today');
  await expect(page.getByRole('heading', { name: t.today, exact: true })).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', locale);
  await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
  await expect(page.getByRole('heading', { name: t.today, exact: true })).toBeVisible();
  await page.goto('/settings');
  await expect(page.locator('.settings-language .setting-trigger')).toHaveAttribute('data-value', locale);
  await expect(page.getByRole('heading', { name: t.settings, exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
