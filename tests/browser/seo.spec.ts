import { expect, test } from '@playwright/test';
import { pageSeo, publicPages, siteOrigin } from '../../src/shared/seo';
import { localeDirection, localeSchema } from '../../src/shared/locale';
import { languagePacks } from '../../src/locales';
import { selectPicker } from './picker';

const origin = 'http://127.0.0.1:8787';

test('one public URL serves all fourteen descriptions with correctly varied HTML', async ({ page, context }) => {
  for (const locale of localeSchema.options) for (const path of ['/', ...Object.keys(publicPages)]) {
    const response = await context.request.get(origin + path, { headers: { Accept: 'text/html', 'Accept-Language': locale } });
    expect(response.status(), `${path}/${locale}`).toBe(200);
    expect(response.headers()['content-language']).toBe(locale);
    expect(response.headers().vary.toLowerCase()).toContain('accept-language');
    const source = await response.text();
    const document = await page.evaluate(source => {
      const doc = new DOMParser().parseFromString(source, 'text/html');
      const state = doc.querySelector('#root')?.getAttribute('data-public-page');
      return { lang: doc.documentElement.lang, dir: doc.documentElement.dir, description: doc.querySelector('meta[name=description]')?.getAttribute('content'), canonical: doc.querySelector('link[rel=canonical]')?.getAttribute('href'), alternate: doc.querySelectorAll('link[hreflang]').length, locale: state ? JSON.parse(state).locale : undefined, dictionary: doc.querySelector('.dictionary h1')?.textContent, about: doc.querySelector('.about-page')?.getAttribute('lang') };
    }, source);
    const seo = pageSeo(path, '', locale);
    expect(document).toMatchObject({ lang: locale, dir: localeDirection(locale), description: seo.description, canonical: seo.canonical, alternate: 0 });
    if (path !== '/') expect(document.locale).toBe(locale);
    if (path === '/library/dictionary') expect(document.dictionary).toBe(languagePacks[locale].dictionary.title);
    if (path === '/settings/about') expect(document.about).toBe('en');
  }
  const fallback = await context.request.get(origin + '/introduction', { headers: { 'Accept-Language': '' } });
  expect(fallback.headers()['content-language']).toBe('en');
  expect(await fallback.text()).toContain(pageSeo('/introduction').description);
});

test('metadata follows saved language changes without changing page addresses', async ({ page }) => {
  await page.goto(origin + '/settings');
  for (const locale of ['fr', 'ar'] as const) {
    await selectPicker(page, (await page.locator('.settings-language .setting-trigger').getAttribute('aria-label'))!, locale);
    await page.locator('.desktop-nav a[href="/library"]').click();
    await page.locator('a[href="/library/dictionary"]').click();
    await expect(page).toHaveURL(origin + '/library/dictionary');
    await expect(page.locator('head meta[name=description]')).toHaveAttribute('content', pageSeo('/library/dictionary', '', locale).description);
    await page.reload();
    await expect(page.locator('head meta[name=description]')).toHaveAttribute('content', pageSeo('/library/dictionary', '', locale).description);
    await expect(page.locator('html')).toHaveAttribute('dir', localeDirection(locale));
    await page.locator('.desktop-nav a[href="/settings"]').click();
  }
});

test('raw HTML exposes accurate public metadata and keeps personal routes unindexed', async ({ page, context }) => {
  const paths = ['/', ...Object.keys(publicPages), '/today', '/settings', '/progress', '/start', '/library', '/library/saved', '/library/history', '/learn/synthetic-private-id', '/library/dictionary?q=synthetic-secret-query'];
  for (const path of paths) {
    const response = await context.request.get(origin + path, { headers: { Accept: 'text/html', ...(path === '/' ? {} : { 'If-None-Match': '*', Range: 'bytes=0-4' }) } });
    expect(response.status()).toBe(200);
    const html = await response.text(), url = new URL(path, origin), seo = pageSeo(url.pathname, url.search);
    const metadata = await page.evaluate(source => {
      const document = new DOMParser().parseFromString(source, 'text/html');
      return { title: document.title, description: document.querySelector('meta[name=description]')?.getAttribute('content'), robots: document.querySelector('meta[name=robots]')?.getAttribute('content'), canonical: document.querySelector('link[rel=canonical]')?.getAttribute('href') ?? null, image: document.querySelector('meta[property="og:image"]')?.getAttribute('content'), url: document.querySelector('meta[property="og:url"]')?.getAttribute('content') ?? null };
    }, html);
    expect(metadata).toEqual({ title: seo.title, description: seo.description, robots: seo.robots, canonical: seo.canonical ?? null, image: `${siteOrigin}/icon-512.png`, url: seo.canonical ?? null });
    expect(html).not.toMatch(/synthetic-private-id|synthetic-secret-query/);
    if (seo.robots.startsWith('noindex')) expect(html).not.toContain('data-public-page=');
    if (path !== '/') expect(response.headers()['x-robots-tag']).toBe(seo.robots);
    if (seo.robots.startsWith('noindex')) expect(response.headers()['cache-control']).toContain('no-store');
  }
  const head = await context.request.head(origin + '/library/ipa', { headers: { Accept: 'text/html' } });
  expect(head.status()).toBe(200); expect(head.headers()['x-robots-tag']).toBe('index, follow'); expect(await head.text()).toBe('');
  for (const accept of ['*/*', 'application/xhtml+xml']) {
    const bot = await context.request.get(origin + '/library/ipa', { headers: { Accept: accept } });
    expect(bot.status()).toBe(200);
    expect(await bot.text()).toContain('property="og:title" content="IPA pronunciation chart | Lingfern"');
  }
  expect((await context.request.get(origin + '/library/ipa', { headers: { Accept: 'application/json' } })).status()).toBe(404);
});

