import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { publicPages, prerenderPath } from '../../src/shared/seo';

const origin = 'http://127.0.0.1:8787';
const paths = Object.keys(publicPages);

test('public preview chunks download while the main view is pending', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'zh-CN', serviceWorkers: 'block' });
  const page = await context.newPage(), requested = new Set<string>(), errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/assets/*.js', async route => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1)!;
    for (const chunk of ['messages-zh-Hans', 'Welcome', 'GithubIdentity', 'ProfileBackup', 'SyncConflicts']) if (name.startsWith(chunk + '-')) requested.add(chunk);
    if (name.startsWith('Welcome-')) await pending;
    await route.continue();
  });
  try {
    await page.goto(origin + '/introduction', { waitUntil: 'commit' });
    await expect(page.locator('.welcome-caption')).toBeVisible();
    await expect.poll(() => [...requested].sort()).toEqual(['GithubIdentity', 'ProfileBackup', 'SyncConflicts', 'Welcome', 'messages-zh-Hans']);
    release();
    await expect(page.locator('#root')).not.toHaveAttribute('data-public-page');
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hans');
    await page.locator('.welcome-start').click();
    await expect(page).toHaveURL(/\/start$/);
    expect(errors).toEqual([]);
  } finally { release(); await page.unrouteAll({ behavior: 'wait' }); await context.close(); }
});

test('reference and settings pages keep quotation data unloaded', async ({ browser }) => {
  for (const path of ['/library/dictionary', '/library/ipa', '/library/grammar', '/settings', '/settings/about']) {
    const context = await browser.newContext({ locale: 'en-US', serviceWorkers: 'block' });
    const page = await context.newPage(), quotes: string[] = [];
    page.on('request', request => { if (/\/assets\/(?:dailyQuoteOnDemand|daily-quote-index|\d{3})-/.test(new URL(request.url()).pathname)) quotes.push(request.url()); });
    try {
      await page.goto(origin + path);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('head link[rel="modulepreload"][href*="/daily-quote-index-"]')).toHaveCount(0);
      await expect(page.locator('#root')).not.toHaveAttribute('data-public-page');
      expect(quotes, path).toEqual([]);
    } finally { await context.close(); }
  }
});

test('a failed public route chunk keeps the existing retry and recovers after reload', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'zh-CN', serviceWorkers: 'block' });
  const page = await context.newPage();
  let blocked = true;
  const requests: { url: string; type: string; blocked: boolean }[] = [];
  await page.route('**/assets/Dictionary-*.js', route => {
    requests.push({ url: route.request().url(), type: route.request().resourceType(), blocked });
    return blocked ? route.abort('failed') : route.continue();
  });
  const theme = (write = false) => page.evaluate(write => new Promise<string | undefined>((resolve, reject) => {
    const request = indexedDB.open('lingfern'); request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result, transaction = database.transaction('settings', write ? 'readwrite' : 'readonly');
      const store = transaction.objectStore('settings'), key = 'profile:local-guest:theme';
      let value: string | undefined;
      if (write) { store.put({ key, value: 'dark' }); value = 'dark'; }
      else { const result = store.get(key); result.onsuccess = () => { value = result.result?.value; }; }
      transaction.oncomplete = () => { database.close(); resolve(value); };
      transaction.onerror = transaction.onabort = () => { database.close(); reject(transaction.error); };
    };
  }), write);
  try {
    await page.goto(origin + '/library/dictionary');
    await expect(page.getByRole('alert')).toContainText('重试');
    expect(requests.some(request => request.blocked)).toBe(true);
    expect(await theme(true)).toBe('dark');
    blocked = false;
    await page.getByRole('button', { name: '重试', exact: true }).click();
    await page.getByRole('combobox').fill('apple');
    await page.getByRole('combobox').press('Enter');
    await expect(page.locator('.dictionary-results h3')).toHaveText('apple');
    expect(requests.some(request => !request.blocked && request.type === 'fetch')).toBe(true);
    expect(new Set(requests.map(request => request.url)).size).toBe(1);
    expect(await theme()).toBe('dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page).toHaveURL(origin + '/library/dictionary');
  } finally { await context.close(); }
});

