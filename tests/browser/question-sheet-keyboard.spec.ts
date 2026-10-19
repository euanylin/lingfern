import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { selectPicker } from './picker';

const raw = JSON.parse(readFileSync(new URL('../fixtures/content/a1-reading.json', import.meta.url), 'utf8'));

async function editingAboveKeyboard(page: Page, workspace: boolean, width: number) {
  await page.setViewportSize({ width, height: 640 }); await page.goto('/today');
  const id = await page.evaluate(async ({ raw, workspace }) => {
    const { organizePractice } = await import('/src/core/practiceOrganization.ts' as string);
    const { createSession, sessions } = await import('/src/data/db.ts' as string);
    const source = structuredClone(raw);
    for (const material of source.materials) material.blocks[0].text += ' This separate practice paragraph keeps the article available for free scrolling.'.repeat(80);
    const lesson = organizePractice(source);
    if (!workspace) delete lesson.organization;
    const position = lesson.materials.flatMap((m: { questions: { kind?: string }[] }) => m.questions).findIndex((q: { kind?: string }) => q.kind === 'completion');
    const session = await createSession(lesson); await sessions.update(session.id, { position }); return session.id;
  }, { raw, workspace });
  await page.goto(`/learn/${id}`); const panel = page.locator('.question-panel');
  await panel.locator('.question-sheet-toggle').click();
  await panel.locator('.question-sheet-resize').press('End');
  const input = panel.locator('.completion-answer input').first(); await input.fill('kept');
  await page.evaluate(() => { scrollTo(0, 0); Object.defineProperty(window.visualViewport!, 'height', { configurable: true, value: 400 }); window.visualViewport!.dispatchEvent(new Event('resize')); });
  await expect.poll(() => panel.evaluate(el => el.getAnimations().filter(a => a.playState === 'running').length)).toBe(0);
  await page.waitForTimeout(200);
  return { id, panel, input };
}

for (const [workspace, width] of [[true, 375], [false, 375], [true, 768]] as const) test(`article scrolling keeps the editing sheet steady without changing focus: ${workspace}/${width}`, async ({ page }, info) => {
  const { id, panel, input } = await editingAboveKeyboard(page, workspace, width);
  const before = (await panel.boundingBox())!;
  const samples = await panel.evaluate(async element => {
    const field = element.querySelector('input:not([type=radio],[type=checkbox],[type=range])')!;
    const samples: { height: number; bottom: number; offset: number; scroll: number; focused: boolean }[] = [];
    for (const [position, offset] of [[120, 0], [300, 12], [60, 6], [0, 0], [200, 0]]) {
      Object.defineProperty(window.visualViewport!, 'offsetTop', { configurable: true, value: offset });
      scrollTo(0, position);
      for (let frame = 0; frame < 12; frame++) { window.visualViewport!.dispatchEvent(new Event('resize')); window.visualViewport!.dispatchEvent(new Event('scroll')); await new Promise(requestAnimationFrame); const box = element.getBoundingClientRect(); samples.push({ height: box.height, bottom: box.bottom, offset, scroll: scrollY, focused: document.activeElement === field }); }
    }
    return samples;
  });
  await info.attach('editing-article-scroll', { body: JSON.stringify(samples), contentType: 'application/json' });
  expect(Math.max(...samples.map(s => Math.abs(s.height - before.height)))).toBeLessThanOrEqual(1);
  expect(Math.max(...samples.map(s => Math.abs(s.bottom - s.offset - before.y - before.height)))).toBeLessThanOrEqual(1);
  expect(Math.max(...samples.map(s => s.scroll))).toBeGreaterThanOrEqual(299);
  expect(samples.every(s => s.focused)).toBe(true); await expect(input).toHaveValue('kept');
  await page.mouse.move(4, 120); const scroll = await page.evaluate(() => scrollY); await page.mouse.wheel(0, 120);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(scroll + 60); await expect(input).toBeFocused();
  await expect.poll(() => page.evaluate(async id => JSON.stringify(await (await import('/src/data/db.ts' as string)).sessions.get(id)).includes('kept'), id)).toBe(true);
});

test.describe('native touch while editing', () => {
  test.use({ hasTouch: true });
  test('article swipes remain unrestricted while the keyboard and answer field stay active', async ({ page }) => {
    const { panel, input } = await editingAboveKeyboard(page, true, 768), before = (await panel.boundingBox())!;
    const cdp = await page.context().newCDPSession(page), scroll = await page.evaluate(() => scrollY);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 40, y: 280 }] });
    for (const y of [250, 210, 170, 130]) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 40, y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(scroll + 60);
    await expect(input).toBeFocused(); await expect(input).toHaveValue('kept');
    expect(Math.abs((await panel.boundingBox())!.height - before.height)).toBeLessThanOrEqual(1);
    expect(Math.abs((await panel.boundingBox())!.y - before.y)).toBeLessThanOrEqual(1); await cdp.detach();
  });
});

