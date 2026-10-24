import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('conflict diagnosis downloads both copies and leaves quarantine intact', async ({ page }) => {
  await page.goto('/today');
  await page.evaluate(async () => {
    const path = '/src/data/sync.ts', shared = '/src/shared/sync.ts'; const sync = await import(path), schema = await import(shared);
    const batch = { product: 'Lingfern', formatVersion: 1, profileId: 'local-guest', deviceId: 'remote', batchId: 'fixed', events: [{ id: 'same-event', deviceId: 'remote', counter: 1, occurredAt: '2026-09-30T00:00:00.000Z', type: 'saved_item', payload: { memoryId: 'sense', saved: true } }] };
    const first = await schema.validateSyncBatch(batch); await sync.receiveSyncBatch('local-guest', first.batch, first.hash);
    batch.events[0].payload.saved = false;
    const second = await schema.validateSyncBatch(batch); await sync.receiveSyncBatch('local-guest', second.batch, second.hash);
  });
  await page.setViewportSize({ width: 320, height: 640 }); await page.goto('/settings');
  await expect(page.getByRole('heading', { name: '同步冲突', exact: true })).toBeVisible();
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: '导出冲突诊断', exact: true }).click();
  const report = JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
  expect(report.incoming.batch.events[0].payload.saved).toBe(false);
  expect(report.originalBatch.batch.events[0].payload.saved).toBe(true);
  expect(report.originalEvents[0].payload.saved).toBe(true);
  expect(await page.evaluate(async () => { const path = '/src/data/db.ts'; return (await import(path)).db.table('syncConflicts').count(); })).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('.sync-conflicts').scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'output/playwright/sync-conflicts-320-zh-Hans-light.png' });
});
