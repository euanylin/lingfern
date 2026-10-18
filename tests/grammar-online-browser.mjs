import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
const origin = 'http://127.0.0.1:8787';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ locale: 'zh-CN', viewport: { width: 375, height: 812 } });
const page = await context.newPage();
const external = [];
await context.route('**/*', route => {
  if (route.request().url().startsWith(origin + '/')) return route.continue();
  external.push(route.request().url());
  return route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>External navigation intercepted</h1>' });
});
try {
  await page.goto(origin + '/library/grammar');
  await expect(page.locator('.grammar-results details').first()).toBeVisible();
  await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistration())?.active?.state === 'activated');
  await page.reload();
  await page.goto(origin + '/library');
  const grammarPack = page.locator('.package-row').filter({ hasText: '英语用法词典' });
  await grammarPack.getByRole('checkbox').check();
  await page.getByRole('button', { name: '下载所选资源', exact: true }).click();
  await expect(grammarPack).toContainText('已安装');
  await page.goto(origin + '/library/grammar');
  for (const [locale, language, label] of [['zh-Hans', '语言', '剑桥语法查询'], ['en', '语言', 'Cambridge grammar'], ['zh-Hant', 'Language', '劍橋文法查詢']]) {
    if (locale !== 'zh-Hans') {
      await page.goto(origin + '/settings');
      await page.getByRole('button', { name: language, exact: true }).click();
      await page.getByRole('listbox', { name: language, exact: true }).locator(`[data-value="${locale}"]`).click();
      await expect(page.getByRole('heading', { name: locale === 'en' ? 'Settings' : '設定', exact: true })).toBeVisible();
      await page.goto(origin + '/library/grammar');
    }
    const link = page.getByRole('link', { name: label, exact: false });
    await expect(link).toHaveAttribute('href', 'https://dictionary.cambridge.org/grammar/british-grammar/');
    await page.getByRole('searchbox').fill('  present perfect & "since"  ');
    const href = new URL(await link.getAttribute('href'));
    assert.equal(href.origin, 'https://dictionary.cambridge.org');
    assert.equal(href.pathname, '/search/direct/');
    assert.equal(href.searchParams.get('datasetsearch'), 'british-grammar');
    assert.equal(href.searchParams.get('q'), 'present perfect & "since"');
    assert.equal(external.length, 0);
    for (const width of [1440, 1200, 1024, 768, 375, 320]) {
      await page.setViewportSize({ width, height: 812 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
  }
  const popupPromise = context.waitForEvent('page');
  await page.getByRole('link', { name: '劍橋文法查詢', exact: false }).click();
  const popup = await popupPromise;
  await expect(popup.getByRole('heading')).toHaveText('External navigation intercepted');
  assert.equal(await popup.evaluate(() => window.opener), null);
  await popup.close();
  assert.equal(external.length, 1);
  await context.setOffline(true);
  await expect(page.locator('.online-lookup-disabled')).toHaveAttribute('aria-disabled', 'true');
  await page.getByRole('searchbox').fill('since / for');
  await expect(page.locator('.grammar-results details')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.grammar-results details').first()).toBeVisible();
  await expect(page.locator('.online-lookup-disabled')).toBeVisible();
  await page.screenshot({ path: 'output/playwright/grammar-online-375-light-zh-Hant-offline.png', animations: 'disabled' });
  await page.goto(origin + '/today');
  await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
  console.log('PASS: three languages, six widths, encoded grammar query, explicit isolated new-tab navigation only, offline search/reload, Today. External result intercepted; live Cambridge endpoint verified separately.');
} finally { await browser.close(); }
