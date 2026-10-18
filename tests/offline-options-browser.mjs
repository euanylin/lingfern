import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:8787/library');
  await page.locator('.package-row').first().waitFor();
  assert.equal(await page.locator('.offline-category').count(), 2);
  assert.equal(await page.locator('.package-row').count(), 4);
  assert.deepEqual(await page.locator('.offline-category h3').allTextContents(), ['阅读', '参考资料']);
  assert.equal(await page.locator('.package-row').filter({ hasText: /A[12]|B[12]|C[12]/ }).count(), 0);
  await page.getByRole('button', { name: '全选', exact: true }).click();
  assert.equal(await page.locator('.package-row input:checked').count(), 4);
  assert.equal(await page.locator('.resource-pack-links a').count(), 4);
  assert.equal(await page.locator('.resource-pack-links a[href*="audio-"]').count(), 0);
  await page.getByRole('button', { name: '取消全选', exact: true }).click();
  const usage = page.locator('.package-row').filter({ hasText: '英语用法词典' });
  await usage.locator('input').check();
  const download = page.getByRole('button', { name: '下载所选资源', exact: true });
  assert.equal(await download.isEnabled(), true);
  await download.click();
  await page.waitForFunction(() => [...document.querySelectorAll('.package-row')].some(row => row.textContent.includes('英语用法词典') && row.textContent.includes('已安装')));
  assert.match(await usage.textContent(), /已安装/);
  await usage.locator('input').check();
  assert.equal(await page.getByRole('button', { name: '删除所选资源', exact: true }).isEnabled(), true);
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 812 });
    await page.goto('http://127.0.0.1:8787/settings');
    await page.getByRole('heading', { name: 'MCP', exact: true }).waitFor();
    assert.equal(await page.locator('.github-identity + .mcp-settings').count(), 1);
    assert.equal(await page.locator('a[href="/settings/ai"]').count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    if (width === 320) await page.screenshot({ path: '/tmp/lingfern-mcp-320.png', fullPage: true });
    await page.goto('http://127.0.0.1:8787/library');
    await page.locator('.package-row').first().waitFor();
    if (width === 320) await page.screenshot({ path: '/tmp/lingfern-downloads-320.png', fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  }
  await page.goto('http://127.0.0.1:8787/settings/about');
  assert.equal(await page.getByText('No video assets are used in the current build.', { exact: true }).count(), 0);
  await page.goto('http://127.0.0.1:8787/settings#mcp');
  await page.getByRole('heading', { name: 'MCP', exact: true }).waitFor();
  assert.equal(new URL(page.url()).pathname, '/settings');
  await page.goto('http://127.0.0.1:8787/today');
  await page.getByRole('heading', { name: '今日', exact: true }).waitFor();
  console.log('PASS: 4 active resources in 2 categories; retired audio absent, actual selected download, eligible selection actions, MCP placement, removed copy, 今日 and three widths.');
} finally { await browser.close(); }
