import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { lessonSchema, questions } from '../../src/shared/content';
import { validateSyncBatch } from '../../src/shared/sync';

const lesson = lessonSchema.parse(JSON.parse(readFileSync(new URL('../fixtures/content/a1-reading.json', import.meta.url), 'utf8')));
for (const [locale, title, confirm] of [['zh-Hans', '核对学习记录时间', '使用此时间'], ['zh-Hant', '核對學習紀錄時間', '使用此時間'], ['en', 'Check learning record times', 'Use this time']]) test(`completion timing preserves original summaries and survives reopening (${locale})`, async ({ page }) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(lesson)));
  const contentHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  const validated = await validateSyncBatch({ product: 'Lingfern', formatVersion: 1, profileId: 'local-guest', deviceId: 'synthetic-device', batchId: 'future-batch', events: questions(lesson).map((item, index) => ({ id: `future-${index}`, deviceId: 'synthetic-device', counter: index + 1, occurredAt: '2099-01-01T00:00:00.000Z', type: 'completion', payload: { recordId: `record-${index}`, sessionId: 'remote-session', questionId: item.question.id, rootId: item.material.rootId, goalId: lesson.goalId, skill: lesson.skill, level: lesson.targetLevel, mode: 'practice', contentHash, correct: true, assistance: { hintLevel: 0, dictionaryUsed: false, audioCompleted: false, playbackRequests: 0 } } })) });
  await page.goto('/today');
  await page.evaluate(async ({ batch, hash, locale }) => {
    const sync = '/src/data/sync.ts', data = '/src/data/db.ts';
    await (await import(sync)).receiveSyncBatch('local-guest', batch, hash);
    await (await import(data)).settings.put({ key: 'profile:local-guest:locale', value: locale });
  }, { ...validated, locale });
  await page.setViewportSize({ width: 320, height: 812 });
  await page.goto('/progress');
  const panel = page.locator('.completion-timing');
  await panel.locator('summary').click();
  await expect(panel.locator('summary')).toHaveText(title);
  await expect(panel.locator('time')).toHaveCount(4);
  for (let index = 0; index < 4; index++) {
    const input = panel.locator('input').nth(index);
    await input.fill('2026-09-27T10:00');
    await input.blur();
    await panel.getByRole('button', { name: confirm, exact: true }).nth(index).click();
    await expect(panel.getByRole('button').nth(index)).toBeEnabled();
  }
  await expect(panel.locator('time').first()).toHaveText('2099-01-01T00:00:00.000Z');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `output/playwright/completion-timing-320-${locale}-light.png`, fullPage: true });
  const stored = await page.evaluate(async () => { const path = '/src/data/sync.ts'; return (await import(path)).readSyncEvents('local-guest'); });
  expect(stored.filter((event: { type: string }) => event.type === 'completion').every((event: { occurredAt: string }) => event.occurredAt === '2099-01-01T00:00:00.000Z')).toBe(true);
  expect(stored.filter((event: { type: string }) => event.type === 'completion_timing')).toHaveLength(4);
  await page.reload();
  await expect(page.locator('.totals dd').first()).toHaveText('4');
  await page.locator('.progress-cell:visible').first().click();
  await expect(page.locator('.progress-record-detail time').first()).not.toContainText('2099');
  expect(await page.evaluate(async () => { const path = '/src/data/db.ts'; return (await import(path)).attempts.count(); })).toBe(0);
});
