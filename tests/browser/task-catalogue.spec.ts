import { expect, test } from '@playwright/test';
import { selectPicker } from './picker';

test('actual catalogue counts, search and desktop filters preserve unavailable check gates', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/today');
  const rows = page.locator('.task-catalogue-list>.task-row');
  await expect(rows).toHaveCount(16);
  expect(await page.locator('.task-filters .setting-trigger>span:first-child').first().evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await expect(page.locator('.task-inventory, .task-levels')).toHaveCount(0);
  for (const badge of await rows.locator('.eyebrow').all()) await expect(badge).not.toContainText(/\b(?:A[12]|B[12]|C[12])\b/);
  await selectPicker(page, '技能', 'reading');
  await expect(rows).toHaveCount(10);
  await expect(rows.first().locator('.eyebrow')).toHaveText('READING · 学习');
  await page.getByLabel('搜索任务', { exact: true }).fill('不存在的任务');
  await expect(rows).toHaveCount(0);
  await expect(page.locator('.task-catalogue-list')).toContainText('没有符合当前筛选');
  await page.locator('.task-filters').getByRole('button', { name: '清除筛选' }).click();
  await expect(rows).toHaveCount(16);
  await expect(page.locator('[aria-label=模式]')).toHaveCount(0);
  for (const width of [1440, 1200, 1024, 768, 375, 320]) {
    await page.setViewportSize({ width, height: 812 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: `output/playwright/task-catalogue-${width}-light-zh-Hans.png` });
  }
});

test('mobile filters apply or cancel explicitly and remain selected offline', async ({ page, context }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/today');
  const rows = page.locator('.task-catalogue-list>.task-row'), filters = page.locator('.task-filters');
  await expect(filters).not.toHaveAttribute('open', '');
  await filters.locator('summary').click();
  await selectPicker(page, '技能', 'listening');
  await expect(rows).toHaveCount(16);
  await filters.getByRole('button', { name: '取消', exact: true }).click();
  await expect(rows).toHaveCount(16);
  await filters.locator('summary').click();
  await selectPicker(page, '技能', 'listening');
  await filters.getByRole('button', { name: /应用筛选/ }).click();
  await expect(rows).toHaveCount(6);
  await context.setOffline(true);
  await expect(rows).toHaveCount(6);
  await expect(rows.getByRole('button', { name: '开始听力', exact: true })).toHaveCount(0);
  await expect(rows.getByRole('button', { name: '下载内容', exact: true })).toHaveCount(6);
  await filters.locator('summary').click();
  await selectPicker(page, '本机内容', 'local');
  await filters.getByRole('button', { name: /应用筛选/ }).click();
  await expect(rows).toHaveCount(0);
  await filters.locator('summary').click();
  await filters.getByRole('button', { name: '清除筛选' }).click();
  await filters.getByRole('button', { name: '取消', exact: true }).click();
  await expect(rows).toHaveCount(0);
  await filters.locator('summary').click();
  await filters.getByRole('button', { name: '清除筛选' }).click();
  await filters.getByRole('button', { name: /应用筛选/ }).click();
  await expect(rows).toHaveCount(16);
});

test('catalogue filters and counts stay readable in all three languages at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  for (const [language, locale, title, search, skill] of [['语言', 'en', 'Today', 'Search tasks', 'Skill'], ['Language', 'zh-Hant', '今日', '搜尋任務', '技能'], ['語言', 'zh-Hans', '今日', '搜索任务', '技能']]) {
    await page.goto('/settings');
    await selectPicker(page, language, locale);
    await page.goto('/today');
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(page.getByLabel(search, { exact: true })).toBeVisible();
    await page.locator('.task-filters>summary').click();
    await selectPicker(page, skill, 'reading');
    await page.locator('.task-filters .setting-trigger').nth(1).click();
    const themes = page.locator('.setting-menu [role=option]');
    await expect(themes).toHaveCount(19);
    expect(await themes.allTextContents()).toEqual(expect.arrayContaining([locale === 'en' ? 'Technology and internet' : locale === 'zh-Hant' ? '科技與網際網路' : '科技与互联网']));
    expect((await themes.allTextContents()).every(label => label.trim().length > 0)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.locator('.task-levels')).toHaveCount(0);
    const picker = page.locator('.task-filters .setting-trigger').last();
    await expect(picker).toBeVisible();
    expect(await picker.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `output/playwright/task-filters-320-${locale}-dark.png` });
  }
});
