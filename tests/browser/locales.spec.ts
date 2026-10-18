import { expect, test } from '@playwright/test';
import { copy } from '../../src/app/i18n';
import { languagePacks, languageOptions } from '../../src/locales';
import { localeSchema } from '../../src/shared/locale';
import { selectPicker } from './picker';
import { confirmTask } from './task-start';

test('Settings and First Run share English alphabetical language order in every display direction', async ({ page }) => {
  const ordered = ['ar', 'zh-Hans', 'zh-Hant', 'en', 'fr', 'de', 'hi', 'id', 'it', 'ja', 'ko', 'pt', 'ru', 'es'];
  for (const locale of ['en', 'ar', 'zh-Hans'] as const) {
    await page.setViewportSize({ width: locale === 'en' ? 1440 : 375, height: 812 });
    await page.goto('/settings');
    await selectPicker(page, (await page.locator('.settings-language .setting-trigger').getAttribute('aria-label'))!, locale);
    await selectPicker(page, languagePacks[locale].app.theme, locale === 'ar' ? 'dark' : 'light');
    for (const route of ['/settings', '/start']) {
      await page.goto(route);
      const trigger = page.locator(route === '/settings' ? '.settings-language .setting-trigger' : '.first-run .setting-trigger');
      await trigger.click();
      const options = page.getByRole('listbox').getByRole('option');
      expect(await options.evaluateAll(items => items.map(item => item.getAttribute('data-value')))).toEqual(ordered);
      await expect(options).toHaveText(ordered.map(value => languageOptions.find(option => option.value === value)!.label));
      await expect(page.getByRole('option').and(page.locator(`[data-value="${locale}"]`))).toHaveAttribute('aria-selected', 'true');
      await page.keyboard.press('Home'); await expect(options.first()).toBeFocused();
      await page.keyboard.press('End'); await expect(options.last()).toBeFocused();
      await page.screenshot({ path: `output/playwright/language-order-${locale}-${route.slice(1)}.png` });
      await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
    }
  }
});