test('a continuing module failure keeps its error until another explicit retry and preserves the current URL', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'zh-CN', serviceWorkers: 'block' }), page = await context.newPage();
  const url = origin + '/library/dictionary?from=synthetic-module-retry#preserved';
  let blocked = true, navigations = 0, recoveryRequests = 0;
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations++; });
  await page.route('**/assets/Dictionary-*.js', route => {
    if (route.request().resourceType() === 'fetch') recoveryRequests++;
    return blocked ? route.fulfill({ status: 503, contentType: 'text/javascript', headers: { 'Cache-Control': 'no-store' }, body: '/* Synthetic temporary failure. */' }) : route.continue();
  });
  try {
    await page.goto(url);
    await expect(page.getByRole('alert')).toContainText('重试');
    const retry = page.getByRole('button', { name: '重试', exact: true });
    await retry.focus(); await page.keyboard.press('Enter');
    await expect.poll(() => recoveryRequests).toBe(1);
    await expect(retry).toBeEnabled();
    await expect(page.getByRole('alert')).toBeVisible();
    expect(navigations).toBe(1); await expect(page).toHaveURL(url);
    blocked = false;
    await retry.focus(); await page.keyboard.press('Enter');
    await page.getByRole('combobox').fill('apple'); await page.getByRole('combobox').press('Enter');
    await expect(page.locator('.dictionary-results h3')).toHaveText('apple');
    expect(recoveryRequests).toBe(2); expect(navigations).toBe(2);
    await expect(page).toHaveURL(url);
  } finally { await context.close(); }
});

test('both simple IPA controls wait for local storage and recover through its existing retry', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'zh-CN', serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.addInitScript(() => {
    const open = IDBFactory.prototype.open;
    Object.assign(window, { restoreStorage: () => { IDBFactory.prototype.open = open; } });
    IDBFactory.prototype.open = () => { throw new DOMException('Synthetic unavailable storage', 'UnknownError'); };
  });
  try {
    await page.goto(origin + '/library/ipa');
    await expect(page.locator('#root')).not.toHaveAttribute('data-public-page');
    await expect(page.getByRole('alert')).toBeVisible();
    const controls = page.locator('.ipa-entry[data-ipa=i] button');
    await expect(controls).toHaveCount(2);
    for (const control of await controls.all()) await expect(control).toBeDisabled();
    await expect(page.locator('.ipa-page audio')).not.toHaveAttribute('src');
    await page.evaluate(() => (window as unknown as { restoreStorage: () => void }).restoreStorage());
    await page.getByRole('alert').getByRole('button').click();
    for (const control of await controls.all()) await expect(control).toBeEnabled();
    await controls.first().click();
    await expect(page.locator('.ipa-page audio')).toHaveAttribute('src', /\.mp3$/);
  } finally { await context.close(); }
});

test('the normal root keeps first-visit onboarding and its saved seen state', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'zh-CN' });
  const page = await context.newPage();
  try {
    await page.goto(origin + '/');
    await expect(page).toHaveURL(/\/introduction$/);
    await expect(page.locator('.welcome-start')).toBeVisible();
    await page.locator('.welcome-start').click();
    await expect(page).toHaveURL(/\/start$/);
    await page.goto(origin + '/');
    await expect(page).toHaveURL(/\/start$/);
  } finally { await context.close(); }
});

test('canonical public documents contain the existing body without executing JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    for (const path of paths) {
      const response = await page.goto(origin + path);
      expect(response?.status()).toBe(200);
      await expect(page.locator('#root h1').first()).toBeVisible();
      await expect(page.locator('#root')).toHaveAttribute('data-public-page', /"path"/);
      if (path === '/library/grammar') expect(await page.locator('.grammar-results>details').count()).toBe(JSON.parse(readFileSync('public/grammar/entries.json', 'utf8')).entries.length);
      if (path === '/library/ipa') expect(await page.locator('.ipa-entry').count()).toBeGreaterThan(30);
      if (path === '/settings/about') await expect(page.locator('.about-projects')).toContainText('React');
      if (path === '/introduction') await expect(page.locator('.welcome-caption')).toContainText('Today');
    }
    const internal = await context.request.get(origin + prerenderPath('/library/ipa'));
    expect(internal.headers()['x-robots-tag']).toContain('noindex');
  } finally { await context.close(); }
});

