import { expect, test, type Page } from '@playwright/test';
import { languagePacks } from '../../src/locales';
import { selectPicker } from './picker';

const sample = (page: Page) => page.evaluate(() => new Promise<{ present: boolean; open: boolean; blur: number; opacity: number }[]>(resolve => {
  const frames: { present: boolean; open: boolean; blur: number; opacity: number }[] = [], began = performance.now();
  let start: number | undefined;
  const frame = () => {
    const dialog = document.querySelector<HTMLDialogElement>('.task-detail');
    if (dialog && start === undefined) start = performance.now();
    const backdrop = dialog && getComputedStyle(dialog, '::backdrop');
    frames.push({ present: !!dialog, open: !!dialog?.open, blur: Number(/blur\(([\d.]+)px\)/.exec(backdrop?.backdropFilter || backdrop?.getPropertyValue('-webkit-backdrop-filter') || '')?.[1] ?? 0), opacity: dialog ? Number(getComputedStyle(dialog).opacity) : 0 });
    if ((start === undefined || performance.now() - start < 650) && performance.now() - began < 10_000) requestAnimationFrame(frame); else resolve(frames);
  };
  requestAnimationFrame(frame);
}));

for (const width of [1440, 900, 375]) test(`task backdrop follows the mouse across the entire card at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/today');
  const trigger = page.locator('.task-row').first().getByRole('button'), dialog = page.locator('.task-detail');
  await page.mouse.move(-10, -10);
  await trigger.focus(); await trigger.press('Enter'); await expect(dialog).toHaveCSS('opacity', '1');
  await expect(dialog).toHaveAttribute('data-blur', 'false');
  expect(await dialog.evaluate(el => getComputedStyle(el, '::backdrop').backdropFilter)).toBe('blur(0px)');
  const box = (await dialog.boundingBox())!;
  for (const point of [{ x: box.x + 2, y: 200 }, { x: box.x + box.width / 2, y: box.y + box.height - 2 }, { x: box.x + 60, y: 200 }]) {
    await page.mouse.move(point.x, point.y);
    await expect(dialog).toHaveAttribute('data-blur', 'true');
  }
  await dialog.getByRole('button').first().focus();
  await page.mouse.move(-10, -10);
  await expect(dialog.getByRole('button').first()).toBeFocused();
  await expect(dialog).toHaveAttribute('data-blur', 'false');
  await expect.poll(() => dialog.evaluate(el => getComputedStyle(el, '::backdrop').backdropFilter)).toBe('blur(0px)');
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
  await trigger.focus(); await trigger.press('Enter'); await expect(dialog).toHaveCSS('opacity', '1');
  await expect(dialog).toHaveAttribute('data-blur', 'false');
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
  // Keep hover when panels slide beneath a stationary pointer.
  await page.mouse.move(box.x + 60, 200);
  await trigger.focus(); await trigger.press('Enter'); await expect(dialog).toHaveCSS('opacity', '1');
  await expect(dialog).toHaveAttribute('data-blur', 'true');
  if (width === 1440) {
    await page.setViewportSize({ width: 1190, height: 900 });
    await expect(dialog).toHaveAttribute('data-blur', 'true');
    await page.setViewportSize({ width, height: 900 });
    await expect(dialog).toHaveAttribute('data-blur', 'true');
  }
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
});

for (const [width, theme, locale, action] of [[1440, 'light', 'zh-Hans', 'escape'], [375, 'dark', 'zh-Hant', 'button'], [1440, 'dark', 'en', 'backdrop'], [1024, 'dark', 'ar', 'escape']] as const) test(`task detail blur enters and exits continuously at ${width}/${theme}/${locale}`, async ({ page, browserName }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/settings');
  await selectPicker(page, (await page.locator('.settings-language .setting-trigger').getAttribute('aria-label'))!, locale);
  await selectPicker(page, languagePacks[locale].app.theme, theme);
  await page.goto('/today');
  const trigger = page.locator('.task-row').first().getByRole('button'), dialog = page.locator('.task-detail');
  await page.mouse.move(-10, -10);
  await trigger.focus();
  const opening = sample(page); await trigger.press('Enter'); const opened = await opening;
  expect(new Set(opened.filter(frame => frame.opacity > 0 && frame.opacity < 1).map(frame => frame.opacity)).size).toBeGreaterThanOrEqual(3);
  expect(opened.every(frame => frame.blur === 0)).toBe(true);
  await expect(dialog).toHaveAttribute('data-open', 'true'); await expect(dialog).toHaveCSS('opacity', '1');
  for (const button of await dialog.getByRole('button').all()) {
    const bounds = (await button.boundingBox())!;
    expect(bounds.width).toBeGreaterThanOrEqual(44); expect(bounds.height).toBeGreaterThanOrEqual(44);
  }
  if (locale === 'ar') await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const box = (await dialog.boundingBox())!;
  const hovering = sample(page); await page.mouse.move(box.x + 60, 200); const entered = await hovering;
  expect(new Set(entered.filter(frame => frame.blur > 0 && frame.blur < 3).map(frame => frame.blur)).size).toBeGreaterThanOrEqual(3);
  await page.screenshot({ path: `output/playwright/task-detail-motion-${browserName}-${width}-${theme}-${locale}.png` });
  const closing = sample(page);
  if (action === 'escape') await page.keyboard.press('Escape');
  else if (action === 'button') await dialog.getByRole('button', { name: languagePacks[locale].taskDetail.close, exact: true }).click();
  else await page.mouse.click(20, 300);
  await expect(dialog).toHaveAttribute('data-open', 'false'); await expect(dialog).toHaveJSProperty('open', true);
  await page.mouse.up();
  const exited = await closing;
  expect(new Set(exited.filter(frame => frame.blur > 0 && frame.blur < 3).map(frame => frame.blur)).size).toBeGreaterThanOrEqual(3);
  expect(exited.some(frame => frame.present && frame.open && frame.blur > 0 && frame.blur < 3)).toBe(true);
  await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
  await test.info().attach('task-detail-native-frames', { body: JSON.stringify({ opened, entered, exited }), contentType: 'application/json' });
});

test('browser back, interrupted entry, missing transition events and reduced motion all close safely', async ({ page }) => {
  await page.goto('/today');
  const trigger = page.locator('.task-row').first().getByRole('button'), dialog = page.locator('.task-detail');
  await trigger.focus(); await trigger.press('Enter'); await expect(dialog).toHaveAttribute('data-open', 'true');
  await page.goBack(); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused(); await expect(page).toHaveURL(/\/today$/);
  await trigger.press('Enter'); await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
  await trigger.press('Enter'); await expect(dialog).toHaveCSS('opacity', '1');
  await dialog.evaluate(el => el.addEventListener('transitionend', event => event.stopPropagation()));
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await trigger.press('Enter'); await expect(dialog).toHaveAttribute('data-open', 'true');
  expect(await dialog.evaluate(el => getComputedStyle(el, '::backdrop').transitionDuration)).toBe('0s');
  await expect(dialog).toHaveCSS('transition-duration', '0s'); await expect(dialog).toHaveCSS('opacity', '1');
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
});

for (const [width, theme, locale] of [[1440, 'light', 'zh-Hans'], [900, 'dark', 'en'], [1024, 'light', 'zh-Hant']] as const) test(`task detail keeps its frame fixed while scrolling and eases pointer blur at ${width}/${theme}/${locale}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 400 });
  await page.goto('/settings');
  await selectPicker(page, (await page.locator('.settings-language .setting-trigger').getAttribute('aria-label'))!, locale);
  await selectPicker(page, languagePacks[locale].app.theme, theme);
  await page.goto('/today');
  const trigger = page.locator('.task-row').first().getByRole('button'), dialog = page.locator('.task-detail'), body = dialog.locator('.task-detail-body');
  await trigger.focus(); await trigger.press('Enter'); await expect(dialog).toHaveCSS('opacity', '1');
  const box = (await dialog.boundingBox())!;
  await page.mouse.move(box.x + 60, 200);
  await expect.poll(() => dialog.evaluate(el => getComputedStyle(el, '::backdrop').backdropFilter)).toBe('blur(3px)');
  const original = await dialog.evaluate(el => ({ rect: el.getBoundingClientRect().toJSON(), radii: [getComputedStyle(el).borderTopLeftRadius, getComputedStyle(el).borderBottomLeftRadius] }));
  expect(await body.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
  await page.mouse.wheel(0, 900);
  await expect.poll(() => body.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  const scrolled = await dialog.evaluate(el => ({ rect: el.getBoundingClientRect().toJSON(), radii: [getComputedStyle(el).borderTopLeftRadius, getComputedStyle(el).borderBottomLeftRadius] }));
  expect(scrolled).toEqual(original);
  expect(await dialog.evaluate(el => el.scrollTop)).toBe(0);
  await expect(dialog).toHaveCSS('overflow', 'hidden');
  const leaving = sample(page); await page.mouse.up(); await page.mouse.move(20, 200); const cleared = await leaving;
  expect(new Set(cleared.filter(f => f.blur > 0 && f.blur < 3).map(f => f.blur)).size).toBeGreaterThanOrEqual(3);
  await expect.poll(() => dialog.evaluate(el => getComputedStyle(el, '::backdrop').backdropFilter)).toBe('blur(0px)');
  await expect(dialog).toHaveCSS('opacity', '1'); await expect(dialog).toHaveJSProperty('open', true);
  expect(await dialog.evaluate(el => getComputedStyle(el).boxShadow)).not.toBe('none');
  expect(await dialog.evaluate(el => getComputedStyle(el, '::backdrop').backgroundColor)).toMatch(/(?:, |\/ )0\)$/);
  const returning = sample(page); await page.mouse.move(box.x + 60, 200); if (width < 1200) await page.mouse.down(); const restored = await returning;
  expect(new Set(restored.filter(f => f.blur > 0 && f.blur < 3).map(f => f.blur)).size).toBeGreaterThanOrEqual(3);
  await expect.poll(() => dialog.evaluate(el => getComputedStyle(el, '::backdrop').backdropFilter)).toBe('blur(3px)');
  // Move outside the viewport without dismissing the native dialog.
  await page.mouse.up(); await page.mouse.move(-10, -10);
  await expect(dialog).toHaveAttribute('data-blur', 'false');
  await expect.poll(() => dialog.evaluate(el => getComputedStyle(el, '::backdrop').backdropFilter)).toBe('blur(0px)');
  await page.mouse.move(box.x + 60, 200); if (width < 1200) await page.mouse.down();
  await expect.poll(() => dialog.evaluate(el => getComputedStyle(el, '::backdrop').backdropFilter)).toBe('blur(3px)');
  await page.mouse.up(); await page.mouse.move(20, 200); await page.waitForTimeout(80);
  // Complete the full exit when closing during hover transitions.
  const closeDuration = dialog.evaluate(el => new Promise<number>(resolve => {
    let started = 0;
    const observer = new MutationObserver(() => { if (el.getAttribute('data-open') === 'false') started = performance.now(); });
    observer.observe(el, { attributes: true, attributeFilter: ['data-open'] });
    el.addEventListener('close', () => { observer.disconnect(); resolve(performance.now() - started); }, { once: true });
  }));
  const closing = sample(page); await page.keyboard.press('Escape'); const exited = await closing;
  expect(await closeDuration).toBeGreaterThanOrEqual(230);
  expect(exited.some(f => f.present && f.open && f.opacity > 0 && f.opacity < 1)).toBe(true);
  await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
  await test.info().attach('task-detail-hover-frames', { body: JSON.stringify({ cleared, restored, exited, original, scrolled }), contentType: 'application/json' });
});

