import { expect, test } from '@playwright/test';
import { selectPicker } from './picker';

test('bookmarks one dictionary meaning, opts into review and restores it from ZIP', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/library/dictionary');
  await page.getByLabel('查询单词或短语').fill('apple');
  await page.getByLabel('查询单词或短语').press('Enter');
  await expect(page.locator('.dictionary-results h3')).toHaveText('apple');
  await page.getByRole('button', { name: /加入书签：/ }).first().click();
  await expect(page.locator('.dictionary-results .sense-star').first()).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/library/saved');
  await expect(page.getByRole('heading', { name: '书签' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'apple' })).toBeVisible();
  const enroll = page.getByRole('button', { name: '加入复习' });
  expect(await enroll.evaluate(el => getComputedStyle(el).borderTopStyle)).toBe('none');
  expect((await enroll.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await enroll.click();
  await page.getByRole('button', { name: '显示词义' }).click();
  await page.getByRole('button', { name: '想起来了', exact: true }).click();
  await expect(page.getByText('下次复习:')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'apple' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/settings');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载备份' }).click();
  const saved = await download;
  const bytes = await (await import('node:fs/promises')).readFile((await saved.path())!);
  await page.getByLabel('从备份恢复').setInputFiles({ name: 'memory.zip', mimeType: 'application/zip', buffer: bytes });
  await expect(page.locator('.backup-preview')).toContainText('书签 1 · 复习事件 1');
  await page.getByRole('button', { name: '导入为新档案' }).click();
  await page.goto('/library/saved');
  await expect(page.getByRole('heading', { name: 'apple' })).toBeVisible();
  await expect(page.getByText('下次复习:')).toBeVisible();
});

test('stars toggle a single sense and bookmarks open the chosen default online dictionary', async ({ page, context }) => {
  const external: string[] = [];
  await context.route(/https:\/\/(dictionary\.cambridge\.org|www\.oxfordlearnersdictionaries\.com)\//, route => {
    external.push(route.request().url());
    return route.abort();
  });
  await page.goto('/settings');
  await selectPicker(page, '默认在线词典', 'oxford');
  await page.goto('/library');
  await expect(page.getByRole('link', { name: '书签' })).toHaveCount(0);
  await page.getByRole('link', { name: '英英词典' }).click();
  await expect(page.getByRole('link', { name: '书签' })).toBeVisible();
  await page.getByLabel('查询单词或短语').fill('apple');
  await page.getByLabel('查询单词或短语').press('Enter');
  const star = page.locator('.dictionary-results .sense-star').first();
  await expect(star).toHaveAttribute('aria-pressed', 'false');
  await expect(star).toContainText('☆');
  expect(await star.evaluate(element => element.nextElementSibling?.tagName)).toBe('P');
  await star.click();
  await expect(star).toHaveAttribute('aria-pressed', 'true');
  await expect(star).toContainText('★');
  await star.click();
  await expect(star).toHaveAttribute('aria-pressed', 'false');
  await star.click();
  await page.getByRole('link', { name: '书签' }).click();
  await expect(page).toHaveURL(/\/library\/saved$/);
  await expect(page.getByRole('heading', { name: 'apple', exact: true })).toBeVisible();
  const link = page.locator('.saved-word-lookup');
  await expect(link).toHaveAttribute('aria-label', /在 Oxford Learner’s Dictionaries 中查询“apple”/);
  await expect(link).toHaveAttribute('href', /www\.oxfordlearnersdictionaries\.com\/search\/english\/\?q=apple/);
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  expect(external).toHaveLength(0);
  const [popup] = await Promise.all([page.waitForEvent('popup'), link.click()]);
  await popup.close();
  expect(external).toHaveLength(1);
  await page.getByRole('button', { name: '取消书签' }).click();
  await expect(page.getByText('还没有书签。')).toBeVisible();
  await page.goto('/settings');
  await expect(page.getByRole('button', { name: '默认在线词典' })).toHaveAttribute('data-value', 'oxford');
});


