import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
const origin = 'http://127.0.0.1:8787';
const paths = ['/introduction', '/start', '/today', '/progress', '/library', '/library/dictionary', '/library/saved', '/library/ipa', '/library/grammar', '/library/history', '/settings', '/settings/about'];

for (const controlled of [false, true]) test(`canonical routes and valid saved practice: SW ${controlled}`, async ({ browser }) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({ baseURL: origin, locale: 'zh-CN', serviceWorkers: controlled ? 'allow' : 'block' });
  const page = await context.newPage();
  try {
    await page.goto('/today'); await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
    if (controlled) {
      await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
      await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    }
    const raw = JSON.parse(readFileSync('tests/fixtures/content/a1-reading.json', 'utf8'));
    const id = await page.evaluate(async lesson => {
      const id = crypto.randomUUID(), contentHash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(lesson))))].map(value => value.toString(16).padStart(2, '0')).join('');
      await new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('lingfern'); open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result, tx = db.transaction('sessions', 'readwrite');
          tx.objectStore('sessions').add({ id, profileId: 'local-guest', lesson, contentHash, position: 0, status: 'active', draft: 1, startedAt: new Date().toISOString(), assistance: { hintLevel: 0 }, leaseUntil: 0 });
          tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => { db.close(); reject(tx.error); };
        };
      }); return id;
    }, raw);
    for (const offline of controlled ? [false, true] : [false]) {
      await context.setOffline(offline);
      for (const path of [...paths, `/learn/${id}`]) {
        const response = (await page.goto(path + '/?from=route%20test&x=1'))!;
        expect(response.status()).toBe(200);
        await expect(page).toHaveURL(origin + path + '?from=route%20test&x=1');
        expect(response.fromServiceWorker()).toBe(controlled);
        if (path.startsWith('/learn/')) {
          await expect(page.locator('.material-workspace')).toBeVisible();
          const refreshed = (await page.reload())!; expect(refreshed.status()).toBe(200);
          await expect(page.locator('.material-workspace')).toBeVisible();
        }
      }
    }
    await context.setOffline(false);
    for (const path of ['/missing-page', '/missing.html', '/library/missing', '/settings/missing', '/tasks', '/tests']) {
      const response = (await page.goto(path))!; expect(response.status()).toBe(404);
      await expect(page.getByRole('heading', { name: '找不到页面' })).toBeVisible();
      await expect(page.getByRole('link', { name: '返回今日' })).toHaveAttribute('href', '/today');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    for (const path of paths) {
      const response = await context.request.get(path + '/?q=one%20two&x=1', { maxRedirects: 0 });
      expect(response.status()).toBe(301); expect(response.headers().location).toBe(origin + path + '?q=one%20two&x=1');
    }
    for (const path of ['/api/missing', '/oauth/missing']) {
      const response = await context.request.get(path, { headers: { Accept: 'text/html' } });
      expect(response.status()).toBe(404); expect(response.headers()['content-type']).toContain('application/json');
    }
    for (const path of ['/missing.js', '/missing.zip', '/audio/missing.mp3']) expect((await context.request.get(path)).status()).toBe(404);
    for (const path of ['/favicon.ico', '/apple-touch-icon.png']) expect((await context.request.get(path)).status()).toBe(200);
    await page.setViewportSize({ width: 320, height: 640 }); await page.goto('/missing-page');
    await page.screenshot({ path: `output/playwright/not-found-sw-${controlled}.png` });
    await page.getByRole('link', { name: '返回今日' }).click(); await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
  } finally { await context.close(); }
});
