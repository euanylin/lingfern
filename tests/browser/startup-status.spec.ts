import { expect, test } from '@playwright/test';
import { languagePacks } from '../../src/locales';
import { selectPicker } from './picker';

test('startup opens local storage while interface loading waits without showing fallback-language controls', async ({ page }) => {
  await page.addInitScript(() => {
    const open = IDBFactory.prototype.open;
    Object.assign(window, { startupDbOpens: 0 });
    IDBFactory.prototype.open = function(...args) {
      if (args[0] === 'lingfern') (window as unknown as { startupDbOpens: number }).startupDbOpens++;
      return open.apply(this, args);
    };
  });
  await page.route(/\/src\/locales\/index\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}\nconst originalLoad = loadUiLocale; loadUiLocale = async (...args) => { if (!window.releaseStartupLocale) await new Promise(resolve => window.releaseStartupLocale = resolve); return originalLoad(...args); };` });
  });
  await page.goto('/today', { waitUntil: 'commit' });
  await expect.poll(() => page.evaluate(() => typeof (window as unknown as { releaseStartupLocale?: unknown }).releaseStartupLocale)).toBe('function');
  await expect.poll(() => page.evaluate(() => (window as unknown as { startupDbOpens: number }).startupDbOpens)).toBeGreaterThan(0);
  await expect(page.locator('main')).toHaveCount(0);
  await page.evaluate(() => (window as unknown as { releaseStartupLocale: () => void }).releaseStartupLocale());
  await expect(page.locator('#practice-section-title')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hans');
});

test('quote overflow ignores viewport-only events but responds to actual width and font changes', async ({ page }) => {
  await page.goto('/today');
  const quote = page.locator('.daily-quote[data-quote-id] blockquote');
  await expect(quote).toBeVisible();
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const reads = await page.evaluate(() => {
    const target = document.querySelector('.daily-quote blockquote'), original = window.getComputedStyle;
    const state = { reads: 0 };
    (window as unknown as { quoteLayoutReads: typeof state }).quoteLayoutReads = state;
    window.getComputedStyle = (...args) => { if (args[0] === target) state.reads++; return original(...args); };
    for (let index = 0; index < 30; index++) { window.dispatchEvent(new Event('resize')); visualViewport?.dispatchEvent(new Event('resize')); }
    return state.reads;
  });
  expect(reads).toBe(0);
  await page.evaluate(() => document.fonts.dispatchEvent(new Event('loadingdone')));
  await expect.poll(() => page.evaluate(() => (window as unknown as { quoteLayoutReads: { reads: number } }).quoteLayoutReads.reads)).toBeGreaterThan(0);
  await page.evaluate(() => { (window as unknown as { quoteLayoutReads: { reads: number } }).quoteLayoutReads.reads = 0; });
  await page.setViewportSize({ width: 390, height: 780 });
  await expect.poll(() => page.evaluate(() => (window as unknown as { quoteLayoutReads: { reads: number } }).quoteLayoutReads.reads)).toBeGreaterThan(0);
  const overflowing = await quote.evaluate(element => element.scrollHeight > parseFloat(getComputedStyle(element).lineHeight) * 4 + 1);
  await expect(page.locator('.daily-quote .update-action')).toHaveCount(overflowing ? 1 : 0);
});

test('network and fern presentation changes reuse unchanged learning progress', async ({ page }) => {
  await page.route(/\/src\/data\/progress\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}\nwindow.progressReads = { records: 0, activity: 0 }; const originalRecords = progressRecords, originalActivity = fernActivity; progressRecords = (...args) => { if (!args[0].length) window.progressReads.records++; return originalRecords(...args); }; fernActivity = (...args) => { window.progressReads.activity++; return originalActivity(...args); };` });
  });
  await page.goto('/today'); await expect(page.locator('.daily-quote[data-quote-id]')).toBeVisible();
  await page.waitForLoadState('networkidle');
  const counts = () => page.evaluate(() => (window as unknown as { progressReads: { records: number; activity: number } }).progressReads);
  const before = await counts();
  expect(before.records).toBeGreaterThan(0); expect(before.activity).toBeGreaterThan(0);
  await page.evaluate(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, value: false }); dispatchEvent(new Event('offline')); });
  await expect(page.locator('.network-status')).toHaveText(languagePacks['zh-Hans'].app.offline);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.today-hero .fern')).toHaveAttribute('data-motion', 'reduced');
  expect(await counts()).toEqual(before);
  await page.getByRole('link', { name: '资料库', exact: true }).filter({ visible: true }).click();
  await expect(page.locator('.library-page')).toBeVisible();
  await page.getByRole('link', { name: '今日', exact: true }).filter({ visible: true }).click();
  await expect(page.locator('#practice-section-title')).toBeVisible();
  await expect.poll(async () => (await counts()).records).toBeGreaterThan(before.records);
});