test('metadata follows navigation and back without duplicates, private details or CSP errors', async ({ page }) => {
  const errors: string[] = [], external: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /Content Security Policy|Refused to execute|violates.*directive/.test(message.text())) errors.push(message.text()); });
  page.on('request', request => { if (new URL(request.url()).origin !== origin) external.push(request.url()); });
  await page.goto(origin + '/library/ipa');
  await expect(page).toHaveTitle(pageSeo('/library/ipa').title);
  await page.locator('nav a[href="/settings"]:visible').first().click();
  await expect(page.locator('head meta[name=robots]')).toHaveAttribute('content', 'noindex, follow');
  await expect(page.locator('head link[rel=canonical],head meta[property="og:url"]')).toHaveCount(0);
  await page.locator('.settings-update a[href="/settings/about"]').click();
  await expect(page).toHaveTitle('About Lingfern');
  await expect(page.locator('head link[rel=canonical]')).toHaveAttribute('href', siteOrigin + '/settings/about');
  await page.goBack();
  await expect(page.locator('head meta[name=robots]')).toHaveAttribute('content', 'noindex, follow');
  await page.goto(origin + '/introduction');
  await expect(page.locator('.welcome')).toBeVisible();
  await expect(page.locator('head title')).toHaveCount(1);
  await expect(page.locator('head meta[name=description]')).toHaveCount(1);
  await expect(page.locator('head link[rel=canonical]')).toHaveCount(1);
  const structured = JSON.parse((await page.locator('head script[type="application/ld+json"]').textContent())!);
  expect(structured).toMatchObject({ '@type': 'WebSite', name: 'Lingfern', url: siteOrigin + '/' });
  expect(errors).toEqual([]); expect(external).toEqual([]);
});

test('metadata route loops keep head text bounded while preserving public and private tags', async ({ page }) => {
  await page.goto('/library');
  await expect(page.locator('.library-page-heading')).toBeVisible();
  const textNodes = () => page.evaluate(() => [...document.head.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).length);
  const before = await textNodes();
  for (let round = 0; round < 6; round++) for (const path of ['/library/dictionary', '/library']) {
    await page.evaluate(path => { history.pushState(null, '', path); dispatchEvent(new PopStateEvent('popstate')); }, path);
    await expect(page.locator(path === '/library' ? '.library-page-heading' : '.dictionary-heading')).toBeVisible();
    const seo = pageSeo(path);
    await expect(page).toHaveTitle(seo.title);
    await expect(page.locator('head title')).toHaveCount(1);
    await expect(page.locator('head meta[name=description]')).toHaveCount(1);
    await expect(page.locator('head meta[name=robots]')).toHaveAttribute('content', seo.robots);
    await expect(page.locator('head link[rel=canonical]')).toHaveCount(seo.canonical ? 1 : 0);
    if (seo.canonical) await expect(page.locator('head link[rel=canonical]')).toHaveAttribute('href', seo.canonical);
  }
  expect(await textNodes()).toBe(before);
});

test('cached shell restores correct public and private metadata while offline', async ({ page, context }) => {
  await page.goto(origin + '/settings');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.goto(origin + '/settings/about');
  await expect(page).toHaveTitle('About Lingfern');
  await expect(page.locator('head meta[name=robots]')).toHaveAttribute('content', 'index, follow');
  await page.goto(origin + '/progress');
  await expect(page.locator('head meta[name=robots]')).toHaveAttribute('content', 'noindex, follow');
  await expect(page.locator('head link[rel=canonical]')).toHaveCount(0);
});

test('cached navigation has destination metadata before client scripts can change the title', async ({ page, context }) => {
  await page.goto(origin + '/settings');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  for (const offline of [false, true]) {
    await context.setOffline(offline);
    for (const path of ['/today', '/settings', '/progress', '/settings/about', '/library/dictionary?q=synthetic-secret-query', '/introduction']) {
      const response = (await page.goto(origin + path))!;
      expect(response.fromServiceWorker()).toBe(true);
      const source = await response.text(), url = new URL(path, origin), seo = pageSeo(url.pathname, url.search);
      const metadata = await page.evaluate(source => {
        const document = new DOMParser().parseFromString(source, 'text/html');
        return { title: document.title, robots: document.querySelector('meta[name=robots]')?.getAttribute('content'), canonical: document.querySelector('link[rel=canonical]')?.getAttribute('href') ?? null };
      }, source);
      expect(metadata).toEqual({ title: seo.title, robots: seo.robots, canonical: seo.canonical ?? null });
      expect(response.headers()['x-robots-tag']).toBe(seo.robots);
      expect(response.headers()['cache-control']).toBe(seo.robots.startsWith('noindex') ? 'private, no-store' : 'no-cache');
      expect(source).not.toContain('synthetic-secret-query');
      await expect(page).toHaveTitle(seo.title);
    }
  }
});

test('protocol responses preserve errors and forbid indexing', async ({ context }) => {
  for (const [path, status] of [['/api/session', 503], ['/mcp', 503], ['/.well-known/oauth-protected-resource/mcp', 503], ['/api/unknown', 404], ['/oauth/missing', 404]] as const) {
    const response = await context.request.get(origin + path);
    expect(response.status()).toBe(status);
    expect(response.headers()['x-robots-tag']).toBe('noindex, nofollow');
    expect(response.headers()['content-type']).toContain('application/json');
  }
  const missing = await context.request.get(origin + '/missing-seo-page', { headers: { Accept: 'text/html' } });
  expect(missing.status()).toBe(404);
});