for (const [workspace, width, locale, scheme, motion] of [
  [true, 375, 'zh-Hans', 'light', 'no-preference'],
  [false, 375, 'en', 'dark', 'no-preference'],
  [true, 768, 'ar', 'light', 'reduce'],
] as const) test(`keyboard frames preserve the mobile sheet and focused draft: ${workspace}/${width}/${locale}`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 812 });
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: motion });
  await page.goto('/settings');
  await selectPicker(page, (await page.locator('.settings-language .setting-trigger').getAttribute('aria-label'))!, locale);
  const id = await page.evaluate(async ({ raw, workspace }) => {
    const { organizePractice } = await import('/src/core/practiceOrganization.ts' as string);
    const { createSession, sessions } = await import('/src/data/db.ts' as string);
    const lesson = organizePractice(raw);
    const position = lesson.materials.flatMap((m: { questions: { kind?: string }[] }) => m.questions).findIndex((q: { kind?: string }) => q.kind === 'completion');
    if (position < 0) throw new Error('Missing existing completion fixture');
    if (!workspace) delete lesson.organization;
    const session = await createSession(lesson);
    await sessions.update(session.id, { position });
    return session.id;
  }, { raw, workspace });
  await page.goto(`/learn/${id}`);
  const panel = page.locator('.question-panel');
  await panel.locator('.question-sheet-toggle').click();
  await expect.poll(() => panel.evaluate(el => el.getAnimations().filter(a => a.playState === 'running').length)).toBe(0);
  const input = panel.locator('.completion-answer input').first();
  await input.fill('kept');
  const samples = await input.evaluate(async field => {
    const panel = field.closest<HTMLElement>('.question-panel')!, content = field.closest<HTMLElement>('.question-sheet-content')!;
    const viewport = window.visualViewport!, header = document.querySelector<HTMLElement>('.session-header')!;
    const normalHeight = panel.getBoundingClientRect().height;
    const samples: { height: number; bottomError: number; headerOverlap: number; focused: boolean; fieldVisible: boolean; preferredError: number }[] = [];
    try {
      for (const [height, offset] of [[812, 0], [760, 0], [690, 0], [600, 0], [520, 0], [480, 0], [480, 32], [480, 0], [560, 0], [690, 0], [760, 0], [812, 0]]) {
        Object.defineProperty(viewport, 'height', { configurable: true, value: height });
        Object.defineProperty(viewport, 'offsetTop', { configurable: true, value: offset });
        viewport.dispatchEvent(new Event('resize')); viewport.dispatchEvent(new Event('scroll'));
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        const box = panel.getBoundingClientRect(), frame = content.getBoundingClientRect(), answer = field.getBoundingClientRect();
        const headerHeight = header.getBoundingClientRect().height;
        samples.push({ height: box.height, bottomError: Math.abs(box.bottom - height - offset), headerOverlap: Math.max(0, header.getBoundingClientRect().bottom - box.top), focused: document.activeElement === field, fieldVisible: answer.top >= frame.top - 1 && answer.bottom <= frame.bottom + 1, preferredError: Math.abs(box.height - Math.min(normalHeight, height - headerHeight - 24)) });
      }
    } finally {
      Reflect.deleteProperty(viewport, 'height'); Reflect.deleteProperty(viewport, 'offsetTop');
      viewport.dispatchEvent(new Event('resize'));
    }
    return samples;
  });
  await testInfo.attach('keyboard-frames.json', { body: JSON.stringify(samples), contentType: 'application/json' });
  expect(Math.max(...samples.map(s => s.headerOverlap))).toBeLessThanOrEqual(1);
  expect(Math.max(...samples.map(s => s.bottomError))).toBeLessThanOrEqual(1);
  expect(Math.max(...samples.map(s => s.preferredError))).toBeLessThanOrEqual(1);
  expect(samples.every(s => s.focused && s.fieldVisible)).toBe(true);
  await expect(input).toBeFocused(); await expect(input).toHaveValue('kept');
  await expect.poll(() => page.evaluate(async id => JSON.stringify(await (await import('/src/data/db.ts' as string)).sessions.get(id)).includes('kept'), id)).toBe(true);
  await page.reload(); await panel.locator('.question-sheet-toggle').click();
  await expect(panel.locator('.completion-answer input').first()).toHaveValue('kept');
  await panel.locator('.question-close').click();
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport!, 'height', { configurable: true, value: 760 });
    window.visualViewport!.dispatchEvent(new Event('resize'));
  });
  await panel.locator('.question-sheet-toggle').click();
  await expect(panel).toHaveCSS('transition-duration', motion === 'reduce' ? '0s' : '0.26s');
  await page.evaluate(() => { Reflect.deleteProperty(window.visualViewport!, 'height'); window.visualViewport!.dispatchEvent(new Event('resize')); });
});
