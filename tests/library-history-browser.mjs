import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';

const origin = 'http://127.0.0.1:8787';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ locale: 'zh-CN', viewport: { width: 375, height: 812 } });
const page = await context.newPage(), errors = [], external = [];
page.on('pageerror', error => errors.push(error.message));
await page.route('**/*', route => { if (route.request().url().startsWith(origin + '/')) return route.continue(); external.push(route.request().url()); return route.abort(); });
const history = () => page.evaluate(() => new Promise((resolve, reject) => {
  const open = indexedDB.open('lingfern'); open.onerror = () => reject(open.error);
  open.onsuccess = () => { const db = open.result, request = db.transaction('settings').objectStore('settings').get('profile:local-guest:lookupHistory'); request.onsuccess = () => { resolve(JSON.parse(request.result?.value ?? '[]')); db.close(); }; request.onerror = () => reject(request.error); };
}));
try {
  await page.goto(origin + '/library'); await page.evaluate(() => navigator.serviceWorker.ready); await page.reload();
  await expect(page.locator('.library-history-entry a')).toHaveText('历史记录');
  const packs = ['英英词典', '英语用法词典', 'IPA 发音与录音'].map(name => page.locator('.package-row').filter({ hasText: name }));
  for (const pack of packs) await pack.getByRole('checkbox').check();
  await page.getByRole('button', { name: '下载所选资源', exact: true }).click();
  for (const pack of packs) await expect(pack).toContainText('已安装', { timeout: 90000 });
  await page.goto(origin + '/library/dictionary'); await page.getByRole('combobox').fill('apple'); await page.getByRole('combobox').press('Enter');
  await expect(page.locator('.dictionary-results h3')).toHaveText('apple');
  await page.goto(origin + '/library/grammar'); await page.getByRole('searchbox').fill('since / for'); await page.locator('.grammar-results summary').click();
  await expect.poll(async () => (await history()).some(row => row.kind === 'grammar')).toBe(true);
  await page.goto(origin + '/library/ipa'); await page.getByRole('button', { name: '听音标 /i/', exact: true }).click();
  await expect.poll(async () => (await history()).some(row => row.kind === 'ipa')).toBe(true);
  await context.setOffline(true); await page.goto(origin + '/library/history'); await page.reload();
  await expect(page.locator('.history')).toHaveCount(3);
  await page.locator('.history a').filter({ hasText: 'apple' }).click(); await expect(page.locator('.dictionary-results h3')).toHaveText('apple');
  await page.reload(); await expect(page.locator('.dictionary-results h3')).toHaveText('apple'); await page.goBack();
  await page.locator('.history a').filter({ hasText: 'since / for' }).click(); await expect(page.locator('.grammar-results details')).toHaveAttribute('open', '');
  await page.reload(); await expect(page.locator('.grammar-results details')).toHaveAttribute('open', ''); await page.goBack();
  await page.locator('.history a').filter({ hasText: '/i/' }).click(); await expect(page.locator('.ipa-entry[tabindex]')).toBeFocused();
  assert(await page.locator('audio').evaluate(audio => audio.paused)); await page.goBack(); await expect(page.locator('.history')).toHaveCount(3);
  for (const [width, theme] of [[1440, 'light'], [320, 'dark']]) {
    await page.setViewportSize({ width, height: 812 }); await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    for (const link of await page.locator('.history a').all()) { const box = await link.boundingBox(); assert(box.height >= 44); }
    await page.screenshot({ path: `output/playwright/lookup-history-${width}-${theme}-zh-Hans-installed-offline.png`, fullPage: true });
    await page.goto(origin + '/library'); await expect(page.locator('.library-history-entry a')).toBeVisible();
    await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
    await page.screenshot({ path: `output/playwright/library-history-entry-${width}-${theme}-zh-Hans-installed-offline.png`, fullPage: true });
    await page.locator('.library-history-entry a').click(); await expect(page.locator('.history')).toHaveCount(3);
  }
  assert.deepEqual(external, []); assert.deepEqual(errors, []);
  await page.goto(origin + '/today'); await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
  console.log('PASS: normal reference downloads; actual dictionary, usage and IPA history; disconnected direct route/reload/reopen/back; no external requests/autoplay; 44px targets, two widths/themes and Today.');
} finally { await context.close(); await browser.close(); }
