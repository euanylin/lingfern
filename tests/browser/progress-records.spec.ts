import { seedLegacyAnswers } from './workspace';
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { selectPicker } from './picker';

const reading = JSON.parse(readFileSync('tests/fixtures/content/a1-reading.json', 'utf8')) as { id: string; title: Record<string, string>; goal: Record<string, string>; materials: { questions: { answer: number }[] }[] };

test('history shows saved responses without statistics or goal panels', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seedLegacyAnswers(page, 1); await page.goto('/progress');
  await expect(page.locator('.totals,.progress-records,.progress-skill-summary,.progress-source-list,.history-overview')).toHaveCount(0);
  await expect(page.locator('#today-records>.history-grid>.history')).toHaveCount(1);
  const disclosure = page.locator('#today-records>.history-grid .history-records-toggle');
  await expect(disclosure).toHaveAccessibleName('已保存作答: 1');
  await disclosure.focus(); await disclosure.press('Enter');
  await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.history-entry-records>section')).toHaveCount(1);
  await expect(page.locator('.history-entry-records')).toContainText('Where do we meet?');
  await disclosure.click();
  await page.screenshot({ path: 'output/playwright/progress-records-1440x900-light-zh-Hans-one-answer.png', fullPage: true });
  await page.setViewportSize({ width: 320, height: 640 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'output/playwright/progress-records-320x640-light-zh-Hans-one-answer.png', fullPage: true });
  for (const [current, next] of [['语言', 'zh-Hant'], ['語言', 'en']]) {
    await page.goto('/settings'); await selectPicker(page, current, next);
    await page.goto('/progress');
    await expect(page.locator('#today-records>.history-grid>.history')).toHaveCount(1);
    await expect(page.locator('.totals,.progress-records,.progress-skill-summary,.progress-source-list')).toHaveCount(0);
  }
});

test('simplified history preserves completed responses and later practice recommendations', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-27T10:00:00Z') });
  await seedLegacyAnswers(page, 4); await page.goto('/progress');
  await page.locator('.history-records-toggle').click();
  await expect(page.locator('.history-entry-records>section')).toHaveCount(4);
  await page.setViewportSize({ width: 320, height: 640 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.clock.fastForward(4 * 86_400_000); await page.goto('/today');
  const selection = await page.evaluate(async () => {
    const db = await import('/src/data/db.ts' as string), { selectPractice } = await import('/src/data/practice.ts' as string);
    const history = await db.sessions.toArray();
    const selected = selectPractice(history.map((session: { lesson: unknown }) => session.lesson), history, await db.attempts.toArray(), 'reading', undefined, new Date());
    return { id: selected?.lesson.id, reason: selected?.reason };
  });
  expect(selection).toEqual({ id: reading.id, reason: 'review' });
  await page.locator('.primary-task.reading-task').getByRole('button', { name: '开始', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: reading.title['zh-Hans'], exact: true })).toBeVisible();
});
