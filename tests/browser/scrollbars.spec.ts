import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { selectPicker } from './picker';

test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });
const transparent = 'rgba(0, 0, 0, 0) rgba(0, 0, 0, 0)';

for (const width of [375, 1440]) test(`document thumbs follow actual scrolling without changing width at ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 812 }); await page.goto('/settings');
  const root = page.locator('html');
  await expect(root).toHaveAttribute('data-scrollbar-y', 'true');
  const geometry = () => page.evaluate(() => ({ viewport: document.documentElement.clientWidth, body: document.body.getBoundingClientRect().width, content: document.querySelector('main')!.getBoundingClientRect().width }));
  const before = await geometry();
  const color = () => root.evaluate(element => getComputedStyle(element).scrollbarColor);
  const eligibleColor = await color(); expect(eligibleColor).not.toBe(transparent);
  await expect(root).toHaveCSS('scrollbar-width', 'auto');
  await page.screenshot({ path: info.outputPath('root-idle.png') });
  await page.mouse.move(width / 2, 400); await page.mouse.wheel(0, 260);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
  expect(await color()).toBe(eligibleColor); expect(await geometry()).toEqual(before);
  await page.screenshot({ path: info.outputPath('root-scrolling.png') });
  await page.mouse.move(width - 2, 200); await page.mouse.down();
  try {
    // Holding a native control must not let a page timer change its eligible colour.
    await page.waitForTimeout(1000);
    expect(await color()).toBe(eligibleColor); expect(await geometry()).toEqual(before);
    await page.screenshot({ path: info.outputPath('root-pointer-held.png') });
  } finally { await page.mouse.up(); }
  expect(await page.pageErrors()).toEqual([]);
});

test('forced colours retain system-native document scrollbar styling', async ({ page }) => {
  await page.goto('/settings');
  const root = page.locator('html'); await expect(root).toHaveAttribute('data-scrollbar-y', 'true');
  await page.emulateMedia({ forcedColors: 'active' });
  await expect(root).toHaveCSS('scrollbar-color', 'auto');
  await expect(root).toHaveCSS('scrollbar-width', 'auto');
});

for (const [locale, theme] of [['zh-Hans','light'],['en','dark'],['ar','dark']] as const) test(`native scrollbar styling preserves menu scrolling and keyboard selection in ${locale}/${theme}`, async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 }); await page.goto('/settings');
  await selectPicker(page, (await page.locator('.settings-language .setting-trigger').getAttribute('aria-label'))!, locale);
  await selectPicker(page, (await page.locator('.settings-appearance .setting-trigger').first().getAttribute('aria-label'))!, theme);
  const trigger = page.locator('.settings-language .setting-trigger'); await trigger.click();
  const menu = page.getByRole('listbox'); await expect(menu).toBeVisible();
  expect(await menu.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
  await expect(menu).toHaveAttribute('data-scrollbar-y','true');
  const styles = await menu.evaluate(el => ({ width: getComputedStyle(el).scrollbarWidth, color: getComputedStyle(el).scrollbarColor }));
  expect(styles.width).toBe('thin'); expect(styles.color).not.toBe(transparent);
  const menuWidth = await menu.evaluate(el => el.clientWidth);
  await menu.hover(); await menu.evaluate(el => el.scrollTop = el.scrollTop > 0 ? 0 : el.scrollHeight);
  expect(await menu.evaluate(el => getComputedStyle(el).scrollbarColor)).toBe(styles.color);
  expect(await menu.evaluate(el => el.clientWidth)).toBe(menuWidth);
  await menu.evaluate(el => el.scrollTop = el.scrollHeight); expect(await menu.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  await page.keyboard.press('End'); await page.keyboard.press('Enter'); await expect(menu).toHaveCount(0);
  await expect(trigger).toHaveAttribute('data-value','es'); await expect(trigger).toBeFocused();
  await test.info().attach('scrollbar-theme', { body: JSON.stringify(styles), contentType: 'application/json' });
});

test('short overflow hides the thumb while native scrolling, resizing and content changes remain available', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 }); await page.goto('/settings');
  await page.locator('.settings-appearance .setting-trigger').first().click();
  const menu = page.getByRole('listbox'); await expect(menu).toBeVisible();
  await expect(menu).toHaveAttribute('data-scrollbar-y','false');
  await menu.evaluate(el => el.style.maxHeight = `${el.scrollHeight - 40}px`);
  await expect.poll(() => menu.evaluate(el => el.scrollHeight - el.clientHeight)).toBeGreaterThan(0);
  expect(await menu.evaluate(el => el.scrollHeight - el.clientHeight)).toBeLessThan(48);
  await expect(menu).toHaveAttribute('data-scrollbar-y','false');
  const before = await menu.evaluate(el => ({ width: el.clientWidth, text: el.firstElementChild!.getBoundingClientRect().width }));
  await menu.hover(); await page.mouse.wheel(0, 80);
  await expect.poll(() => menu.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  expect(await menu.evaluate(el => getComputedStyle(el).scrollbarColor)).toBe(transparent);
  await menu.evaluate(el => { const content = document.createElement('div'); content.dataset.scrollFixture = ''; content.style.height = '200px'; el.appendChild(content); });
  await expect(menu).toHaveAttribute('data-scrollbar-y','true');
  expect(await menu.evaluate(el => ({ width: el.clientWidth, text: el.firstElementChild!.getBoundingClientRect().width }))).toEqual(before);
  await menu.evaluate(el => el.querySelector('[data-scroll-fixture]')!.remove());
  await expect(menu).toHaveAttribute('data-scrollbar-y','false');
  await menu.evaluate(el => el.style.maxHeight = `${el.scrollHeight - 80}px`);
  await expect(menu).toHaveAttribute('data-scrollbar-y','true');
  await menu.evaluate(el => el.style.maxHeight = '340px');
  await expect(menu).toHaveAttribute('data-scrollbar-y','false');
  await page.keyboard.press('Escape');
  await page.goto('/library/ipa');
  await page.locator('.ipa-view-switch button').nth(1).click();
  await expect(page.locator('.ipa-table-scroll').filter({ has: page.locator('.ipa-table-consonants') })).toHaveAttribute('data-scrollbar-x','true');
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.scrollbarY)).toBe('true');
});

for (const [locale, width, theme] of [['zh-Hans',375,'light'],['en',1440,'dark'],['ar',375,'dark']] as const) test(`control scrollbars stay inside rounded surfaces in ${locale}/${width}/${theme}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 640 }); await page.goto('/settings');
  await selectPicker(page, (await page.locator('.settings-language .setting-trigger').getAttribute('aria-label'))!, locale);
  await selectPicker(page, (await page.locator('.settings-appearance .setting-trigger').first().getAttribute('aria-label'))!, theme);
  const surface = async (selector: string) => {
    const element = page.locator(selector).first();
    await expect(element).toBeVisible();
    await expect.poll(() => element.evaluate(el => { const box = el.getBoundingClientRect(); return box.left >= 0 && box.right <= innerWidth + 1; })).toBe(true);
    expect(await element.evaluate(el => {
      const style = getComputedStyle(el), box = el.getBoundingClientRect(), frame = el.closest('dialog');
      return { width: style.scrollbarWidth, corners: frame ? style.borderRadius === getComputedStyle(frame).borderRadius : parseFloat(style.borderRadius) > 0, fits: box.left >= 0 && box.right <= innerWidth + 1, native: ['auto','scroll'].includes(style.overflowY) || ['auto','scroll'].includes(style.overflowX) };
    })).toEqual({ width: 'thin', corners: true, fits: true, native: true });
  };
  await page.locator('.settings-language .setting-trigger').click(); await surface('.setting-menu');
  await page.keyboard.press('End'); await expect(page.getByRole('option').last()).toBeInViewport();
  await page.keyboard.press('Escape');
  await page.goto('/today'); await page.locator('.primary-task.reading-task [data-practice-skill=reading]').click();
  const group = page.locator('.practice-material-list .offline-source-group-toggle').first();
  await expect(group).toBeVisible();
  if (await group.getAttribute('aria-expanded') !== 'true') await group.click();
  await expect.poll(() => page.locator('.practice-options-body').evaluate(el => el.scrollHeight > el.clientHeight + 16)).toBe(true);
  await surface('.practice-options-body');
  expect(await page.locator('.practice-options-body').evaluate(el => {
    const card = el.closest('dialog')!, box = card.getBoundingClientRect(), scroll = el.getBoundingClientRect();
    return scroll.top >= box.top && scroll.bottom <= box.bottom + 1 && getComputedStyle(el).borderRadius === getComputedStyle(card).borderRadius && ['hidden', 'clip'].includes(getComputedStyle(card).overflow);
  })).toBe(true);
  await page.locator('.practice-options-body').evaluate(el => el.scrollTop = el.scrollHeight);
  await page.screenshot({ path: test.info().outputPath(`scrollbar-${locale}-${width}-${theme}.png`) });
  await page.keyboard.press('Escape'); await page.goto('/library/ipa');
  await page.locator('.ipa-view-switch button').nth(1).click();
  await surface('.ipa-table-scroll');
  const horizontal = page.locator('.ipa-table-scroll').filter({ has: page.locator('.ipa-table-consonants') });
  await horizontal.evaluate(el => el.scrollLeft = el.scrollWidth);
  expect(await horizontal.evaluate(el => el.scrollWidth <= el.clientWidth || el.scrollLeft > 0)).toBe(true);
});

