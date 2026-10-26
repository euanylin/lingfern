import { expect, test, type Locator, type Page } from '@playwright/test';
import { languagePacks } from '../../src/locales';
import { selectPicker } from './picker';
import { confirmTask } from './task-start';
import { currentSnapshot, fillQuestion, focusQuestion } from './workspace';

async function expectFrozenBackground(page: Page, dialog: Locator, position: number) {
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate(element => {
    const style = getComputedStyle(element, '::backdrop');
    return style.backdropFilter || style.getPropertyValue('-webkit-backdrop-filter');
  })).toBe('blur(3px)');
  await expect(page.locator('html')).toHaveCSS('overflow-y', 'hidden');
  expect(await page.evaluate(() => scrollY)).toBe(position);
  await page.mouse.move(2, 2);
  if (!(test.info().project.use.isMobile && page.context().browser()?.browserType().name() === 'webkit')) await page.mouse.wheel(0, 600);
  await page.keyboard.press('PageDown');
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => scrollY)).toBe(position);
}

for (const [locale, width, colorScheme] of [['zh-Hans', 375, 'dark'], ['en', 1440, 'light'], ['ar', 320, 'dark']] as const) {
  test(`backup and deletion freeze their background without moving the page: ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    await page.emulateMedia({ colorScheme });
    await page.goto('/settings');
    if (locale !== 'zh-Hans') await selectPicker(page, '语言', locale);
    const t = languagePacks[locale].profileBackup;
    for (const [label, selector] of [[t.export, '.backup-export-dialog'], [t.delete, '.profile-delete-dialog']]) {
      const trigger = page.locator('.profile-backup').getByRole('button', { name: label, exact: true });
      await trigger.scrollIntoViewIfNeeded();
      // Mobile WebKit can leave a short overscroll after automatic positioning.
      await page.evaluate(() => scrollTo(0, Math.min(scrollY, Math.max(0, document.documentElement.scrollHeight - innerHeight))));
      const before = await page.evaluate(() => ({ scroll: scrollY, left: document.querySelector('.profile-backup')!.getBoundingClientRect().left, height: document.documentElement.scrollHeight, bodyHeight: document.body.scrollHeight, viewport: innerHeight }));
      await trigger.click();
      const dialog = page.locator(selector);
      await test.info().attach('page-lock-geometry', { body: JSON.stringify({ before, after: await page.evaluate(() => ({ scroll: scrollY, height: document.documentElement.scrollHeight, bodyHeight: document.body.scrollHeight, viewport: innerHeight, visual: visualViewport?.height })) }), contentType: 'application/json' });
      await expectFrozenBackground(page, dialog, before.scroll);
      expect(await page.locator('.profile-backup').evaluate(element => element.getBoundingClientRect().left)).toBe(before.left);
      await page.screenshot({ path: test.info().outputPath(`${selector.slice(1)}-${locale}-${width}-${colorScheme}.png`) });
      await dialog.getByRole('button', { name: t.cancel, exact: true }).click();
      await expect(dialog).toHaveCount(0);
      await expect(page.locator('html')).not.toHaveCSS('overflow-y', 'hidden');
      expect(await page.evaluate(() => scrollY)).toBe(before.scroll);
    }
    const before = await page.evaluate(() => scrollY);
    await page.keyboard.press(before > 0 ? 'PageUp' : 'PageDown');
    await expect.poll(() => page.evaluate(() => scrollY)).not.toBe(before);
    expect(await page.pageErrors()).toEqual([]);
  });

  test(`restart confirmation blurs and freezes the background: ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    await page.emulateMedia({ colorScheme });
    await page.goto('/settings');
    if (locale !== 'zh-Hans') await selectPicker(page, '语言', locale);
    await page.goto('/today');
    await page.locator('.primary-task.reading-task .practice-card-action').click();
    await confirmTask(page);
    const lesson = await currentSnapshot(page);
    await fillQuestion(await focusQuestion(page, lesson, 0), lesson.materials[0].questions[0]);
    await page.locator('.session-header>a').click();
    const trigger = page.locator('.primary-task.reading-task .practice-card-restart');
    await expect(trigger).toBeVisible();
    await trigger.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => scrollY);
    await trigger.click();
    const dialog = page.locator('.practice-restart-dialog');
    await expectFrozenBackground(page, dialog, before);
    await page.screenshot({ path: test.info().outputPath(`restart-${locale}-${width}-${colorScheme}.png`) });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => scrollY)).toBe(before);
  });
}

test.describe('native touch scrolling', () => {
  test.use({ hasTouch: true, viewport: { width: 375, height: 812 } });
  test('a touch swipe on the backdrop cannot scroll the page', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'Native gesture injection uses Chromium CDP.');
    await page.goto('/settings');
    await page.locator('.backup-download').click();
    const before = await page.evaluate(() => scrollY);
    const cdp = await context.newCDPSession(page);
    const swipe = async () => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 150, y: 580 }] });
      for (let step = 1; step <= 8; step++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 150, y: 580 + step * 24 }] });
        await page.waitForTimeout(20);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    await swipe();
    expect(await page.evaluate(() => scrollY)).toBe(before);
    await page.keyboard.press('Escape');
    await expect(page.locator('.backup-export-dialog')).toHaveCount(0);
    await expect(page.locator('html')).not.toHaveCSS('overflow-y', 'hidden');
    await swipe();
    await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(before);
    await cdp.detach();
  });
});

test('offline removal uses the same blurred, frozen confirmation surface', async ({ page }) => {
  const t = languagePacks['zh-Hans'].offlineInstall;
  await page.goto('http://127.0.0.1:8787/library');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  const category = page.locator('.offline-category').filter({ has: page.getByRole('heading', { name: t.categories.listening, exact: true }) });
  await category.getByRole('button', { name: /通用材料/ }).click();
  const checkbox = page.getByRole('checkbox', { name: t.names['audio-a1'], exact: true });
  await checkbox.check();
  await page.getByRole('button', { name: t.start, exact: true }).click();
  await expect(checkbox.locator('..').locator('.package-status')).toHaveText(t.ready);
  await checkbox.check();
  const remove = page.getByRole('button', { name: t.remove, exact: true });
  await expect(remove).toBeEnabled();
  await remove.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => scrollY);
  await remove.click();
  const dialog = page.locator('dialog[aria-labelledby=offline-remove-title]');
  await expectFrozenBackground(page, dialog, before);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(remove).toBeFocused();
});

for (const locale of ['en', 'ar'] as const) test(`a reserved scrollbar does not move the page or shrink a full-width drawer: ${locale}`, async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/settings');
  await selectPicker(page, '语言', locale);
  await page.goto('/today');
  const trigger = page.locator('[data-practice-skill=reading]').first();
  await expect(trigger).toBeVisible();
  await page.evaluate(() => { document.documentElement.style.scrollbarGutter = 'stable'; });
  const before = await page.evaluate(() => ({ gutter: innerWidth - document.documentElement.clientWidth, left: document.querySelector('main')!.getBoundingClientRect().left }));
  test.skip(!before.gutter, 'This engine provides overlay scrollbars without a reserved gutter.');
  await trigger.click();
  const dialog = page.locator('.practice-options-dialog');
  await expect(dialog).toHaveCSS('opacity', '1');
  await expect.poll(() => dialog.evaluate(element => element.getAnimations().every(animation => animation.playState !== 'running'))).toBe(true);
  const box = (await dialog.boundingBox())!;
  expect(box.x).toBe(0); expect(box.width).toBe(375);
  expect(await page.locator('main').evaluate(element => element.getBoundingClientRect().left)).toBe(before.left);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});
