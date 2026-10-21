import { expect, test } from '@playwright/test';
import { openSnapshot, focusQuestion, fillWorkspace, submitWorkspace, verifyWorkspace } from './workspace';

test('A2 table preserves typed times and scores the exception on a new material', async ({ page }) => {
  const { lesson } = await openSnapshot(page, 'a2-reading');
  await fillWorkspace(page, lesson); await submitWorkspace(page); await verifyWorkspace(page, lesson);
  await page.setViewportSize({ width: 320, height: 640 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('a2-table.png') });
  await page.goto('/progress');
  await page.locator('.history').filter({ has: page.getByRole('link', { name: /核对开放时间的例外/ }) }).locator('summary').click();
  await expect(page.getByText('Thursday: 12:00 · Tuesday: 10:00')).toBeVisible();
});

test('A2 table draft returns after leaving the task', async ({ page }) => {
  const { lesson, id } = await openSnapshot(page, 'a2-reading');
  await focusQuestion(page, lesson, 0);
  await page.getByRole('textbox', { name: /Friday$/ }).fill('11 am');
  await expect.poll(() => page.evaluate(async id => (await (await import('/src/data/db.ts' as string)).sessions.get(id)).workspace?.drafts?.['museum-hours-table'], id)).toEqual(['11 am', '']);
  await page.goto('/today'); await page.goto(`/learn/${id}`);
  await focusQuestion(page, lesson, 0);
  await expect(page.getByRole('textbox', { name: /Friday$/ })).toHaveValue('11 am');
  await expect(page.getByRole('textbox', { name: /Wednesday$/ })).toHaveValue('');
});

test('a partly ordered A2 response survives leaving and reopening', async ({ page }) => {
  const { lesson, id } = await openSnapshot(page, 'a2-reading');
  const section = await focusQuestion(page, lesson, 3);
  const steps = ['Check the usual opening days and times.', "Check Thursday's changed opening time."];
  for (const step of steps) await section.locator('.sequence-choices').getByRole('button', { name: `${step} ＋`, exact: true }).click();
  await expect.poll(() => page.evaluate(async id => (await (await import('/src/data/db.ts' as string)).sessions.get(id)).workspace?.drafts?.['studio-thursday-plan'], id)).toEqual(steps);
  await page.goto('/today'); await page.goto(`/learn/${id}`); await focusQuestion(page, lesson, 3);
  await expect(page.locator('.sequence-order li')).toHaveCount(2);
  await page.locator('.sequence-controls button').first().focus();
  await page.locator('.sequence-controls button').nth(3).press('Enter');
  await expect(page.locator('.sequence-order li').first()).toContainText(steps[1]);
});