test.describe('touch input', () => {
  test.use({ hasTouch: true });
  test('mobile task blur follows touch contact and mouse hover independently', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 350 }); await page.goto('/today');
    const trigger = page.locator('.task-row').first().getByRole('button'), dialog = page.locator('.task-detail');
    await trigger.tap(); await expect(dialog).toHaveCSS('opacity', '1');
    await expect(dialog).toHaveCSS('box-shadow', 'none');
    const body = dialog.locator('.task-detail-body');
    // A newly opened panel can re-hit-test a stationary mouse after a touch tap.
    await body.dispatchEvent('pointerover', { pointerId: 1, pointerType: 'mouse', bubbles: true });
    await expect(dialog).toHaveAttribute('data-blur', 'false');
    await page.screenshot({ path: test.info().outputPath('touch-dialog-open.png') });
    await body.dispatchEvent('pointerdown', { pointerId: 4, pointerType: 'touch', bubbles: true });
    await expect(dialog).toHaveAttribute('data-blur', 'true');
    await body.evaluate(el => el.scrollTo(0, el.scrollHeight));
    await expect.poll(() => body.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
    expect(await dialog.evaluate(el => el.scrollTop)).toBe(0);
    // Scrolling can re-hit-test stationary pointers.
    await body.dispatchEvent('pointerover', { pointerId: 1, pointerType: 'mouse', bubbles: true });
    await body.dispatchEvent('pointercancel', { pointerId: 4, pointerType: 'touch', bubbles: true });
    await expect(dialog).toHaveAttribute('data-blur', 'false');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.mouse.move(100, 200); await expect(dialog).toHaveAttribute('data-blur', 'true');
    await page.mouse.down(); await expect(dialog).toHaveAttribute('data-blur', 'true');
    expect(await dialog.evaluate(el => getComputedStyle(el, '::backdrop').backdropFilter)).toBe('blur(3px)');
    await page.mouse.up(); await expect(dialog).toHaveAttribute('data-blur', 'true');
    await page.mouse.move(-10, -10); await expect(dialog).toHaveAttribute('data-blur', 'false');
    expect(await dialog.evaluate(el => getComputedStyle(el, '::backdrop').backdropFilter)).toBe('blur(0px)');
    expect(await dialog.evaluate(el => getComputedStyle(el, '::backdrop').transitionDuration)).toBe('0s');
    await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
  });
});

