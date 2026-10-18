import { expect, test } from '@playwright/test';
import { selectPicker } from './picker';
import { copy } from '../../src/app/i18n';
import { aboutCopy as t } from '../../src/app/aboutCopy';
import { localeSchema } from '../../src/shared/locale';
import quotes from '../../content/daily-quotes.json' with { type: 'json' };
import credits from '../../content/about-credits.json' with { type: 'json' };

test('every display language opens the same English About page with local artwork and labelled contact links', async ({ page, context }) => {
  const external: string[] = [];
  context.on('request', request => { if (/^https:\/\/(rinuan\.org|github\.com)\//.test(request.url())) external.push(request.url()); });
  await page.setViewportSize({ width: 320, height: 640 });
  let englishText: string | undefined;
  for (const locale of localeSchema.options) {
    const heading = copy[locale].about;
    await page.goto('/settings');
    await selectPicker(page, (await page.locator('.settings-preferences .setting-trigger').first().getAttribute('aria-label'))!, locale);
    await page.getByRole('link', { name: heading, exact: true }).click();
    await expect(page.getByRole('heading', { name: 'About', exact: true })).toBeVisible();
    await expect(page.locator('.about-page')).toHaveAttribute('lang', 'en');
    await expect(page.locator('.about-page')).toHaveAttribute('dir', 'ltr');
    expect(await page.locator('.about-page').evaluate(el => getComputedStyle(el).direction)).toBe('ltr');
    await expect(page.locator('.about-back')).toHaveText('← Settings');
    const text = await page.locator('.about-page').innerText();
    englishText ??= text;
    expect(text).toBe(englishText);
    await expect(page.getByRole('img', { name: 'Lingfern' }).last()).toBeVisible();
    const logo = page.locator('.about-logo .brand-symbol');
    await expect(logo).toBeVisible();
    expect(await logo.evaluate(el => {
      const rect = el.getBoundingClientRect(), css = getComputedStyle(el);
      return rect.width >= 200 && rect.width === rect.height && css.maskImage.includes('/icon.svg');
    })).toBe(true);
    await expect(page.locator('.about-signature,.about-signature-block')).toHaveCount(0);
    await expect(page.locator('.about-projects a')).toHaveCount(credits.software.length);
    await expect(page.locator('.about-credit-details summary')).toHaveText([`${t.buildTools} (11)`, `${t.corpora} (${credits.corpora.length})`, `${t.quotes} (${quotes.quotes.length})`, `${t.originalRecordings} (29)`, `${t.ipaWords} (39)`, `${t.ipaSounds} (125)`]);
    const dailyCredits = page.locator('.about-credit-details').filter({ has: page.getByText(`${t.quotes} (${quotes.quotes.length})`, { exact: true }) });
    await dailyCredits.locator('summary').click();
    await expect(dailyCredits.locator('li')).toHaveCount(1);
    await expect(dailyCredits.locator('li a')).toHaveAttribute('href', 'https://en.wikiquote.org/');
    await expect(dailyCredits.getByRole('link', { name: `${t.reuseNotes} ↗` })).toHaveAttribute('href', '/daily-quotes/README.md');
    await dailyCredits.locator('summary').click();
    await expect(page.locator('.mobile-nav a[href="/settings"]')).toHaveAttribute('aria-current', 'page');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.goto('/settings');
  await selectPicker(page, (await page.locator('.settings-language .setting-trigger').getAttribute('aria-label'))!, 'en');
  await page.getByRole('link', { name: 'About', exact: true }).click();
  await expect(page.locator('.about-links a[href="https://rinuan.org/"]')).toBeVisible();
  await expect(page.locator('.about-links a[href="mailto:euan@rinuan.org"]')).toBeVisible();
  await expect(page.locator('.about-links a[href="https://github.com/euanylin"]')).toBeVisible();
  await expect(page.locator('.about-link-label')).toHaveText(['Blog', 'Email', 'GitHub']);
  for (const icon of ['book', 'mail', 'github']) {
    await expect(page.locator(`.about-${icon}-icon`)).toBeVisible();
    expect(await page.locator(`.about-${icon}-icon`).evaluate((el, name) => {
      const style = getComputedStyle(el);
      return style.maskImage.includes(name) && style.backgroundColor === getComputedStyle(document.querySelector('.about-link-arrow')!).color;
    }, icon)).toBe(true);
  }
  await expect(page.locator('.about-blogger-icon')).toHaveCount(0);
  await expect(page.locator('.about-credits a[href="/THIRD_PARTY_NOTICES.md"]')).toBeVisible();
  const sources = page.locator('.about-credit-details').filter({ has: page.getByText(`${t.corpora} (${credits.corpora.length})`, { exact: true }) });
  await sources.locator('summary').click();
  await expect(sources.locator('li a')).toHaveText(credits.corpora.map(source => `${source.name} ↗`));
  await sources.locator('summary').click();
  await page.getByText('IPA sound recordings (125)' ).click();
  await expect(page.locator('.about-credit-details[open] li')).toHaveCount(125);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  expect(await page.evaluate(() => document.querySelector('.about-links')!.getBoundingClientRect().bottom <= document.querySelector('.mobile-nav')!.getBoundingClientRect().top)).toBe(true);
  expect(external).toHaveLength(0);
  await page.goto('/settings');
  await expect(page.getByRole('link', { name: /Audio sources|音频来源|音訊來源/ })).toHaveCount(0);
});

for (const locale of ['zh-Hans', 'en', 'ar'] as const) test(`${locale} keeps About English in desktop, narrow, dark and keyboard layouts`, async ({ page }) => {
  await page.goto('/settings');
  await selectPicker(page, (await page.locator('.settings-language .setting-trigger').getAttribute('aria-label'))!, locale);
  for (const [width, theme] of [[1440, 'light'], [375, 'dark'], [320, 'light']] as const) {
    await page.goto('/settings');
    await page.setViewportSize({ width, height: 812 });
    await selectPicker(page, copy[locale].theme, theme);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('link', { name: copy[locale].about, exact: true }).click();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('.about-page')).toHaveAttribute('lang', 'en');
    await expect(page.locator('.about-page')).toHaveCSS('direction', 'ltr');
    const logo = page.locator('.about-logo .brand-symbol');
    await expect(logo).toBeVisible();
    expect(await logo.evaluate(el => {
      const css = getComputedStyle(el);
      return css.maskImage.includes('/icon.svg') && css.backgroundColor !== 'rgba(0, 0, 0, 0)';
    })).toBe(true);
    await expect(page.locator('.about-signature')).toHaveCount(0);
    await expect(page.locator('.about-copyright')).toHaveText('© Euan Lin');
    await expect(page.locator('.about-logo')).toHaveCSS('border-bottom-width', '0px');
    await expect(page.locator('.about-credits')).toHaveCSS('border-top-width', '1px');
    await expect(page.getByRole('heading', { name: 'About', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const back = page.locator('.about-back');
    const bounds = await back.boundingBox();
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
    await back.focus();
    await expect(back).toBeFocused();
    await back.press('Enter');
    await expect(page.getByRole('heading', { name: copy[locale].settings, exact: true })).toBeVisible();
  }
});
