import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { aboutCopy } from '../../src/app/aboutCopy';

// Static response headers require the Worker preview, rather than Vite.
test.use({ baseURL: 'http://127.0.0.1:8787', serviceWorkers: 'block' });

test('About licence links display their original text without downloading', async ({ page, baseURL }) => {
  const downloads: string[] = [];
  page.on('download', download => downloads.push(download.suggestedFilename()));
  await page.goto('/settings/about');
  await expect(page.getByRole('heading', { name: 'About', exact: true })).toBeVisible();
  await page.locator('summary').filter({ hasText: aboutCopy.quotes }).click();
  const paths = await page.locator('.about-credits a[href^="/"]').evaluateAll(links => links.map(link => link.getAttribute('href')!));
  expect(paths).toHaveLength(9);
  for (const pathname of paths) {
    const original = readFileSync(`public${pathname}`, 'utf8');
    const response = await page.request.get(pathname);
    expect(response.status(), pathname).toBe(200);
    expect(response.headers()['content-type'], pathname).toBe('text/plain; charset=utf-8');
    expect(response.headers()['content-disposition'] ?? '', pathname).not.toMatch(/attachment/i);
    expect(response.headers()['x-content-type-options'], pathname).toBe('nosniff');
    expect(await response.text(), pathname).toBe(original);
    await Promise.all([
      page.waitForURL(`${baseURL}${pathname}`),
      page.locator(`.about-credits a[href="${pathname}"]`).click(),
    ]);
    await expect(page.locator('body')).toContainText(original.split('\n').find(line => line.trim())!);
    await page.goBack();
    await expect(page.getByRole('heading', { name: 'About', exact: true })).toBeVisible();
    if (pathname === '/daily-quotes/README.md') continue;
    const quotes = page.locator('summary').filter({ hasText: aboutCopy.quotes });
    if (await quotes.locator('..').getAttribute('open') === null) await quotes.click();
  }
  expect(downloads).toEqual([]);
  const dictionary = await page.request.head('/dictionary/oewn-2025/b.json');
  expect(dictionary.headers()['content-type']).toMatch(/application\/json/);
  expect((await page.request.get('/licenses/missing-LICENSE')).status()).toBe(404);
});
