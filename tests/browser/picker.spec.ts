import { expect, test } from '@playwright/test';
import { expectPickerAlignment } from './picker';

test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

test('dragging the thumb keeps the menu open and outer scrolling dismisses it', async ({ page, browserName, headless }) => {
  test.skip(browserName === 'webkit' || browserName === 'firefox' && headless, 'WebKit does not capture this drag; headless Firefox forces scrollbars hidden.');
  await page.setViewportSize({ width: 1280, height: 850 }); await page.goto('/settings');
  const trigger = page.locator('.settings-language .setting-trigger'); await trigger.click();
  const scroller = page.locator('.setting-menu-scroll'); await scroller.hover(); await page.mouse.wheel(0, 120);
  await expect.poll(() => scroller.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  await page.waitForTimeout(150);
  const before = await scroller.evaluate(el => ({ top: el.scrollTop, total: el.scrollHeight, height: el.clientHeight, box: el.getBoundingClientRect().toJSON() }));
  const thumb = before.height * before.height / before.total;
  const x = before.box.right - 3, y = before.box.top + before.height * before.top / before.total + thumb / 2;
  await page.mouse.move(x, y); await page.waitForTimeout(150); await page.mouse.down();
  await page.mouse.move(x, y + 90, { steps: 12 }); await page.mouse.up();
  await expect(scroller).toBeVisible(); await expect.poll(() => scroller.evaluate(el => el.scrollTop)).toBeGreaterThan(before.top);
  await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
  await trigger.click(); await expect(scroller).toBeVisible();
  await page.mouse.move(100, 300); await page.mouse.wheel(0, 120);
  await expect(scroller).toHaveCount(0); await expect(trigger).toBeFocused();
});

test('returning from reading settings decorates its label without underlining the arrow', async ({ page }) => {
  await page.goto('/today'); const trigger = page.locator('.reading-task [data-practice-skill=reading]');
  await trigger.focus(); await trigger.press('Enter'); await expect(page.locator('.practice-options-dialog[open]')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.locator('.practice-options-dialog')).toHaveCount(0);
  await expect(trigger).toBeFocused(); await expect(trigger).toHaveCSS('text-decoration-line', 'none');
  await expect(trigger.locator('span').first()).toHaveCSS('text-decoration-line', 'underline');
});

test('Home and End return scrollbar focus to an unchanged option index', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 850 }); await page.goto('/settings');
  const trigger = page.locator('.settings-language .setting-trigger'); await trigger.click();
  const owner = page.locator('.setting-menu-scroll'), options = owner.getByRole('option');
  for (const key of ['Home', 'End']) {
    await page.keyboard.press(key);
    // Native thumb dragging focuses the scroll owner without changing the option index.
    await owner.evaluate((element, key) => { element.focus({ preventScroll: true }); element.scrollTop = key === 'Home' ? element.scrollHeight : 0; }, key);
    await page.keyboard.press(key);
    await expect(key === 'Home' ? options.first() : options.last()).toBeFocused();
    expect(await owner.evaluate((element, key) => key === 'Home' ? element.scrollTop : element.scrollHeight - element.clientHeight - element.scrollTop, key)).toBeLessThanOrEqual(1);
  }
  await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
});

test('multi-select pointer choices become the next keyboard navigation starting point', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 850 }); await page.goto('/today');
  await page.locator('.reading-task [data-practice-skill=reading]').click();
  const dialog = page.locator('.practice-options-dialog'); await expect(dialog).toHaveAttribute('data-open', 'true');
  const trigger = dialog.locator('.setting-trigger').first(); await trigger.click();
  const menu = dialog.getByRole('listbox');
  const chosen = menu.locator('[role=option][data-value=environment]'), next = menu.locator('[role=option][data-value=history]');
  await chosen.click(); await expect(chosen).toHaveAttribute('aria-selected', 'true');
  await expect(chosen).toBeFocused();
  await page.keyboard.press('ArrowDown'); await expect(next).toBeFocused(); await expect(next).toBeInViewport();
  await page.keyboard.press('Space'); await expect(next).toHaveAttribute('aria-selected', 'true');
  await expect(chosen).toHaveAttribute('aria-selected', 'true'); await expect(menu).toBeVisible();
  await page.keyboard.press('ArrowUp'); await expect(chosen).toBeFocused();
  await page.keyboard.press('Space'); await expect(chosen).toHaveAttribute('aria-selected', 'false');
  await expect(next).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Escape'); await expect(menu).toHaveCount(0); await expect(trigger).toBeFocused();
});

