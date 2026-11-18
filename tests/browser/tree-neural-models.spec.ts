import { expect, test } from '@playwright/test';

const origin = 'http://127.0.0.1:8787';

test('installs Stanza and Hol-CCG and uses both on the same offline editor route', async ({ page, context, request }) => {
  test.setTimeout(120_000);
  const policy = async (path: string) => (await request.get(origin + path)).headers()['content-security-policy'];
  for (const worker of ['stanza-v1.js', 'hol-ccg-v1.js']) {
    expect(await policy('/tree-parser/' + worker)).toContain("'wasm-unsafe-eval'");
  }
  expect(await policy('/library/trees')).not.toContain("'wasm-unsafe-eval'");

  await page.addInitScript(() => {
    const fetchResource = window.fetch;
    window.fetch = (input, options) => input === '/resources/catalogue.json' && sessionStorage.getItem('holdCatalogue')
      ? new Promise(() => {}) : fetchResource(input, options);
    const NativeWorker = window.Worker;
    const results: Record<string, unknown> = {};
    Reflect.set(window, 'neuralResults', results);
    window.Worker = class extends NativeWorker {
      constructor(url: URL | string, options?: WorkerOptions) {
        if (String(url).endsWith('/hol-ccg-v1.js') && sessionStorage.getItem('failHol')) {
          sessionStorage.removeItem('failHol');
          throw new Error('Synthetic Worker launch failure');
        }
        super(url, options);
        this.addEventListener('message', event => { results[String(url)] = event.data; });
      }
    };
  });

  await page.goto(origin + '/library');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  const treeGroup = page.getByRole('group', { name: '句法树', exact: true });
  const toggle = treeGroup.getByRole('button');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(treeGroup.getByRole('checkbox', { name: /Charniak/u })).toHaveCount(0);
  const search = page.locator('.offline-install').getByRole('textbox');
  await search.fill('句法树');
  await expect(treeGroup.locator('.package-row')).toHaveCount(4);
  await search.clear();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.press('Enter');
  await expect(treeGroup.locator('.package-row')).toHaveCount(4);
  const models = page.locator('.package-row').filter({ hasText: /Stanza|Hol-CCG|UDPipe/u });
  const options = page.getByRole('checkbox', { name: /Stanza|Hol-CCG|UDPipe/u });
  await expect(options).toHaveCount(3);
  for (const option of await options.all()) await option.check();
  await expect(treeGroup.getByRole('checkbox', { name: '参考资料 · 句法树' })).toHaveAttribute('aria-checked', 'mixed');
  await page.getByRole('button', { name: '下载所选资源', exact: true }).click();
  await expect(models.filter({ hasText: '已安装' })).toHaveCount(3, { timeout: 80_000 });

  await page.evaluate(() => sessionStorage.setItem('holdCatalogue', '1'));
  await context.setOffline(true);
  await page.goto(origin + '/library/trees');
  const source = page.locator('#tree-source');
  const result = (name: string) => page.evaluate(name => Reflect.get(window, 'neuralResults')['/tree-parser/' + name + '-v1.js'], name);

  await source.fill('She stayed while he lit the lamp.');
  await source.press('Enter');
  await expect.poll(() => result('stanza'), { timeout: 15_000 }).toContain('(VBD lit)');
  await expect(page.getByRole('treeitem', { name: 'lit', exact: true })).toBeVisible();
  await source.fill('The dog that barked ran.');
  await source.press('Enter');
  await expect(page.getByRole('treeitem', { name: 't₁', exact: true })).toBeVisible();

  await page.getByRole('button', { name: '类型: 成分树' }).click();
  await page.getByRole('option', { name: '组合范畴语法（CCG）', exact: true }).click();
  await expect.poll(() => result('hol-ccg'), { timeout: 15_000 }).toMatch(/^\(<T/u);
  await source.fill('She left.');
  await source.press('Enter');
  await expect(page.getByRole('treeitem', { name: /left.*S\[dcl\]/u })).toBeVisible();
  await expect(page.getByRole('treeitem', { name: '?', exact: true })).toHaveCount(0);

  await page.reload();
  await page.evaluate(() => sessionStorage.setItem('failHol', '1'));
  await source.fill('why did she leave');
  await source.press('Enter');
  await expect(page.getByRole('treeitem', { name: 'S', exact: true }).first()).toBeVisible();
  expect(await result('hol-ccg')).toBeUndefined();
  await source.press('Enter');
  await expect.poll(() => result('hol-ccg'), { timeout: 15_000 }).toMatch(/^\(<T/u);
});
