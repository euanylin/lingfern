import { expect, test } from '@playwright/test';

test('introduction reuses the startup catalogue while Library still revalidates on each visit', async ({ page }) => {
  let catalogues = 0;
  page.on('request', request => { if (new URL(request.url()).pathname === '/resources/catalogue.json') catalogues++; });
  await page.goto('/introduction');
  await expect(page.locator('.welcome-card .offline-categories')).toBeAttached();
  await page.waitForLoadState('networkidle');
  expect(catalogues).toBe(1);
  for (let visit = 2; visit <= 3; visit++) {
    await page.evaluate(() => { history.pushState(null, '', '/library'); dispatchEvent(new PopStateEvent('popstate')); });
    await expect(page.locator('.library-page-heading')).toBeVisible();
    await expect.poll(() => catalogues).toBe(visit);
    await page.waitForLoadState('networkidle');
    expect(catalogues).toBe(visit);
    await page.locator('.desktop-nav a[href="/today"]').click();
    await expect(page.locator('.today-home')).toBeVisible();
  }
});

for (const width of [390, 1440]) test(`hidden introduction settles its selected card and resumes navigation at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  await page.goto('/introduction');
  await expect(page.locator('.welcome-start')).toBeVisible();
  const hidden = await page.evaluate(() => {
    document.querySelectorAll<HTMLButtonElement>('.welcome-dots button')[1].click();
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    return { selected: document.querySelector('.welcome-card[data-current=true]')?.getAttribute('aria-label'), transform: getComputedStyle(document.querySelectorAll('.welcome-card')[1]).transform };
  });
  expect(hidden.selected).toBe(languagePacks['zh-Hans'].onboarding.slideN.replace('{n}', '2'));
  expect(hidden.transform).toBe('matrix(1, 0, 0, 1, 0, 0)');
  await page.waitForTimeout(700);
  await expect(page.locator('.welcome-card').nth(1)).toHaveCSS('transform', hidden.transform);
  await page.evaluate(() => { Reflect.deleteProperty(document, 'hidden'); Reflect.deleteProperty(document, 'visibilityState'); document.dispatchEvent(new Event('visibilitychange')); });
  await page.locator('.welcome-dots button').first().click();
  await expect(page.locator('.welcome-card').first()).toHaveAttribute('data-current', 'true');
  await expect(page.locator('.welcome-card').first()).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
});

for (const [width, height] of [[1440, 900], [390, 844], [900, 1100], [1920, 1080]]) test(`introduction card geometry is stable before the first resize observation at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height });
  await page.addInitScript(() => {
    const NativeObserver = window.ResizeObserver;
    window.ResizeObserver = class extends NativeObserver {
      constructor(callback: ResizeObserverCallback) { super((entries, observer) => setTimeout(() => callback(entries, observer), 500)); }
      observe(...args: Parameters<ResizeObserver['observe']>) {
        if (args[0].matches('.welcome-stage')) (window as unknown as { introStageObserved: boolean }).introStageObserved = true;
        super.observe(...args);
      }
    };
  });
  await page.goto('/introduction');
  const card = page.locator('.welcome-card[data-current=true]');
  await expect(card).toBeVisible();
  await page.waitForFunction(() => (window as unknown as { introStageObserved?: boolean }).introStageObserved);
  const initial = await card.boundingBox();
  await page.waitForTimeout(650);
  const measured = await card.boundingBox();
  expect(Math.abs(measured!.height - initial!.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(measured!.y - initial!.y)).toBeLessThanOrEqual(1);
});

test('introduction SSR card geometry matches hydration before the main script is released at 1920px', async ({ browser }) => {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:8787', viewport: { width: 1920, height: 1080 }, locale: 'en', serviceWorkers: 'block' });
  const page = await context.newPage();
  let releaseMain: () => void = () => undefined;
  const main = new Promise<void>(resolve => { releaseMain = resolve; });
  await page.route('**/assets/index-*.js', async route => { await main; await route.continue(); });
  try {
    await page.goto('/introduction', { waitUntil: 'commit' });
    const card = page.locator('.welcome-card[data-current=true]');
    await expect(card).toBeVisible();
    expect(await page.evaluate(() => CSS.supports('aspect-ratio', 'calc(100vw / 100dvh)'))).toBe(true);
    await expect(card).toHaveCSS('height', '578.25px');
    expect(await page.locator('.welcome').evaluate(element => (element as HTMLElement).style.getPropertyValue('--welcome-card-ratio'))).toBe('');
    const initial = await card.boundingBox();
    await test.info().attach('introduction-ssr-before-main.png', { body: await page.screenshot(), contentType: 'image/png' });
    releaseMain();
    await expect.poll(() => page.locator('.welcome').evaluate(element => (element as HTMLElement).style.getPropertyValue('--welcome-card-ratio'))).toBe(String(1920 / 1080));
    const hydrated = await card.boundingBox();
    expect(Math.abs(hydrated!.height - initial!.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(hydrated!.y - initial!.y)).toBeLessThanOrEqual(1);
    await test.info().attach('introduction-ssr-hydration-geometry', { body: JSON.stringify({ initial, hydrated }), contentType: 'application/json' });
    await test.info().attach('introduction-after-main.png', { body: await page.screenshot(), contentType: 'image/png' });
  } finally { releaseMain(); await page.unrouteAll({ behavior: 'wait' }); await context.close(); }
});

import { languagePacks } from '../../src/locales';

for (const [from, to] of [[390, 1440], [1440, 390], [900, 1440], [1440, 900]]) test(`introduction keeps current spacing when resized from ${from}px to ${to}px during a transition`, async ({ page }) => {
  await page.setViewportSize({ width: from, height: 900 });
  await page.clock.install(); await page.goto('/introduction');
  await expect(page.locator('.welcome-start')).toBeVisible();
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 1000));
  const positions = () => page.locator('.welcome-card').evaluateAll(cards => cards.map(card => new DOMMatrixReadOnly(getComputedStyle(card).transform).m41));
  await page.locator('.welcome-dots button').nth(1).evaluate(button => (button as HTMLButtonElement).click());
  await page.clock.runFor(100);
  await page.setViewportSize({ width: to, height: 900 });
  await page.clock.runFor(1000);
  const resized = await positions();
  await expect(page.locator('.welcome-card').nth(1)).toHaveAttribute('data-current', 'true');
  // Reselecting the same card must not repair stale geometry from a queued frame.
  await page.locator('.welcome-dots button').nth(1).evaluate(button => (button as HTMLButtonElement).click());
  await page.clock.runFor(1000);
  const settled = await positions();
  for (let index = 0; index < settled.length; index++) expect(Math.abs(resized[index] - settled[index])).toBeLessThanOrEqual(.1);
});

test('mobile browser-bar resizing stays in CSS while desktop height and orientation still update card geometry', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/introduction');
  await expect(page.locator('.welcome-start')).toBeVisible();
  const ratio = () => page.locator('.welcome').evaluate(element => (element as HTMLElement).style.getPropertyValue('--welcome-card-ratio'));
  const initialRatio = await ratio(), initialHeight = (await page.locator('.welcome-stage').boundingBox())!.height;
  for (const height of [744, 400, 844]) {
    await page.setViewportSize({ width: 390, height });
    await expect(page.locator('.welcome-start')).toBeInViewport({ ratio: 1 });
    expect(await ratio()).toBe(initialRatio);
    expect((await page.locator('.welcome-stage').boundingBox())!.height).toBeCloseTo(initialHeight + height - 844, 1);
  }
  await page.setViewportSize({ width: 699, height: 400 });
  await expect.poll(ratio).toBe(String(699 / 400));
  await page.setViewportSize({ width: 700, height: 844 });
  await expect.poll(ratio).toBe('0.9');
  await page.setViewportSize({ width: 700, height: 400 });
  await expect.poll(ratio).toBe('1.75');
  await expect(page.locator('.welcome-start')).toBeInViewport({ ratio: 1 });
});

for (const locale of ['zh-Hans', 'en', 'ar'] as const) test(`desktop Today heading fits fully in the introduction at ${locale}`, async ({ browser }) => {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL, locale, reducedMotion: 'reduce', colorScheme: 'dark' });
  const page = await context.newPage();
  for (const [width, height] of [[1280, 720], [1440, 740], [1440, 900], [1920, 1080]]) {
    await page.setViewportSize({ width, height }); await page.goto('/introduction');
    await expect(page.locator('.welcome-card[data-current=true] .today-hero h1')).toHaveText(languagePacks[locale].app.today);
    expect(await page.locator('.today-hero h1').evaluate(el => { const box = el.getBoundingClientRect(), frame = el.closest('.welcome-content')!.getBoundingClientRect(); return box.top >= frame.top && box.bottom <= frame.bottom; })).toBe(true);
    await expect(page.locator('.welcome-start')).toBeInViewport({ ratio: 1 });
    if (width === 1280) await page.screenshot({ path: test.info().outputPath(`desktop-heading-${locale}.png`) });
  }
  await context.close();
});

