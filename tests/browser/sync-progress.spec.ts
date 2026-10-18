import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { lessonSchema, questions } from '../../src/shared/content';
import { validateSyncBatch } from '../../src/shared/sync';

const lesson = lessonSchema.parse(JSON.parse(readFileSync(new URL('../fixtures/content/a1-reading.json', import.meta.url), 'utf8')));
test('synced summaries render without invented answers or replay links, across languages and widths', async ({ page }) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(lesson)));
  const contentHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  const events = questions(lesson).map((item, index) => ({ id: `summary-${index}`, deviceId: 'remote-device', counter: index + 1, occurredAt: '2026-09-27T10:00:00.000Z', type: 'completion', payload: { recordId: `record-${index}`, sessionId: 'remote-session', questionId: item.question.id, rootId: item.material.rootId, goalId: lesson.goalId, skill: lesson.skill, level: lesson.targetLevel, mode: 'practice', contentHash, correct: true, assistance: { hintLevel: 0, dictionaryUsed: false, audioCompleted: false, playbackRequests: 0 } } }));
  const unknown = { ...events[0], id: 'unknown-summary', counter: 5, payload: { ...events[0].payload, recordId: 'unknown-record', rootId: 'unknown-root', contentHash: 'a'.repeat(64) } };
  const validated = await validateSyncBatch({ product: 'Lingfern', formatVersion: 1, profileId: 'local-guest', deviceId: 'remote-device', batchId: 'summary-batch', events: [...events, unknown] });
  await page.goto('/today');
  await page.evaluate(async ({ batch, hash }) => {
    const path = '/src/data/sync.ts';
    await (await import(path)).receiveSyncBatch('local-guest', batch, hash);
  }, { batch: validated.batch, hash: validated.hash });
  for (const locale of ['zh-Hans', 'zh-Hant', 'en']) {
    await page.evaluate(async value => { const path = '/src/data/db.ts'; await (await import(path)).settings.put({ key: 'profile:local-guest:locale', value }); }, locale);
    for (const width of [1440, 1200, 1024, 768, 375, 320]) {
      await page.setViewportSize({ width, height: 812 });
      await page.goto('/progress');
      await expect(page.locator('.totals dd').first()).toHaveText('5');
      await expect(page.locator('.totals dd').nth(1)).toHaveText('3');
      await expect(page.locator('.synced-summary-list')).toContainText('unknown-root');
      await expect(page.locator('.synced-summary-list code')).toHaveText('a'.repeat(64));
      expect(await page.locator('.history-grid a').count()).toBe(0);
      await page.locator('.progress-cell:visible').first().click();
      await expect(page.locator('.progress-record-detail')).toBeVisible();
      await expect(page.locator('.progress-record-detail a')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if ((width === 320 && locale === 'zh-Hans') || (width === 1440 && locale === 'en')) { await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: `output/playwright/sync-summary-${width}-${locale}.png` }); }
    }
  }
  expect(await page.evaluate(async () => { const path = '/src/data/db.ts'; return (await import(path)).attempts.count(); })).toBe(0);
});
