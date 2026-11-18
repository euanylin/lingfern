import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { ResourceCatalogue } from '../../src/shared/resourceCatalogue';

const origin = 'http://127.0.0.1:8787';
const sentence = 'The book that she bought is new.';
const model = '英语依存句法解析器（UDPipe）';

test('recovers an optional parser install and regenerates after an offline reload', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + '/library');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.getByRole('group', { name: '句法树', exact: true }).getByRole('button').click();
  const row = page.locator('.package-row').filter({ hasText: model });
  await row.getByRole('checkbox').check();
  const download = page.getByRole('button', { name: '下载所选资源', exact: true });
  const path = '**/resources/tree-parser-v1/english.udpipe?offline-install=*';
  await page.route(path, route => route.abort());
  await download.click();
  await expect(page.getByRole('alert')).toContainText('下载或校验失败');
  await expect(row).not.toContainText('已安装');
  await page.unroute(path);
  await download.click();
  await expect(row).toContainText('已安装');

  await page.goto(origin + '/library/trees');
  const source = page.locator('#tree-source');
  await expect(source).toBeEnabled();
  await page.getByRole('button', { name: '类型: 成分树' }).click();
  await page.getByRole('option', { name: '依存树', exact: true }).click();
  await source.fill(sentence);
  await source.press('Enter');
  await expect(page.getByText('acl:relcl', { exact: true })).toBeVisible();
  await expect(page.getByText('obj', { exact: true })).toBeVisible();
  await expect(page.getByText('mark', { exact: true })).toHaveCount(0);

  // Simulate a failed Worker launch without changing the installed package.
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    let rejectParser = true;
    window.Worker = class extends NativeWorker {
      constructor(url: URL | string, options?: WorkerOptions) {
        if (rejectParser && String(url).endsWith('/tree-parser/worker-v1.js')) {
          rejectParser = false;
          throw new Error('Synthetic worker failure');
        }
        super(url, options);
      }
    };
  });
  await context.setOffline(true);
  await page.reload();
  await expect(source).toHaveValue(sentence);
  await source.press('Enter');
  await expect(page.getByText('mark', { exact: true })).toBeVisible();
  await source.press('Enter');
  await expect(page.getByText('acl:relcl', { exact: true })).toBeVisible();
  await expect(page.getByText('obj', { exact: true })).toBeVisible();
  await expect(page.getByText('mark', { exact: true })).toHaveCount(0);
});

test('retains Worker CSP scope and reads a parser installed from a ZIP', async ({ page, context, request }) => {
  const policy = async (path: string) => (await request.get(origin + path)).headers()['content-security-policy'];
  expect(await policy('/tree-parser/worker-v1.js')).toContain("'wasm-unsafe-eval'");
  expect(await policy('/tree-parser/udpipe-v1.js')).not.toContain("'wasm-unsafe-eval'");
  expect(await policy('/library/trees')).not.toContain("'wasm-unsafe-eval'");
  const catalogue: ResourceCatalogue = JSON.parse(readFileSync('public/resources/catalogue.json', 'utf8'));
  const pack = catalogue.downloads.packs.find(item => item.id === 'tree-parser')!;
  await page.goto(origin + '/library');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.getByLabel('导入 ZIP').setInputFiles('public' + pack.path);
  await page.getByRole('group', { name: '句法树', exact: true }).getByRole('button').click();
  await expect(page.locator('.package-row').filter({ hasText: model })).toContainText('已安装');
  await context.setOffline(true);
  await page.goto(origin + '/library/trees');
  const source = page.locator('#tree-source');
  await expect(source).toBeEnabled();
  await page.getByRole('button', { name: '类型: 成分树' }).click();
  await page.getByRole('option', { name: '依存树', exact: true }).click();
  await source.fill(sentence);
  await source.press('Enter');
  await expect(page.getByText('acl:relcl', { exact: true })).toBeVisible();
});
