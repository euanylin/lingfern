import { confirmTask } from './task-start';
import { expect, test } from '@playwright/test';
import { selectPicker } from './picker';

test('mobile reading keeps the answer while the bottom sheet opens and closes', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/today');
  await page.locator('.primary-task.reading-task').getByRole('button', { name: '开始', exact: true }).click(); await confirmTask(page);
  const sheet = page.locator('.question-panel');
  const toggle = sheet.locator('.question-sheet-toggle');
  await expect(sheet).toHaveAttribute('data-open', 'false');
  await expect(page.locator('.material')).toBeVisible();
  await toggle.click();
  await expect(sheet).toHaveAttribute('data-open', 'true');
  await page.getByRole('radio', { name: 'At the library.' }).check();
  await page.locator('.question-sheet-scrim').click({ position: { x: 4, y: 100 } });
  await expect(sheet).toHaveAttribute('data-open', 'false');
  await expect(page.locator('.material')).toBeVisible();
  await toggle.click();
  await expect(page.getByRole('radio', { name: 'At the library.' })).toBeChecked();
  await page.getByRole('button', { name: '保存答案', exact: true }).click();
  await expect(page.getByRole('heading', { name: '✓ 回答正确' })).toBeVisible();
  await expect.poll(() => page.getByRole('radio', { name: 'At the library.' }).evaluate(el => getComputedStyle(el).backgroundColor))
    .toBe(await page.locator('.feedback h2').evaluate(el => getComputedStyle(el).color));
});

test('visitor learns, saves, reopens and finishes another root material', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/today');
  await expect(page.locator('.primary-task.reading-task').getByRole('button', { name: '开始', exact: true })).toBeVisible();
  await page.screenshot({ path: 'output/playwright/today-1440x900-light-zh-Hans-empty.png', fullPage: true });
  await page.locator('.primary-task.reading-task').getByRole('button', { name: '开始', exact: true }).click(); await confirmTask(page);
  await expect(page.getByRole('heading', { name: 'Where do we meet?' })).toBeVisible();
  const option = page.getByRole('radio', { name: 'At the library.' }).locator('..');
  const optionColor = await option.evaluate(el => getComputedStyle(el).backgroundColor);
  await option.hover();
  await expect.poll(() => option.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(optionColor);
  await page.getByRole('radio', { name: 'At the library.' }).check();
  await page.getByRole('button', { name: '保存答案', exact: true }).click();
  await expect(page.getByRole('heading', { name: '✓ 回答正确' })).toBeVisible();
  const selectedRadio = page.getByRole('radio', { name: 'At the library.' });
  await expect(selectedRadio).toBeDisabled();
  await expect.poll(() => selectedRadio.evaluate(el => getComputedStyle(el).backgroundColor))
    .toBe(await page.locator('.feedback h2').evaluate(el => getComputedStyle(el).color));
  await expect(page.locator('.question-panel input[type=radio]:not(:checked)').first()).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await page.screenshot({ path: 'output/playwright/learning-1440x900-light-zh-Hans-one-answer.png', fullPage: true });
  const url = page.url();
  await page.getByRole('link', { name: '离开任务' }).click();
  await expect(page).toHaveURL(/\/today$/);
  await page.goto(url);
  await expect(page.getByRole('heading', { name: '✓ 回答正确' })).toBeVisible();
  for (const answer of ['A student card.', 'At the café.', 'A pencil.']) {
    await page.getByRole('button', { name: '下一题' }).click();
    await page.getByRole('radio', { name: answer }).check();
    await page.getByRole('button', { name: '保存答案', exact: true }).click();
    await expect(page.getByRole('heading', { name: '✓ 回答正确' })).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: '阅读任务已保存' })).toBeVisible();
  await page.getByRole('link', { name: '返回今日' }).click();
  await page.getByRole('link', { name: '今日', exact: true }).click(); await page.getByRole('link', { name: '历史记录', exact: true }).click();
  await expect(page.locator('.totals dd')).toHaveText(['4', '2']);
  await expect(page.locator('.progress-cell [role=img]').filter({ hasText: /^●$/ })).toHaveCount(0);
  await page.locator('summary').click();
  await expect(page.getByRole('heading', { name: 'Where do we meet?' })).toBeVisible();
});

test('an already open task saves while offline without claiming offline installation', async ({ page, context }) => {
  await page.goto('/today'); await page.locator('.primary-task.reading-task').getByRole('button', { name: '开始', exact: true }).click(); await confirmTask(page);
  await expect(page.getByRole('heading', { name: 'Where do we meet?' })).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByRole('status')).toContainText('尚未确认资源完整安装');
  await page.getByRole('radio', { name: 'At the library.' }).check();
  await page.getByRole('button', { name: '保存答案', exact: true }).click();
  await expect(page.getByRole('heading', { name: '✓ 回答正确' })).toBeVisible();
});