test('hydrated public views keep their existing appearance', async ({ browser }) => {
  for (const path of paths) {
    const context = await browser.newContext({ locale: 'en-US', reducedMotion: 'reduce', serviceWorkers: 'block', viewport: { width: path === '/introduction' ? 390 : 1440, height: 844 } });
    const page = await context.newPage(), samples: Buffer[] = [], geometry: unknown[] = [];
    try {
      for (const [index, query] of ['', '?visual-check=1'].entries()) {
        await page.goto(origin + path + query);
        await page.waitForLoadState('networkidle'); await page.evaluate(() => document.fonts.ready);
        const suffix = path.replaceAll('/', '-');
        samples.push(await page.screenshot({ path: `output/playwright/prerender${suffix}-${index}.png`, animations: 'disabled' }));
        if (path === '/introduction') geometry.push(await page.locator('.welcome-stage,.welcome-caption').evaluateAll(elements => elements.map(element => element.getBoundingClientRect().toJSON())));
      }
      if (path === '/introduction') expect(geometry[0]).toEqual(geometry[1]);
      else expect(samples[0].equals(samples[1]), path).toBe(true);
    } finally { await context.close(); }
  }
});

test('a saved profile and RTL preferences load before public actions write records', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'zh-CN', serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    await page.goto(origin + '/today');
    await expect(page.getByRole('heading', { name: '练习', exact: true })).toBeVisible();
    await page.evaluate(() => new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('lingfern');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result, transaction = db.transaction(['profiles', 'settings'], 'readwrite');
        transaction.objectStore('profiles').put({ id: 'seo-synthetic', name: 'Synthetic public test', createdAt: new Date().toISOString() });
        for (const [key, value] of [['activeProfile', 'seo-synthetic'], ['profile:seo-synthetic:locale', 'ar'], ['profile:seo-synthetic:theme', 'dark']]) transaction.objectStore('settings').put({ key, value });
        transaction.oncomplete = () => { db.close(); resolve(); }; transaction.onerror = () => { db.close(); reject(transaction.error); };
      };
    }));
    await page.goto(origin + '/library/dictionary');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('combobox').fill('apple'); await page.getByRole('combobox').press('Enter');
    await expect(page.locator('.dictionary-results h3')).toHaveText('apple');
    expect(await page.evaluate(() => new Promise<Record<string, number>>((resolve, reject) => {
      const request = indexedDB.open('lingfern'); request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result, transaction = db.transaction('syncEvents'), read = transaction.objectStore('syncEvents').getAll();
        transaction.oncomplete = () => { const lookups = read.result.filter(row => row.type === 'lookup'); db.close(); resolve(Object.fromEntries(['local-guest', 'seo-synthetic'].map(id => [id, lookups.filter(row => row.profileId === id).length]))); };
        transaction.onerror = () => { db.close(); reject(transaction.error); };
      };
    }))).toEqual({ 'local-guest': 0, 'seo-synthetic': 1 });
  } finally { await context.close(); }
});