for (const width of [1440, 900, 375]) test(`pages and introduction previews share the Settings top spacing at ${width}px`, async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/settings');
  await expect(page.locator('.settings-page>h1')).toBeVisible();
  const gap = await page.locator('.settings-page>h1').evaluate(el => el.getBoundingClientRect().top - document.querySelector('#root>header')!.getBoundingClientRect().bottom);
  expect(gap).toBe(width < 768 ? 20 : 44);
  for (const [route, selector] of [
    ['/today', width < 768 ? '.today-hero .eyebrow' : '.practice-section-heading'],
    ['/library', '.library-page-heading h1'], ['/library/dictionary', '.dictionary-heading h1'],
    ['/library/ipa', '.ipa-heading h1'], ['/library/grammar', '.grammar-page>h1'],
    ['/library/saved', '.saved-words>h1'], ['/library/history', '.records-back'],
    ['/progress', '.records-back'], ['/settings/about', '.about-back'], ['/start', '.first-run-top'],
  ]) {
    await page.goto(route); await expect(page.locator(selector)).toBeVisible();
    expect(await page.locator(selector).evaluate(el => el.getBoundingClientRect().top - document.querySelector('#root>header')!.getBoundingClientRect().bottom)).toBeCloseTo(gap, 0);
  }
  await page.goto('/introduction');
  for (const [index, selector] of [[0, width < 768 ? '.today-hero .eyebrow' : '.practice-section-heading'], [1, '.library-page-heading h1'], [2, '.settings-page>h1']] as const) {
    await page.locator('.welcome-dots button').nth(index).click();
    const card = page.locator('.welcome-card[data-current=true]'); await expect(card.locator(selector)).toBeVisible();
    expect(await card.locator(selector).evaluate(el => el.getBoundingClientRect().top - el.closest('.welcome-window')!.querySelector('.welcome-site-header')!.getBoundingClientRect().bottom)).toBeCloseTo(gap, 0);
  }
});

test('first visit introduces the app before existing choices and remembers only explicit Start', async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as unknown as { entryNavigationFlashed: boolean }; state.entryNavigationFlashed = false;
    new MutationObserver(() => { if (location.pathname === '/' && document.querySelector('#root>header,#root>nav.mobile-nav')) state.entryNavigationFlashed = true; }).observe(document, { childList: true, subtree: true });
  });
  await page.goto('/'); await expect(page).toHaveURL(/\/introduction$/);
  await expect(page.locator('.welcome')).toBeVisible(); await expect(page.locator('.first-run')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { entryNavigationFlashed: boolean }).entryNavigationFlashed)).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem('lingfern.onboarding.seen'))).toBeNull();
  await page.locator('.welcome-start').click(); await expect(page).toHaveURL(/\/start$/); await expect(page.locator('.first-run')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('lingfern.onboarding.seen'))).toBe('1');
  await page.reload(); await expect(page.locator('.welcome')).toHaveCount(0);
  await page.goto('/introduction'); await expect(page.locator('.welcome')).toBeVisible(); await page.reload(); await expect(page.locator('.welcome')).toBeVisible();
  await page.locator('.welcome-start').click(); await page.goBack(); await expect(page).toHaveURL(/\/introduction$/); await expect(page.locator('.welcome')).toBeVisible();
  await page.goto('/'); await expect(page.locator('.first-run')).toBeVisible(); await expect(page.locator('.welcome')).toHaveCount(0);
});

test('deep links, settings entry and unavailable storage keep their existing flow', async ({ page }) => {
  for (const path of ['/today', '/library/dictionary', '/settings', '/start']) {
    await page.goto(path); await expect(page.locator('main')).toBeVisible(); await expect(page.locator('.welcome')).toHaveCount(0);
  }
  await page.addInitScript(() => {
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function(key: string) { if (key === 'lingfern.onboarding.seen') throw new Error('Storage disabled'); return get.call(this, key); };
  });
  await page.goto('/'); await expect(page.locator('.first-run')).toBeVisible(); await expect(page.locator('.welcome')).toHaveCount(0);
});

test('Start stays fully visible without scrolling the introduction at short and narrow sizes', async ({ page }) => {
  for (const [width, height] of [[1440, 740], [1280, 720], [1366, 650], [844, 390], [390, 844], [320, 568], [375, 667]]) {
    await page.setViewportSize({ width, height }); await page.goto('/introduction'); await expect(page.locator('.welcome')).toBeVisible();
    const button = (await page.locator('.welcome-start').boundingBox())!;
    expect(button.y).toBeGreaterThanOrEqual(0); expect(button.y + button.height).toBeLessThanOrEqual(height);
    expect(button.height).toBeGreaterThanOrEqual(44); expect(await page.evaluate(() => scrollY)).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(height + 1);
    await expect(page.locator('.welcome-card[data-current=true] .welcome-site-header')).toBeVisible();
    if (width < 768) await expect(page.locator('.welcome-card[data-current=true] .welcome-mobile-nav')).toBeVisible();
  }
  await page.locator('.welcome-start').click(); await expect(page).toHaveURL(/\/start$/); await expect(page.locator('.first-run')).toBeVisible();
});

test('idle rotation waits until contact, scrolling and keyboard activity end and respects reduced motion', async ({ page }) => {
  await page.clock.install(); await page.goto('/introduction'); await expect(page.locator('.welcome')).toBeVisible();
  const current = page.locator('.welcome-card[data-current=true]');
  await expect(page.locator('.welcome-playback,.welcome-arrow')).toHaveCount(0);
  await page.clock.fastForward(6500); await page.clock.runFor(800);
  await expect(current).toHaveAttribute('aria-label', '第 2 张，共 3 张');
  const stage = (await page.locator('.welcome-stage').boundingBox())!;
  await page.mouse.move(stage.x + stage.width / 2, stage.y + 2); await page.mouse.down();
  await page.clock.fastForward(15000); await page.clock.runFor(800);
  await expect(current).toHaveAttribute('aria-label', '第 2 张，共 3 张');
  await page.mouse.up();
  // Native scrolling may continue after contact ends outside the stage.
  for (let i = 0; i < 5; i++) { await page.clock.fastForward(3000); await page.mouse.wheel(0, 40); await page.clock.runFor(100); }
  await expect(current).toHaveAttribute('aria-label', '第 2 张，共 3 张');
  await page.clock.fastForward(5000); await page.clock.runFor(100);
  await expect(current).toHaveAttribute('aria-label', '第 2 张，共 3 张');
  await page.clock.fastForward(1500); await page.clock.runFor(800);
  await expect(current).toHaveAttribute('aria-label', '第 3 张，共 3 张');
  await page.locator('.welcome-start').focus(); await page.keyboard.press('Shift');
  await page.clock.fastForward(15000); await page.clock.runFor(800);
  await expect(current).toHaveAttribute('aria-label', '第 3 张，共 3 张');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.fastForward(15000); await page.clock.runFor(800);
  await expect(current).toHaveAttribute('aria-label', '第 3 张，共 3 张');
  await expect(current).toHaveCSS('transform', 'none'); await expect(current.locator('.welcome-window')).toHaveCSS('filter', 'none');
  await expect(current.locator('.welcome-shade')).toBeHidden();
});

test('only horizontal trackpad gestures switch cards; wheel and Shift+wheel keep native scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto('/introduction');
  await expect(page.locator('.welcome')).toBeVisible();
  const current = page.locator('.welcome-card[data-current=true]'), content = current.locator('.welcome-content');
  await content.hover(); const top = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, 120); await page.mouse.wheel(0, 20); await page.mouse.wheel(0, 10);
  await expect.poll(() => content.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  await expect(current).toHaveAttribute('aria-label', '第 1 张，共 3 张');
  await page.mouse.wheel(120, 0); await page.mouse.wheel(20, 0); await page.mouse.wheel(10, 0);
  await expect(current).toHaveAttribute('aria-label', '第 2 张，共 3 张');
  expect(await page.evaluate(() => scrollY)).toBe(top);
  await page.waitForTimeout(220); await page.mouse.wheel(70, 0);
  await expect(current).toHaveAttribute('aria-label', '第 3 张，共 3 张');
  await page.waitForTimeout(220); await page.mouse.wheel(-90, 0);
  await expect(current).toHaveAttribute('aria-label', '第 2 张，共 3 张');
  await page.waitForTimeout(220); await page.keyboard.down('Shift'); await page.mouse.wheel(0, -90); await page.keyboard.up('Shift');
  await page.waitForTimeout(900);
  await expect(current).toHaveAttribute('aria-label', '第 2 张，共 3 张');
  const wheel = await current.evaluate(el => { const e = new WheelEvent('wheel', {deltaX:120,deltaMode:1,bubbles:true,cancelable:true}); el.dispatchEvent(e); return e.defaultPrevented; });
  expect(wheel).toBe(false);
  await page.waitForTimeout(900);
  await expect(current).toHaveAttribute('aria-label', '第 2 张，共 3 张');
});

test('small trackpad deltas move cards continuously before the switch threshold and settle once', async ({ page }) => {
  await page.clock.install();
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto('/introduction');
  const first = page.locator('.welcome-card').first(), content = first.locator('.welcome-content');
  await content.hover();
  // Preserve continuous gestures across browser sampling gaps.
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 1000));
  const samples: number[] = [];
  for (const delta of [12, 11, 10, 9, 8, 6]) {
    await page.mouse.wheel(delta, 0);
    await page.clock.runFor(32);
    samples.push(await first.evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41));
  }
  await test.info().attach('trackpad-contact-positions', {body:JSON.stringify(samples),contentType:'application/json'});
  expect(samples[0]).toBeLessThan(-1);
  expect(samples.every((x, i) => !i || x <= samples[i - 1] + .1)).toBe(true);
  expect(samples.every((x, i) => !i || Math.abs(x - samples[i - 1]) < 30)).toBe(true);
  await page.clock.runFor(1000);
  await expect(page.locator('.welcome-card[data-current=true]')).toHaveAttribute('aria-label', '第 2 张，共 3 张');
  await expect.poll(() => first.evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41)).toBeLessThan(-100);
});

