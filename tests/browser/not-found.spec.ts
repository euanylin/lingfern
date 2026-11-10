import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

const origin = 'http://127.0.0.1:8787';
const locales = ['en', 'zh-Hans', 'zh-Hant', 'ja', 'ko', 'fr', 'es', 'de', 'pt', 'it', 'ru', 'ar', 'hi', 'id'];

test('404 and Today keep the same header geometry and appearance', async ({ browser }, info) => {
  for (const [width, colorScheme] of [[390, 'dark'], [1440, 'light']] as const) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme, locale: 'zh-CN', serviceWorkers: 'block' });
    const page = await context.newPage();
    const sample = () => page.locator('body>header,#root>header').evaluate(header => {
      const symbol = [...header.querySelectorAll<HTMLElement>('.brand-symbol')].find(el => el.getClientRects().length)!;
      const box = (el: Element) => { const { x, y, width, height } = el.getBoundingClientRect(); return { x, y, width, height }; };
      const style = getComputedStyle(symbol), backdrop = getComputedStyle(header, '::before');
      return { header: box(header), symbol: box(symbol), opacity: style.opacity, fill: style.backgroundColor, position: getComputedStyle(header).position, backdrop: backdrop.backgroundColor, blur: backdrop.backdropFilter, divider: backdrop.borderBottomColor };
    });
    try {
      expect((await page.goto(origin + '/missing-page'))!.status()).toBe(404);
      await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hans');
      await expect(page.locator('.desktop-nav')).toBeAttached();
      const missing = await sample();
      await page.evaluate(() => { Object.assign(window, { originalHeader: document.querySelector('#root>header'), pageToken: crypto.randomUUID() }); });
      const token = await page.evaluate(() => (window as unknown as { pageToken: string }).pageToken);
      let documents = 0;
      page.on('request', request => { if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents++; });
      await page.screenshot({ path: info.outputPath(`header-404-${width}.png`) });
      await page.locator('.not-found-copy .button').click();
      await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
      expect(await page.evaluate(() => (window as unknown as { pageToken: string }).pageToken)).toBe(token);
      expect(await page.evaluate(() => (window as unknown as { originalHeader: Element }).originalHeader === document.querySelector('#root>header'))).toBe(true);
      expect(documents).toBe(0);
      await expect(page.locator('body')).not.toHaveClass('not-found');
      await expect(page.locator('main')).not.toHaveClass('not-found-main');
      expect(await sample()).toEqual(missing);
      await expect.poll(() => page.locator('.today-home').evaluate(el => el.getAnimations().length)).toBe(0);
      await page.screenshot({ path: info.outputPath(`header-today-${width}.png`) });
      await page.evaluate(() => scrollTo(0, 180)); expect(await sample()).toEqual(missing);
      await page.goBack(); await expect(page.locator('.not-found-copy')).toBeVisible();
      expect(await sample()).toEqual(missing);
      expect(documents).toBe(0);
    } finally { await context.close(); }
  }
});

test('404 primary feedback matches the existing Settings action', async ({ page }, info) => {
  for (const [width, scheme] of [[390, 'dark'], [1440, 'light']] as const) {
    await page.setViewportSize({ width, height: 900 }); await page.emulateMedia({ colorScheme: scheme });
    await page.route('**/api/session', route => route.fulfill({ json: { account: null, syncAvailable: false } }));
    await page.goto(origin + '/settings');
    const action = page.locator('.github-connect'); await expect(action).toBeVisible();
    await action.press('Tab'); await page.keyboard.press('Shift+Tab'); await expect(action).toBeFocused();
    await expect.poll(() => action.evaluate(el => { void getComputedStyle(el).backgroundColor; return el.getAnimations().length; })).toBe(0);
    const appearance = (el: Element) => {
      const style = getComputedStyle(el);
      return { background: style.backgroundColor, color: style.color, outline: style.outlineStyle, shadow: style.boxShadow };
    };
    const expected = await action.evaluate(appearance);
    await page.goto(origin + '/missing-page');
    const button = page.locator('.not-found-copy .button');
    await button.press('Tab'); await page.keyboard.press('Shift+Tab'); await expect(button).toBeFocused();
    await expect.poll(() => button.evaluate(appearance)).toEqual(expected);
    await page.screenshot({ path: info.outputPath(`shared-feedback-${width}.png`) });
  }
});

