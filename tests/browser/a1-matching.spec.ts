import { expect, test } from '@playwright/test';
import { openSnapshot, focusQuestion, completeWorkspace, verifyWorkspace } from './workspace';
import { selectPicker } from './picker';

test('matching preserves partial answers, supports keyboards and cites both messages', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  const { lesson, id } = await openSnapshot(page, 'a1-matching-reading');
  const section = await focusQuestion(page, lesson, 0), mia = section.getByRole('button', { name: /Mia$/ });
  await mia.focus(); await mia.press('End');
  await page.getByRole('option', { name: 'library', exact: true }).press('Enter');
  await expect(mia).toContainText('library');
  await expect.poll(() => page.evaluate(async id => (await (await import('/src/data/db.ts' as string)).sessions.get(id)).workspace?.drafts?.['after-class-plans-places'], id)).toEqual(['library', '']);
  await page.goto('/today'); await page.goto(`/learn/${id}`); await focusQuestion(page, lesson, 0);
  await expect(mia).toContainText('library');
  await expect(section.getByRole('button', { name: /Ben$/ })).toContainText('请选择');
  await completeWorkspace(page, lesson); await verifyWorkspace(page, lesson);
  await expect(page.locator('.slot-result')).toHaveCount(8);
  await page.screenshot({ path: test.info().outputPath('matching.png') });
});

test('matching uses translated instructions and full-size touch options', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const [locale, label] of [['en', '语言'], ['zh-Hant', 'Language'], ['zh-Hans', '語言']]) {
    await page.goto('/settings'); await selectPicker(page, label, locale);
    const { lesson } = await openSnapshot(page, 'a1-matching-reading');
    const section = await focusQuestion(page, lesson, 0);
    await section.getByRole('button', { name: /Mia$/ }).click();
    const options = page.getByRole('option');
    for (const option of await options.all()) {
      const box = (await option.boundingBox())!; expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('matching labels and long selected answers fit inside their question panel', async ({ page }) => {
  const { lesson } = await openSnapshot(page, 'a1-matching-reading'); await focusQuestion(page, lesson, 0);
  await selectPicker(page, '1. Mia', 'library');
  await page.locator('.matching-answers .setting').first().evaluate(row => {
    row.querySelector('.setting-trigger > span')!.textContent = 'Ancient-period formulation of belief and philosophical systems';
    row.querySelector(':scope > span')!.textContent = 'Hinduism, Buddhism, Confucianism, Judaism, and Greek philosophy';
  });
  for (const width of [1440, 375, 320]) {
    await page.setViewportSize({ width, height: 640 }); await focusQuestion(page, lesson, 0);
    const bounds = await page.locator('.matching-answers').first().evaluate(fieldset => {
      const panel = fieldset.closest('.question-panel')!.getBoundingClientRect(), box = fieldset.getBoundingClientRect();
      return { panelRight: panel.right, right: box.right, width: box.width, scroll: fieldset.scrollWidth };
    });
    expect(bounds.right).toBeLessThanOrEqual(bounds.panelRight); expect(bounds.scroll).toBeLessThanOrEqual(Math.ceil(bounds.width));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