test('a delayed decaying wheel tail cannot pull the selected card back', async ({ page }) => {
  await page.clock.install(); await page.setViewportSize({ width: 1440, height: 900 }); await page.goto('/introduction');
  await page.locator('.welcome-content').first().hover();
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 1000));
  await page.mouse.wheel(50, 0); await page.clock.runFor(220);
  const first = page.locator('.welcome-card').first(), samples: number[] = [];
  for (const delta of [6, 4, 3, 2, 1]) {
    await page.mouse.wheel(delta, 0); await page.clock.runFor(32);
    samples.push(await first.evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41));
  }
  await page.clock.runFor(1100);
  await expect(page.locator('.welcome-card[data-current=true]')).toHaveAttribute('aria-label', '第 2 张，共 3 张');
  expect(samples.every((x, i) => !i || x <= samples[i - 1] + .1)).toBe(true);
  await test.info().attach('late-momentum-positions', { body: JSON.stringify(samples), contentType: 'application/json' });
});

test('a horizontal trackpad gesture can accelerate after small separated samples', async ({ page }) => {
  await page.clock.install(); await page.goto('/introduction'); await expect(page.locator('.welcome')).toBeVisible();
  await page.locator('.welcome-content').first().hover(); await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 1000));
  for (const [delay, delta] of [[0, -4], [392, -4], [104, -17], [96, -58], [104, -77], [96, -103]]) {
    await page.clock.runFor(delay); await page.mouse.wheel(delta, 0);
  }
  await page.clock.runFor(1800);
  await expect(page.locator('.welcome-card[data-current=true]')).toHaveAttribute('aria-label', '第 3 张，共 3 张');
});

test('small horizontal pixel samples accumulate across brief pauses without fighting the release', async ({ page }) => {
  await page.clock.install(); await page.goto('/introduction'); await expect(page.locator('.welcome')).toBeVisible();
  await page.locator('.welcome-content').first().hover(); await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 1000));
  for (const delay of [0, 392, 104]) { await page.clock.runFor(delay); await page.mouse.wheel(-18, 0); }
  await page.clock.runFor(1500);
  await expect(page.locator('.welcome-card[data-current=true]')).toHaveAttribute('aria-label', '第 3 张，共 3 张');
});

test('reversing a wheel gesture interrupts the release without snapping or replacing page content', async ({ page }) => {
  await page.clock.install(); await page.goto('/introduction'); await page.locator('.welcome-content').first().hover();
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 1000));
  const first = page.locator('.welcome-card').first();
  await first.evaluate(el => { (window as unknown as { originalPreview: Element }).originalPreview = el.querySelector('.today-home')!; });
  await page.mouse.wheel(80, 0); await page.clock.runFor(140);
  const before = await first.evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41);
  await page.mouse.wheel(-45, 0); await page.clock.runFor(16);
  const after = await first.evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41);
  expect(after).toBeGreaterThan(before); expect(after - before).toBeLessThan(150);
  await page.clock.runFor(1200);
  await expect(page.locator('.welcome-card[data-current=true]')).toHaveAttribute('aria-label', '第 1 张，共 3 张');
  expect(await first.evaluate(el => el.querySelector('.today-home') === (window as unknown as { originalPreview: Element }).originalPreview)).toBe(true);
  for (const card of await page.locator('.welcome-card').all()) {
    const current = (await card.getAttribute('data-current')) === 'true';
    await expect(card).toHaveCSS('z-index', current ? '3' : '1'); expect(await card.locator('.welcome-shade').evaluate(el => getComputedStyle(el).opacity)).toBe(current ? '0' : '0.18');
  }
});

for (const [locale, theme] of [['zh-Hans', 'light'], ['en', 'dark'], ['ar', 'dark']] as const) test.describe(`whole card surfaces ${locale}/${theme}`, () => {
  test.use({ locale, colorScheme: theme });
  test('forward, backward and interrupted drags keep cards opaque and separated', async ({ page }, info) => {
    await page.clock.install();
    const samples: { width: number; selected: number; offset: number; gaps: number[] }[] = [];
    for (const [width, height] of [[1440, 900], [390, 844], [844, 390], [2560, 900]]) {
      await page.setViewportSize({ width, height }); await page.goto('/introduction'); await expect(page.locator('.welcome')).toBeVisible();
      for (let selected = 0; selected < 3; selected++) {
        await page.locator('.welcome-dots button').nth(selected).click(); await page.clock.runFor(1000);
        const box = (await page.locator('.welcome-stage').boundingBox())!;
        const cardWidth = await page.locator('.welcome-card').first().evaluate(el => (el as HTMLElement).offsetWidth);
        const shift = Math.max(cardWidth * .92 + 12, (width + cardWidth * .8 + 64) / 3);
        const start = { x: box.x + box.width / 2, y: box.y + 4 };
        await page.mouse.move(start.x, start.y); await page.mouse.down();
        // Reverse held contact after both depth handoffs.
        for (const offset of [.1, .25, .4, .49, .5, .51, .6, .9, 1, .6, .1, -.1, -.4, -.49, -.5, -.51, -.6, -1, -.4, 0]) {
          await page.mouse.move(start.x - offset * Math.max(90, shift), start.y); await page.clock.runFor(16);
          const surfaces = await page.locator('.welcome-card').evaluateAll(elements => elements.map(el => {
            const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, opacity: getComputedStyle(el).opacity };
          }).sort((a, b) => a.left - b.left));
          expect(surfaces.map(card => card.opacity)).toEqual(['1', '1', '1']);
          const gaps = surfaces.slice(1).map((card, i) => card.left - surfaces[i].right);
          samples.push({ width, selected, offset, gaps });
          for (const gap of gaps) expect(gap, `card gap at ${width}px, card ${selected}, drag ${offset}`).toBeGreaterThan(8);
        }
        await page.mouse.up(); await page.clock.runFor(1000);
      }
      for (const card of await page.locator('.welcome-card').all()) {
        await expect(card).toHaveCSS('transform-style', 'flat'); await expect(card).toHaveCSS('isolation', 'isolate');
      }
    }
    await info.attach('sampled-card-gaps', { body: JSON.stringify(samples), contentType: 'application/json' });
  });
});

test('narrow-view trackpad gestures belong to the cards while normal browser Back remains available', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/today'); await page.goto('/introduction');
  const first = page.locator('.welcome-card').first(), content = first.locator('.welcome-content');
  await expect(content).toHaveCSS('touch-action', 'pan-y'); await expect(content).toHaveCSS('overscroll-behavior-x', 'contain');
  await page.evaluate(() => {
    (window as unknown as {wheelOwnership:boolean[]}).wheelOwnership = [];
    window.addEventListener('wheel', e => { if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) (window as unknown as {wheelOwnership:boolean[]}).wheelOwnership.push(e.defaultPrevented); });
  });
  await content.hover();
  for (const delta of [14, 14, 14, 14]) { await page.mouse.wheel(delta, 0); await page.evaluate(() => new Promise(requestAnimationFrame)); }
  await expect(page.locator('.welcome-card[data-current=true]')).toHaveAttribute('aria-label', '第 2 张，共 3 张');
  const ownership = await page.evaluate(() => (window as unknown as {wheelOwnership:boolean[]}).wheelOwnership);
  expect(ownership.length).toBeGreaterThan(0); expect(ownership.every(Boolean)).toBe(true);
  await expect(page).toHaveURL(/\/introduction$/);
  await page.goBack(); await expect(page).toHaveURL(/\/today$/); await expect(page.getByRole('heading',{name:'今日',exact:true})).toBeVisible();
});

test('the same fern reverses its growth when Today leaves and resumes on return', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('.welcome')).toBeVisible();
  const fern = page.locator('.welcome .fern');
  await expect.poll(() => fern.getAttribute('data-growth').then(Number)).toBeGreaterThan(.3);
  await fern.evaluate(el => { (window as unknown as { introFern: Element }).introFern = el; });
  await page.locator('.welcome-dots button').nth(1).click();
  const values = await fern.evaluate(el => new Promise<number[]>(resolve => {
    const values: number[] = [], start = performance.now();
    const sample = () => { values.push(Number(el.getAttribute('data-growth'))); if (performance.now() - start < 2200) requestAnimationFrame(sample); else resolve(values); }; requestAnimationFrame(sample);
  }));
  const descending = values.slice(values.findIndex((v, i) => i > 0 && v < values[i - 1]));
  expect(descending.length).toBeGreaterThan(10); expect(descending.at(-1)).toBe(0);
  expect(descending.every((v, i) => i === 0 || v <= descending[i - 1] + .000001)).toBe(true);
  expect(await fern.evaluate(el => el === (window as unknown as { introFern: Element }).introFern)).toBe(true);
  await page.locator('.welcome-dots button').nth(0).click();
  await expect.poll(() => fern.getAttribute('data-growth').then(Number)).toBeGreaterThan(.3);
  await test.info().attach('reverse-fern-growth', { body: JSON.stringify(values), contentType: 'application/json' });
});

