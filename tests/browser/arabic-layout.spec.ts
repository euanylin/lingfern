import { expect, test, type Locator } from '@playwright/test';
import { languagePacks } from '../../src/locales';
import { confirmTask } from './task-start';

test.use({ locale: 'ar-EG', reducedMotion: 'reduce' });

async function leftOf(first: Locator, second: Locator) {
  await expect(first).toBeVisible();
  await expect(second).toBeVisible();
  expect((await first.boundingBox())!.x).toBeLessThan((await second.boundingBox())!.x);
}

for (const width of [1440, 390]) test(`Arabic copy keeps its direction inside fixed page layouts at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 });
  const desktop = width >= 768;
  const ar = languagePacks.ar.app;
  await page.goto('/today');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const nav = page.locator(desktop ? '#root>header .desktop-nav' : '#root>.mobile-nav');
  const today = nav.getByRole('link', { name: ar.today, exact: true });
  const library = nav.getByRole('link', { name: ar.library, exact: true });
  const settings = nav.getByRole('link', { name: ar.settings, exact: true });
  if (desktop) {
    await leftOf(page.locator('header .home-mark'), today);
    await leftOf(page.locator('.practice-section'), page.locator('.today-hero'));
  }
  await leftOf(today, library);
  await leftOf(library, settings);
  await expect(today.locator('.nav-label')).toHaveCSS('direction', 'rtl');
  await expect(today).toHaveAttribute('aria-current', 'page');
  await page.screenshot({ path: info.outputPath('today.png') });

  await library.click();
  await expect(library).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.library-page')).toHaveCSS('direction', 'rtl');
  await settings.click();
  const palette = page.locator('.settings-appearance .setting-trigger').nth(1);
  await palette.press('Enter');
  await expect(page.getByRole('listbox')).toHaveCSS('direction', 'rtl');
  await page.keyboard.press('Escape');
  await expect(palette).toBeFocused();
  const aboutArrow = page.locator('.settings-about-link > span[aria-hidden]');
  await expect(aboutArrow).toHaveCSS('transform', 'matrix(-1, 0, 0, 1, 0, 0)');
  await page.screenshot({ path: info.outputPath('settings.png') });

  await page.goto('/library/trees');
  await expect(page.locator('.tree-page h1')).toHaveCSS('direction', 'rtl');
  await expect(page.locator('#tree-source')).toHaveCSS('direction', 'ltr');
  await expect(page.locator('.tree-scroll')).toHaveCSS('direction', 'ltr');
  const zoom = page.locator('.tree-zoom button');
  await leftOf(zoom.first(), zoom.last());
  await page.screenshot({ path: info.outputPath('syntax-tree.png') });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
});

test('Arabic introduction matches the fixed navigation and ArrowRight opens the next card', async ({ page }, info) => {
  await page.goto('/introduction');
  const dots = page.locator('.welcome-dots button');
  await leftOf(dots.first(), dots.last());
  await dots.first().focus();
  await page.keyboard.press('ArrowRight');
  await expect(dots.nth(1)).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('.welcome-caption-slide[aria-hidden=false] h1')).toHaveText(languagePacks.ar.app.library);
  await page.screenshot({ path: info.outputPath('introduction.png') });
});

test('Arabic study keeps the article left and questions right at desktop width', async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/today');
  await page.locator('.task-row').filter({ has: page.getByRole('heading', { name: 'Preserve disagreement and responsibility', exact: true }) }).getByRole('button').click();
  await confirmTask(page);
  await leftOf(page.locator('.workspace-material'), page.locator('.workspace-questions'));
  await expect(page.locator('.workspace-questions')).toHaveCSS('direction', 'rtl');
  await expect(page.locator('.passage').first()).toHaveCSS('direction', 'ltr');
  await expect(page.locator('.workspace-question h2').first()).toHaveCSS('direction', 'ltr');
  await expect(page.locator('#workspace-question-nav')).toHaveCSS('direction', 'ltr');
  await page.screenshot({ path: info.outputPath('study.png') });
});