test('installed cache readiness requires every native request key and its completion marker', async ({ page }) => {
  await page.goto('/today'); await expect(page.locator('#practice-section-title')).toBeVisible();
  const result = await page.evaluate(async () => {
    const { communityCacheName, communityMarker, communityPackageReady } = await import('/src/data/communityInstall.ts' as string);
    const hash = 'e'.repeat(64), name = communityCacheName(hash), paths = [0, 1].map(index => `/audio/community-${hash}/synthetic-${index}.mp3`);
    const cache = await caches.open(name), pack = { hash, lessons: [], spoken: { records: [{ clips: paths.map(src => ({ audio: { src } })) }] } };
    try {
      await cache.put(communityMarker(hash), new Response('ready'));
      for (const path of paths) await cache.put(path, new Response(new Uint8Array(32)));
      const ready = await communityPackageReady(pack);
      await cache.delete(paths[0]); const missing = await communityPackageReady(pack);
      await cache.put(paths[0], new Response(new Uint8Array(32))); await cache.delete(communityMarker(hash));
      const unmarked = await communityPackageReady(pack);
      await caches.delete(name); const absent = await communityPackageReady(pack);
      return { ready, missing, unmarked, absent };
    } finally { await caches.delete(name); }
  });
  expect(result).toEqual({ ready: true, missing: false, unmarked: false, absent: false });
});