test('pointer closing each practice settings button restores its idle appearance and keyboard focus remains visible', async ({ page, browserName }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto('/today');
  const triggers = page.locator('.today-grid .topic-picker .setting-trigger');
  await expect(triggers).toHaveCount(4);
  for (let index = 0; index < 4; index++) {
    const trigger = triggers.nth(index), label = trigger.locator('span').first();
    const idle = await trigger.evaluate(el => ({ color: getComputedStyle(el).color, background: getComputedStyle(el).backgroundColor }));
    await trigger.click();
    const dialog = page.locator('.practice-options-dialog[open]');
    await expect(dialog).toHaveAttribute('data-open', 'true');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await dialog.locator('header button').click(); await expect(dialog).toHaveCount(0);
    await page.mouse.move(1400, 850); await expect(trigger).toBeFocused();
    await expect(label).toHaveCSS('text-decoration-line', 'none');
    await expect(trigger).toHaveCSS('background-color', idle.background); await expect(trigger).toHaveCSS('color', idle.color);
    await expect(trigger).toHaveCSS('scale', 'none'); await expect(trigger.locator('.setting-chevron')).toHaveCSS('translate', 'none');
    // Firefox does not promote pointer focus on an arbitrary arrow key; Safari's default Tab order skips buttons.
    if (browserName === 'firefox') {
      await page.keyboard.press('Tab'); await expect(trigger).not.toBeFocused();
      await page.keyboard.press('Shift+Tab');
    } else await page.keyboard.press('ArrowRight');
    await expect(trigger).toBeFocused(); await expect(label).toHaveCSS('text-decoration-line', 'underline');
    await trigger.press('Enter'); await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused(); await expect(label).toHaveCSS('text-decoration-line', 'underline');
    await page.mouse.click(1400, 850);
  }
});

for (const [width, colorScheme] of [[1440, 'light'], [375, 'dark']] as const) test(`keyboard profile picker ignores an already-settled scroll event: ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 800 });
  await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
  await page.goto('/settings');
  const trigger = page.locator('.profile-backup .setting-trigger');
  await trigger.scrollIntoViewIfNeeded();
  await trigger.focus();
  await trigger.press('Enter');
  const menu = page.getByRole('listbox', { name: '当前档案', exact: true });
  await expect(menu).toBeVisible();
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  // Focus can finish scrolling before its queued notification is delivered.
  await page.evaluate(() => document.dispatchEvent(new Event('scroll')));
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(menu.getByRole('option', { selected: true })).toBeFocused();
  expect(await menu.getByRole('option', { selected: true }).evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  const before = await page.evaluate(() => scrollY);
  await page.evaluate(() => scrollBy(0, scrollY > 80 ? -80 : 80));
  await expect.poll(() => page.evaluate(() => scrollY)).not.toBe(before);
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

for (const [width, locale, colorScheme] of [[830, 'zh-CN', 'dark'], [1440, 'en', 'light'], [375, 'ar', 'dark']] as const) test.describe(`picker anchors ${width}/${locale}`, () => {
  test.use({ viewport: { width, height: 780 }, locale, colorScheme, hasTouch: width < 768, isMobile: width < 768, reducedMotion: width < 768 ? 'reduce' : 'no-preference' });
  test('wide fields follow their logical start edge through selection and resizing', async ({ page }, info) => {
    await page.goto('/today');
    const positions = [];
    for (const skill of ['reading', 'listening']) {
      await page.locator(`[data-practice-skill=${skill}]`).first().click();
      const dialog = page.locator('.practice-options-dialog[open]'); await expect(dialog).toHaveCSS('opacity', '1');
      for (let index = 0; index < 2; index++) {
        const trigger = dialog.locator('.practice-option-fields .setting-trigger').nth(index);
        await trigger.click(); await expect(dialog.getByRole('listbox')).toBeVisible();
        await page.screenshot({ path: info.outputPath(`${skill}-field-${index}.png`) });
        positions.push(await expectPickerAlignment(trigger));
        await dialog.getByRole('option').nth(1).click(); await expect(dialog.getByRole('listbox')).toBeVisible();
        positions.push(await expectPickerAlignment(trigger));
        await page.keyboard.press('End'); await expect(dialog.getByRole('option').last()).toBeFocused();
        await page.keyboard.press('Home'); await expect(dialog.getByRole('option').first()).toBeFocused();
        await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
      }
      const trigger = dialog.locator('.practice-option-fields .setting-trigger').first(); await trigger.click();
      await page.setViewportSize({ width: width - 15, height: 780 });
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      if (!(await dialog.getByRole('listbox').isVisible())) {
        // A resize may scroll the owning surface, which intentionally dismisses menus.
        await expect(trigger).toHaveAttribute('aria-expanded', 'false'); await expect(trigger).toBeFocused(); await trigger.click();
      }
      await expect(dialog.getByRole('listbox')).toBeVisible(); positions.push(await expectPickerAlignment(trigger));
      await page.keyboard.press('Escape'); await dialog.locator('header button').click();
      await expect(dialog).toHaveCount(0);
      await page.setViewportSize({ width, height: 780 });
    }
    await info.attach('positions', { body: JSON.stringify(positions), contentType: 'application/json' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test('row menus follow logical end edges and account for their containing border', async ({ page }, info) => {
    await page.goto('/settings'); const positions = [];
    for (const selector of ['.settings-language .setting-trigger', '.settings-appearance .setting-trigger', '.profile-backup .setting-trigger']) {
      const trigger = page.locator(selector).first(); await trigger.scrollIntoViewIfNeeded();
      await trigger.focus(); await trigger.press('Enter'); await expect(page.getByRole('listbox')).toBeVisible();
      positions.push(await expectPickerAlignment(trigger)); await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
    }
    const trigger = page.locator('.profile-backup .setting-trigger');
    await trigger.locator('..').evaluate(element => { element.style.border = '3px solid transparent'; });
    await trigger.click(); await expect(page.getByRole('listbox')).toBeVisible();
    await page.screenshot({ path: info.outputPath('bordered-row.png') });
    positions.push(await expectPickerAlignment(trigger));
    await info.attach('positions', { body: JSON.stringify(positions), contentType: 'application/json' });
  });
});