test('404 keeps its English return link without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: 'block' });
  const page = await context.newPage();
  expect((await page.goto(origin + '/missing-page'))!.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await page.getByRole('link', { name: 'Back to Today' }).click();
  await expect(page).toHaveURL(origin + '/today'); await context.close();
});

test('404 follows all fourteen browser languages with real errors and usable layouts', async ({ browser }, info) => {
  for (const [index, locale] of locales.entries()) {
    const width = index % 2 ? 390 : 1440;
    const context = await browser.newContext({ locale, viewport: { width, height: 900 }, colorScheme: index % 3 ? 'dark' : 'light', serviceWorkers: 'block' });
    const page = await context.newPage(), errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const response = (await page.goto(origin + '/missing-page'))!;
    expect(response.status()).toBe(404);
    await expect(page.locator('.desktop-nav')).toBeAttached();
    const pack = JSON.parse(readFileSync(`src/locales/${locale}/messages.json`, 'utf8'));
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
    await expect(page.locator('h1')).toHaveText(pack.notFound.title);
    await expect(page.locator('.not-found-description')).toHaveText(pack.notFound.description);
    const button = page.locator('.not-found-copy .button');
    await expect(button).toHaveText(pack.app.finish);
    await expect(button).toHaveAttribute('href', '/today');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(button).toHaveCSS('font-size', '15px');
    await expect(page.locator('h1')).toHaveCSS('font-size', width < 768 ? '34px' : '46px');
    if (width < 768) {
      expect((await page.locator('.not-found-copy').boundingBox())!.x).toBeCloseTo(20, 1);
      const box = (await page.locator('.mobile-brand').boundingBox())!;
      expect(box.x + box.width / 2).toBeCloseTo(width / 2, 1);
    }
    await button.press('Tab'); await page.keyboard.press('Shift+Tab');
    await expect(button).toBeFocused(); await expect(button).toHaveCSS('outline-style', 'none');
    await expect(button).toHaveCSS('text-decoration-line', 'none');
    await page.screenshot({ path: info.outputPath(`404-${locale}-${width}.png`) });
    expect(errors).toEqual([]);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(origin + '/today');
    await expect(page.locator('h1').first()).toBeVisible();
    await context.close();
  }
});

test('404 reuses saved appearance and clears touch feedback on release and cancellation', async ({ browser }, info) => {
  const context = await browser.newContext({ locale: 'en', hasTouch: true, viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const page = await context.newPage(); await page.goto(origin + '/today');
  await expect(page.locator('h1').first()).toBeVisible();
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('lingfern'); request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result, tx = database.transaction('settings', 'readwrite'), store = tx.objectStore('settings');
        const active = store.get('activeProfile');
        active.onsuccess = () => {
          for (const [key, value] of [['locale', 'zh-Hant'], ['theme', 'dark']]) store.put({ key: `profile:${active.result.value}:${key}`, value });
        };
        tx.oncomplete = () => { database.close(); resolve(); }; tx.onerror = () => reject(tx.error);
      };
    });
  });
  await page.goto(origin + '/missing-page');
  await expect(page.locator('h1')).toHaveText('找不到頁面');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const button = page.locator('.not-found-copy .button'), cdp = await context.newCDPSession(page);
  await button.evaluate(el => el.addEventListener('click', event => event.preventDefault()));
  const idle = await button.evaluate(el => getComputedStyle(el).backgroundColor), box = (await button.boundingBox())!;
  await expect(page.locator('body')).toHaveCSS('-webkit-tap-highlight-color', 'rgba(0, 0, 0, 0)');
  for (const end of ['touchEnd', 'touchCancel'] as const) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
    await expect(button).toHaveAttribute('data-touch-active', '');
    await expect(button).not.toHaveCSS('background-color', idle);
    await page.screenshot({ path: info.outputPath(`404-touch-${end}.png`) });
    await cdp.send('Input.dispatchTouchEvent', { type: end, touchPoints: [] });
    await expect(button).not.toHaveAttribute('data-touch-active');
    await expect(button).toHaveCSS('background-color', idle);
  }
  await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
  await expect(button).toBeFocused(); await expect(button).toHaveCSS('outline-style', 'none');
  await expect(button).toHaveCSS('text-decoration-line', 'none');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(button).toHaveCSS('transition-duration', '0s');
  await cdp.detach(); await context.close();
});
