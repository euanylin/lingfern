import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { selectPicker } from './picker';

const raw = JSON.parse(readFileSync(new URL('../fixtures/content/a1-reading.json', import.meta.url), 'utf8'));

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
