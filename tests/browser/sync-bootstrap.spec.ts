import { openSnapshot, completeWorkspace } from './workspace';
import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('task and bookmark originals are captured once and their IDs survive actual ZIP restoration', async ({ page }) => {
  const { lesson } = await openSnapshot(page, 'a1-reading');
  await completeWorkspace(page, lesson);
  await page.getByRole('link', { name: '离开任务' }).click();
  await page.goto('/settings');
  await page.evaluate(async () => {
    const path = '/src/data/db.ts', memoryPath = '/src/data/memory.ts';
    const data = await import(path), memory = await import(memoryPath);
    await memory.saveSense('local-guest', 'apple%1:13:00::', 'apple', 'Fruit with red, yellow or green skin.');
    // Upgrade an archive predating sync events.
    await data.syncEvents.clear(); await data.syncClocks.clear();
    await data.settings.delete('profile:local-guest:syncBootstrap');
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: '设置', exact: true })).toBeVisible();
  const original = await page.evaluate(async () => {
    const path = '/src/data/sync.ts'; return (await import(path)).readSyncEvents('local-guest');
  });
  expect(original.filter((event: { type: string }) => event.type === 'completion')).toHaveLength(4);
  expect(original.filter((event: { type: string }) => event.type === 'exposure')).toHaveLength(4);
  expect(original.filter((event: { type: string }) => event.type === 'saved_item')).toHaveLength(1);
  await page.reload();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载备份' }).click(); await page.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click();
  const bytes = await readFile((await (await download).path())!);
  await page.getByLabel('从备份恢复').setInputFiles({ name: 'legacy.zip', mimeType: 'application/zip', buffer: bytes });
  await expect(page.locator('.backup-preview')).toBeVisible();
  await page.getByRole('button', { name: '导入为新档案' }).click();
  await expect(page.getByRole('status').filter({ hasText: '已建立新档案并导入记录。' })).toBeVisible();
  await expect(page.getByRole('button', { name: '当前档案' })).not.toHaveAttribute('data-value', 'local-guest');
  const restored = await page.getByRole('button', { name: '当前档案' }).getAttribute('data-value');
  expect(restored).not.toBe('local-guest');
  await page.reload();
  const copied = await page.evaluate(async profile => {
    const path = '/src/data/sync.ts'; return (await import(path)).readSyncEvents(profile);
  }, restored);
  expect(copied).toEqual(original);
});

test('failed legacy event capture leaves local learning records readable', async ({ page }) => {
  const { lesson } = await openSnapshot(page, 'a1-reading', true);
  await completeWorkspace(page, lesson);
  await page.getByRole('link', { name: '离开任务' }).click();
  await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const path = '/src/data/db.ts'; const data = await import(path);
    await data.syncEvents.clear(); await data.syncClocks.clear();
    await data.settings.delete('profile:local-guest:syncBootstrap');
    const fail = () => { throw new Error('STORAGE_FAILURE'); };
    data.syncEvents.hook('creating', fail);
    (window as unknown as { removeSyncFailure: () => void }).removeSyncFailure = () => data.syncEvents.hook('creating').unsubscribe(fail);
  });
  await page.getByRole('link', { name: '今日', exact: true }).click(); await page.getByRole('link', { name: '历史记录', exact: true }).click();
  await expect(page.locator('.totals dd').first()).toHaveText('2');
  await expect(page.getByRole('alert')).toBeVisible();
  expect(await page.evaluate(async () => {
    const path = '/src/data/db.ts'; return (await import(path)).attempts.count();
  })).toBe(2);
  await page.evaluate(() => (window as unknown as { removeSyncFailure: () => void }).removeSyncFailure());
});