test('another tab cannot edit the same active session', async ({ page, context }) => {
  await page.goto('/today'); await page.locator('.primary-task.reading-task').getByRole('button', { name: '开始', exact: true }).click(); await confirmTask(page);
  await expect(page.getByRole('heading', { name: 'Where do we meet?' })).toBeVisible();
  const other = await context.newPage(); await other.goto(page.url());
  await expect(other.getByRole('alert')).toContainText('另一标签页');
  await expect(other.getByRole('radio')).toHaveCount(0);
  await page.getByRole('link', { name: '离开任务' }).click();
  await expect(page).toHaveURL(/\/today$/);
  await other.getByRole('button', { name: '重试', exact: true }).click();
  await expect(other.getByRole('heading', { name: 'Where do we meet?' })).toBeVisible();
});

test('small screen, theme and all interface languages', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 }); await page.goto('/today');
  const start = page.locator('.primary-task.reading-task').getByRole('button', { name: '开始', exact: true });
  await expect(start).toBeVisible();
  const mobileBrand = page.locator('header .mobile-brand');
  await expect(mobileBrand).toBeVisible();
  await expect(page.locator('footer .footer-wordmark')).toHaveCount(0);
  expect((await mobileBrand.boundingBox())?.width).toBe(44);
  const homeMark = page.getByRole('link', { name: 'Lingfern' });
  await expect(homeMark.locator('picture,img')).toHaveCount(0);
  await expect(homeMark.locator('.brand-symbol')).toHaveCount(1);
  expect((await homeMark.boundingBox())?.height).toBe(52);
  await expect(page.getByText('记录保存在本设备，无需登录。', { exact: true })).toHaveCount(0);
  const initial = await start.evaluate(el => getComputedStyle(el).backgroundColor);
  await start.hover();
  await expect.poll(() => start.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(initial);
  await page.mouse.move(0, 0);
  await expect.poll(() => start.evaluate(el => getComputedStyle(el).transform)).toBe('none');
  const box = await start.boundingBox();
  expect(box && box.y + box.height <= 812).toBeTruthy();
  await page.screenshot({ path: 'output/playwright/today-375x812-light-zh-Hans-empty.png', fullPage: true });
  await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
  const footerGap = await page.evaluate(() => document.querySelector('.mobile-nav')!.getBoundingClientRect().top - document.querySelector('main')!.lastElementChild!.getBoundingClientRect().bottom);
  expect(footerGap).toBeGreaterThanOrEqual(8);
  expect((await page.locator('#root > header').boundingBox())?.y).toBe(0);
  expect(await page.locator('#root > header').evaluate(el => getComputedStyle(el, '::before').backdropFilter)).toContain('blur(16px)');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 320, height: 640 });
  const mobileNav = page.getByRole('navigation', { name: '主导航' });
  await expect(mobileNav.getByRole('link')).toHaveCount(3);
  expect((await mobileNav.boundingBox())!.y).toBeGreaterThan(500);
  expect(await mobileNav.locator('a').evaluateAll(links => links.every(link => link.getBoundingClientRect().height >= 44 && !!link.querySelector('svg')))).toBe(true);
  await expect(page.locator('header select')).toHaveCount(0);
  const settingsLink = mobileNav.getByRole('link', { name: '设置', exact: true });
  const navColor = await settingsLink.evaluate(el => getComputedStyle(el).backgroundColor);
  await settingsLink.hover();
  expect(await settingsLink.evaluate(el => getComputedStyle(el).backgroundColor)).toBe(navColor);
  expect(await settingsLink.evaluate(el => getComputedStyle(el, '::after').content)).toBe('none');
  expect(await settingsLink.evaluate(el => getComputedStyle(el, '::after').animationName)).toBe('none');
  expect(await settingsLink.locator('svg').evaluate(el => getComputedStyle(el).transform)).toBe('none');
  await settingsLink.click();
  const languageSelect = page.getByRole('button', { name: '语言' });
  const settingRow = languageSelect.locator('..');
  const rowColor = await settingRow.evaluate(el => getComputedStyle(el).backgroundColor);
  const controlColor = await languageSelect.evaluate(el => getComputedStyle(el).backgroundColor);
  await languageSelect.hover();
  expect(await settingRow.evaluate(el => getComputedStyle(el).backgroundColor)).toBe(rowColor);
  await expect.poll(() => languageSelect.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(controlColor);
  await selectPicker(page, '语言', 'en');
  await page.getByRole('link', { name: 'Today', exact: true }).click();
  await expect(page.locator('.primary-task.reading-task').getByRole('button', { name: 'Start', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await selectPicker(page, 'Appearance', 'dark');
  await page.getByRole('link', { name: 'Today', exact: true }).click();
  const darkStart = page.locator('.primary-task.reading-task').getByRole('button', { name: 'Start', exact: true });
  await expect(mobileBrand.locator('.brand-symbol')).toBeVisible();
  expect(await mobileBrand.locator('.brand-symbol').evaluate(el => {
    const css = getComputedStyle(el);
    return css.maskImage.includes('/icon.svg') && css.backgroundColor !== 'rgba(0, 0, 0, 0)';
  })).toBe(true);
  const beforeHover = await darkStart.evaluate(el => getComputedStyle(el).backgroundColor);
  await darkStart.hover();
  await expect.poll(() => darkStart.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(beforeHover);
  await expect.poll(() => darkStart.evaluate(el => getComputedStyle(el).transform)).toBe('matrix(1.025, 0, 0, 1.025, 0, 0)');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => darkStart.evaluate(el => getComputedStyle(el).transform)).toBe('none');
  const reducedNav = page.getByRole('link', { name: 'Settings', exact: true });
  await reducedNav.hover();
  expect(await reducedNav.evaluate(el => getComputedStyle(el, '::after').animationName)).toBe('none');
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await selectPicker(page, 'Language', 'zh-Hant');
  await expect(page.getByRole('heading', { name: '設定', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: '語言' })).toHaveAttribute('data-value', 'zh-Hant');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'output/playwright/settings-320x640-dark-zh-Hant-empty.png', fullPage: true });
});

