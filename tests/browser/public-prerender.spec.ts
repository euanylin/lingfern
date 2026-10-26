import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { publicPages, prerenderPath } from '../../src/shared/seo';

const origin = 'http://127.0.0.1:8787';
const paths = Object.keys(publicPages);

test('a failed public route chunk keeps the existing retry and recovers after reload', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'zh-CN', serviceWorkers: 'block' });
  const page = await context.newPage();
  let blocked = true;
  await page.route('**/assets/Dictionary-*.js', route => blocked ? route.abort('failed') : route.continue());
  try {
    await page.goto(origin + '/library/dictionary');
    await expect(page.getByRole('alert')).toContainText('重试');
    blocked = false;
    await page.getByRole('button', { name: '重试', exact: true }).click();
    await page.getByRole('combobox').fill('apple');
    await page.getByRole('combobox').press('Enter');
    await expect(page.locator('.dictionary-results h3')).toHaveText('apple');
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
