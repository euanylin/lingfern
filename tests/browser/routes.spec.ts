import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

test('page links use clean URLs and support direct entry, refresh, back', async ({ page }) => {
  await page.goto('/today');
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole('heading', { name: '今日' })).toBeVisible();
  await page.evaluate(() => { (window as Window & { routeMarker?: boolean }).routeMarker = true; });
  await page.getByRole('link', { name: '资料库', exact: true }).first().click();
  await expect(page).toHaveURL(/\/library$/);
  expect(await page.evaluate(() => (window as Window & { routeMarker?: boolean }).routeMarker)).toBe(true);
  await page.goBack();
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.locator('a[href="/tests"], .today-tests, .test-centre')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '综合训练', exact: true })).toBeVisible();
  await page.goto('/library/ipa');
  await expect(page.getByRole('heading', { name: 'IPA 发音表' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'IPA 发音表' })).toBeVisible();
});

test('search-engine sitemap returns XML without a user-facing page', async ({ page, context }) => {
  const origin = 'http://127.0.0.1:8787';
  const xml = await readFile('public/sitemap.xml', 'utf8');
  for (const path of ['/sitemap', '/sitemap.xml']) {
    for (const accept of ['text/html', 'application/xml']) {
      const response = await context.request.get(origin + path, { headers: { Accept: accept } });
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toMatch(/^application\/xml/);
      expect(response.headers()['cache-control']).toContain('max-age=3600');
      expect(await response.text()).toBe(xml);
    }
    const head = await context.request.head(origin + path);
    expect(head.status()).toBe(200);
    expect(head.headers()['content-type']).toMatch(/^application\/xml/);
    expect(await head.text()).toBe('');
  }
  const parsed = await page.evaluate(source => {
    const document = new DOMParser().parseFromString(source, 'application/xml');
    return {
      errors: document.querySelectorAll('parsererror').length,
      root: document.documentElement.localName,
      namespace: document.documentElement.namespaceURI,
      urls: [...document.getElementsByTagNameNS('http://www.sitemaps.org/schemas/sitemap/0.9', 'loc')].map(item => item.textContent),
    };
  }, xml);
  expect(parsed).toEqual({ errors: 0, root: 'urlset', namespace: 'http://www.sitemaps.org/schemas/sitemap/0.9', urls: [
    'https://lingfern.com/introduction', 'https://lingfern.com/library/dictionary', 'https://lingfern.com/library/ipa', 'https://lingfern.com/library/grammar', 'https://lingfern.com/settings/about',
  ] });
  const robots = await context.request.get(origin + '/robots.txt');
  expect(robots.status()).toBe(200);
  expect(robots.headers()['content-type']).toMatch(/^text\/plain/);
  expect(await robots.text()).toBe('Sitemap: https://lingfern.com/sitemap.xml\n');
  for (const path of ['/sitemap/missing', '/sitemap.xml/missing', '/sitemaps']) {
    expect((await context.request.get(origin + path, { headers: { Accept: 'text/html' } })).status()).toBe(404);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(origin + '/settings');
  await expect(page.locator('.settings-update a')).toHaveAttribute('href', '/settings/about');
  await expect(page.locator('a[href="/sitemap"], a[href="/sitemap.xml"]')).toHaveCount(0);
  await page.screenshot({ path: 'output/playwright/settings-without-sitemap.png', fullPage: true });
  await page.goto(origin + '/today');
  await expect(page.getByRole('heading', { name: '练习', exact: true })).toBeVisible();
  const serviceWorker = await context.request.get(origin + '/sw.js');
  expect(serviceWorker.status()).toBe(200);
  const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
  expect(hash(await serviceWorker.body())).toBe(hash(await readFile('dist/sw.js')));
});
