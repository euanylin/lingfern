import { expect, test, type Locator } from '@playwright/test';
import { selectPicker } from './picker';
import { readFileSync } from 'node:fs';

async function readyForTouch(control: Locator) {
  await control.evaluate(el => el.scrollIntoView({ block: 'center' }));
  await control.click({ trial: true });
}

for (const [locale, theme] of [['zh-Hans', 'light'], ['en', 'dark'], ['ar', 'dark']] as const) test(`Test keeps its desktop feedback during touch and keyboard focus: ${locale}/${theme}`, async ({ browser }, info) => {
  let desktopColor = '';
  for (const hasTouch of [false, true]) {
    const context = await browser.newContext({ baseURL: info.project.use.baseURL, locale, colorScheme: theme, hasTouch, viewport: { width: hasTouch ? 390 : 1440, height: 900 } });
    const page = await context.newPage(); await page.goto('/today');
    await page.evaluate(async ({ fixture, locale }) => {
      const { createElement } = (await import('/node_modules/.vite/deps/react.js' as string)).default;
      const { createRoot } = (await import('/node_modules/.vite/deps/react-dom_client.js' as string)).default;
      const { TaskDetail } = await import('/src/app/TaskDetail.tsx' as string);
      const host = document.createElement('div'); document.body.appendChild(host);
      createRoot(host).render(createElement(TaskDetail, { lesson: fixture, locale, profileId: 'local-guest', action: 'Practice', available: true, busy: false, startError: '', onStart: async () => {}, onCheck: async () => {}, onClose: () => {} }));
    }, { fixture: JSON.parse(readFileSync(new URL('../fixtures/content/a1-reading.json', import.meta.url), 'utf8')), locale });
    const control = page.locator('.task-detail [data-mode=test]');
    await expect(control).toBeEnabled(); await control.scrollIntoViewIfNeeded();
    const idle = await control.evaluate(el => getComputedStyle(el).backgroundColor), box = (await control.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
    if (!hasTouch) {
      desktopColor = idle; await control.hover(); await expect(control).toHaveCSS('background-color', desktopColor);
      await page.mouse.down(); await expect(control).toHaveCSS('background-color', desktopColor); await page.mouse.up();
      await page.screenshot({ path: info.outputPath(`test-desktop-${locale}-${theme}.png`) });
      await page.mouse.move(0, 0);
    } else {
      expect(idle).toBe(desktopColor);
      const cdp = await context.newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
      await expect(control).toHaveAttribute('data-touch-active', '');
      await expect(control).toHaveCSS('background-color', desktopColor);
      await page.screenshot({ path: info.outputPath(`test-touch-${locale}-${theme}.png`) });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      await expect(control).not.toHaveAttribute('data-touch-active'); await expect(control).toHaveCSS('background-color', idle);
      await cdp.detach();
    }
    await control.press('Tab'); await page.keyboard.press('Shift+Tab');
    await expect(control).toBeFocused(); await expect(control).toHaveCSS('text-decoration-line', 'underline');
    await expect(control).toHaveCSS('background-color', desktopColor);
    await context.close();
  }
});

test.describe('touch feedback', () => {
  test.use({ hasTouch: true });
  test('primary links and both History buttons use their desktop colours during touch contact', async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.route('**/api/session', route => route.fulfill({ json: { account: null, syncAvailable: false } }));
    const cdp = await context.newCDPSession(page);
    for (const [path, selector, token] of [['/settings', '.github-connect:not(:disabled)', '--primary-hover'], ['/today', '.practice-section-heading .records-link', '--button-hover'], ['/library', '.library-history-entry .records-link', '--button-hover']]) {
      await page.goto(path);
      const control = page.locator(selector).first();
      await expect(control).toBeVisible(); await control.scrollIntoViewIfNeeded();
      const expected = await control.evaluate((element, token) => { const sample = document.createElement('span'); sample.style.backgroundColor = getComputedStyle(element).getPropertyValue(token); document.body.appendChild(sample); const color = getComputedStyle(sample).backgroundColor; sample.remove(); return color; }, token);
      const idle = await control.evaluate(element => getComputedStyle(element).backgroundColor), box = (await control.boundingBox())!;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
      await expect(control).toHaveAttribute('data-touch-active', '');
      await expect.poll(() => control.evaluate(element => getComputedStyle(element).backgroundColor)).toBe(expected);
      expect(expected).not.toBe(idle);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      await expect(control).not.toHaveAttribute('data-touch-active');
      await expect.poll(() => control.evaluate(element => getComputedStyle(element).backgroundColor)).toBe(idle);
    }
    await cdp.detach();
  });
  for (const [width, locale, theme] of [[375, 'zh-Hans', 'light'], [1440, 'en', 'dark'], [390, 'ar', 'dark']] as const) test(`practice settings and their topic pickers retain touch feedback while open: ${width}/${locale}/${theme}`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 900 }); await page.goto('/settings');
    await selectPicker(page, (await page.locator('.settings-language .setting-trigger').getAttribute('aria-label'))!, locale);
    await selectPicker(page, (await page.locator('.settings-appearance .setting-trigger').first().getAttribute('aria-label'))!, theme);
    await page.goto('/today');
    const chips = page.locator('.practice-card-topics .setting-trigger'), cdp = await context.newCDPSession(page);
    await expect(chips).toHaveCount(5);
    for (const chip of await chips.all()) {
      await readyForTouch(chip);
      const idle = await chip.evaluate(el => getComputedStyle(el).backgroundColor), box = (await chip.boundingBox())!;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
      await expect(chip).toHaveAttribute('data-touch-active', '');
      await expect.poll(() => chip.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(idle);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await expect(chip).toHaveAttribute('aria-expanded', 'true'); await expect(chip).not.toHaveAttribute('data-touch-active');
      await expect.poll(() => chip.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(idle);
      await expect(chip).toHaveCSS('outline-style', 'none');
      await expect.poll(() => chip.locator('.setting-chevron').evaluate(el => getComputedStyle(el).translate)).toBe(locale === 'ar' ? '-2px' : '2px');
      const settings = page.locator('.practice-options-dialog'); await expect(settings).toBeVisible();
      await settings.locator('.setting-trigger').first().tap(); await expect(settings.getByRole('listbox')).toBeVisible();
      await settings.getByRole('listbox').getByRole('option').first().tap();
      await page.keyboard.press('Escape'); await expect(settings.getByRole('listbox')).toHaveCount(0);
      await page.keyboard.press('Escape'); await expect(settings).toHaveCount(0); await expect(chip).toHaveAttribute('aria-expanded', 'false');
      await expect(chip).toBeFocused();
    }
    await page.emulateMedia({ reducedMotion: 'reduce' }); await chips.first().tap();
    await expect(chips.first()).toHaveCSS('scale', 'none'); await expect(chips.first()).toHaveCSS('translate', 'none');
    await expect(page.locator('.practice-options-dialog')).toBeVisible(); await page.keyboard.press('Escape'); await cdp.detach();
  });
  for (const [width, locale, theme] of [[375, 'zh-Hans', 'light'], [900, 'en', 'dark'], [1440, 'ar', 'dark']] as const) test(`native touch shows and clears control feedback at ${width}/${locale}/${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/settings');
    await selectPicker(page, (await page.locator('.settings-language .setting-trigger').getAttribute('aria-label'))!, locale);
    await selectPicker(page, (await page.locator('.settings-appearance .setting-trigger').first().getAttribute('aria-label'))!, theme);
    const trigger = page.locator('.settings-language .setting-trigger');
    await readyForTouch(trigger);
    const idle = await trigger.evaluate(el => ({ color: getComputedStyle(el).backgroundColor, width: el.getBoundingClientRect().width }));
    const cdp = await page.context().newCDPSession(page), box = (await trigger.boundingBox())!;
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await expect.poll(() => trigger.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(idle.color);
    await expect(trigger).toHaveCSS('box-shadow', 'none');
    expect((await trigger.boundingBox())!.width).toBeCloseTo(idle.width, 1);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.getByRole('listbox')).toBeVisible();
    await expect(trigger).not.toHaveAttribute('data-touch-active');
    await page.getByRole('listbox').locator(`[role=option][data-value="${locale}"]`).tap();
    await expect.poll(() => trigger.evaluate(el => getComputedStyle(el).backgroundColor)).toBe(idle.color);
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveCSS('box-shadow', 'none');
    await trigger.press('Tab'); await page.keyboard.press('Shift+Tab');
    await expect(trigger).toHaveCSS('box-shadow', 'none');
    await expect.poll(() => trigger.evaluate(el => getComputedStyle(el.firstElementChild!).textDecorationLine)).toBe('underline');
    await test.info().attach('touch-control-state', { body: JSON.stringify({ width, locale, theme, idle }), contentType: 'application/json' });
    await cdp.detach();
  });

  test('wide touch task preview responds to actual touch and clears after release', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 }); await page.goto('/today');
    await page.locator('.task-row').first().getByRole('button').tap();
    const dialog = page.locator('.task-detail'); await expect(dialog).toHaveCSS('opacity', '1');
    await expect(dialog).toHaveAttribute('data-blur', 'false');
    const body = dialog.locator('.task-detail-body'), box = (await body.boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + 50, y: box.y + 130 }] });
    await expect(dialog).toHaveAttribute('data-blur', 'true');
    await expect.poll(() => dialog.evaluate(el => getComputedStyle(el, '::backdrop').backdropFilter)).toBe('blur(3px)');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(dialog).toHaveAttribute('data-blur', 'false');
    await expect.poll(() => dialog.evaluate(el => getComputedStyle(el, '::backdrop').backdropFilter)).toBe('blur(0px)');
    await page.mouse.move(box.x + 50, box.y + 130); await expect(dialog).toHaveAttribute('data-blur', 'true');
    await page.mouse.move(20, 300); await expect(dialog).toHaveAttribute('data-blur', 'false');
    await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await cdp.detach();
  });

  test('native scrolling and cancellation clear feedback without opening a picker', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 }); await page.goto('/settings');
    const trigger = page.locator('.settings-language .setting-trigger');
    await readyForTouch(trigger);
    const box = (await trigger.boundingBox())!, point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const cdp = await page.context().newCDPSession(page);
    for (const cancel of [false, true]) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
      await expect(trigger).toHaveAttribute('data-touch-active', '');
      if (cancel) await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      else {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, y: point.y + 60 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      }
      await expect(trigger).not.toHaveAttribute('data-touch-active'); await expect(page.getByRole('listbox')).toHaveCount(0);
    }
    await expect(page.locator('[data-touch-active]')).toHaveCount(0); await cdp.detach();
  });

  test('touch and keyboard navigation use filled focus cues without bright rings', async ({ page, context }, info) => {
    await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/settings');
    const library = page.locator('.mobile-nav a[href="/library"]');
    await library.focus(); await library.press('ArrowRight');
    await expect(library).toHaveCSS('outline-width', '0px');
    const box = (await library.boundingBox())!, cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
    await expect(library).toHaveCSS('outline-width', '0px');
    await page.screenshot({ path: info.outputPath('touch-navigation-no-ring.png') });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page).toHaveURL(/\/library$/); await expect(library).toHaveCSS('outline-width', '0px');
    await page.keyboard.press('Tab');
    await expect(page.locator('.mobile-nav a[href="/settings"]')).toBeFocused();
    await expect(page.locator('.mobile-nav a[href="/settings"]')).toHaveCSS('outline-width', '0px');
    await cdp.detach();
  });

  test('typing after touch focus keeps native text entry without restoring a bright ring', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/library/dictionary');
    const query = page.locator('#dictionary-query'); await query.tap(); await page.keyboard.type('dad');
    await expect(page.locator('html')).toHaveAttribute('data-touch-input', '');
    await expect(query).toBeFocused(); await expect(query).toHaveValue('dad');
    await expect(query).toHaveCSS('outline-style', 'none');
    await expect(query).toHaveCSS('box-shadow', 'none');
    await page.keyboard.press('Tab'); await expect(page.locator('html')).not.toHaveAttribute('data-touch-input');
  });

  test('touching resource labels keeps native selection and ignores disabled actions', async ({ page, context }) => {
    await page.setViewportSize({ width: 375, height: 812 }); await page.goto('/library');
    const row = page.locator('.package-row').filter({ hasText: '英英词典' });
    await readyForTouch(row);
    const box = (await row.boundingBox())!, point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await expect(row).toHaveAttribute('data-touch-active', '');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(row.locator('input')).toBeChecked(); await expect(row).not.toHaveAttribute('data-touch-active');
    await context.setOffline(true);
    const download = page.locator('.offline-actions .primary'); await expect(download).toBeDisabled();
    const disabled = (await download.boundingBox())!;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: disabled.x + disabled.width / 2, y: disabled.y + disabled.height / 2 }] });
    await expect(download).not.toHaveAttribute('data-touch-active');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(row.locator('input')).toBeChecked(); await context.setOffline(false); await cdp.detach();
  });

  test('audio scrubbing retains contact feedback and reduced motion retains a static cue', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 }); await page.goto('/today');
    const raw = JSON.parse(readFileSync(new URL('../fixtures/content/a2-listening.json', import.meta.url), 'utf8'));
    const id = await page.evaluate(async raw => {
      const { organizePractice } = await import('/src/core/practiceOrganization.ts' as string);
      return (await (await import('/src/data/db.ts' as string)).createSession(organizePractice(raw))).id;
    }, raw);
    await page.goto(`/learn/${id}`);
    const slider = page.locator('.audio-timeline input[type=range]'); await expect(slider).toBeEnabled();
    await readyForTouch(slider);
    const box = (await slider.boundingBox())!, cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + 8, y: box.y + box.height / 2 }] });
    await expect(slider).toHaveAttribute('data-touch-active', '');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + box.width - 12, y: box.y + box.height / 2 }] });
    await expect(slider).toHaveAttribute('data-touch-active', ''); expect(Number(await slider.inputValue())).toBeGreaterThan(0);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const thumb = await slider.evaluate(el => ({ transform: getComputedStyle(el, '::-webkit-slider-thumb').transform, shadow: getComputedStyle(el, '::-webkit-slider-thumb').boxShadow }));
    expect(thumb.transform).toBe('none');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await expect(slider).not.toHaveAttribute('data-touch-active'); await cdp.detach();
  });
});

for (const theme of ['light', 'dark']) test(`desktop search and keyboard controls use clear focus without bright frames: ${theme}`, async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto('/settings');
  await selectPicker(page, (await page.locator('.settings-appearance .setting-trigger').first().getAttribute('aria-label'))!, theme);
  await page.goto('/library');
  const field = page.locator('.offline-search'), input = field.locator('input');
  const idle = await field.evaluate(el => getComputedStyle(el).backgroundColor);
  await input.click(); await input.fill('test');
  await expect(input).toHaveCSS('outline-style', 'none'); await expect(input).toHaveCSS('box-shadow', 'none');
  await expect(field).toHaveCSS('outline-width', '0px');
  await expect.poll(() => field.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(idle);
  await input.fill(''); await page.goto('/settings');
  const trigger = page.locator('.settings-language .setting-trigger'); await trigger.focus(); await trigger.press('ArrowDown');
  await expect(page.getByRole('listbox')).toBeVisible(); await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused(); await expect(trigger).toHaveCSS('outline-style', 'none'); await expect(trigger).toHaveCSS('box-shadow', 'none');
  await expect(trigger.locator('span').first()).toHaveCSS('text-decoration-line', 'underline');
  await trigger.press('Enter'); await expect(page.getByRole('listbox')).toBeVisible(); await expect(page.getByRole('option').first()).toHaveCSS('outline-style', 'none');
});

test.describe('portable touch feedback', () => {
  test.use({ hasTouch: true });
  for (const [width, locale, theme] of [[375, 'zh-Hans', 'light'], [900, 'en', 'dark'], [768, 'ar', 'light']] as const) test(`quick taps expose visible feedback and return to rest: ${width}/${locale}/${theme}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 }); await page.goto('/settings');
    await selectPicker(page, (await page.locator('.settings-language .setting-trigger').getAttribute('aria-label'))!, locale);
    await selectPicker(page, (await page.locator('.settings-appearance .setting-trigger').first().getAttribute('aria-label'))!, theme);
    const trigger = page.locator('.settings-language .setting-trigger');
    await readyForTouch(trigger);
    const idle = await trigger.evaluate(el => getComputedStyle(el).backgroundColor);
    const samples = trigger.evaluate(el => new Promise<{ active: boolean; shadow: string; background: string }[]>(resolve => {
      const frames: { active: boolean; shadow: string; background: string }[] = [], started = performance.now();
      const frame = () => { frames.push({ active: el.hasAttribute('data-touch-active'), shadow: getComputedStyle(el).boxShadow, background: getComputedStyle(el).backgroundColor }); if (performance.now() - started < 500) requestAnimationFrame(frame); else resolve(frames); };
      requestAnimationFrame(frame);
    }));
    await trigger.tap(); const frames = await samples;
    expect(frames.some(f => f.active && f.background !== idle)).toBe(true);
    expect(frames.filter(f => f.active).every(f => f.shadow === 'none')).toBe(true);
    expect(frames.at(-1)!.active).toBe(false);
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.getByRole('listbox').locator(`[role=option][data-value="${locale}"]`).tap();
    await expect(trigger).toHaveAttribute('data-value', locale);
    await expect(page.locator('[data-touch-active]')).toHaveCount(0);
    await page.screenshot({ path: info.outputPath(`touch-settings-${width}-${locale}-${theme}.png`) });
    await info.attach('touch-feedback-frames', { body: JSON.stringify(frames), contentType: 'application/json' });
  });
});

