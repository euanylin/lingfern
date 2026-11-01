import { fillQuestion, focusQuestion, openSnapshot, seedLegacyAnswers } from './workspace';
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { selectPicker } from './picker';

const reading = JSON.parse(readFileSync('tests/fixtures/content/a1-reading.json', 'utf8')) as { id: string; title: Record<string, string>; goal: Record<string, string>; materials: { questions: { answer: number }[] }[] };

for (const width of [1440, 320]) test(`unsubmitted history explains its empty details and preserves drafts at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const { id, lesson } = await openSnapshot(page, 'a1-reading', true);
  const row = page.locator('.history').filter({ has: page.locator(`a[href="/learn/${id}"]`) });
  await page.goto('/progress'); await row.locator('.history-records-toggle').click();
  await expect(row.locator('.history-entry-records')).toHaveText('暂无已提交的作答。');
  await row.locator('.history-entry-link').click();
  const first = lesson.materials[0].questions[0];
  await fillQuestion(await focusQuestion(page, lesson, 0), first);
  await expect(page.locator('.workspace-save-status')).toHaveText('已保存在本设备');
  const saved = await page.evaluate(async id => (await (await import('/src/data/db.ts' as string)).sessions.get(id)).workspace.drafts, id);
  await page.goto('/progress'); await row.locator('.history-records-toggle').click();
  await expect(row.locator('.history-entry-records')).toHaveText('暂无已提交的作答。');
  expect(await page.evaluate(async id => (await (await import('/src/data/db.ts' as string)).sessions.get(id)).workspace.drafts, id)).toEqual(saved);
  expect(await page.evaluate(async id => (await import('/src/data/db.ts' as string)).attempts.where('sessionId').equals(id).count(), id)).toBe(0);
  await page.screenshot({ path: `output/playwright/history-empty-details-${width}.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await row.locator('.history-entry-link').click();
  const section = await focusQuestion(page, lesson, 0);
  if (!('options' in first)) throw new Error('Expected a choice fixture');
  await expect(section.getByRole('radio').nth(first.answer)).toBeChecked();
  for (const [index, question] of lesson.materials.flatMap(material => material.questions).entries()) await fillQuestion(await focusQuestion(page, lesson, index), question);
  await page.getByRole('button', { name: '提交练习', exact: true }).click(); await expect(page.locator('#workspace-result')).toBeVisible();
  await page.goto('/progress'); await row.locator('.history-records-toggle').click();
  await expect(row.locator('.history-entry-records>section')).toHaveCount(2);
  await expect(row).not.toContainText('暂无已提交的作答。');
});

for (const testMode of [false, true]) test(`skipped history stays visible only when permitted: test=${testMode}`, async ({ page }) => {
  const raw = JSON.parse(readFileSync('tests/fixtures/content/b1-summary-reading.json', 'utf8'));
  await page.goto('/today');
  const id = await page.evaluate(async ({ raw, testMode }) => {
    const data = await import('/src/data/db.ts' as string), { asTestLesson, questions } = await import('/src/shared/content.ts' as string);
    const session = await data.createSession(testMode ? asTestLesson(raw) : raw);
    await data.claimSession(session.id, 'history-skipped');
    for (const item of questions(session.lesson)) await data.skipWorkspaceQuestion(session.id, 'history-skipped', item.question.id, true);
    await data.releaseSession(session.id, 'history-skipped'); return session.id;
  }, { raw, testMode });
  await page.goto('/progress'); await page.locator('.history-records-toggle').click();
  const details = page.locator('.history-entry-records');
  await expect(details.locator('section')).toHaveCount(testMode ? 0 : 2);
  if (testMode) await expect(details).not.toContainText(raw.materials[0].questions[0].prompt);
  await expect(details).not.toContainText('暂无已提交的作答。');
  await page.evaluate(async id => {
    const data = await import('/src/data/db.ts' as string); await data.claimSession(id, 'history-skipped'); await data.submitWorkspace(id, 'history-skipped'); await data.releaseSession(id, 'history-skipped');
  }, id);
  await page.reload(); await page.locator('.history-records-toggle').click();
  await expect(details.locator('section')).toHaveCount(2);
  await expect(details).toContainText('已跳过（不计分）');
  await expect(details).not.toContainText('暂无已提交的作答。');
});

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