test('received public sense reviews appear with clock safeguards, without transferring private definitions', async ({ page }) => {
  await page.goto('/today');
  await page.evaluate(async () => {
    const syncPath = '/src/data/sync.ts', sharedPath = '/src/shared/sync.ts', memoryPath = '/src/data/memory.ts';
    const sync = await import(syncPath), shared = await import(sharedPath), memory = await import(memoryPath);
    const events = [{ id: 'remote-save', deviceId: 'remote', counter: 1, occurredAt: '2026-09-01T00:00:00.000Z', type: 'saved_item', payload: { memoryId: 'apple%1:13:00::', saved: true, reviewEnabled: true } }, { id: 'remote-review', deviceId: 'remote', counter: 2, occurredAt: '2026-09-02T00:00:00.000Z', type: 'memory_review', payload: { memoryId: 'apple%1:13:00::', rating: 3, assistance: { answerRevealed: true, hintUsed: false }, configId: memory.memoryConfigId } }];
    const valid = await shared.validateSyncBatch({ product: 'Lingfern', formatVersion: 1, profileId: 'local-guest', deviceId: 'remote', batchId: 'public-meaning', events });
    await sync.receiveSyncBatch('local-guest', valid.batch, valid.hash);
  });
  await page.goto('/library/saved');
  await expect(page.getByRole('heading', { name: 'apple', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '显示词义' })).toBeVisible();
  await page.evaluate(async () => {
    const syncPath = '/src/data/sync.ts', sharedPath = '/src/shared/sync.ts', memoryPath = '/src/data/memory.ts';
    const sync = await import(syncPath), shared = await import(sharedPath), memory = await import(memoryPath);
    const events = [{ id: 'future-review', deviceId: 'remote', counter: 3, occurredAt: '2099-01-01T00:00:00.000Z', type: 'memory_review', payload: { memoryId: 'apple%1:13:00::', rating: 3, assistance: { answerRevealed: true, hintUsed: false }, configId: memory.memoryConfigId } }];
    const valid = await shared.validateSyncBatch({ product: 'Lingfern', formatVersion: 1, profileId: 'local-guest', deviceId: 'remote', batchId: 'future', events });
    await sync.receiveSyncBatch('local-guest', valid.batch, valid.hash);
  });
  for (const [locale, width] of [['zh-Hans', 375], ['zh-Hant', 320], ['en', 1440]] as const) {
    await page.evaluate(async value => { const path = '/src/data/db.ts'; await (await import(path)).settings.put({ key: 'profile:local-guest:locale', value }); }, locale);
    await page.setViewportSize({ width, height: 812 });
    await page.goto('/library/saved');
    await expect(page.locator('.memory-problems')).toContainText(locale === 'en' ? 'Scheduling is paused' : locale === 'zh-Hant' ? '暫不安排複習' : '暂不安排复习');
    await expect(page.locator('.review-ratings')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (locale !== 'zh-Hant') await page.screenshot({ path: `output/playwright/sync-memory-clock-${width}-${locale}.png` });
  }
  await page.evaluate(async () => { const path = '/src/data/db.ts'; await (await import(path)).settings.put({ key: 'profile:local-guest:locale', value: 'zh-Hans' }); });
  await page.goto('/settings');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载备份' }).click();
  const saved = await download;
  const bytes = await (await import('node:fs/promises')).readFile((await saved.path())!);
  await page.getByLabel('从备份恢复').setInputFiles({ name: 'received-reviews.zip', mimeType: 'application/zip', buffer: bytes });
  await expect(page.locator('.backup-preview')).toContainText('书签 1 · 复习事件 1');
  await page.getByRole('button', { name: '导入为新档案' }).click();
  await page.goto('/library/saved');
  await expect(page.getByRole('heading', { name: 'apple', exact: true })).toBeVisible();
  await expect(page.locator('.memory-problems')).toContainText('暂不安排复习');
});