for (const width of [375,1440]) test(`answer-card and text-entry scrollbars remain inside their surfaces at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await page.goto('/today');
  const lesson = JSON.parse(readFileSync(new URL('../fixtures/content/b1-summary-reading.json', import.meta.url), 'utf8'));
  const id = await page.evaluate(async lesson => (await (await import('/src/data/db.ts' as string)).createSession(lesson)).id, lesson);
  await page.goto(`/learn/${id}`); await expect(page.locator('.material-workspace')).toBeVisible();
  if (width < 1200) await page.locator('.question-sheet-toggle').click();
  const input = page.locator('.response-answer textarea').first();
  const answer = 'Keep the stated condition and next action.\n'.repeat(60);
  await input.fill(answer);
  await expect(page.locator('.workspace-save-status')).toHaveText('已保存在本设备');
  expect(await input.evaluate(el => {
    const control = el.getBoundingClientRect(), card = el.closest('.workspace-questions')!.getBoundingClientRect();
    return control.left >= card.left && control.right <= card.right && getComputedStyle(el).scrollbarWidth === 'thin' && parseFloat(getComputedStyle(el).borderRadius) > 0 && el.scrollHeight > el.clientHeight;
  })).toBe(true);
  await input.evaluate(el => el.scrollTop = el.scrollHeight); expect(await input.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  await expect(input).toHaveAttribute('data-scrollbar-y', 'true');
  const bottom = await input.evaluate(el => el.scrollTop), inputWidth = await input.evaluate(el => el.clientWidth);
  const color = await input.evaluate(el => getComputedStyle(el).scrollbarColor); expect(color).not.toBe(transparent);
  await input.press('PageUp'); await expect.poll(() => input.evaluate(el => el.scrollTop)).toBeLessThan(bottom);
  expect(await input.evaluate(el => getComputedStyle(el).scrollbarColor)).toBe(color);
  expect(await input.evaluate(el => el.clientWidth)).toBe(inputWidth); await expect(input).toHaveValue(answer);
  const content = page.locator('.question-sheet-content');
  expect(await content.evaluate(el => {
    const scroll = el.getBoundingClientRect(), card = el.closest('.workspace-questions')!, box = card.getBoundingClientRect();
    return scroll.left >= box.left && scroll.right <= box.right && (getComputedStyle(el).overflowY === 'visible' || scroll.bottom <= box.bottom + 1 && ['hidden', 'clip'].includes(getComputedStyle(card).overflow));
  })).toBe(true);
  await content.evaluate(el => el.scrollTop = el.scrollHeight);
  await page.screenshot({ path: test.info().outputPath(`answer-scrollbars-${width}.png`) });
});