test.describe('native touch carousel', () => {
  test.use({ hasTouch: true });
  test('backgrounding held contact releases capture and restores native scrolling', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'Native touch injection uses CDP.');
    await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/introduction');
    const stage = page.locator('.welcome-stage');
    await stage.evaluate(el => el.addEventListener('gotpointercapture', event => el.setAttribute('data-test-pointer', String((event as PointerEvent).pointerId))));
    const cdp = await context.newCDPSession(page), box = (await page.locator('.welcome-card[data-current=true] .welcome-content').boundingBox())!;
    const x = box.x + box.width * .8, y = box.y + box.height * .5;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (const dx of [20, 50, 100]) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - dx, y }] }); await page.waitForTimeout(20); }
    await expect.poll(() => stage.evaluate(el => el.hasPointerCapture(Number(el.getAttribute('data-test-pointer'))))).toBe(true);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    expect(await stage.evaluate(el => el.hasPointerCapture(Number(el.getAttribute('data-test-pointer'))))).toBe(false);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.evaluate(() => { Reflect.deleteProperty(document, 'hidden'); document.dispatchEvent(new Event('visibilitychange')); });
    await page.locator('.welcome-dots button').nth(1).click();
    const current = page.locator('.welcome-card[data-current=true]');
    await expect(current).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
    const content = current.locator('.welcome-content'), next = (await content.boundingBox())!, sx = next.x + next.width / 2, sy = next.y + next.height * .8;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy }] });
    for (const dy of [20, 60, 120]) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx, y: sy - dy }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => content.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
    await expect(current).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
    await cdp.detach();
  });
  test('a short fast flick advances while the same held displacement returns to rest', async ({ page, context }) => {
    await page.clock.install(); await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/introduction');
    await expect(page.locator('.welcome')).toBeVisible();
    await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 1000));
    const cdp = await context.newCDPSession(page), current = page.locator('.welcome-card[data-current=true]');
    for (const held of [true, false]) {
      const box = (await current.locator('.welcome-content').boundingBox())!, x = box.x + box.width * .8, y = box.y + box.height * .5;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (const dx of [12, 24]) {
        await page.clock.runFor(16);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - dx, y }] });
      }
      if (held) await page.clock.runFor(200);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.clock.runFor(1000);
      await expect(current).toHaveAttribute('aria-label', held ? '第 1 张，共 3 张' : '第 2 张，共 3 张');
    }
    await cdp.detach();
  });
  test('a multi-frame swipe starting inside the scrolling card keeps pointer ownership without jumps', async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/introduction');
    const content = page.locator('.welcome-card').first().locator('.welcome-content');
    const box = (await content.boundingBox())!, x = box.x + box.width * .8, y = box.y + box.height * .55;
    await page.evaluate(() => {
      const events: string[] = []; (window as unknown as { swipeEvents: string[] }).swipeEvents = events;
      for (const name of ['pointermove','pointercancel']) document.querySelector('.welcome-stage')!.addEventListener(name, () => events.push(name));
    });
    const cdp = await context.newCDPSession(page), positions: number[] = [];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{x,y}] });
    for (let i = 1; i <= 8; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{x:x-i*12,y:y+1}] });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      positions.push(await page.locator('.welcome-card').first().evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41));
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const events = await page.evaluate(() => (window as unknown as {swipeEvents:string[]}).swipeEvents);
    expect(events.filter(e => e === 'pointercancel')).toHaveLength(0);
    expect(events.filter(e => e === 'pointermove').length).toBeGreaterThanOrEqual(6);
    expect(positions.every((x, i) => !i || x <= positions[i - 1] + .1)).toBe(true);
    expect(positions.every((x, i) => !i || Math.abs(x - positions[i - 1]) < 20)).toBe(true);
    await expect(page.locator('.welcome-card[data-current=true]')).toHaveAttribute('aria-label', '第 2 张，共 3 张');
    await expect(content).toHaveJSProperty('scrollLeft', 0);
    await test.info().attach('content-swipe-positions', {body:JSON.stringify({events,positions}),contentType:'application/json'});
    await cdp.detach();
  });
  test('mobile preview contents do not scroll horizontally while vertical scrolling and card switching remain available', async ({ page }) => {
    for (const width of [320, 390, 767]) {
      await page.setViewportSize({ width, height: 600 }); await page.goto('/introduction');
      for (let index = 0; index < 3; index++) {
        await page.locator('.welcome-dots button').nth(index).tap();
        const current = page.locator('.welcome-card[data-current=true]');
        await expect(current).toHaveAttribute('aria-label', `第 ${index + 1} 张，共 3 张`);
        const content = current.locator('.welcome-content');
        await expect(content).toHaveCSS('overflow-x', 'hidden');
        await expect(content).toHaveCSS('overflow-y', 'auto');
        expect(await content.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
        const box = (await content.boundingBox())!;
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.wheel(100, 0);
        await expect.poll(() => content.evaluate(el => el.scrollLeft)).toBe(0);
      }
    }
  });
  test('horizontal contact follows the finger, settles, and does not activate preview controls', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/'); await expect(page.locator('.welcome')).toBeVisible();
    const cdp = await page.context().newCDPSession(page), stage = (await page.locator('.welcome-stage').boundingBox())!;
    const point = { x: stage.x + stage.width * .75, y: stage.y + 90 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x - 100, y: point.y + 2 }] });
    expect(await page.locator('.welcome-card').first().evaluate(el => getComputedStyle(el).transform)).not.toBe('none');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.locator('.welcome-card[data-current=true]')).toHaveAttribute('aria-label', '第 2 张，共 3 张');
    await expect(page.locator('.first-run')).toHaveCount(0); await expect(page.getByRole('listbox')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('lingfern.onboarding.seen'))).toBeNull(); await cdp.detach();
  });
  test('vertical touch scrolling moves the preview without changing the selected card', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 440 }); await page.goto('/'); await expect(page.locator('.welcome')).toBeVisible();
    const cdp = await page.context().newCDPSession(page), current = page.locator('.welcome-card[data-current=true]');
    const before = await current.getAttribute('aria-label');
    const content = (await current.locator('.welcome-content').boundingBox())!, x = content.x + content.width / 2, y = content.y + content.height - 24;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (const distance of [30, 70, 110, 150]) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 2, y: y - distance }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => current.locator('.welcome-content').evaluate(el => el.scrollTop)).toBeGreaterThan(0);
    await expect(current).toHaveAttribute('aria-label', before!); await expect(page.locator('.first-run')).toHaveCount(0); await cdp.detach();
  });
  test('small sideways finger drift at the start of vertical reading does not twitch the card', async ({ page, context }) => {
    await page.setViewportSize({width:390,height:440}); await page.goto('/introduction');
    const first = page.locator('.welcome-card').first(), content = first.locator('.welcome-content'), box = (await content.boundingBox())!;
    const x=box.x+box.width/2,y=box.y+box.height-20,cdp=await context.newCDPSession(page),positions:number[]=[];
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    for(const [dx,dy] of [[8,1],[9,26],[20,90],[30,170]]) {
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx,y:y-dy}]});
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      positions.push(await first.evaluate(el=>new DOMMatrixReadOnly(getComputedStyle(el).transform).m41));
    }
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    expect(positions.every(x=>Math.abs(x)<.1)).toBe(true);
    await expect.poll(()=>content.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
    await expect(first).toHaveAttribute('data-current','true');await cdp.detach();
    await test.info().attach('vertical-finger-drift',{body:JSON.stringify(positions),contentType:'application/json'});
  });
});

for (const [locale, colorScheme, width] of [['zh-Hans', 'light', 393], ['en', 'dark', 320], ['ar', 'dark', 767]] as const) test.describe(`native preview scrolling ${locale}`, () => {
  test.use({ locale, colorScheme, hasTouch: true, isMobile: true, deviceScaleFactor: 2.75 });
  test('every card scrolls in both directions after switching, including over inert controls', async ({ page, context }) => {
    await page.setViewportSize({ width, height: 851 }); await page.goto('/introduction');
    const cdp = await context.newCDPSession(page), samples: { card: number; down: number; up: number }[] = [];
    for (let card = 0; card < 3; card++) {
      await page.locator('.welcome-dots button').nth(card).tap();
      const current = page.locator('.welcome-card[data-current=true]');
      await expect(current).toHaveAttribute('aria-label', languagePacks[locale].onboarding.slideN.replace('{n}', String(card + 1)));
      await expect.poll(() => current.locator('.welcome-shade').evaluate(el => getComputedStyle(el).opacity)).toBe('0');
      const content = current.locator('.welcome-content'), box = (await content.boundingBox())!;
      const x = box.x + box.width / 2, y = box.y + box.height * .75, distance = Math.min(140, box.height * .5);
      for (const direction of [-1, 1]) {
        const before = await content.evaluate(el => el.scrollTop);
        await content.evaluate(el => { el.setAttribute('data-scroll-ended', 'false'); el.addEventListener('scrollend', () => el.setAttribute('data-scroll-ended', 'true'), { once: true }); });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: direction < 0 ? y : y - distance }] });
        for (let step = 1; step <= 8; step++) {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 2, y: (direction < 0 ? y : y - distance) + direction * distance * step / 8 }] });
          await page.waitForTimeout(20);
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        if (direction < 0) await expect.poll(() => content.evaluate(el => el.scrollTop)).toBeGreaterThan(before + 20);
        else await expect.poll(() => content.evaluate(el => el.scrollTop)).toBeLessThan(before - 20);
        samples.push({ card, down: before, up: await content.evaluate(el => el.scrollTop) });
        await expect(current).toHaveAttribute('data-current', 'true');
        // Keep independent gestures outside the browser's native fling window.
        await expect(content).toHaveAttribute('data-scroll-ended', 'true');
      }
      await expect(page.getByRole('listbox')).toHaveCount(0);
    }
    await cdp.detach();
    await test.info().attach('native-preview-scroll', { body: JSON.stringify(samples), contentType: 'application/json' });
  });
});

