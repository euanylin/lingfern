import type { ResourceCatalogue } from '../../src/shared/resourceCatalogue';
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { unzipSync, zipSync } from 'fflate';
const resources = JSON.parse(await readFile('/tmp/lingfern-offline-fixtures-resources/content/offline-resources.json', 'utf8')) as ResourceCatalogue['offline'];

const pack = (id: string) => {
  const group = resources.groups.find(item => item.id === id)!;
  return `/tmp/lingfern-offline-fixtures-resources/public/packs/${id}-${group.version}.zip`;
};

test('prepared Library state follows installs and removals in another tab', async ({ page, context }) => {
  await page.goto('/today');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  const other = await context.newPage(); await other.goto('/library');
  const otherRow = other.locator('.package-row').filter({ hasText: '英语用法词典' });
  await other.getByLabel('导入 ZIP').setInputFiles(pack('grammar'));
  await expect(otherRow).toContainText('已安装');
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/resources/catalogue.json', async route => { await pending; await route.continue(); });
  await page.locator('nav a[href="/library"]:visible').first().click();
  const row = page.locator('.package-row').filter({ hasText: '英语用法词典' });
  await expect(row).toContainText('已安装');
  await expect(page.locator('.offline-install')).toHaveAttribute('aria-busy', 'false');
  release(); await page.unrouteAll({ behavior: 'wait' });
  await otherRow.locator('input').check();
  await other.getByRole('button', { name: '删除所选资源', exact: true }).click();
  await other.getByRole('alertdialog').getByRole('button', { name: '删除所选资源', exact: true }).click();
  await expect(otherRow).not.toContainText('已安装');
  await expect(row).not.toContainText('已安装');
  await other.close();
});

test('imports a verified ZIP offline and leaves an existing package intact after a bad ZIP', async ({ page, context }) => {
  await page.goto('/library');
  await page.locator('.package-row').filter({ hasText: '英语用法词典' }).locator('input').check();
  await page.locator('.resource-pack-tools > summary').click();
  await expect(page.getByRole('link', { name: '英语用法词典 · 下载 ZIP' })).toHaveAttribute('href', `/packs/grammar-${resources.groups.find(group => group.id === 'grammar')!.version}.zip`);
  await page.getByLabel('导入 ZIP').setInputFiles(pack('grammar'));
  await expect(page.getByRole('status')).toContainText('资源已安装');
  await expect(page.locator('.package-row').filter({ hasText: '英语用法词典' })).toContainText('已安装');
  const intents = await page.evaluate(() => new Promise<{ type: string; payload: { contentId: string; wanted: boolean } }[]>((resolve, reject) => {
    const request = indexedDB.open('lingfern');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => { const database = request.result, read = database.transaction('syncEvents').objectStore('syncEvents').getAll(); read.onerror = () => { database.close(); reject(read.error); }; read.onsuccess = () => { database.close(); resolve(read.result); }; };
  }));
  expect(intents.filter(event => event.type === 'installation').map(event => event.payload)).toMatchObject([{ contentId: 'grammar', wanted: true }]);
  const corrupted = unzipSync(await readFile(pack('audio-a1')));
  corrupted['audio/a1-words/word-1.mp3'][0] ^= 1;
  await page.getByLabel('导入 ZIP').setInputFiles({ name: 'bad.zip', mimeType: 'application/zip', buffer: Buffer.from(zipSync(corrupted)) });
  await expect(page.getByRole('status').filter({ hasText: '资源包无效' })).toContainText('资源包无效');
  await expect(page.locator('.package-row').filter({ hasText: '英语用法词典' })).toContainText('已安装');
  await expect(page.locator('.package-row').filter({ hasText: 'A1 单词录音' })).not.toContainText('已安装');
  await context.setOffline(true);
  await page.goto('/library/grammar');
  await page.getByRole('searchbox', { name: '搜索单词、搭配或用法疑问' }).fill('条件句');
  await expect.poll(() => page.locator('.grammar-results details').count()).toBeGreaterThanOrEqual(2);
});

