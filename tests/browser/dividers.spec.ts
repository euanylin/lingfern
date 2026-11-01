import { confirmTask } from './task-start';
import { openSnapshot, completeWorkspace } from './workspace';
import { expect, test } from '@playwright/test';

test('task lists use available width without spilling on smaller screens', async ({ page }) => {
  for (const width of [375, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [route, selector] of [['today', '.primary-task'], ['today', '.task-row']] as const) {
      await page.goto(`/${route}`);
      const rows = page.locator(selector);
      await expect(rows.first()).toBeVisible();
      const layout = await rows.evaluateAll(elements => {
        const [first, second] = elements.map(element => element.getBoundingClientRect());
        return { columns: Math.abs(first.top - second.top) < 1 ? 2 : 1, overflow: document.documentElement.scrollWidth > innerWidth };
      });
      expect(layout).toEqual({ columns: 1, overflow: false });
    }
  }
});

test('history rows share one rounded surface with a single divider', async ({ page }) => {
  await page.goto('/today');
  const { lesson } = await openSnapshot(page, 'a1-reading', true); await completeWorkspace(page, lesson);
  await page.getByRole('link', { name: '离开任务' }).click();
  await expect(page).toHaveURL(/\/today$/);
  await page.locator('.primary-task:not(.reading-task):not(.combined-training)').getByRole('button', { name: '开始' }).click(); await confirmTask(page);
  await page.getByRole('link', { name: '离开任务' }).click();
  await expect(page).toHaveURL(/\/today$/);
  await page.goto('/progress');
  await expect(page).toHaveURL(/\/progress$/);
  await expect(page.locator('.history')).toHaveCount(2);
  for (const width of [375, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    const layout = await page.locator('.history').evaluateAll(elements => {
      const [first, second] = elements.map(element => element.getBoundingClientRect());
      const surface = getComputedStyle(elements[0].closest('.history-grid')!);
      return { columns: Math.abs(first.top - second.top) < 1 ? 2 : 1, borders: elements.every((element, index) => getComputedStyle(element).borderTopWidth === (index ? '1px' : '0px') && getComputedStyle(element).borderBottomWidth === '0px'), rounded: surface.borderRadius === '16px' && surface.overflow === 'hidden', overflow: document.documentElement.scrollWidth > innerWidth };
    });
    expect(layout).toEqual({ columns: 1, borders: true, rounded: true, overflow: false });
  }
  await expect(page.locator('footer')).toHaveCount(0);
  await page.goto('/library');
  expect(await page.locator('.library-references a').last().evaluate(el => getComputedStyle(el).borderBottomWidth)).toBe('0px');
  expect(await page.locator('.offline-install').evaluate(el => getComputedStyle(el).borderTopWidth)).toBe('0px');
});