test('keyboard direction follows RTL and preview-only controls cannot receive focus', async ({ page }) => {
  await page.goto('/settings');
  const { selectPicker } = await import('./picker');
  await selectPicker(page, (await page.locator('.settings-language .setting-trigger').getAttribute('aria-label'))!, 'ar');
  await page.goto('/introduction'); await expect(page.locator('.welcome')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const current = page.locator('.welcome-card[data-current=true]');
  await expect(current).toHaveAttribute('aria-label', languagePacks.ar.onboarding.slideN.replace('{n}', '1'));
  await page.locator('.welcome-dots button').first().focus(); await page.keyboard.press('ArrowLeft');
  await expect(current).toHaveAttribute('aria-label', languagePacks.ar.onboarding.slideN.replace('{n}', '2'));
  await page.keyboard.press('ArrowRight'); await expect(current).toHaveAttribute('aria-label', languagePacks.ar.onboarding.slideN.replace('{n}', '1'));
  const trigger = current.locator('.setting-trigger').first(); await trigger.evaluate(el => (el as HTMLElement).focus());
  await expect(trigger).not.toBeFocused(); await expect(page.getByRole('listbox')).toHaveCount(0);
});

test('all fourteen language packages render the introduction without horizontal overflow', async ({ browser }) => {
  test.setTimeout(90000);
  for (const locale of Object.keys(languagePacks) as (keyof typeof languagePacks)[]) {
    const context = await browser.newContext({ baseURL: test.info().project.use.baseURL, locale, reducedMotion: 'reduce', viewport: { width: 375, height: 812 } });
    const page = await context.newPage(); await page.goto('/'); await expect(page.locator('.welcome')).toBeVisible();
    for (let index = 0; index < 3; index++) {
      await page.locator('.welcome-dots button').nth(index).click();
      await expect(page.locator('.welcome-card[data-current=true]')).toHaveAttribute('aria-label', languagePacks[locale].onboarding.slideN.replace('{n}', String(index + 1)));
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(376);
      expect(await page.locator('.welcome-card[data-current=true] .welcome-mobile-nav a').evaluateAll(links => links.every(link => { const label = link.querySelector('.nav-label')!.getBoundingClientRect(), box = link.getBoundingClientRect(); return label.left >= box.left && label.right <= box.right && box.height >= 44; }))).toBe(true);
      await expect(page.locator('.welcome-start')).toHaveText(languagePacks[locale].corpusPractice.start);
    }
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr'); await context.close();
  }
});

for (const [locale, theme] of [['zh-Hans', 'light'], ['en', 'dark'], ['de', 'light'], ['ar', 'dark']] as const) test.describe(`responsive ${locale}/${theme}`, () => {
  test.use({ locale, colorScheme: theme });
  test('cards and arrangement adapt through portrait, landscape and short viewports', async ({ page }, info) => {
    test.setTimeout(90000); await page.goto('/'); await expect(page.locator('.welcome')).toBeVisible();
    const shapes: { width: number; height: number; cardWidth: number; cardHeight: number; ratio: string }[] = [];
    for (const [width, height] of [[390, 844], [320, 700], [768, 1024], [1024, 768], [1440, 900], [1920, 1080], [844, 390]]) {
      await page.setViewportSize({ width, height });
      for (let index = 0; index < 3; index++) {
        await page.locator('.welcome-dots button').nth(index).click();
        const current = page.locator('.welcome-card[data-current=true]'); await expect(current).toHaveAttribute('aria-label', languagePacks[locale].onboarding.slideN.replace('{n}', String(index + 1)));
        await expect(current).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
        expect((await page.locator('.welcome-dots [aria-current] span').boundingBox())!.width).toBeCloseTo(26, 1);
        if (await page.evaluate(() => matchMedia('(min-width:768px)').matches)) {
          await expect(current.locator('.welcome-site-header')).toBeVisible();
          await expect(current.locator('.desktop-nav a[aria-current]')).toHaveAttribute('href', `/${['today', 'library', 'settings'][index]}`);
        } else {
          await expect(current.locator('.welcome-site-header')).toBeVisible(); await expect(current.locator('.welcome-site-header .mobile-brand .brand-symbol')).toBeVisible(); await expect(current.locator('.welcome-site-header .desktop-nav')).toBeHidden();
          const nav = current.locator('.welcome-mobile-nav'); await expect(nav).toBeVisible(); await expect(nav.locator('svg')).toHaveCount(3);
          await expect(nav.locator('a[aria-current]')).toHaveAttribute('href', `/${['today', 'library', 'settings'][index]}`);
          expect(Math.abs(await nav.evaluate(el => el.getBoundingClientRect().bottom - el.parentElement!.getBoundingClientRect().bottom))).toBeLessThanOrEqual(1);
        }
        const card = (await current.boundingBox())!;
        expect(card.width).toBeGreaterThanOrEqual(width < 700 ? width * .7 : 250);
        expect(card.height / card.width).toBeLessThan(1.9);
        expect(await page.evaluate(() => document.documentElement.scrollHeight - document.querySelector('main')!.getBoundingClientRect().bottom - scrollY)).toBeLessThanOrEqual(1);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
        const clipped = await current.evaluate(el => [...el.querySelectorAll('button,a')].filter(e => !e.closest('[inert]')).some(e => { const box = e.getBoundingClientRect(); return box.width > 0 && box.height > 0 && (box.width < 43.5 || box.height < 43.5); }));
        expect(clipped).toBe(false);
        if (index === 0 && width >= 1200) {
          const fern = (await current.locator('.fern').boundingBox())!, frame = (await current.locator('.welcome-content').boundingBox())!;
          expect(fern.y).toBeGreaterThanOrEqual(frame.y); expect(fern.y + fern.height).toBeLessThanOrEqual(frame.y + frame.height + 1);
        }
        if (index === 0) shapes.push({ width, height, cardWidth: card.width, cardHeight: card.height, ratio: await page.locator('.welcome').evaluate(el => getComputedStyle(el).getPropertyValue('--welcome-card-ratio')) });
        if (width === 390 || width === 1440) await page.screenshot({ path: info.outputPath(`intro-${index}-${width}-${locale}-${theme}.png`), fullPage: true });
      }
    }
    expect(new Set(shapes.map(s => s.ratio)).size).toBeGreaterThan(2);
    await info.attach('responsive-card-geometry', { body: JSON.stringify(shapes), contentType: 'application/json' });
  });
});

test('both neighbouring cards stay visible while only quote and navigation controls remain interactive', async ({ page }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 }); await page.goto('/'); await expect(page.locator('.welcome')).toBeVisible();
    const current = page.locator('.welcome-card[data-current=true]');
    const front = (await current.boundingBox())!;
    for (const side of await page.locator('.welcome-card[data-current=false]').all()) {
      const box = (await side.boundingBox())!;
      expect(Math.max(front.x - box.x, box.x + box.width - front.x - front.width, front.y - box.y)).toBeGreaterThanOrEqual(14);
      expect(await side.locator('.welcome-shade').evaluate(el => getComputedStyle(el).backdropFilter)).toBe('none');
      expect(await side.locator('.welcome-shade').evaluate(el => getComputedStyle(el).opacity)).toBe('0.18');
    }
    if (width >= 768) {
      await current.locator('.desktop-nav a[href="/library"]').click();
      await expect(current).toHaveAttribute('aria-label', '第 2 张，共 3 张');
    } else await current.locator('.welcome-mobile-nav a[href="/library"]').click();
    await expect(current.locator('.library-reference-tile')).toHaveCount(3);
    await expect(current.locator('.library-reference-tile').first()).toHaveJSProperty('inert', false);
    expect(await current.locator('.library-reference-tile').first().evaluate(el => !!el.closest('[inert]'))).toBe(true);
    await current.locator(width >= 768 ? '.desktop-nav a[href="/settings"]' : '.welcome-mobile-nav a[href="/settings"]').click();
    await expect(current).toHaveAttribute('aria-label', '第 3 张，共 3 张');
    await expect(current.locator('.settings-page .github-identity')).toHaveCount(1);
    await expect(current.locator('.settings-page .settings-language')).toHaveCount(1);
    expect(await current.locator('.settings-page').evaluate(el => !!el.closest('[inert]'))).toBe(true);
    await page.locator('.welcome-dots button').first().click();
    const before = await page.locator('.welcome .daily-quote').getAttribute('data-quote-id');
    const nextQuote = current.locator('.daily-quote-next'); await nextQuote.scrollIntoViewIfNeeded(); await nextQuote.click();
    await expect(current.locator('.daily-quote')).not.toHaveAttribute('data-quote-id', before!);
    expect(await current.locator('.practice-card-action').first().evaluate(el => !!el.closest('[inert]'))).toBe(true);
    await page.locator('.welcome-start').click(); await expect(page).toHaveURL(/\/start$/); await expect(page.locator('.first-run')).toBeVisible();
    await page.evaluate(() => localStorage.removeItem('lingfern.onboarding.seen'));
  }
});