// Respect explicit themes; follow the OS for system mode without changing the frame.
test('task depth follows explicit and system themes without a hard edge or mobile elevation', async ({ page }) => {
  for (const width of [1024, 375]) for (const [theme, system, dark] of [['system', 'dark', true], ['system', 'light', false], ['dark', 'light', true], ['light', 'dark', false]] as const) {
    await page.setViewportSize({ width, height: 400 });
    await page.emulateMedia({ colorScheme: system, reducedMotion: 'reduce' });
    await page.goto('/settings');
    await selectPicker(page, (await page.locator('.settings-appearance .setting-trigger').first().getAttribute('aria-label'))!, theme);
    await page.goto('/today');
    await page.locator('.task-row').first().getByRole('button').click();
    const dialog = page.locator('.task-detail');
    await expect(dialog).toHaveCSS('opacity', '1');
    await page.mouse.move(-10, -10);
    await expect(dialog).toHaveAttribute('data-blur', 'false');
    const depth = await dialog.evaluate(el => ({ surface: getComputedStyle(el).backgroundColor, page: getComputedStyle(document.body).backgroundColor, shadow: getComputedStyle(el).boxShadow }));
    expect(depth.surface !== depth.page).toBe(dark && width >= 768);
    if (width >= 768) {
      expect(depth.shadow).not.toBe('none');
      // Require blurred shadows without solid one-pixel outlines.
      expect(depth.shadow.split(/, (?=rgba?\()/).every(layer => Number(layer.match(/\)\s+-?[\d.]+px\s+-?[\d.]+px\s+([\d.]+)px/)?.[1]) > 0)).toBe(true);
    } else expect(depth.shadow).toBe('none');
    await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
  }
});
