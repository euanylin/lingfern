import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { ResourceCatalogue } from '../../src/shared/resourceCatalogue';

const origin = 'http://127.0.0.1:8787';
const model = '英语成分句法解析器（Charniak）';
const sentence = 'She stayed while he lit the lamp.';

test('uses an installed Charniak model offline and preserves automatic movement traces', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (text: string) => { Reflect.set(window, 'copiedTree', text); } },
    });
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(url: URL | string, options?: WorkerOptions) {
        if (String(url).endsWith('/tree-parser/constituency-v1.js') && sessionStorage.getItem('failCharniak')) {
          sessionStorage.removeItem('failCharniak');
          throw new Error('Synthetic Worker launch failure');
        }
        super(url, options);
      }
    };
  });
  await page.goto(origin + '/library');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.getByRole('group', { name: '句法树', exact: true }).getByRole('button').click();
  const row = page.locator('.package-row').filter({ hasText: model });
  await row.getByRole('checkbox').check();
  const download = page.getByRole('button', { name: '下载所选资源', exact: true });
  const path = '**/resources/tree-constituency-v1/model.bin?offline-install=*';
  await page.route(path, route => route.abort());
  await download.click();
  await expect(page.getByRole('alert')).toContainText('下载或校验失败');
  await expect(row).not.toContainText('已安装');
  await page.unroute(path);
  await download.click();
  await expect(row).toContainText('已安装');

  await context.setOffline(true);
  await page.goto(origin + '/library/trees');
  await page.evaluate(() => sessionStorage.setItem('failCharniak', '1'));
  const source = page.locator('#tree-source');
  const copy = page.getByRole('button', { name: '复制文本', exact: true });
  const copied = () => page.evaluate(() => Reflect.get(window, 'copiedTree'));
  await source.fill(sentence);
  await source.press('Enter');
  await expect(page.getByRole('treeitem', { name: 'lit', exact: true })).toBeVisible();
  await copy.click();
  expect(await copied()).toContain('[VB lit]');
  await source.press('Enter');
  await expect(page.locator('.tree-node').filter({ hasText: /^VBD$/u })).toHaveCount(2);
  await copy.click();
  expect(await copied()).toContain('[VBD lit]');
  await source.fill('The dog that barked ran.');
  await source.press('Enter');
  await expect(page.getByRole('treeitem', { name: 'that₁', exact: true })).toBeVisible();
  await expect(page.getByRole('treeitem', { name: 't₁', exact: true })).toBeVisible();
});

test('accepts the constituency ZIP and keeps WASM permission scoped to the parser Worker', async ({ page, context, request }) => {
  const policy = async (path: string) => (await request.get(origin + path)).headers()['content-security-policy'];
  expect(await policy('/tree-parser/constituency-v1.js')).toContain("'wasm-unsafe-eval'");
  expect(await policy('/tree-parser/charniak-v1.js')).not.toContain("'wasm-unsafe-eval'");
  expect(await policy('/library/trees')).not.toContain("'wasm-unsafe-eval'");
  const catalogue: ResourceCatalogue = JSON.parse(readFileSync('public/resources/catalogue.json', 'utf8'));
  const pack = catalogue.downloads.packs.find(item => item.id === 'tree-constituency')!;
  await page.goto(origin + '/library');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.getByLabel('导入 ZIP').setInputFiles('public' + pack.path);
  await page.getByRole('group', { name: '句法树', exact: true }).getByRole('button').click();
  await expect(page.locator('.package-row').filter({ hasText: model })).toContainText('已安装');
  await context.setOffline(true);
  await page.goto(origin + '/library/trees');
  const source = page.locator('#tree-source');
  await source.fill(sentence);
  await source.press('Enter');
  await expect(page.locator('.tree-node').filter({ hasText: /^VBD$/u })).toHaveCount(2);
});