for (const width of [390, 1440]) test(`preview keeps the same practice appearance and layout as Today at ${width}px`, async ({ page, context }) => {
  await page.setViewportSize({ width, height: 900 }); await page.goto('/'); await expect(page.locator('.welcome')).toBeVisible();
  const preview = page.locator('.welcome .practice-card').first();
  const normal = await context.newPage(); await normal.setViewportSize({ width, height: 900 }); await normal.goto('/today');
  await expect(normal.locator('.practice-card').first()).toBeVisible();
  const dimensions = (el: Element) => { const style = getComputedStyle(el); return { font: style.fontSize, padding: style.padding, radius: style.borderRadius, display: style.display, gap: style.gap }; };
  expect(await preview.evaluate(dimensions)).toEqual(await normal.locator('.practice-card').first().evaluate(dimensions));
  expect(await preview.locator('.practice-card-action').evaluate(dimensions)).toEqual(await normal.locator('.practice-card-action').first().evaluate(dimensions));
  expect(await page.locator('.welcome .today-grid').evaluate(el => getComputedStyle(el).display)).toEqual(await normal.locator('.today-grid').evaluate(el => getComputedStyle(el).display));
  await expect(page.locator('.welcome .practice-card')).toHaveCount(3);
  const scroll = page.locator('.welcome-card[data-current=true] .welcome-content');
  expect(await scroll.evaluate(el => el.scrollHeight)).toBeGreaterThan(await scroll.evaluate(el => el.clientHeight));
  await expect(scroll).toHaveAttribute('data-scrollbar-y', 'true');
  const contentWidth = await scroll.evaluate(el => el.clientWidth), scrollbarColor = await scroll.evaluate(el => getComputedStyle(el).scrollbarColor);
  expect(scrollbarColor).not.toBe('rgba(0, 0, 0, 0) rgba(0, 0, 0, 0)');
  await scroll.hover(); await page.mouse.wheel(0, 120);
  await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  expect(await scroll.evaluate(el => getComputedStyle(el).scrollbarColor)).toBe(scrollbarColor);
  expect(await scroll.evaluate(el => el.clientWidth)).toBe(contentWidth);
  await expect(page.locator('.welcome-card[data-current=true]')).toHaveAttribute('aria-label', '第 1 张，共 3 张');
  await scroll.evaluate(el => el.scrollTop = el.scrollHeight); await expect(preview.locator('.practice-card-action')).not.toHaveAttribute('disabled');
  await normal.close();
  await scroll.evaluate(el => {
    el.style.padding = '0';
    const content = el.firstElementChild as HTMLElement;
    content.style.cssText = `display:block;height:${el.clientHeight + 40}px;overflow:hidden`;
    el.scrollTop = 0;
  });
  await expect(scroll).toHaveAttribute('data-scrollbar-y', 'false');
  expect(await scroll.evaluate(el => el.scrollHeight - el.clientHeight)).toBe(40);
  await scroll.evaluate(el => el.scrollTop = 20);
  await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBe(20);
  expect(await scroll.evaluate(el => getComputedStyle(el).scrollbarColor)).toBe('rgba(0, 0, 0, 0) rgba(0, 0, 0, 0)');
});

for (const [locale, theme, width] of [['zh-Hans','light',390],['en','dark',1440],['ar','dark',375]] as const) test.describe(`complete Settings preview ${locale}`, () => {
  test.use({ locale, colorScheme: theme });
  test('shows the actual Settings functions without permitting preview changes', async ({ page, context }) => {
    await page.setViewportSize({ width, height: 900 }); await page.goto('/introduction');
    await page.locator('.welcome-dots button').nth(2).click();
    const preview = page.locator('.welcome-card[data-current=true] .settings-page'); await expect(preview).toBeVisible();
    expect(await page.locator('.welcome-card[data-current=true] .welcome-window').evaluate(el => [...el.querySelectorAll('a,button,input,select,textarea,summary,[tabindex]')].filter(node => !node.closest('[inert]')).every(node => !!node.closest('.daily-quote,.desktop-nav,.welcome-mobile-nav')))).toBe(true);
    const normal = await context.newPage(); await normal.goto('/settings');
    await expect(preview.locator('.github-status-line')).not.toHaveAttribute('data-status', 'loading');
    await expect(normal.locator('.github-status-line')).not.toHaveAttribute('data-status', 'loading');
    for (const selector of ['.settings-language','.settings-appearance','.settings-dictionary-row','.settings-start-link','.github-identity','.mcp-settings','.profile-backup','.settings-update-row','.settings-about-link']) {
      await expect(preview.locator(selector)).toHaveCount(1);
      expect(await preview.locator(selector).innerText()).toBe(await normal.locator('.settings-page').locator(selector).innerText());
    }
    const trigger = preview.locator('.setting-trigger').first(); await trigger.scrollIntoViewIfNeeded(); await trigger.click({ force: true });
    await expect(page.getByRole('listbox')).toHaveCount(0); await expect(page).toHaveURL(/\/introduction$/);
    const link = preview.locator('.settings-start-link'); await link.scrollIntoViewIfNeeded(); await link.click({ force: true });
    await expect(page).toHaveURL(/\/introduction$/); expect(await page.evaluate(() => localStorage.getItem('lingfern.onboarding.seen'))).toBeNull();
    await normal.close();
  });
});

test('Today content geometry and live nodes remain stable throughout card transitions', async ({ page }) => {
  await page.goto('/introduction');
  const today = page.locator('.welcome-card').first(); await expect(today.locator('.daily-quote[data-quote-id]')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await today.evaluate(el => {
    const nodes = [el.querySelector('.fern')!, el.querySelector('.daily-quote')!, el.querySelector('.practice-section')!];
    (window as unknown as { introNodes: Element[] }).introNodes = nodes;
  });
  await page.locator('.welcome-dots button').nth(1).click();
  const rows = await today.evaluate(el => new Promise<number[][]>(resolve => {
    const rows: number[][] = [], start = performance.now();
    const sample = () => {
      const nodes = [el.querySelector('.fern')!, el.querySelector('.daily-quote')!, el.querySelector('.practice-section')!];
      rows.push(nodes.flatMap((node, i) => [Number(node === (window as unknown as { introNodes: Element[] }).introNodes[i]), node instanceof HTMLElement ? node.offsetTop : 0, node.clientHeight]));
      if (performance.now() - start < 900) requestAnimationFrame(sample); else resolve(rows);
    }; requestAnimationFrame(sample);
  }));
  expect(rows.length).toBeGreaterThan(10);
  for (let column = 0; column < rows[0].length; column++) {
    const values = rows.map(row => row[column]);
    if (column % 3 === 0) expect(new Set(values)).toEqual(new Set([1]));
    else expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
  }
  await test.info().attach('stable-intro-content-geometry', { body: JSON.stringify(rows), contentType: 'application/json' });
});

for (const [locale, theme] of [['zh-Hans','light'],['en','dark'],['ar','dark']] as const) test.describe(`actual header preview ${locale}`, () => {
  test.use({ locale, colorScheme: theme });
  test('uses the same mobile header sizing, brand and surface as the actual page', async ({ page, context }) => {
    const normal = await context.newPage();
    const appearance = (el: Element) => {
      const header = getComputedStyle(el), mark = el.querySelector('.mobile-brand .brand-symbol')!, brand = getComputedStyle(mark), backdrop = getComputedStyle(el, '::before');
      return { padding: header.padding, minHeight: header.minHeight, height: el.clientHeight, brandWidth: brand.width, brandHeight: brand.height, brandOpacity: brand.opacity, surface: backdrop.backgroundColor, filter: backdrop.backdropFilter, border: backdrop.borderBottom };
    };
    for (const width of [320,390,767]) {
      await page.setViewportSize({ width, height: 900 }); await normal.setViewportSize({ width, height: 900 });
      await page.goto('/introduction'); await normal.goto('/today');
      const header = page.locator('.welcome-card[data-current=true] .welcome-site-header'); await expect(header).toBeVisible();
      expect(await header.evaluate(appearance)).toEqual(await normal.locator('#root>header').evaluate(appearance));
      const brand = (await header.locator('.mobile-brand .brand-symbol').boundingBox())!, frame = (await header.boundingBox())!;
      expect(Math.abs(brand.x + brand.width / 2 - frame.x - frame.width / 2)).toBeLessThanOrEqual(1);
      await expect(page.locator('.welcome-chrome')).toHaveCount(0);
    }
    await normal.close();
  });
});

test('slide indicators follow the moving cards continuously instead of waiting for transition end', async ({ page }) => {
  await page.goto('/introduction'); await expect(page.locator('.welcome')).toBeVisible();
  await page.locator('.welcome-dots button').nth(1).click();
  const rows = await page.locator('.welcome').evaluate(el => new Promise<{ at: number; widths: number[]; active: number }[]>(resolve => {
    const rows: { at: number; widths: number[]; active: number }[] = [], start = performance.now();
    const sample = () => {
      const buttons = [...el.querySelectorAll('.welcome-dots button')];
      rows.push({ at: performance.now() - start, widths: buttons.map(button => button.firstElementChild!.getBoundingClientRect().width), active: buttons.findIndex(button => button.hasAttribute('aria-current')) });
      if (performance.now() - start < 900) requestAnimationFrame(sample); else resolve(rows);
    }; requestAnimationFrame(sample);
  }));
  expect(rows.some(row => row.at < 200 && row.widths[1] > 8)).toBe(true);
  expect(new Set(rows.filter(row => row.widths[1] > 7 && row.widths[1] < 26).map(row => row.widths[1])).size).toBeGreaterThan(4);
  for (const row of rows) expect(row.widths[row.active]).toBeGreaterThanOrEqual(Math.max(...row.widths) - .5);
  await expect(page.locator('.welcome-dots button').nth(1).locator('span')).toHaveCSS('width','26px');
  await test.info().attach('synchronized-indicator-frames', { body: JSON.stringify(rows), contentType: 'application/json' });
});


test.describe('mobile transition follow-up', () => {
  test.use({ hasTouch: true });
  test('a long swipe keeps following beyond ninety pixels and releases at the last contact', async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/introduction');
    const first = page.locator('.welcome-card').first(), content = first.locator('.welcome-content');
    const b = (await content.boundingBox())!, x = b.x + b.width - 24, y = b.y + b.height * .55;
    const cdp = await context.newCDPSession(page), samples: number[] = [];
    await cdp.send('Input.dispatchTouchEvent', {type:'touchStart',touchPoints:[{x,y}]});
    for (const dx of [20,40,60,80,100,120,140]) {
      await cdp.send('Input.dispatchTouchEvent', {type:'touchMove',touchPoints:[{x:x-dx,y}]});
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      samples.push(await first.evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41));
    }
    expect(samples.slice(1).every((value, i) => value < samples[i] - .1)).toBe(true);
    for (let i = 1; i < samples.length; i++) expect(samples[i] - samples[i - 1]).toBeCloseTo(-20, 1);
    await cdp.send('Input.dispatchTouchEvent', {type:'touchEnd',touchPoints:[]});
    await expect(page.locator('.welcome-card[data-current=true]')).toHaveAttribute('aria-label','第 2 张，共 3 张');
    await expect(page.locator('.welcome-card[data-current=true] .welcome-window')).toHaveJSProperty('inert',false);
    await test.info().attach('long-contact-positions',{body:JSON.stringify(samples),contentType:'application/json'});
    await cdp.detach();
  });
});