test('download and local removal capture intentions without treating them as cached files', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 812 });
  await page.goto('/library');
  await page.getByRole('button', { name: /^通用材料/ }).last().click();
  const row = page.locator('.package-row').filter({ hasText: 'A1 单词录音' });
  const grammar = page.locator('.package-row').filter({ hasText: '英语用法词典' });
  await row.locator('input').check();
  await grammar.locator('input').check();
  await page.evaluate(() => {
    const samples: number[] = [];
    (window as unknown as { resourceBarHeights: number[] }).resourceBarHeights = samples;
    const observe = () => { const bar = document.querySelector('.offline-selection-actions:has(progress)'); if (bar) samples.push(bar.getBoundingClientRect().height); requestAnimationFrame(observe); };
    requestAnimationFrame(observe);
  });
  await page.getByRole('button', { name: '下载所选资源', exact: true }).click();
  await expect(row).toContainText('已安装');
  await expect(grammar).toContainText('已安装');
  const heights = await page.evaluate(() => (window as unknown as { resourceBarHeights: number[] }).resourceBarHeights);
  expect(heights.length).toBeGreaterThan(1);
  expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(1);
  await row.locator('input').check();
  await grammar.locator('input').check();
  await page.getByRole('button', { name: '删除所选资源', exact: true }).click();
  const removal = page.getByRole('alertdialog');
  await expect(removal.getByRole('button', { name: '取消', exact: true })).toBeFocused();
  await removal.getByRole('button', { name: '取消', exact: true }).click();
  await expect(row).toContainText('已安装');
  await page.getByRole('button', { name: '删除所选资源', exact: true }).click();
  const began = Date.now();
  await removal.getByRole('button', { name: '删除所选资源', exact: true }).click();
  await expect(row).not.toContainText('已安装');
  await expect(grammar).not.toContainText('已安装');
  await test.info().attach('batch-resource-operation', { body: JSON.stringify({ viewport: '320x812', progressBarHeights: [...new Set(heights)], removalMs: Date.now() - began }), contentType: 'application/json' });
  const events = await page.evaluate(() => new Promise<{ type: string; payload: { contentId: string; contentHash: string; wanted: boolean } }[]>((resolve, reject) => {
    const request = indexedDB.open('lingfern');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => { const database = request.result, read = database.transaction('syncEvents').objectStore('syncEvents').getAll(); read.onerror = () => { database.close(); reject(read.error); }; read.onsuccess = () => { database.close(); resolve(read.result); }; };
  }));
  const intents = events.filter(event => event.type === 'installation');
  expect(intents).toHaveLength(4);
  expect(intents.map(event => event.payload.wanted).sort()).toEqual([false, false, true, true]);
  expect(intents.every(event => ['audio-a1', 'grammar'].includes(event.payload.contentId) && /^[a-f0-9]{64}$/.test(event.payload.contentHash))).toBe(true);
});

test('imports the full dictionary ZIP and serves an unvisited entry after going offline', async ({ page, context }) => {
  await page.goto('/library');
  await page.getByLabel('导入 ZIP').setInputFiles(pack('dictionary'));
  await expect(page.locator('.package-row').filter({ hasText: '英英词典' })).toContainText('已安装', { timeout: 30_000 });
  await context.setOffline(true);
  await page.goto('/library/dictionary');
  await page.getByRole('combobox', { name: '查询单词或短语' }).fill('zebra');
  await page.getByLabel('查询单词或短语').press('Enter');
  await expect(page.locator('.dictionary-results h3')).toHaveText('zebra');
});

test('imports both complete reading ZIPs within the unchanged expansion limit and reopens their files offline', async ({ page, context }) => {
  await page.goto('/library');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  for (const [id, label] of [['corpus', '阅读语料'], ['corpus-open-reading', '开放阅读语料']]) {
    const group = resources.groups.find(item => item.id === id)!;
    const bytes = await readFile(pack(id));
    expect(bytes).toEqual(await readFile(`public/packs/${id}-${group.version}.zip`));
    await page.getByLabel('导入 ZIP').setInputFiles(pack(id));
    await expect(page.locator('.community-import [role=status]')).toContainText('资源已安装', { timeout: 60_000 });
    await expect(page.locator('.package-row').filter({ has: page.locator('.package-title', { hasText: new RegExp(`^${label}$`) }) })).toContainText('已安装');
  }
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.package-row').filter({ hasText: '开放阅读语料' })).toContainText('已安装');
  const results = await page.evaluate(async files => {
    const results = [];
    for (const file of files) {
      const response = await fetch(file.path), bytes = await response.arrayBuffer();
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
      results.push({ path: file.path, ok: response.ok && bytes.byteLength === file.bytes && hash === file.sha256 });
    }
    return results;
  }, resources.groups.filter(group => ['corpus', 'corpus-open-reading'].includes(group.id)).flatMap(group => group.files));
  expect(results.length).toBeGreaterThan(1);
  expect(results.every(file => file.ok)).toBe(true);
  expect(new Set(results.map(file => file.path)).size).toBe(results.length);
});
