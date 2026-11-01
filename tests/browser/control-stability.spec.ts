import { expect, test, webkit, type Locator, type Page } from '@playwright/test';
import { openSnapshot, focusQuestion } from './workspace';
import { showLearningPane } from './learning-pane';

async function geometry(page: Page, control: Locator, keyboard = false) {
  await control.scrollIntoViewIfNeeded(); await page.mouse.move(1, 1); await page.waitForTimeout(200);
  await control.evaluate(element => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let text: Node | null; do { text = walker.nextNode(); } while (text && !text.textContent?.trim());
    const range = document.createRange(); if (text) range.selectNodeContents(text);
    const state = { rows: [] as number[][], frame: 0 };
    (window as unknown as { controlMotion: typeof state }).controlMotion = state;
    const capture = () => {
      const box = element.getBoundingClientRect(), label = range.getBoundingClientRect();
      state.rows.push([box.x, box.width, box.height, label.x, label.width]); state.frame = requestAnimationFrame(capture);
    };
    capture();
  });
  if (keyboard) { await control.focus(); await page.keyboard.down('Space'); }
  else { await control.hover(); await page.waitForTimeout(190); await page.mouse.down(); }
  await page.waitForTimeout(190);
  const frames = await page.evaluate(() => {
    const state = (window as unknown as { controlMotion: { rows: number[][]; frame: number } }).controlMotion;
    cancelAnimationFrame(state.frame); return state.rows;
  });
  if (keyboard) await page.keyboard.up('Space');
  else { await page.mouse.move(1, 1); await page.mouse.up(); }
  return Math.max(...frames.flatMap(frame => frame.map((value, index) => Math.abs(value - frames[0][index]))));
}

for (const engine of ['chromium', 'webkit'] as const) test(`shared rows, menu options and learning controls keep stable geometry in ${engine}`, async ({ browser }) => {
  const alternate = engine === 'webkit' ? await webkit.launch({ channel: '' }) : undefined;
  const context = await (alternate ?? browser).newContext({ baseURL: 'http://127.0.0.1:5173', viewport: { width: 1440, height: 900 }, locale: 'zh-CN', colorScheme: engine === 'webkit' ? 'dark' : 'light' });
  const page = await context.newPage(), drift: Record<string, number> = {};
  try {
    await page.goto('/settings/about');
    drift.summary = await geometry(page, page.locator('.about-credit-details>summary').first());
    await page.goto('/library/dictionary'); await page.getByRole('combobox').fill('book');
    drift.suggestion = await geometry(page, page.locator('.dictionary-suggestions li').first());
    await page.goto('/today'); await page.locator('.reading-task .topic-picker .setting-trigger').first().click();
    const dialog = page.locator('.practice-options-dialog'); await expect(dialog).toHaveCSS('opacity', '1');
    await dialog.locator('.practice-option-fields .setting-trigger').first().click();
    drift.menuKeyboard = await geometry(page, dialog.getByRole('option').first(), true);
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
    const { lesson } = await openSnapshot(page, 'a2-reading');
    const index = lesson.materials.flatMap(material => material.questions).findIndex(question => 'steps' in question);
    const section = await focusQuestion(page, lesson, index);
    drift.sequence = await geometry(page, section.locator('.sequence-choices button').first());
    drift.questionNumber = await geometry(page, page.locator('.workspace-card button').first());
    await page.setViewportSize({ width: 320, height: 900 }); await showLearningPane(page, 'material');
    await expect.poll(() => page.locator('.question-panel').evaluate(element => element.getAnimations().length)).toBe(0);
    drift.sheet = await geometry(page, page.locator('.question-sheet-toggle'));
    await test.info().attach('control-geometry', { body: JSON.stringify(drift), contentType: 'application/json' });
    console.log(engine, JSON.stringify(drift));
    for (const [name, value] of Object.entries(drift)) expect.soft(value, `${name} moved ${value}px`).toBeLessThan(.1);
    expect(await page.pageErrors()).toEqual([]);
  } finally { await context.close(); await alternate?.close(); }
});