test('mobile navigation stays fixed around learning and software-keyboard focus', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/today');
  const nav = page.locator('.mobile-nav');
  await expect(nav).toBeVisible();
  expect(await nav.evaluate(el => getComputedStyle(el).position)).toBe('fixed');
  await page.locator('.primary-task.reading-task').getByRole('button', { name: '开始', exact: true }).click(); await confirmTask(page);
  await expect(nav).toHaveCount(0);
  const leave = page.getByRole('link', { name: '离开任务' });
  const symbol = page.locator('.session-header > .brand-symbol');
  await expect(symbol).toBeVisible();
  expect((await leave.boundingBox())!.x + (await leave.boundingBox())!.width).toBeLessThan((await symbol.boundingBox())!.x);
  await leave.click();
  await expect(nav).toBeVisible();
  await nav.getByRole('link', { name: '资料库' }).click();
  await page.getByRole('link', { name: '英英词典' }).click();
  const query = page.getByRole('combobox', { name: '查询单词或短语' });
  await query.focus();
  expect(await nav.evaluate(el => getComputedStyle(el).position)).toBe('fixed');
  await query.blur();
  expect(await nav.evaluate(el => getComputedStyle(el).position)).toBe('fixed');
  await page.setViewportSize({ width: 320, height: 500 });
  expect(await nav.evaluate(el => getComputedStyle(el).position)).toBe('fixed');
  expect(await page.locator('#root > header').evaluate(el => getComputedStyle(el).position)).toBe('fixed');
});

test('failed answer transaction preserves selection and never advances before retry', async ({ page }) => {
  await page.goto('/today'); await page.locator('.primary-task.reading-task').getByRole('button', { name: '开始', exact: true }).click(); await confirmTask(page);
  await page.getByRole('radio', { name: 'At the library.' }).check();
  await page.evaluate(() => {
    const add = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function(...args) {
      if (this.name === 'attempts') {
        IDBObjectStore.prototype.add = add;
        throw new DOMException('Synthetic storage failure', 'QuotaExceededError');
      }
      return add.apply(this, args);
    };
  });
  await page.getByRole('button', { name: '保存答案', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('未能保存');
  await expect(page.getByRole('radio', { name: 'At the library.' })).toBeChecked();
  await expect(page.getByRole('button', { name: '下一题' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '✓ 回答正确' })).toHaveCount(0);
  await page.getByRole('button', { name: '重试', exact: true }).click();
  await expect(page.getByRole('heading', { name: '✓ 回答正确' })).toBeVisible();
});

test('full browser refresh releases its tab lock and immediately recovers the saved answer', async ({ page }) => {
  await page.goto('/today'); await page.locator('.primary-task.reading-task').getByRole('button', { name: '开始', exact: true }).click(); await confirmTask(page);
  await page.getByRole('radio', { name: 'At the library.' }).check();
  await page.getByRole('button', { name: '保存答案', exact: true }).click();
  await expect(page.getByRole('heading', { name: '✓ 回答正确' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '✓ 回答正确' })).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole('alert')).toHaveCount(0);
});