test('opaque cards retain rounded depth shading without full-card backdrop filters', async ({ page }) => {
  for (const [width,height] of [[390,844],[1440,900]]) {
    await page.setViewportSize({width,height}); await page.goto('/introduction');
    const first = page.locator('.welcome-card').first(), stage = (await page.locator('.welcome-stage').boundingBox())!;
    await expect(first).toHaveCSS('opacity','1');
    expect(await first.locator('.welcome-shade').evaluate(el => getComputedStyle(el).opacity)).toBe('0');
    expect(await page.locator('.welcome-card').nth(1).locator('.welcome-shade').evaluate(el => getComputedStyle(el).opacity)).toBe('0.18');
    await page.mouse.move(stage.x + stage.width * .65, stage.y + 25); await page.mouse.down();
    await page.mouse.move(stage.x + stage.width * .65 - (width < 700 ? 80 : 150), stage.y + 25, {steps:4});
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const blur = await first.locator('.welcome-shade').evaluate(el => {
      const style = getComputedStyle(el);
      return { backdropFilter: style.backdropFilter, opacity: style.opacity };
    });
    expect(blur.backdropFilter).toBe('none');
    const strength = Number(blur.opacity);
    expect(strength).toBeGreaterThan(0); expect(strength).toBeLessThan(.18);
    await expect(page.locator('.welcome-stage')).toHaveCSS('perspective','none');
    await expect(page.locator('.welcome-stage')).toHaveCSS('overflow','visible');
    for (const window of await page.locator('.welcome-window').all()) {
      await expect(window).toHaveCSS('overflow','hidden');
      await expect(window).toHaveCSS('filter','none');
    }
    await page.screenshot({path:test.info().outputPath(`transition-${width}.png`)});
    await page.mouse.up();
    await expect.poll(() => page.locator('.welcome-card[data-current=true] .welcome-shade').evaluate(el => getComputedStyle(el).opacity)).toBe('0');
  }
});


for (const locale of ['zh-Hans','en','ar'] as const) test.describe(`stable caption ${locale}`, () => {
  test.use({locale});
  test('different caption lengths do not resize the stage or move Start during transitions', async ({page}) => {
    for (const [width,height] of [[320,700],[390,844],[1440,740]]) {
      await page.setViewportSize({width,height}); await page.goto('/introduction');
      await page.evaluate(()=>document.fonts.ready);
      const rows:number[][]=[];
      for (const index of [0,1,2,0]) {
        await page.locator('.welcome-dots button').nth(index).click();
        await expect(page.locator('.welcome-card[data-current=true]')).toHaveAttribute('aria-label',languagePacks[locale].onboarding.slideN.replace('{n}',String(index+1)));
        rows.push(await page.evaluate(()=>[...document.querySelectorAll('.welcome-stage,.welcome-start')].flatMap(el=>{const r=el.getBoundingClientRect();return [r.y,r.height];})));
      }
      for(let column=0;column<rows[0].length;column++) expect(Math.max(...rows.map(row=>row[column]))-Math.min(...rows.map(row=>row[column]))).toBeLessThanOrEqual(1);
    }
  });
});


test('navigation uses the nearest loop copy and a fast release does not overshoot its card', async ({page}) => {
  await page.clock.install(); await page.setViewportSize({width:1440,height:900}); await page.goto('/introduction');
  await expect(page.locator('.welcome')).toBeVisible();
  await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+1000));
  await page.locator('.welcome-card[data-current=true] .desktop-nav a[href="/settings"]').click();
  await page.clock.runFor(100);
  expect(await page.locator('.welcome-card').first().evaluate(el=>new DOMMatrixReadOnly(getComputedStyle(el).transform).m41)).toBeGreaterThan(0);
  await page.clock.runFor(1000); await page.locator('.welcome-dots button').first().click(); await page.clock.runFor(1000);
  const stage=(await page.locator('.welcome-stage').boundingBox())!, first=page.locator('.welcome-card').first();
  const distance=Math.max(90,(await first.evaluate(el=>(el as HTMLElement).offsetWidth))*.92+12);
  const x=stage.x+stage.width*.7,y=stage.y+25;
  await page.mouse.move(x,y); await page.mouse.down();
  for(const fraction of [.25,.5,.75,.99]) {await page.clock.runFor(16);await page.mouse.move(x-fraction*distance,y);}
  await page.mouse.up();const positions:number[]=[];
  for(let i=0;i<50;i++){await page.clock.runFor(16);positions.push(await first.evaluate(el=>new DOMMatrixReadOnly(getComputedStyle(el).transform).m41));}
  expect(Math.min(...positions)).toBeGreaterThanOrEqual(positions.at(-1)!-.1);
});

for (const [locale, colorScheme] of [['zh-Hans', 'light'], ['en', 'dark'], ['ar', 'dark']] as const) test.describe(`slow touch ${locale}/${colorScheme}`, () => {
  test.use({ hasTouch: true, locale, colorScheme });
  test('held contact stays stable through pauses and reversal, then permits vertical reading', async ({ page, context }, info) => {
    await page.setViewportSize({ width: 390, height: 700 }); await page.goto('/introduction');
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
    const first = page.locator('.welcome-card').first(), content = first.locator('.welcome-content');
    await expect(first).toHaveAttribute('data-current', 'true');
    await content.evaluate(el => { el.scrollTop = 60; });
    const scroll = await content.evaluate(el => el.scrollTop), box = (await content.boundingBox())!;
    const x = box.x + box.width * .85, y = box.y + box.height * .55, rtl = locale === 'ar' ? -1 : 1;
    const cdp = await context.newCDPSession(page), samples: { dx: number; x: number; width: number; scroll: number }[] = [];
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.evaluate(() => {
      (window as unknown as { cancelledTouches: number }).cancelledTouches = 0;
      document.querySelector('.welcome-stage')!.addEventListener('pointercancel', () => { (window as unknown as { cancelledTouches: number }).cancelledTouches++; });
    });
    try {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      const offsets = Array.from({ length: 33 }, (_, i) => 16 + i * 4);
      for (const dx of [...offsets, ...offsets.slice(0, -1).reverse()]) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - dx * rtl, y: y + 1 }] });
        await page.waitForTimeout(50);
        const sample = await first.evaluate(el => { const r = el.getBoundingClientRect(); return { x: r.x, width: r.width, scroll: el.querySelector('.welcome-content')!.scrollTop }; });
        samples.push({ dx, ...sample });
        expect(sample.scroll).toBe(scroll);
        if (dx === 80) {
          await page.waitForTimeout(220);
          const held = (await first.boundingBox())!;
          expect(Math.abs(held.x - sample.x)).toBeLessThan(.1); expect(Math.abs(held.width - sample.width)).toBeLessThan(.1);
        }
        if (samples.length === 22) await page.screenshot({ path: info.outputPath('slow-held-contact.png') });
      }
      for (let i = 1; i < samples.length; i++) {
        expect(Math.abs(samples[i].x - samples[i - 1].x)).toBeLessThan(6);
        expect(Math.abs(samples[i].width - samples[i - 1].width)).toBeLessThan(6);
      }
      expect(await page.evaluate(() => (window as unknown as { cancelledTouches: number }).cancelledTouches)).toBe(0);
      await page.waitForTimeout(220);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await expect.poll(() => first.locator('.welcome-shade').evaluate(el => getComputedStyle(el).opacity)).toBe('0');
      await expect(first).toHaveAttribute('data-current', 'true');
      const resting = (await content.boundingBox())!, sx = resting.x + resting.width / 2, sy = resting.y + resting.height - 20;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy }] });
      for (const dy of [30, 60, 100]) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx, y: sy - dy }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await expect.poll(() => content.evaluate(el => el.scrollTop)).toBeGreaterThan(scroll);
      await expect(first).toHaveAttribute('data-current', 'true');
      await expect(content).toHaveJSProperty('scrollLeft', 0);
      await info.attach('slow-touch-geometry', { body: JSON.stringify(samples), contentType: 'application/json' });
    } finally { await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }); await cdp.detach(); }
  });
});

