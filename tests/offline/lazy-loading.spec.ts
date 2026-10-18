import { expect, test } from '@playwright/test';
import { languagePacks } from '../../src/locales';
import { selectPicker } from '../browser/picker';

test('previously unvisited quote chunks, teaching locales and generation work after shell installation offline', async ({ page, context }) => {
  await page.goto('/today');
  await expect(page.locator('.daily-quote[data-quote-id] blockquote')).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect(page.locator('.daily-quote[data-quote-id] blockquote')).toBeVisible();
  await context.setOffline(true);
  for (let i = 0; i < 6; i++) {
    const previous = await page.locator('.daily-quote').getAttribute('data-quote-id');
    await page.locator('.daily-quote-next').click();
    await expect(page.locator('.daily-quote')).not.toHaveAttribute('data-quote-id', previous!);
  }
  for (const locale of ['ar', 'ja', 'fr', 'zh-Hant', 'en'] as const) {
    await page.goto('/settings');
    await selectPicker(page, (await page.locator('.settings-language .setting-trigger').getAttribute('aria-label'))!, locale);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await page.goto('/today');
    await expect(page.getByRole('heading', { name: languagePacks[locale].app.today, exact: true })).toBeVisible();
    await expect(page.locator('.daily-quote[data-quote-id] blockquote')).toBeVisible();
    await expect(page.locator('.daily-quote blockquote')).toHaveCSS('direction', 'ltr');
  }
  // The existing full offline suite separately exercises actual installed Reading/Listening saves.
  const requests: string[] = [];
  page.on('requestfailed', request => requests.push(request.url()));
  await page.goto('/library');
  await expect(page.getByRole('heading', { name: languagePacks.en.app.library, exact: true })).toBeVisible();
  expect(requests.filter(url => /\/assets\//.test(url))).toEqual([]);
});
