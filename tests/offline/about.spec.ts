import { expect, test } from '@playwright/test';
import { languagePacks } from '../../src/locales';
import { localeSchema } from '../../src/shared/locale';
import { selectPicker } from '../browser/picker';

test('About stays English across every installed language and offline reload', async ({ page, context }) => {
  await page.goto('/settings');
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  for (const [path, expected] of [['/licenses/octicons/LICENSE', 'MIT License'], ['/dictionary/oewn-2025/WNDB_License.txt', 'WordNet'], ['/ipa/CC-BY-SA-4.0.txt', 'Creative Commons'], ['/licenses/lingfern/LICENSE', 'Apache License'], ['/licenses/lingfern/CC-BY-4.0.txt', 'Attribution 4.0 International'], ['/licenses/lingfern/NOTICE', 'Lingfern contributors'], ['/licenses/lingfern/BRAND.md', 'Artwork has separate terms']] as const) {
    const result = await page.evaluate(async path => { const response = await fetch(path); return { status: response.status, text: await response.text() }; }, path);
    expect(result.status).toBe(200); expect(result.text).toContain(expected);
  }
  let englishText: string | undefined;
  for (const locale of localeSchema.options) {
    await page.goto('/settings');
    await selectPicker(page, (await page.locator('.settings-language .setting-trigger').getAttribute('aria-label'))!, locale);
    await page.getByRole('link', { name: languagePacks[locale].app.about, exact: true }).click();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('.about-page')).toHaveAttribute('lang', 'en');
    await expect(page.locator('.about-page')).toHaveCSS('direction', 'ltr');
    await expect(page.getByRole('heading', { name: 'About', exact: true })).toBeVisible();
    const text = await page.locator('.about-page').innerText();
    englishText ??= text;
    expect(text).toBe(englishText);
    expect(await page.locator('.about-logo .brand-symbol').evaluate(el => getComputedStyle(el).maskImage.includes('/icon.svg'))).toBe(true);
    expect(await page.evaluate(async () => {
      const image = new Image(); image.src = '/icon.svg'; await image.decode();
      return image.naturalWidth > 0 && image.naturalWidth === image.naturalHeight;
    })).toBe(true);
    await expect(page.locator('.about-signature')).toHaveCount(0);
    const notices = await page.evaluate(async () => { const response = await fetch('/THIRD_PARTY_NOTICES.md'); return { status: response.status, text: await response.text() }; });
    expect(notices.status).toBe(200);
    expect(notices.text).toContain('LibriSpeech / LibriVox readers');
    await page.locator('.about-back').click();
    await expect(page.getByRole('heading', { name: languagePacks[locale].app.settings, exact: true })).toBeVisible();
  }
});