for (const path of paths) test(`public markup hydrates without replacement or errors: ${path}`, async ({ browser }) => {
  const context = await browser.newContext({ locale: 'zh-CN', viewport: { width: path === '/introduction' ? 390 : 1440, height: 844 } });
  const page = await context.newPage(), errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && /hydration|hydrating|Minified React error|Content Security Policy|violates.*directive/i.test(message.text())) errors.push(message.text()); });
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/assets/*.js', async route => { await pending; await route.continue(); });
  try {
    await page.goto(origin + path, { waitUntil: 'commit' });
    await expect(page.locator('#root h1').first()).toBeVisible();
    await page.evaluate(() => { (window as unknown as { originalHeading: Element | null }).originalHeading = document.querySelector('#root h1'); });
    release();
    try { await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hans'); }
    catch (error) { await test.info().attach('hydration-errors', { body: JSON.stringify(errors), contentType: 'application/json' }); throw error; }
    await expect(page.locator('#root')).not.toHaveAttribute('data-public-page');
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => (window as unknown as { originalHeading: Element | null }).originalHeading === document.querySelector('#root h1'))).toBe(true);
    if (path === '/library/dictionary') {
      await page.getByRole('combobox').fill('apple'); await page.getByRole('combobox').press('Enter');
      await expect(page.locator('.dictionary-results h3')).toHaveText('apple');
    } else if (path === '/library/grammar') {
      await page.getByRole('searchbox').fill('each');
      await page.locator('#grammar-each-every>summary').click();
      await expect(page.locator('#grammar-each-every .grammar-detail')).toBeVisible();
    } else if (path === '/library/ipa') {
      await page.locator('.ipa-entry[data-ipa=i] button').first().click();
      await expect(page.locator('.ipa-page audio')).toHaveAttribute('src', /\.mp3$/);
    } else if (path === '/introduction') {
      await page.locator('.welcome-start').click();
      await expect(page).toHaveURL(/\/start$/);
    } else {
      await page.locator('.about-back').click();
      await expect(page).toHaveURL(/\/settings$/);
    }
    expect(errors).toEqual([]);
  } finally { release(); await page.unrouteAll({ behavior: 'wait' }); await context.close(); }
});

for (const [part, asset] of [
  ['index', /\/assets\/(?:dailyQuoteOnDemand|daily-quote-index)-[^/?]+\.js(?:\?.*)?$/],
  ['chunk', /\/assets\/\d{3}-[^/?]+\.js(?:\?.*)?$/],
] as const) test(`a failed Introduction quotation ${part} keeps welcome controls usable and recovers through its retry`, async ({ browser }) => {
  const context = await browser.newContext({ locale: 'zh-CN', reducedMotion: 'reduce', serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
  const page = await context.newPage(), errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  let blocked = true, failedRequests = 0, recoveredRequests = 0;
  await page.route(asset, route => {
    if (blocked) { failedRequests++; return route.abort('failed'); }
    recoveredRequests++; return route.continue();
  });
  try {
    await page.goto(origin + '/introduction');
    await expect(page.locator('#root')).not.toHaveAttribute('data-public-page');
    const quote = page.locator('.daily-quote');
    await expect(quote.getByRole('status')).toHaveText('引文加载失败，请重新加载页面。');
    expect(errors).toEqual([]);
    expect(failedRequests).toBeGreaterThan(0);
    await expect(page.locator('.welcome-start')).toBeEnabled();
    await page.locator('.welcome-dots button').nth(1).click();
    await expect(page.locator('.welcome-card[data-current=true] .library-page')).toBeVisible();
    await page.locator('.welcome-dots button').first().click();
    await expect(quote.getByRole('status')).toBeVisible();
    blocked = false;
    await quote.getByRole('button', { name: '重试', exact: true }).click();
    await expect(quote).toHaveAttribute('data-quote-id', /^wikiquote-[a-f0-9]{64}$/);
    expect(recoveredRequests).toBeGreaterThan(0);
    const catalogue = JSON.parse(readFileSync('content/daily-quotes-runtime.json', 'utf8')) as { quotes: { id: string; text: string; pageTitle: string; locator?: string }[] };
    const id = await quote.getAttribute('data-quote-id'), displayed = catalogue.quotes.find(entry => entry.id === id);
    expect(displayed).toBeDefined();
    expect(await quote.locator('blockquote').textContent()).toBe(displayed!.text);
    await expect(quote.locator('.daily-quote-attribution a')).toHaveText(displayed!.pageTitle + (displayed!.locator ? ` · ${displayed!.locator}` : ''));
    await expect(quote.getByRole('status')).toHaveCount(0);
    await page.locator('.welcome-start').click();
    await expect(page).toHaveURL(/\/start$/);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

for (const [entry, gate] of [['/introduction', 'messages-zh-Hans'], ['/introduction', 'Welcome'], ['/', 'Welcome']]) test(`${entry === '/' ? 'First-visit root' : 'Introduction'} prepares its complete quotation while ${gate} is pending without delaying controls`, async ({ browser }) => {
  const context = await browser.newContext({ locale: 'zh-CN', reducedMotion: 'reduce', serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
  const page = await context.newPage(), requested = new Set<string>(), errors: string[] = [];
  const catalogue = JSON.parse(readFileSync('content/daily-quotes-runtime.json', 'utf8')) as { quotes: { id: string; text: string; pageTitle: string; locator?: string }[] };
  const previous = catalogue.quotes[0];
  const index = JSON.parse(readFileSync('content/daily-quote-index.json', 'utf8')) as { id: string; pageTitle: string; eligible: boolean }[];
  const calendar = JSON.parse(readFileSync('content/quote-calendar.json', 'utf8')) as { date: string; pages: string[] }[];
  const expectedDraws = 2 + Number(calendar.some(event => event.date === '10-30' && index.some(quote => quote.eligible && quote.id !== previous.id.slice(-16) && event.pages.includes(quote.pageTitle))));
  await page.clock.setSystemTime(new Date(2026, 9, 30, 12));
  await page.addInitScript(id => {
    localStorage.setItem('lingfern:last-daily-quote', id);
    let draws = 0, previousReads = 0;
    Object.assign(window, { quoteDrawCount: () => draws, quotePreviousReads: () => previousReads });
    const getItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      if (key === 'lingfern:last-daily-quote') previousReads++;
      return getItem.call(this, key);
    };
    const random = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = values => values instanceof Uint32Array && values.length === 1 ? (draws++, values[0] = 1349303770, values) : random(values);
  }, previous.id);
  page.on('pageerror', error => errors.push(error.message));
  let releaseView!: () => void, releaseQuote!: () => void;
  const viewPending = new Promise<void>(resolve => { releaseView = resolve; }), quotePending = new Promise<void>(resolve => { releaseQuote = resolve; });
  await page.route('**/assets/*.js', async route => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1)!;
    if (/^(?:dailyQuoteOnDemand|daily-quote-index)-/.test(name)) requested.add('loader');
    if (/^\d{3}-/.test(name)) { requested.add('chunk'); await quotePending; }
    if (name.startsWith(gate + '-')) { requested.add('gate'); await viewPending; }
    await route.continue();
  });
  try {
    await page.goto(origin + entry, { waitUntil: 'commit' });
    if (entry === '/introduction') await expect(page.locator('.welcome-caption')).toBeVisible();
    else await expect(page).toHaveURL(/\/introduction$/);
    await expect.poll(() => [...requested].sort()).toEqual(['chunk', 'gate', 'loader']);
    if (entry === '/introduction') await expect(page.locator('#root')).toHaveAttribute('data-public-page', /introduction/);
    expect(await page.evaluate(() => localStorage.getItem('lingfern.onboarding.seen'))).toBeNull();
    releaseView();
    await expect(page.locator('#root')).not.toHaveAttribute('data-public-page');
    const quote = page.locator('.daily-quote');
    await expect(quote.getByRole('status')).toHaveText('正在加载引文…');
    if (entry === '/introduction' && gate === 'Welcome') {
      await expect.poll(() => page.evaluate(() => (window as unknown as { quotePreviousReads: () => number }).quotePreviousReads())).toBe(2);
      expect(await page.evaluate(() => (window as unknown as { quoteDrawCount: () => number }).quoteDrawCount())).toBe(expectedDraws);
      await page.evaluate(async () => {
        for (let count = 0; count < 3; count++) document.dispatchEvent(new Event('visibilitychange'));
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      });
      expect(await page.evaluate(() => (window as unknown as { quoteDrawCount: () => number }).quoteDrawCount())).toBe(expectedDraws);
    }
    await expect(page.locator('.welcome-start')).toBeEnabled();
    await page.locator('.welcome-dots button').nth(1).click();
    await expect(page.locator('.welcome-card[data-current=true] .library-page')).toBeVisible();
    await page.locator('.welcome-dots button').first().click();
    releaseQuote();
    await expect(quote).toHaveAttribute('data-quote-id', /^wikiquote-[a-f0-9]{64}$/);
    const id = await quote.getAttribute('data-quote-id'), displayed = catalogue.quotes.find(entry => entry.id === id);
    expect(displayed).toBeDefined(); expect(id).not.toBe(previous.id);
    expect(await quote.locator('blockquote').textContent()).toBe(displayed!.text);
    expect(displayed!.text).not.toBe(previous.text);
    await expect(quote.locator('.daily-quote-attribution a')).toHaveText(displayed!.pageTitle + (displayed!.locator ? ` · ${displayed!.locator}` : ''));
    await expect.poll(() => page.evaluate(() => localStorage.getItem('lingfern:last-daily-quote'))).toBe(id);
    expect(await page.evaluate(() => (window as unknown as { quoteDrawCount: () => number }).quoteDrawCount())).toBe(expectedDraws);
    expect(await page.evaluate(() => localStorage.getItem('lingfern.onboarding.seen'))).toBeNull();
    await page.locator('.welcome-start').click();
    await expect(page).toHaveURL(/\/start$/);
    expect(await page.evaluate(() => localStorage.getItem('lingfern.onboarding.seen'))).toBe('1');
    expect(errors).toEqual([]);
  } finally { releaseView(); releaseQuote(); await page.unrouteAll({ behavior: 'wait' }); await context.close(); }
});
