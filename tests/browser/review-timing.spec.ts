import { expect, test } from '@playwright/test';

for (const [locale, open, confirm] of [['zh-Hans', '核对复习时间', '使用此时间'], ['zh-Hant', '核對複習時間', '使用此時間'], ['en', 'Check review times', 'Use this time']]) test(`confirmed review time preserves originals and fits narrow screens (${locale})`, async ({ page }) => {
  await page.goto('/today');
  await page.evaluate(async locale => {
    const path = '/src/data/db.ts', shared = '/src/shared/sync.ts', syncPath = '/src/data/sync.ts';
    const data = await import(path), schema = await import(shared), sync = await import(syncPath);
    await data.settings.put({ key: 'profile:local-guest:locale', value: locale });
    await data.memories.put({ profileId: 'local-guest', memoryId: 'apple%1:13:00::', term: 'apple', definition: 'fruit', savedAt: '2026-09-01T10:00:00.000Z', reviewEnabled: true });
    const base = { deviceId: 'remote', occurredAt: '2026-09-01T10:00:00.000Z' };
    const batch = await schema.validateSyncBatch({ product: 'Lingfern', formatVersion: 1, profileId: 'local-guest', deviceId: 'remote', batchId: 'future-batch', events: [
      { ...base, id: 'saved', counter: 1, type: 'saved_item', payload: { memoryId: 'apple%1:13:00::', saved: true, reviewEnabled: true } },
      { ...base, id: 'future-review', counter: 2, occurredAt: '2099-01-01T00:00:00.000Z', type: 'memory_review', payload: { memoryId: 'apple%1:13:00::', rating: 3, configId: 'ts-fsrs-5.4.2-retention-0.90-fuzz-off', assistance: { answerRevealed: true, hintUsed: false } } },
    ] });
    await sync.receiveSyncBatch('local-guest', batch.batch, batch.hash);
  }, locale);
  await page.setViewportSize({ width: 320, height: 640 }); await page.goto('/library/saved');
  await page.getByText(open, { exact: true }).click();
  const row = page.locator('.review-timing>div').filter({ hasText: 'future-review' });
  await row.locator('input').fill('2026-09-02T10:00');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await row.scrollIntoViewIfNeeded(); await page.screenshot({ path: `output/playwright/review-timing-320-${locale}-light.png` });
  await row.getByRole('button', { name: confirm, exact: true }).click();
  await expect(page.locator('.review-timing')).toHaveCount(0);
  const stored = await page.evaluate(async () => {
    const path = '/src/data/db.ts'; const data = await import(path);
    return { original: await data.memoryReviews.get(['local-guest', 'future-review']), adjustments: await data.db.table('syncEvents').filter((event: { type: string }) => event.type === 'review_timing').toArray(), memory: await data.memories.get(['local-guest', 'apple%1:13:00::']) };
  });
  expect(stored.original.occurredAt).toBe('2099-01-01T00:00:00.000Z'); expect(stored.original.rating).toBe(3);
  expect(stored.adjustments).toHaveLength(1); expect(stored.memory.card.reps).toBe(1);
  await page.reload(); await expect(page.locator('.review-timing')).toHaveCount(0);
});
