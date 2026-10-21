import { expect, test } from '@playwright/test';
import { languagePacks } from '../../src/locales';

test('pages and introduction previews share the Settings top spacing', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [1440, 900, 375]) {
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
  }
});

test('first visit introduces the app before existing choices and remembers only explicit Start', async ({ page }) => {
  await page.goto('/'); await expect(page).toHaveURL(/\/introduction$/);
  await expect(page.locator('.welcome')).toBeVisible(); await expect(page.locator('.first-run')).toHaveCount(0);
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
  // Native scrolling can continue after contact has ended, including outside the stage.
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
  // Browser sampling must not turn one continuous gesture into separated wheel bursts.
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
    await expect(card).toHaveCSS('z-index', 'auto'); await expect(card.locator('.welcome-window')).toHaveCSS('filter', (await card.getAttribute('data-current')) === 'true' ? 'blur(0px)' : 'blur(3px)');
  }
});

for (const [locale, theme] of [['zh-Hans', 'light'], ['en', 'dark'], ['ar', 'dark']] as const) test.describe(`whole card surfaces ${locale}/${theme}`, () => {
  test.use({ locale, colorScheme: theme });
  test('forward, backward and interrupted drags never intersect the visible card planes', async ({ page }, info) => {
    await page.clock.install();
    const samples: { width: number; selected: number; offset: number; intersections: number[][] }[] = [];
    for (const [width, height] of [[1440, 900], [390, 844], [844, 390]]) {
      await page.setViewportSize({ width, height }); await page.goto('/introduction'); await expect(page.locator('.welcome')).toBeVisible();
      for (let selected = 0; selected < 3; selected++) {
        await page.locator('.welcome-dots button').nth(selected).click(); await page.clock.runFor(1000);
        const box = (await page.locator('.welcome-stage').boundingBox())!;
        const cardWidth = await page.locator('.welcome-card').first().evaluate(el => (el as HTMLElement).offsetWidth);
        const shift = width < 700 ? Math.min(75, box.width * .18) : Math.min(300, Math.max(24, (box.width - cardWidth * .85) / 2));
        const start = { x: box.x + box.width / 2, y: box.y + 4 };
        await page.mouse.move(start.x, start.y); await page.mouse.down();
        // Hold contact across both depth handoffs, then reverse before releasing.
        for (const offset of [.1, .25, .4, .49, .5, .51, .6, .9, 1, .6, .1, -.1, -.4, -.49, -.5, -.51, -.6, -1, -.4, 0]) {
          await page.mouse.move(start.x - offset * Math.max(90, shift * 1.1), start.y); await page.clock.runFor(16);
          const intersections = await page.locator('.welcome-card').evaluateAll(elements => {
            const planes = elements.map(element => {
              const style = getComputedStyle(element), m = new DOMMatrixReadOnly(style.transform), half = (element as HTMLElement).offsetWidth * m.m11 / 2;
              return { x: m.m41, z: m.m43, slope: m.m13 / m.m11, left: m.m41 - half, right: m.m41 + half, visible: Number(style.opacity) > .01 };
            });
            const cuts: number[][] = [];
            for (let a = 0; a < planes.length; a++) for (let b = a + 1; b < planes.length; b++) {
              const one = planes[a], two = planes[b], left = Math.max(one.left, two.left), right = Math.min(one.right, two.right);
              if (!one.visible || !two.visible || right <= left) continue;
              const depth = (x: number) => one.z + one.slope * (x - one.x) - two.z - two.slope * (x - two.x);
              if (depth(left) * depth(right) < -.01) cuts.push([a, b]);
            }
            return cuts;
          });
          samples.push({ width, selected, offset, intersections });
          expect(intersections, `intersecting planes at ${width}px, card ${selected}, drag ${offset}`).toEqual([]);
        }
        await page.mouse.up(); await page.clock.runFor(1000);
      }
      for (const card of await page.locator('.welcome-card').all()) {
        await expect(card).toHaveCSS('transform-style', 'flat'); await expect(card).toHaveCSS('isolation', 'isolate');
      }
    }
    await info.attach('sampled-card-planes', { body: JSON.stringify(samples), contentType: 'application/json' });
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

test('keyboard direction follows RTL and preview-only controls cannot receive focus', async ({ page }) => {
  await page.goto('/settings');
  const { selectPicker } = await import('./picker');
  await selectPicker(page, (await page.locator('.settings-language .setting-trigger').getAttribute('aria-label'))!, 'ar');
  await page.goto('/introduction'); await expect(page.locator('.welcome')).toBeVisible();
  const current = page.locator('.welcome-card[data-current=true]');
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
      await expect(side.locator('.welcome-window')).toHaveCSS('filter', 'blur(3px)');
      await expect(side.locator('.welcome-shade')).toHaveCSS('opacity', '0.18');
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
  expect(await scroll.evaluate(el => getComputedStyle(el).scrollbarWidth === 'none' || getComputedStyle(el, '::-webkit-scrollbar').display === 'none')).toBe(true);
  await scroll.hover(); await page.mouse.wheel(0, 120);
  await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  await expect(page.locator('.welcome-card[data-current=true]')).toHaveAttribute('aria-label', '第 1 张，共 3 张');
  await scroll.evaluate(el => el.scrollTop = el.scrollHeight); await expect(preview.locator('.practice-card-action')).not.toHaveAttribute('disabled');
  await normal.close();
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
    expect(samples.slice(1).every((value, i) => Math.abs(value - samples[i]) < 20)).toBe(true);
    await cdp.send('Input.dispatchTouchEvent', {type:'touchEnd',touchPoints:[]});
    await expect(page.locator('.welcome-card[data-current=true]')).toHaveAttribute('aria-label','第 2 张，共 3 张');
    await expect(page.locator('.welcome-card[data-current=true] .welcome-window')).toHaveJSProperty('inert',false);
    await test.info().attach('long-contact-positions',{body:JSON.stringify(samples),contentType:'application/json'});
    await cdp.detach();
  });
});

test('card contents blur continuously with depth and stay inside the rounded window', async ({ page }) => {
  for (const [width,height] of [[390,844],[1440,900]]) {
    await page.setViewportSize({width,height}); await page.goto('/introduction');
    const first = page.locator('.welcome-card').first(), stage = (await page.locator('.welcome-stage').boundingBox())!;
    await expect(first.locator('.welcome-window')).toHaveCSS('filter','blur(0px)');
    await expect(page.locator('.welcome-card').nth(1).locator('.welcome-window')).toHaveCSS('filter','blur(3px)');
    await page.mouse.move(stage.x + stage.width * .65, stage.y + 25); await page.mouse.down();
    await page.mouse.move(stage.x + stage.width * .65 - (width < 700 ? 80 : 150), stage.y + 25, {steps:4});
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const blur = await first.locator('.welcome-window').evaluate(el => parseFloat(getComputedStyle(el).filter.slice(5)));
    expect(blur).toBeGreaterThan(0); expect(blur).toBeLessThan(3);
    for (const window of await page.locator('.welcome-window').all()) await expect(window).toHaveCSS('overflow','hidden');
    await page.screenshot({path:test.info().outputPath(`transition-${width}.png`)});
    await page.mouse.up();
    await expect(page.locator('.welcome-card[data-current=true] .welcome-window')).toHaveCSS('filter','blur(0px)');
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
  const shift=Math.min(300,Math.max(24,(stage.width-(await first.boundingBox())!.width*.85)/2)), distance=Math.max(90,shift*1.1);
  const x=stage.x+stage.width*.7,y=stage.y+25;
  await page.mouse.move(x,y); await page.mouse.down();
  for(const fraction of [.25,.5,.75,.99]) {await page.clock.runFor(16);await page.mouse.move(x-fraction*distance,y);}
  await page.mouse.up();const positions:number[]=[];
  for(let i=0;i<50;i++){await page.clock.runFor(16);positions.push(await first.evaluate(el=>new DOMMatrixReadOnly(getComputedStyle(el).transform).m41));}
  expect(Math.min(...positions)).toBeGreaterThanOrEqual(positions.at(-1)!-.1);
});