for (const locale of localeSchema.options) {
  test(`${locale} package persists and fits the main pages in desktop and narrow layouts`, async ({ page }) => {
    await page.goto('/settings');
    const language = page.locator('.settings-language .setting-trigger');
    await selectPicker(page, (await language.getAttribute('aria-label'))!, locale);
    const t = copy[locale];
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
    await page.reload();
    await expect(language).toHaveAttribute('data-value', locale);
    for (const [width, theme] of [[1440, 'light'], [375, 'dark'], [320, 'light']] as const) {
      await page.setViewportSize({ width, height: 812 });
      await selectPicker(page, t.theme, theme);
      for (const trigger of await page.locator('.setting-trigger').all()) {
        const bounds = await trigger.boundingBox();
        expect(bounds!.width).toBeGreaterThanOrEqual(44);
        expect(bounds!.height).toBeGreaterThanOrEqual(44);
      }
      if (locale === 'ar') {
        await expect(language.locator('.setting-chevron')).toHaveCSS('direction', 'ltr');
        expect(await language.locator('.setting-chevron').evaluate(element => new DOMMatrix(getComputedStyle(element).transform).a)).toBe(-1);
      }
      await language.click();
      const options = page.getByRole('listbox', { name: t.language });
      await expect(options.getByRole('option')).toHaveText(languageOptions.map(item => item.label));
      await expect(options.getByRole('option', { name: languagePacks[locale].meta.nativeName, exact: true })).toHaveAttribute('aria-selected', 'true');
      for (const option of languageOptions) await expect(options.locator(`[data-value="${option.value}"] bdi`)).toHaveAttribute('lang', option.value);
      await page.keyboard.press('Escape');
      for (const [path, heading] of [['/today', t.today], ['/library', t.library], ['/progress', t.progress], ['/settings', t.settings]] as const) {
        await page.goto(path);
        await expect(page.getByRole('heading', { name: heading, exact: true }).first()).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
      const link = await page.locator('.settings-start-link').evaluate(element => {
        const label = element.firstElementChild!.getBoundingClientRect(), arrow = element.lastElementChild!.getBoundingClientRect();
        return { labelRight: label.right, labelLeft: label.left, arrowRight: arrow.right, arrowLeft: arrow.left, arrowTop: arrow.top, labelBottom: label.bottom };
      });
      if (locale === 'ar') expect(link.arrowRight).toBeLessThanOrEqual(link.labelLeft);
      else expect(link.arrowLeft).toBeGreaterThanOrEqual(link.labelRight);
      expect(link.arrowTop).toBeLessThan(link.labelBottom);
      await page.screenshot({ path: `output/playwright/locale-${locale}-${width}-${theme}-settings.png` });
    }
  });
}

for (const locale of ['ja', 'ko', 'fr', 'es', 'de', 'pt', 'it', 'ru', 'ar', 'hi', 'id'] as const) {
  test(`${locale} keeps English sources and advanced instruction while localizing actions`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/settings');
    await selectPicker(page, (await page.locator('.settings-language .setting-trigger').getAttribute('aria-label'))!, locale);
    const t = copy[locale];
    await page.goto('/today');
    const row = page.locator('.task-row').filter({ has: page.getByRole('heading', { name: 'Preserve disagreement and responsibility', exact: true }) });
    await row.getByRole('button').click();
    const detail = page.locator('.task-detail');
    await expect(detail.locator('p[lang=en]').filter({ hasText: 'Synthesize two writers' })).toBeVisible();
    await expect(detail.locator('[data-mode=practice]')).toHaveText(t.start);
    await confirmTask(page);
    await expect(page.locator('.learning-grid > article > .eyebrow')).toHaveText(copy.en.goal);
    await expect(page.locator('.learning-grid > article > .lead')).toHaveAttribute('lang', 'en');
    await expect(page.locator('.passage').first()).toHaveAttribute('lang', 'en');
    await expect(page.locator('.passage').first()).toHaveCSS('direction', 'ltr');
    await expect(page.locator('.session-meta')).toHaveCount(0);
    await expect(page.locator('.learning-grid > article > .lead')).toHaveCSS('direction', 'ltr');
    await expect(page.locator('.question-sheet-toggle')).toContainText(t.question);
    await page.locator('.question-sheet-toggle').click();
    await expect(page.locator('.question-number bdi')).toHaveText('1 / 4');
    await expect(page.locator('.question-number bdi')).toHaveCSS('direction', 'ltr');
    await page.getByRole('radio').first().check();
    await page.getByRole('button', { name: t.submit, exact: true }).click();
    await expect(page.getByText(t.saved, { exact: true })).toBeVisible();
    await page.reload();
    await page.locator('.question-sheet-toggle').click();
    await expect(page.locator('.feedback')).toBeVisible();
    await expect(page.locator('.feedback p[lang=en]').first()).toBeVisible();
    await page.screenshot({ path: `output/playwright/locale-${locale}-375-saved-english-instruction.png` });
  });
}

for (const locale of ['ja', 'ko', 'fr', 'es', 'de', 'pt', 'it', 'ru', 'ar', 'hi', 'id'] as const) test(`${locale} regional browser preference starts First Run and saves without falling back`, async ({ browser }) => {
  const context = await browser.newContext({ locale: { ja: 'ja-JP', ko: 'ko-KR', fr: 'fr-CA', es: 'es-MX', de: 'de-AT', pt: 'pt-BR', it: 'it-IT', ru: 'ru-RU', ar: 'ar-EG', hi: 'hi-IN', id: 'id-ID' }[locale], viewport: { width: 375, height: 812 } });
  try {
    const page = await context.newPage(), t = languagePacks[locale].firstRun_firstRunCopy;
    await page.goto('/start');
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
    await expect(page.getByRole('heading', { name: t.headings[0], exact: true })).toBeVisible();
    await page.getByRole('button', { name: t.next, exact: true }).click();
    await expect(page.getByRole('heading', { name: t.headings[1], exact: true })).toBeVisible();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
    await expect(page.getByRole('heading', { name: t.headings[1], exact: true })).toBeVisible();
    await page.getByRole('button', { name: t.next, exact: true }).click();
    const history = page.getByRole('checkbox', { name: t.themes[8], exact: true });
    await history.check();
    await expect(history).toBeChecked();
    await page.getByRole('button', { name: t.next, exact: true }).click();
    await expect(page.getByRole('heading', { name: t.headings[3], exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: t.headings[3], exact: true })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
  } finally { await context.close(); }
});

test('switching away from Arabic resets and persists left-to-right direction', async ({ page }) => {
  await page.goto('/settings');
  await selectPicker(page, copy['zh-Hans'].language, 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await selectPicker(page, copy.ar.language, 'de');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
});