test('startup prepares locale beside records and an obsolete load cannot replace a newly selected profile', async ({ page }) => {
  await page.goto('/settings'); await expect(page.locator('.settings-page')).toBeVisible();
  await page.evaluate(async () => {
    const { profiles, settings, saveSetting, savePreferences } = await import('/src/data/db.ts' as string);
    await savePreferences('local-guest', { interests: [], step: 4, completed: true }, 'ar');
    await saveSetting('local-guest', 'locale', 'ar');
    await profiles.add({ id: 'isolated-next-profile', name: 'Next profile', createdAt: new Date().toISOString(), preferences: { interests: [], step: 4, completed: true } });
    await settings.put({ key: 'profile:isolated-next-profile:locale', value: 'en' });
  });
  let teachingRequested = false;
  await page.route(/\/src\/locales\/ar\/teaching\.json(?:\?.*)?$/, async route => { teachingRequested = true; await route.continue(); });
  await page.route(/\/src\/data\/progress\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}\nconst originalMerge = mergeLearningRecords; mergeLearningRecords = async (...args) => { if (!window.mergeHeld) { window.mergeHeld = true; await new Promise(resolve => window.releaseMerge = resolve); const result = await originalMerge(...args); window.mergeReleased = true; return result; } return originalMerge(...args); };` });
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => typeof (window as unknown as { releaseMerge?: unknown }).releaseMerge)).toBe('function');
  expect(teachingRequested).toBe(true);
  await page.evaluate(async () => {
    const { settings } = await import('/src/data/db.ts' as string);
    await settings.put({ key: 'activeProfile', value: 'isolated-next-profile' });
    history.pushState(null, '', '/today'); dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.locator('#practice-section-title')).toBeVisible(); await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.evaluate(() => (window as unknown as { releaseMerge: () => void }).releaseMerge());
  await expect.poll(() => page.evaluate(() => (window as unknown as { mergeReleased?: boolean }).mergeReleased)).toBe(true);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  expect(await page.evaluate(async () => (await (await import('/src/data/db.ts' as string)).settings.get('activeProfile')).value)).toBe('isolated-next-profile');
});

for (const [locale, width, colorScheme] of [['zh-Hans', 390, 'dark'], ['en', 1440, 'light'], ['ar', 375, 'dark']] as const) {
  test(`network status stays outside content and clears after each change: ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ colorScheme, reducedMotion: locale === 'ar' ? 'reduce' : 'no-preference' });
    await page.goto('/settings');
    await expect(page.locator('.settings-language .setting-trigger')).toBeVisible();
    if (locale !== 'zh-Hans') await selectPicker(page, (await page.locator('.settings-language .setting-trigger').getAttribute('aria-label'))!, locale);
    const status = page.locator('.network-status');
    await expect(status).toBeEmpty();
    await page.addInitScript(() => Object.defineProperty(navigator, 'onLine', { configurable: true, value: false }));
    await page.reload();
    await expect(status).toHaveText(languagePacks[locale].app.offline);
    await expect(page.locator('main > .notice:not(.update-notice)')).toHaveCount(0);
    const headingTop = (await page.locator('main h1').boundingBox())!.y;
    expect(await status.evaluate(element => getComputedStyle(element).position)).toBe('fixed');
    expect((await status.locator('.network-status-content').boundingBox())!.width).toBeLessThan(width - 32);
    if (locale === 'ar') await expect(status.locator('.network-status-content')).toHaveCSS('animation-name', 'none');
    const bar = (await status.boundingBox())!;
    if (width < 768) expect(bar.y + bar.height).toBeLessThanOrEqual((await page.locator('.mobile-nav').boundingBox())!.y);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.waitForTimeout(220);
    await page.screenshot({ path: `output/playwright/network-status-${locale}-offline.png` });
    const network = async (online: boolean) => page.evaluate(value => {
      Object.defineProperty(navigator, 'onLine', { configurable: true, value });
      window.dispatchEvent(new Event(value ? 'online' : 'offline'));
    }, online);
    await network(true);
    await expect(status).toHaveText(languagePacks[locale].app.online);
    expect((await page.locator('main h1').boundingBox())!.y).toBe(headingTop);
    await page.waitForTimeout(220);
    await page.screenshot({ path: `output/playwright/network-status-${locale}-online.png` });
    await network(false);
    await expect(status).toHaveText(languagePacks[locale].app.offline);
    await page.waitForTimeout(3100);
    await expect(status).toHaveText(languagePacks[locale].app.offline);
    await expect(status).toBeEmpty({ timeout: 2000 });
    await page.getByRole('link', { name: languagePacks[locale].app.library, exact: true }).filter({ visible: true }).click();
    await expect(page.locator('main h1')).toHaveText(languagePacks[locale].app.library);
    await expect(status).toBeEmpty();
    await network(true);
    await expect(status).toHaveText(languagePacks[locale].app.online);
    await expect(status).toBeEmpty({ timeout: 5000 });
    expect(await page.pageErrors()).toEqual([]);
  });

  test(`refresh keeps the record-reading status accessible without visible text: ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ colorScheme, reducedMotion: locale === 'ar' ? 'reduce' : 'no-preference' });
    await page.goto('/settings');
    await expect(page.locator('.settings-language .setting-trigger')).toBeVisible();
    if (locale !== 'zh-Hans') await selectPicker(page, (await page.locator('.settings-language .setting-trigger').getAttribute('aria-label'))!, locale);
    await page.addInitScript(labels => {
      const statuses: { text: string; clipped: boolean }[] = [];
      Object.assign(window, { startupStatuses: statuses });
      const inspect = (node: Node) => {
        if (!(node instanceof Element)) return;
        const elements = [...node.querySelectorAll('[role=status]')];
        if (node.matches('[role=status]')) elements.push(node);
        for (const element of elements) if (labels.includes(element.textContent ?? '')) {
          const style = getComputedStyle(element);
          statuses.push({ text: element.textContent!, clipped: style.position === 'absolute' && style.clip === 'rect(0px, 0px, 0px, 0px)' });
        }
      };
      new MutationObserver(records => { for (const record of records) for (const node of record.addedNodes) inspect(node); }).observe(document, { childList: true, subtree: true });
    }, Object.values(languagePacks).map(pack => pack.app.loading));
    for (const path of ['/today', '/library', '/settings']) {
      await page.goto(path);
      for (let reload = 0; reload < 2; reload++) {
        if (reload) await page.reload();
        const route = path.slice(1) as 'today' | 'library' | 'settings';
        await expect(page.getByRole('heading', { name: languagePacks[locale].app[route], exact: true })).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('lang', locale);
        const statuses = await page.evaluate(() => (window as unknown as { startupStatuses: { text: string; clipped: boolean }[] }).startupStatuses);
        expect(statuses.length).toBeGreaterThan(0);
        expect(statuses.every(status => status.clipped)).toBe(true);
        await expect(page.locator('main > p.sr-only[role=status]')).toHaveCount(0);
        expect(await page.pageErrors()).toEqual([]);
      }
    }
    await page.screenshot({ path: `output/playwright/startup-status-${locale}-settings.png`, fullPage: true, animations: 'disabled' });
  });
}

test('a real record-read failure stays visible and retry retains the existing profile', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.locator('main h1')).toBeVisible();
  const before = await page.evaluate(async () => {
    const path = '/src/data/db.ts';
    return (await import(path)).profiles.toArray();
  });
  await page.addInitScript(() => {
    const get = IDBObjectStore.prototype.get;
    Object.assign(window, { failProfileRead: true });
    IDBObjectStore.prototype.get = function(...args) {
      if (this.name === 'profiles' && (window as unknown as { failProfileRead: boolean }).failProfileRead) throw new DOMException('Synthetic read failure', 'InvalidStateError');
      return get.apply(this, args);
    };
  });
  await page.reload();
  const alert = page.getByRole('alert');
  await expect(alert).toBeVisible();
  await expect(alert).toContainText(languagePacks['zh-Hans'].app.readError);
  await expect(alert.getByRole('button', { name: '重试', exact: true })).toBeEnabled();
  await page.evaluate(() => { Object.assign(window, { failProfileRead: false }); });
  await alert.getByRole('button', { name: '重试', exact: true }).click();
  await expect(page.locator('main h1')).toBeVisible();
  await expect(alert).toHaveCount(0);
  expect(await page.evaluate(async () => {
    const path = '/src/data/db.ts';
    return (await import(path)).profiles.toArray();
  })).toEqual(before);
  expect(await page.pageErrors()).toEqual([]);
});