for (const [locale, theme, width] of [['zh-Hans', 'light', 390], ['en', 'dark', 1440], ['ar', 'dark', 390]] as const) test(`backup restore keeps feedback inside the rounded button: ${locale}/${theme}`, async ({ browser }, info) => {
  const context = await browser.newContext({ baseURL: info.project.use.baseURL, hasTouch: true, viewport: { width, height: 900 } });
  const page = await context.newPage(); await page.goto('/settings');
  await selectPicker(page, (await page.locator('.settings-language .setting-trigger').getAttribute('aria-label'))!, locale);
  await selectPicker(page, (await page.locator('.settings-appearance .setting-trigger').first().getAttribute('aria-label'))!, theme);
  const label = page.locator('.profile-backup .backup-file-label'), button = label.locator('.backup-file-button'), input = label.locator('input');
  await button.scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  await expect.poll(() => button.evaluate(el => el.getAnimations().length)).toBe(0);
  const box = (await button.boundingBox())!, idle = await button.evaluate(el => getComputedStyle(el).backgroundColor);
  expect(box.height).toBeGreaterThanOrEqual(44); expect(box.width).toBeGreaterThanOrEqual(44);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
  await expect(label).toHaveAttribute('data-touch-active', '');
  await expect(label).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(button).not.toHaveCSS('background-color', idle);
  await expect.poll(() => button.evaluate(el => el.getAnimations().length)).toBe(0);
  const active = await button.evaluate(el => getComputedStyle(el).backgroundColor);
  await page.screenshot({ path: info.outputPath(`restore-touch-${locale}-${theme}.png`) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await expect(label).not.toHaveAttribute('data-touch-active'); await expect(button).toHaveCSS('background-color', idle);
  await input.focus(); await input.press('Tab'); await page.keyboard.press('Shift+Tab');
  await expect(input).toBeFocused(); await expect(button).toHaveCSS('background-color', active);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const chooser = page.waitForEvent('filechooser'); await input.press('Enter'); await (await chooser).setFiles([]);
  await expect(label).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await input.evaluate(el => { (el as HTMLInputElement).disabled = true; });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
  await expect(label).not.toHaveAttribute('data-touch-active');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await cdp.detach(); await context.close();
});
