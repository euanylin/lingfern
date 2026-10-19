import { expect, test } from '@playwright/test';
import { selectPicker } from './picker';
import { readFileSync } from 'node:fs';

test.describe('touch feedback', () => {
  test.use({ hasTouch: true });
  for (const [width, locale, theme] of [[375, 'zh-Hans', 'light'], [900, 'en', 'dark'], [1440, 'ar', 'dark']] as const) test(`native touch shows and clears control feedback at ${width}/${locale}/${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/settings');
    await selectPicker(page, (await page.locator('.settings-language .setting-trigger').getAttribute('aria-label'))!, locale);
    await selectPicker(page, (await page.locator('.settings-appearance .setting-trigger').first().getAttribute('aria-label'))!, theme);
    const trigger = page.locator('.settings-language .setting-trigger');
    await trigger.evaluate(el => el.scrollIntoView({ block: 'center' }));
    const idle = await trigger.evaluate(el => ({ color: getComputedStyle(el).backgroundColor, width: el.getBoundingClientRect().width }));
    const cdp = await page.context().newCDPSession(page), box = (await trigger.boundingBox())!;
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await expect.poll(() => trigger.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe(idle.color);
    await expect.poll(() => trigger.evaluate(el => getComputedStyle(el).boxShadow)).not.toBe('none');
    expect((await trigger.boundingBox())!.width).toBeCloseTo(idle.width, 1);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.getByRole('listbox')).toBeVisible();
    await expect(trigger).not.toHaveAttribute('data-touch-active');
    await page.getByRole('listbox').locator(`[role=option][data-value="${locale}"]`).tap();
    await expect.poll(() => trigger.evaluate(el => getComputedStyle(el).backgroundColor)).toBe(idle.color);
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveCSS('box-shadow', 'none');
    await trigger.press('Tab'); await page.keyboard.press('Shift+Tab');
    await expect.poll(() => trigger.evaluate(el => getComputedStyle(el).boxShadow)).not.toBe('none');
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
    await trigger.evaluate(el => el.scrollIntoView({ block: 'center' }));
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

  test('touching resource labels keeps native selection and ignores disabled actions', async ({ page, context }) => {
    await page.setViewportSize({ width: 375, height: 812 }); await page.goto('/library');
    const row = page.locator('.package-row').filter({ hasText: '英英词典' });
    await row.evaluate(el => el.scrollIntoView({ block: 'center' }));
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
    await slider.evaluate(el => el.scrollIntoView({ block: 'center' }));
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

test.describe('portable touch feedback', () => {
  test.use({ hasTouch: true });
  for (const [width, locale, theme] of [[375, 'zh-Hans', 'light'], [900, 'en', 'dark'], [768, 'ar', 'light']] as const) test(`quick taps expose visible feedback and return to rest: ${width}/${locale}/${theme}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 }); await page.goto('/settings');
    await selectPicker(page, (await page.locator('.settings-language .setting-trigger').getAttribute('aria-label'))!, locale);
    await selectPicker(page, (await page.locator('.settings-appearance .setting-trigger').first().getAttribute('aria-label'))!, theme);
    const trigger = page.locator('.settings-language .setting-trigger');
    await trigger.evaluate(el => el.scrollIntoView({ block: 'center' }));
    const samples = trigger.evaluate(el => new Promise<{ active: boolean; shadow: string }[]>(resolve => {
      const frames: { active: boolean; shadow: string }[] = [], started = performance.now();
      const frame = () => { frames.push({ active: el.hasAttribute('data-touch-active'), shadow: getComputedStyle(el).boxShadow }); if (performance.now() - started < 500) requestAnimationFrame(frame); else resolve(frames); };
      requestAnimationFrame(frame);
    }));
    await trigger.tap(); const frames = await samples;
    expect(frames.some(f => f.active && f.shadow !== 'none')).toBe(true);
    expect(frames.at(-1)!.active).toBe(false);
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.getByRole('listbox').locator(`[role=option][data-value="${locale}"]`).tap();
    await expect(trigger).toHaveAttribute('data-value', locale);
    await expect(page.locator('[data-touch-active]')).toHaveCount(0);
    await page.screenshot({ path: info.outputPath(`touch-settings-${width}-${locale}-${theme}.png`) });
    await info.attach('touch-feedback-frames', { body: JSON.stringify(frames), contentType: 'application/json' });
  });
});
