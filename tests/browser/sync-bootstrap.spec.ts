import { confirmTask } from './task-start';
import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('legacy task and review originals are captured once and their IDs survive actual ZIP restoration', async ({ page }) => {
  await page.goto('/today');
  await page.locator('.primary-task.reading-task').getByRole('button', { name: '开始', exact: true }).click(); await confirmTask(page);
  for (const [index, answer] of [1, 2, 1, 2].entries()) {
    await page.getByRole('radio').nth(answer).check();
    await page.getByRole('button', { name: '保存答案', exact: true }).click();
    if (index < 3) await page.getByRole('button', { name: '下一题', exact: true }).click();
  }
  await page.getByRole('link', { name: '离开任务' }).click();
  await page.goto('/settings');
  const reviewId = await page.evaluate(async () => {
    const path = '/src/data/db.ts', memoryPath = '/src/data/memory.ts';
    const data = await import(path), memory = await import(memoryPath);
    await memory.saveSense('local-guest', 'apple%1:13:00::', 'apple', 'Fruit with red, yellow or green skin.');
    await memory.enableReview('local-guest', 'apple%1:13:00::');
    const id = crypto.randomUUID();
    await memory.rateMemory('local-guest', 'apple%1:13:00::', 3, id);
    // Simulate upgrading an archive created before synchronization events existed.
    await data.syncEvents.clear(); await data.syncClocks.clear();
    await data.settings.delete('profile:local-guest:syncBootstrap');
    return id;
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: '设置', exact: true })).toBeVisible();
  const original = await page.evaluate(async () => {
    const path = '/src/data/sync.ts'; return (await import(path)).readSyncEvents('local-guest');
  });
  expect(original.filter((event: { type: string }) => event.type === 'completion')).toHaveLength(4);
  expect(original.filter((event: { type: string }) => event.type === 'exposure')).toHaveLength(4);
  expect(original.filter((event: { id: string }) => event.id === reviewId)).toHaveLength(1);
  await page.reload();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载备份' }).click();
  const bytes = await readFile((await (await download).path())!);
  await page.getByLabel('从备份恢复').setInputFiles({ name: 'legacy.zip', mimeType: 'application/zip', buffer: bytes });
  await expect(page.locator('.backup-preview')).toBeVisible();
  await page.getByRole('button', { name: '导入为新档案' }).click();
  await expect(page.getByRole('status').filter({ hasText: '已建立新档案并导入记录。' })).toBeVisible();
  const restored = await page.getByRole('button', { name: '当前档案' }).getAttribute('data-value');
  expect(restored).not.toBe('local-guest');
  await page.reload();
  const copied = await page.evaluate(async profile => {
    const path = '/src/data/sync.ts'; return (await import(path)).readSyncEvents(profile);
  }, restored);
  expect(copied).toEqual(original);
});

test('failed legacy event capture leaves local learning records readable', async ({ page }) => {
  await page.goto('/today');
  await page.locator('.primary-task.reading-task').getByRole('button', { name: '开始', exact: true }).click(); await confirmTask(page);
  await page.getByRole('radio').nth(1).check();
  await page.getByRole('button', { name: '保存答案', exact: true }).click();
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
  await expect(page.locator('.totals dd').first()).toHaveText('1');
  await expect(page.getByRole('alert')).toBeVisible();
  expect(await page.evaluate(async () => {
    const path = '/src/data/db.ts'; return (await import(path)).attempts.count();
  })).toBe(1);
  await page.evaluate(() => (window as unknown as { removeSyncFailure: () => void }).removeSyncFailure());
});