test('cards stay opaque and separate across desktop and mobile loop reversals', async ({page},info)=>{
  await page.emulateMedia({reducedMotion:'no-preference'}); await page.clock.install();
  for (const width of [390,1440,2560,3840]) {
  await page.clock.resume();
  await page.setViewportSize({width,height:900});
  await page.goto('/introduction');
  await expect(page.locator('.welcome')).toBeVisible();
  await page.clock.pauseAt(new Date(await page.evaluate(()=>Date.now())+1000));
  const stage=page.locator('.welcome-stage'),box=(await stage.boundingBox())!,cardWidth=await page.locator('.welcome-card').first().evaluate(el=>(el as HTMLElement).offsetWidth);
  const x=box.x+box.width*.8,y=box.y+8,distance=Math.max(cardWidth*.92+12,(width+cardWidth*.8+64)/3);
  await page.mouse.move(x,y);await page.mouse.down();
  const shots:string[]=[];
  // Compare the same subpixel displacement on either side of the selection boundary.
  const epsilon = .06 / distance;
  for(const fraction of [.5-epsilon,.5+epsilon,.5-epsilon,.5+epsilon]){
    await page.mouse.move(x-fraction*distance,y);await page.clock.runFor(16);
    const surfaces = await page.locator('.welcome-card').evaluateAll(cards => cards.slice(0,2).map(card => {
      const r = card.getBoundingClientRect(); return {left:r.left,right:r.right,opacity:getComputedStyle(card).opacity};
    }));
    expect(surfaces.map(card=>card.opacity)).toEqual(['1','1']);
    expect(surfaces[1].left-surfaces[0].right).toBeGreaterThan(8);
    shots.push((await page.screenshot({clip:{x:0,y:box.y,width,height:box.height}})).toString('base64'));
  }
  const diffs=await page.evaluate(async shots=>{
    const pixels: Uint8ClampedArray[]=[];
    for(const shot of shots){const img=new Image();img.src='data:image/png;base64,'+shot;await img.decode();const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;const context=canvas.getContext('2d')!;context.drawImage(img,0,0);pixels.push(context.getImageData(0,0,img.width,img.height).data);}
    return pixels.slice(1).map((p,i)=>{let changed=0,total=0;for(let j=0;j<p.length;j+=4){let delta=0;for(let k=0;k<3;k++)delta=Math.max(delta,Math.abs(p[j+k]-pixels[i][j+k]));if(delta>24)changed++;total++;}return changed/total;});
  },shots);
  await info.attach('handoff-pixel-differences',{body:JSON.stringify(diffs),contentType:'application/json'});
  for(let i=0;i<shots.length;i++)await info.attach(`handoff-${i}`,{body:Buffer.from(shots[i],'base64'),contentType:'image/png'});
  expect(Math.max(...diffs)).toBeLessThan(.02);
  await page.mouse.up();
  }
});

for (const [locale, colorScheme] of [['zh-Hans', 'light'], ['en', 'dark'], ['ar', 'dark']] as const) test.describe(`short landscape ${locale}`, () => {
  test.use({ locale, colorScheme });
  test('cards have no inner cutoff and controls remain below every slide across layout boundaries', async ({ page }, info) => {
    test.setTimeout(90000);
    await page.goto('/introduction');
    for (const [width, height, font] of [[960,600],[900,600],[976,650],[960,650],[960,651],[844,390],[568,320],[568,300],[568,300,'Verdana,sans-serif']] as const) {
      await page.setViewportSize({ width, height });
      await page.locator('.welcome-caption').evaluate((element, font) => { (element as HTMLElement).style.fontFamily = font ?? ''; }, font);
      await expect(page.locator('.welcome-stage')).toHaveCSS('overflow', 'visible');
      for (let index = 0; index < 3; index++) {
        await page.locator('.welcome-dots button').nth(index).click();
        const current = page.locator('.welcome-card[data-current=true]');
        await expect(current).toHaveAttribute('aria-label', languagePacks[locale].onboarding.slideN.replace('{n}', String(index + 1)));
        await expect(current).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
        const caption = (await page.locator('.welcome-caption').boundingBox())!;
        for (const card of await page.locator('.welcome-card').all()) {
          const box = (await card.boundingBox())!;
          expect(box.y).toBeGreaterThanOrEqual(0);
          expect(box.y + box.height).toBeLessThanOrEqual(caption.y);
        }
        const start = (await page.locator('.welcome-start').boundingBox())!;
        expect(start.y + start.height).toBeLessThanOrEqual(height);
        expect(start.height).toBeGreaterThanOrEqual(44);
        expect(await page.locator('.welcome-start').evaluate(el => {
          const r = el.getBoundingClientRect(); return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === el;
        })).toBe(true);
        const content = current.locator('.welcome-content');
        expect(await content.evaluate(el => el.clientHeight)).toBeGreaterThanOrEqual(44);
        if (await content.evaluate(el => el.scrollHeight > el.clientHeight)) {
          await content.evaluate(el => { el.scrollTop = 0; });
          await content.hover(); await page.mouse.wheel(0, 250);
          await expect.poll(() => content.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
        }
        if (index === 0) {
          await content.evaluate(el => { el.scrollTop = 0; });
          await page.screenshot({ path: info.outputPath(`${width}x${height}-${locale}-${colorScheme}${font ? '-wide-font' : ''}.png`) });
        }
      }
    }
    await page.locator('.welcome-start').click(); await expect(page).toHaveURL(/\/start$/);
  });
});

for (const [locale, colorScheme] of [['zh-Hans','light'],['en','dark'],['ar','dark']] as const) for (const hasTouch of [false,true]) test.describe(`side cards ${locale} ${hasTouch ? 'touch' : 'mouse'}`, () => {
  test.use({ locale, colorScheme, hasTouch });
  test('select either visible neighbour without activating its inert content', async ({ page }) => {
    for (const [width,height] of [[1440,900],[390,844],[960,600]]) {
      await page.setViewportSize({width,height}); await page.goto('/introduction');
      for (const index of [1,0,2,0]) {
        const side = page.locator('.welcome-card').nth(index);
        await expect(side).toHaveAttribute('data-current','false');
        await expect(side.locator('.welcome-window')).toHaveJSProperty('inert',true);
        const box = (await side.boundingBox())!;
        const x = (Math.max(0,box.x) + Math.min(width,box.x + box.width)) / 2, y = box.y + Math.min(80,box.height / 2);
        if (hasTouch) await page.touchscreen.tap(x,y); else await page.mouse.click(x,y);
        await expect(side).toHaveAttribute('data-current','true');
        await expect(side).toHaveCSS('transform','matrix(1, 0, 0, 1, 0, 0)');
        await expect(side.locator('.welcome-window')).toHaveJSProperty('inert',false);
        await expect(page).toHaveURL(/\/introduction$/);
      }
    }
  });
});

test('side card drags do not become clicks and reduced-motion navigation does not bounce back', async ({ page }) => {
  await page.setViewportSize({width:1440,height:900}); await page.goto('/introduction');
  const side = page.locator('.welcome-card').nth(1), first = page.locator('.welcome-card').first();
  for (const [dx,dy] of [[40,0],[0,40]]) {
    const box = (await side.boundingBox())!, x = (box.x + 1440) / 2, y = box.y + 80;
    await page.mouse.move(x,y); await page.mouse.down(); await page.mouse.move(x + dx,y + dy,{steps:5});
    await page.waitForTimeout(150); await page.mouse.up(); await page.waitForTimeout(850);
    await expect(first).toHaveAttribute('data-current','true');
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  await first.locator('.desktop-nav a[href="/library"]').focus();
  await page.keyboard.press('Enter');
  await expect(side).toHaveAttribute('data-current','true');
  await expect(side).toHaveCSS('transform','none');
  await expect(page).toHaveURL(/\/introduction$/);
});
