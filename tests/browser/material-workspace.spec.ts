import { expect, test, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { questionSlots } from '../../src/shared/practiceWorkspace';
import type { Lesson } from '../../src/shared/content';
const reading = JSON.parse(readFileSync(new URL('../fixtures/content/a1-reading.json', import.meta.url), 'utf8'));
const listening = JSON.parse(readFileSync(new URL('../fixtures/content/c2-listening.json', import.meta.url), 'utf8'));
const questions = (lesson: Lesson) => lesson.materials.flatMap(material => material.questions.map(question => ({ material, question })));
import { selectPicker } from './picker';
import { languagePacks } from '../../src/locales';

async function start(page: Page, raw: unknown, testMode = false) {
  await page.goto('/today');
  const result = await page.evaluate(async ({ raw, testMode }) => {
    const { organizePractice } = await import('/src/core/practiceOrganization.ts' as string);
    const { asTestLesson } = await import('/src/shared/content.ts' as string);
    const lesson = organizePractice(raw);
    const session = await (await import('/src/data/db.ts' as string)).createSession(testMode ? asTestLesson(lesson) : lesson);
    return { id: session.id, lesson: session.lesson };
  }, { raw, testMode });
  await page.goto(`/learn/${result.id}`); await expect(page.locator('.material-workspace')).toBeVisible();
  await expect(page.locator('.workspace-questions progress')).toHaveCount(0);
  return result as { id: string; lesson: Lesson };
}
const expanded = structuredClone(reading);
const facts = ['butterflies', 'containers', 'vegetables', 'waterfalls', 'architects', 'libraries', 'astronauts', 'musicians', 'mountains', 'hospitals', 'workshops', 'newspapers', 'buildings', 'paintings', 'passengers', 'neighbours'];
for (const material of expanded.materials) material.blocks[0].text += '\n\n' + facts.map((word, index) => `The ${word} appeared in the local report on day ${index + 1}. This separate observation has its own careful description and clear context.`).join('\n\n');
const worksheet = expanded;

test('desktop submit feedback stays inside the answer card without a horizontal scrollbar', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await start(page, worksheet);
  const content = page.locator('.workspace-questions .question-sheet-content'), submit = content.locator('button[type=submit]');
  await submit.scrollIntoViewIfNeeded(); await submit.hover(); await page.waitForTimeout(250);
  expect(await content.evaluate(el => el.scrollWidth - el.clientWidth)).toBe(0);
  const bounds = (await content.boundingBox())!, button = (await submit.boundingBox())!;
  expect(button.x).toBeGreaterThanOrEqual(bounds.x); expect(button.x + button.width).toBeLessThanOrEqual(bounds.x + bounds.width);
  await submit.focus(); await expect(submit).toBeFocused(); await expect(submit).toBeEnabled();
});

test('desktop question number follows visible questions without changing the saved selection or drafts', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); const { id } = await start(page, worksheet);
  const before = await page.evaluate(async id => (await (await import('/src/data/db.ts' as string)).sessions.get(id)).workspace, id);
  const section = page.locator('.workspace-question').nth(1), heading = section.locator('h2'), label = (await heading.textContent())!.match(/^\d+/)![0];
  await heading.evaluate(el => { const panel = el.closest('.question-sheet-content')!; panel.scrollTop += el.getBoundingClientRect().top - panel.getBoundingClientRect().top - 16; });
  expect(await heading.evaluate(el => el.getBoundingClientRect().top - el.closest('.question-sheet-content')!.getBoundingClientRect().top)).toBeCloseTo(16, 0);
  await expect(page.locator('.workspace-questions .question-number bdi')).toHaveText(new RegExp(`^${label}/`));
  await heading.evaluate(el => { const panel = el.closest('.question-sheet-content')!; panel.scrollTop += el.getBoundingClientRect().top - panel.getBoundingClientRect().top - 80; });
  await expect(page.locator('.workspace-questions .question-number bdi')).toHaveText(new RegExp(`^${label}/`));
  expect(await page.evaluate(async id => (await (await import('/src/data/db.ts' as string)).sessions.get(id)).workspace, id)).toEqual(before);
});

for (const width of [375, 1440]) for (const kind of ['reading', 'listening', 'gaps', 'response']) test(`typing and deletion keep the answer position while drafts save: ${kind}/${width}`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  const raw = kind === 'reading' ? worksheet : kind === 'gaps' ? (await import('../fixtures/workspace-lessons')).multiGapListening()
    : JSON.parse(readFileSync(new URL(`../fixtures/content/${kind === 'response' ? 'b1-summary-reading' : 'a2-listening'}.json`, import.meta.url), 'utf8'));
  const { id, lesson } = await start(page, raw);
  const all = questions(lesson), index = all.findIndex(item => kind === 'response' ? 'criteria' in item.question : kind === 'gaps' ? 'gaps' in item.question : 'kind' in item.question && item.question.kind === 'completion');
  expect(index).toBeGreaterThanOrEqual(0);
  const slot = all.slice(0, index).reduce((count, item) => count + questionSlots(item.question), 0);
  if (width < 1200 && raw.skill === 'reading') await page.locator('.workspace-questions .question-sheet-toggle').click();
  await page.locator('.workspace-card button').nth(slot).click();
  const field = page.locator(kind === 'response' ? '.workspace-question textarea' : kind === 'gaps' ? '.inline-gap input' : '.workspace-question .completion-answer input').first();
  await field.click();
  await page.evaluate(async () => {
    const { db, sessions } = await import('/src/data/db.ts' as string), update = sessions.update.bind(sessions);
    sessions.update = async (id: string, changes: { workspace?: unknown }) => {
      if (changes.workspace) await db.constructor.waitFor(new Promise(resolve => setTimeout(resolve, 80)));
      return update(id, changes);
    };
  });
  await field.evaluate(element => {
    const samples: { y: number; contentY: number; focused: boolean }[] = [];
    const state = window as unknown as { inputTrace: { samples: typeof samples; running: boolean } };
    state.inputTrace = { samples, running: true };
    const sample = () => {
      const panel = element.closest('.question-sheet-content')!;
      samples.push({ y: element.getBoundingClientRect().y, contentY: element.getBoundingClientRect().y - panel.getBoundingClientRect().y + panel.scrollTop, focused: document.activeElement === element });
      if (state.inputTrace.running) requestAnimationFrame(sample);
    };
    sample();
  });
  await page.keyboard.type('steady draft', { delay: 25 });
  for (let index = 0; index < 6; index++) await page.keyboard.press('Backspace');
  await expect(page.locator('.workspace-save-status')).toHaveText('已保存在本设备');
  const trace = await page.evaluate(() => {
    const state = window as unknown as { inputTrace: { samples: { y: number; contentY: number; focused: boolean }[]; running: boolean } };
    state.inputTrace.running = false; return state.inputTrace.samples;
  });
  writeFileSync(testInfo.outputPath('input-position.json'), JSON.stringify(trace));
  await testInfo.attach('input-position.json', { path: testInfo.outputPath('input-position.json'), contentType: 'application/json' });
  expect(trace.length).toBeGreaterThan(5);
  expect(Math.max(...trace.map(sample => sample.contentY)) - Math.min(...trace.map(sample => sample.contentY))).toBeLessThanOrEqual(1);
  expect(Math.max(...trace.map(sample => sample.y)) - Math.min(...trace.map(sample => sample.y))).toBeLessThanOrEqual(1);
  expect(trace.every(sample => sample.focused)).toBe(true);
  await expect(field).toHaveValue('steady');
  expect(await page.evaluate(async id => Object.values((await (await import('/src/data/db.ts' as string)).sessions.get(id)).workspace.drafts).some(value => value === 'steady' || Array.isArray(value) && value.includes('steady')), id)).toBe(true);
  await page.reload();
  if (width < 1200 && raw.skill === 'reading') await page.locator('.workspace-questions .question-sheet-toggle').click();
  await expect(page.locator(kind === 'response' ? '.workspace-question textarea' : kind === 'gaps' ? '.inline-gap input' : '.workspace-question .completion-answer input').first()).toHaveValue('steady');
});

test('desktop reading follows page scrolling beside a pinned answer card, with free drafts, refresh and atomic completion', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { id, lesson } = await start(page, worksheet);
  expect(await page.locator('.workspace-question:visible').count()).toBeGreaterThan(2);
  const article = page.locator('.workspace-material'), panel = page.locator('.workspace-questions');
  const boxes = [await article.boundingBox(), await panel.boundingBox()]; expect(boxes[1]!.x).toBeGreaterThan(boxes[0]!.x + boxes[0]!.width);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const originalHeight = (await panel.boundingBox())!.height;
  await article.hover(); const origin = await page.evaluate(() => scrollY); await page.mouse.wheel(0, 400); await expect.poll(() => page.evaluate(() => scrollY)).toBe(origin + 400);
  expect(Math.abs((await panel.boundingBox())!.height - originalHeight)).toBeLessThanOrEqual(1);
  const pinned = (await panel.boundingBox())!.y, before = (await article.boundingBox())!.y, pageBefore = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, 300); await expect.poll(() => page.evaluate(() => scrollY)).toBe(pageBefore + 300);
  expect((await article.boundingBox())!.y).toBeLessThan(before - 100); expect(Math.abs((await panel.boundingBox())!.y - pinned)).toBeLessThanOrEqual(1);
  expect(Math.abs((await panel.boundingBox())!.height - originalHeight)).toBeLessThanOrEqual(1);
  expect(await article.evaluate(el => el.scrollTop)).toBe(0);
  const scroll = await page.evaluate(() => scrollY);
  const inputs = page.locator('.workspace-question input:not([type=radio]):not([type=range])'); await inputs.last().fill('retained-draft');
  await expect.poll(() => page.evaluate(async id => Object.values((await (await import('/src/data/db.ts' as string)).sessions.get(id)).workspace.drafts).includes('retained-draft'), id)).toBe(true);
  expect(await page.evaluate(() => scrollY)).toBe(scroll);
  await page.reload(); await expect(page.locator('.material-workspace')).toBeVisible();
  await expect(page.locator('.workspace-question input:not([type=radio]):not([type=range])').last()).toHaveValue('retained-draft');
  const all = questions(lesson);
  // Drive real controls in reverse order; no previous-question requirement.
  for (const item of [...all].reverse()) {
    const nav = page.locator('.workspace-card button').filter({ hasText: /^\d+$/ });
    const index = all.indexOf(item); await nav.nth(index).click();
    const question = page.locator('.workspace-question').filter({ has: page.locator(`[id="prompt-${item.question.id}"]`) });
    if ('options' in item.question) await question.getByRole('radio').nth(item.question.answer).check();
    else if ('kind' in item.question && item.question.kind === 'completion') await question.locator('input').fill(item.question.answer);
    else throw new Error('Unexpected fixture type');
  }
  await expect.poll(() => page.locator('.workspace-save-status').textContent()).toBe('已保存在本设备');
  await expect(page.locator('.workspace-review')).toHaveCount(0);
  await page.getByRole('button', { name: '提交练习', exact: true }).click();
  await expect(page.locator('#workspace-result')).toBeVisible(); await expect(page.locator('#workspace-result')).toBeFocused(); await expect(page.locator('.workspace-review')).toHaveCount(all.length);
  expect(await page.evaluate(async id => (await (await import('/src/data/db.ts' as string)).attempts.where('sessionId').equals(id).toArray()).every((attempt: {correct: boolean}) => attempt.correct), id)).toBe(true);
  await page.setViewportSize({ width: 375, height: 812 }); await page.reload();
  await expect(page.locator('.workspace-questions')).toHaveAttribute('data-open', 'true');
  await expect(page.locator('#workspace-result')).toBeVisible();
});

for (const locale of ['zh-Hans', 'zh-Hant', 'en', 'ar'] as const) for (const theme of ['light', 'dark'] as const) test(`mobile free navigation and reading position at ${locale}/${theme}`, async ({ page }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const state = window as unknown as { layoutErrors: string[] }; state.layoutErrors = [];
    window.addEventListener('error', event => state.layoutErrors.push(event.message));
  });
  await page.setViewportSize({ width: 375, height: 812 }); await page.goto('/settings');
  await selectPicker(page, (await page.locator('.settings-language .setting-trigger').getAttribute('aria-label'))!, locale);
  await selectPicker(page, (await page.locator('.setting-trigger').nth(1).getAttribute('aria-label'))!, theme);
  await start(page, worksheet);
  await expect(page.locator('.workspace-questions')).toHaveAttribute('data-open', 'false');
  await page.screenshot({ path: testInfo.outputPath('mobile-peek.png') });
  const reader = page.locator('.workspace-material .reading-workspace');
  await page.evaluate(() => scrollTo(0, 250)); const top = await page.evaluate(() => scrollY);
  await page.locator('.workspace-questions .question-sheet-toggle').click();
  await page.locator('.workspace-card button').nth(2).click();
  await page.locator('.workspace-question:visible input:not([type=radio]):not([type=range])').fill('mobile-draft');
  await page.locator('.workspace-card button').first().click();
  await page.locator('.workspace-card button').nth(2).click(); await expect(page.locator('.workspace-question:visible input:not([type=radio]):not([type=range])')).toHaveValue('mobile-draft');
  await page.locator('.workspace-questions .question-close').click();
  await expect(reader).toBeVisible(); expect(await page.evaluate(() => scrollY)).toBe(top);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('.workspace-questions .question-sheet-toggle').click();
  expect(await page.locator('.workspace-card button').evaluateAll(buttons => buttons.every(button => { const r = button.getBoundingClientRect(); return r.width >= 44 && r.height >= 44; }))).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('mobile-open.png') });
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.evaluate(() => document.documentElement.style.fontSize = '200%');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => (window as unknown as { layoutErrors: string[] }).layoutErrors)).toEqual([]);
});

test('same recording survives native playback, question navigation, answer edits and answer-card expansion', async ({ page }) => {
  await start(page, listening);
  const intro = page.locator('.workspace-material'), guidance = intro.locator('details.teaching');
  await expect(intro.locator('>.lead')).toHaveText(listening.goal.en);
  expect(await intro.evaluate(el => [...el.children].map(child => child.tagName))).toEqual(['P', 'P', 'DETAILS', 'SECTION']);
  await expect(guidance).toHaveCount(1);
  const player = page.locator('audio');
  await player.evaluate((audio: HTMLAudioElement) => { audio.muted = true; audio.playbackRate = 4; (window as unknown as { originalPlayer: HTMLAudioElement }).originalPlayer = audio; });
  await page.getByRole('button', { name: '播放 / 重听', exact: true }).click();
  await expect.poll(() => player.evaluate((audio: HTMLAudioElement) => audio.currentTime)).toBeGreaterThan(1);
  const before = await player.evaluate((audio: HTMLAudioElement) => audio.currentTime);
  await guidance.locator('summary').click(); await guidance.locator('summary').click();
  await intro.locator('.source>summary').click(); await intro.locator('.source>summary').click();
  await page.locator('.workspace-card button').nth(1).click();
  await page.locator('.workspace-question').nth(1).getByRole('radio').first().check();
  await page.locator('.workspace-card summary').click(); await page.locator('.workspace-card summary').click();
  expect(await player.evaluate((audio: HTMLAudioElement) => audio === (window as unknown as { originalPlayer: HTMLAudioElement }).originalPlayer && !audio.paused && audio.currentTime >= 1)).toBe(true);
  expect(await player.evaluate((audio: HTMLAudioElement) => audio.currentTime)).toBeGreaterThanOrEqual(before);
});

for (const raw of [worksheet, listening]) test(`Test hides teaching, hints, dictionary, answers and feedback until the complete snapshot is committed: ${raw.skill}`, async ({ page }) => {
  await start(page, raw, true);
  await expect(page.locator('.workspace-hints,.teaching,.workspace-review')).toHaveCount(0);
  await expect(page.locator('.material-workspace .dictionary-trigger')).toHaveCount(0);
  await page.getByRole('button', { name: '提交练习', exact: true }).click();
  await expect(page.locator('.material-workspace [role=alert]')).toBeVisible();
  await expect(page.locator('.workspace-review')).toHaveCount(0);
});

test('real recording multi-gap input saves independently, keeps playback and reports a partial group score after submission', async ({ page }) => {
  const { multiGapListening } = await import('../fixtures/workspace-lessons');
  const lesson = multiGapListening(), { id } = await start(page, lesson);
  const gap = lesson.materials[0].questions[0]; if (!('gaps' in gap)) throw new Error('NO_GAPS');
  const inputs = page.locator('.inline-gap input'), player = page.locator('audio');
  await expect(inputs).toHaveCount(2);
  await player.evaluate((audio: HTMLAudioElement) => { audio.muted = true; audio.playbackRate = 16; (window as unknown as { original: HTMLAudioElement }).original = audio; });
  await page.getByRole('button', { name: '播放 / 重听', exact: true }).click();
  await expect.poll(() => player.evaluate((audio: HTMLAudioElement) => audio.currentTime)).toBeGreaterThan(1);
  await inputs.nth(1).fill(gap.gaps[1].answer); await page.locator('.workspace-card button').first().click(); await inputs.first().fill('incorrect');
  expect(await player.evaluate((audio: HTMLAudioElement) => audio === (window as unknown as { original: HTMLAudioElement }).original && !audio.paused)).toBe(true);
  await expect.poll(() => player.evaluate((audio: HTMLAudioElement) => audio.ended && audio.duration > 0), { timeout: 15_000 }).toBe(true);
  await expect(page.locator('.workspace-player [role=status]')).toHaveText('录音已播放，可以选择并保存。');
  await page.locator('.workspace-card button').nth(2).click();
  await expect(player).toHaveAttribute('src', lesson.materials[1].audio!.src);
  await player.evaluate((audio: HTMLAudioElement) => { audio.muted = true; audio.playbackRate = 16; });
  await page.getByRole('button', { name: '播放 / 重听', exact: true }).click();
  for (const [index, question] of lesson.materials[1].questions.entries()) {
    if (!('options' in question)) throw new Error('NO_OPTIONS');
    await page.locator('.workspace-question').nth(index).getByRole('radio').nth(question.answer).check();
  }
  await expect.poll(() => player.evaluate((audio: HTMLAudioElement) => audio.ended && audio.duration > 0), { timeout: 15_000 }).toBe(true);
  await expect(page.locator('.workspace-player [role=status]')).toHaveText('录音已播放，可以选择并保存。');
  await page.getByRole('button', { name: '提交练习', exact: true }).click();
  await expect(page.locator('#workspace-result')).toBeVisible();
  const review = page.locator('.workspace-review').first(); await expect(review.locator('.slot-result')).toHaveText(['1: × 再看一看', '2: ✓ 回答正确']);
  expect(await page.evaluate(async id => (await (await import('/src/data/db.ts' as string)).attempts.where('sessionId').equals(id).toArray()).filter((attempt: {correct: boolean}) => !attempt.correct).length, id)).toBe(1);
});

test('failed draft write retains the input across navigation and retries before refreshing', async ({ page }) => {
  const { id } = await start(page, worksheet);
  await page.evaluate(async () => {
    const { sessions } = await import('/src/data/db.ts' as string); const update = sessions.update.bind(sessions); let fail = true;
    sessions.update = async (id: string, changes: {workspace?: unknown}) => { if (changes.workspace && fail) { fail = false; throw new Error('DISK_FULL'); } return update(id, changes); };
  });
  const field = page.locator('.workspace-question input:not([type=radio]):not([type=range])').first(); await field.fill('failure-retained');
  await expect(page.locator('.material-workspace [role=alert]')).toBeVisible(); await expect(field).toHaveValue('failure-retained');
  await page.locator('.workspace-card button').first().click();
  await page.locator('.workspace-card button').nth(2).click();
  await expect(field).toHaveValue('failure-retained');
  expect(await page.evaluate(async id => (await (await import('/src/data/db.ts' as string)).attempts.where('sessionId').equals(id).count()), id)).toBe(0);
  await page.locator('.material-workspace [role=alert]').getByRole('button', { name: '重试', exact: true }).click();
  await expect(page.locator('.material-workspace [role=alert]')).toHaveCount(0);
  await page.reload(); await expect(page.locator('.workspace-question input:not([type=radio]):not([type=range])').first()).toHaveValue('failure-retained');
});

test('multi-gap mobile controls reflow at 320px and 200 percent with explicit blank progress', async ({ page }, testInfo) => {
  const { multiGapListening } = await import('../fixtures/workspace-lessons');
  await page.setViewportSize({ width: 320, height: 812 }); await start(page, multiGapListening());
  await expect(page.locator('.inline-gap input')).toHaveCount(2);
  await page.locator('.inline-gap input').nth(1).fill('draft');
  await expect(page.locator('.workspace-card button[data-answered=true]')).toHaveCount(1);
  for (const scale of ['100%', '200%']) {
    await page.evaluate(scale => document.documentElement.style.fontSize = scale, scale);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator('.inline-gap input').evaluateAll(inputs => inputs.every(input => { const box = input.getBoundingClientRect(); return box.width >= 44 && box.height >= 44; }))).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`gap-mobile-${scale}.png`), fullPage: true });
  }
});

test('B1-C2 answer instructions remain English while navigation follows the interface language', async ({ page }) => {
  const raw = structuredClone(worksheet); raw.targetLevel = 'B2'; raw.id = 'english-instructions-workspace';
  await start(page, raw);
  const instruction = page.locator('.completion-answer > span').first();
  await expect(instruction).toHaveAttribute('lang', 'en');
  await expect(instruction).toHaveText('Type the missing word from the passage.');
  await expect(page.getByRole('button', { name: '提交练习', exact: true })).toBeVisible();
});

test('mobile reading opens from the original bottom peek and keeps the reader mounted', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 }); await start(page, worksheet);
  const panel = page.locator('.workspace-questions'), reader = page.locator('.workspace-material');
  await page.screenshot({ path: testInfo.outputPath('reading-peek.png') });
  await expect(page.locator('.workspace-mobile-switch')).toHaveCount(0);
  await expect(reader).toBeVisible(); await expect(panel).toHaveAttribute('data-open', 'false');
  await panel.locator('.question-sheet-toggle').click(); await expect(panel).toHaveAttribute('data-open', 'true');
  expect(await panel.evaluate(el => { const css = getComputedStyle(el), box = el.getBoundingClientRect(); return css.borderBottomLeftRadius === '0px' && css.borderBottomRightRadius === '0px' && box.bottom <= innerHeight + 1; })).toBe(true);
  await panel.locator('.question-close').click(); await expect(panel).toHaveAttribute('data-open', 'false');
  await expect(panel.locator('.question-sheet-toggle')).toBeFocused(); await expect(reader).toBeVisible();
});

test('mobile reading navigation reveals the selected input inside the sheet without moving the passage', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 410 });
  await start(page, worksheet);
  await page.locator('.workspace-questions .question-sheet-toggle').click();
  const visibleInput = async () => {
    const frame = (await page.locator('.workspace-questions .question-sheet-content').boundingBox())!;
    const input = (await page.locator('.workspace-question[data-selected=true] input').first().boundingBox())!;
    return input.y >= frame.y && input.y + input.height <= frame.y + frame.height;
  };
  await expect.poll(visibleInput).toBe(true);
  const position = await page.evaluate(() => scrollY);
  await page.locator('.workspace-card button').last().click();
  const focused = page.locator('.workspace-question[data-selected=true] input').first();
  await expect(focused).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath('selected-input.png') });
  const frame = (await page.locator('.workspace-questions .question-sheet-content').boundingBox())!;
  const input = (await focused.boundingBox())!;
  expect(input.y).toBeGreaterThanOrEqual(frame.y);
  expect(input.y + input.height).toBeLessThanOrEqual(frame.y + frame.height);
  expect(await page.evaluate(() => scrollY)).toBe(position);
  await focused.fill('retained-short-screen-answer');
  await page.locator('.workspace-questions .question-close').click();
  await page.locator('.workspace-questions .question-sheet-toggle').click();
  await expect(focused).toHaveValue('retained-short-screen-answer');
  await expect.poll(visibleInput).toBe(true);
  expect(await page.evaluate(() => scrollY)).toBe(position);
});

test('choosing an input during sheet expansion keeps the learner focus and draft', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 410 });
  await start(page, worksheet);
  const panel = page.locator('.workspace-questions');
  await panel.locator('.question-sheet-toggle').click();
  await page.locator('.workspace-card button').last().click();
  const field = page.locator('.workspace-question[data-selected=true] input').first();
  await expect(field).toBeFocused();
  await panel.locator('.question-close').click();
  await expect.poll(() => panel.evaluate(el => el.getAnimations().some(animation => animation.playState === 'running'))).toBe(false);
  await page.addStyleTag({ content: '.workspace-questions { transition-duration: 800ms !important; }' });
  await panel.locator('.question-sheet-toggle').click();
  await expect(page.locator('.workspace-question[data-selected=true] h2')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(field).toBeFocused();
  await field.fill('chosen-during-opening');
  await expect.poll(() => panel.evaluate(el => el.getAnimations().some(animation => animation.playState === 'running'))).toBe(false);
  await expect(field).toBeFocused();
  await expect(field).toHaveValue('chosen-during-opening');
  await expect(page.locator('.workspace-save-status')).toHaveText('已保存在本设备');
});

test('opening mobile reading keeps the editor unfocused until the learner chooses it', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await start(page, worksheet);
  const panel = page.locator('.workspace-questions'), toggle = panel.locator('.question-sheet-toggle');
  await toggle.click();
  await panel.locator('.workspace-card button').last().click();
  const input = panel.locator('.workspace-question[data-selected=true] input').first();
  await expect(input).toBeFocused();
  await input.fill('retained-without-opening-keyboard');
  await panel.locator('.question-close').click();
  for (const keyboard of [false, true]) {
    if (keyboard) await toggle.press('Enter'); else await toggle.click();
    await expect(panel.locator('.workspace-question[data-selected=true] h2')).toBeFocused();
    await expect(input).not.toBeFocused();
    await expect(input).toHaveValue('retained-without-opening-keyboard');
    await input.click();
    await expect(input).toBeFocused();
    await panel.locator('.question-close').click();
    await expect(toggle).toBeFocused();
  }
});

for (const width of [375, 1440]) test(`idle card keyboard selection saves without blur resetting its native value: ${width}`, async ({ page }) => {
  const raw = structuredClone(reading); raw.organization = 'material-v1';
  await page.setViewportSize({ width, height: 900 });
  await start(page, raw);
  const panel = page.locator('.workspace-questions'), choices = panel.getByRole('radio');
  if (width < 1200) await panel.locator('.question-sheet-toggle').click();
  for (const index of [0, 1]) {
    if (width < 1200) await expect(page.locator('.question-sheet-scrim')).toHaveAttribute('data-blur', 'false');
    await choices.nth(index).focus(); await expect(choices.nth(index)).toBeFocused();
    await choices.nth(index).press('Space'); await expect(choices.nth(index)).toBeChecked();
    await expect(page.locator('.workspace-save-status')).toHaveText('已保存在本设备');
  }
  await page.reload();
  if (width < 1200) await panel.locator('.question-sheet-toggle').click();
  await expect(choices.nth(1)).toBeChecked();
});

test('mobile reading focuses a multiple-choice prompt after the sheet becomes visible', async ({ page }) => {
  const raw = structuredClone(reading); raw.organization = 'material-v1';
  await page.setViewportSize({ width: 375, height: 900 });
  await start(page, raw);
  await page.setViewportSize({ width: 375, height: 410 });
  const panel = page.locator('.workspace-questions'), prompt = panel.locator('.workspace-question[data-selected=true] h2');
  for (let n = 0; n < 4; n++) {
    await panel.locator('.question-sheet-toggle').click();
    await expect(prompt).toBeFocused();
    await panel.locator('.question-close').click();
    await expect(panel.locator('.question-sheet-toggle')).toBeFocused();
  }
});

for (const width of [1440, 375]) test(`cross-material focus waits for the parent commit and preserves drafts: ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 812 });
  await page.addInitScript(raw => { (window as unknown as { deferredLesson: unknown }).deferredLesson = raw; }, worksheet);
  await page.route(/\/src\/main\.tsx(?:\?.*)?$/, route => route.fulfill({ contentType: 'text/javascript', body: "import {mountDeferredWorkspace} from '/tests/fixtures/deferred-workspace.tsx'; mountDeferredWorkspace(window.deferredLesson);" }));
  await page.goto('/today');
  const panel = page.locator('.workspace-questions'), toggle = panel.locator('.question-sheet-toggle');
  await expect(panel).toBeVisible();
  if (width < 1200) await toggle.click();
  await panel.locator('.workspace-card button').last().click();
  const input = panel.locator('.workspace-question[data-selected=true] input').first();
  await expect(input).toBeFocused();
  await input.fill('retained-after-deferred-material');
  await expect.poll(() => page.evaluate(async () => {
    const { sessions } = await import('/src/data/db.ts' as string);
    return Object.values((await sessions.toArray())[0].workspace?.drafts ?? {}).includes('retained-after-deferred-material');
  })).toBe(true);
  if (width < 1200) {
    await panel.locator('.workspace-card button').first().click();
    await page.keyboard.press('Escape');
    await expect(panel).toHaveAttribute('data-open', 'false');
    await expect(input).toHaveCount(1);
    await expect(toggle).toBeFocused();
    await expect(input).not.toBeFocused();
    await toggle.click();
    await expect(panel.locator('.workspace-question[data-selected=true] h2')).toBeFocused();
  }
});

for (const raw of [worksheet, listening]) test(`responsive learning controls stay usable across short, tablet and desktop viewports: ${raw.skill}`, async ({ page }, testInfo) => {
  await page.goto('/settings');
  await selectPicker(page, (await page.locator('.settings-language .setting-trigger').getAttribute('aria-label'))!, 'ar');
  await selectPicker(page, languagePacks.ar.app.theme, 'dark');
  const { lesson } = await start(page, raw);
  const panel = page.locator('.workspace-questions');
  for (const [width, height] of [[1440, 900], [1199, 800], [768, 560], [667, 375], [375, 410], [320, 480], [1200, 650]]) {
    await page.setViewportSize({ width, height });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (raw.skill === 'reading') {
      if (width < 1200 && await panel.getAttribute('data-open') === 'false') await panel.locator('.question-sheet-toggle').click();
      await panel.locator('.workspace-card button').last().click();
      const input = panel.locator('.workspace-question[data-selected=true] input').first();
      await expect(input).toBeFocused();
      await expect.poll(async () => {
        const box = (await input.boundingBox())!, frame = (await panel.locator('.question-sheet-content').boundingBox())!;
        return box.y >= frame.y && box.y + box.height <= frame.y + frame.height;
      }).toBe(true);
    } else {
      await expect(panel).toHaveCSS('position', 'static');
      const controls = await panel.locator('.audio-play,input[type=range]').evaluateAll(elements => elements.map(el => el.getBoundingClientRect().height));
      expect(controls.every(height => height >= 44)).toBe(true);
      await expect(panel.locator('.workspace-question:visible')).toHaveCount(questions(lesson).filter(item => item.material.id === raw.materials[0].id).length);
    }
    await page.screenshot({ path: testInfo.outputPath(`${raw.skill}-${width}x${height}.png`) });
  }
});

test('multi-slot navigation marks exactly one current response and keeps number buttons uniform', async ({ page }, testInfo) => {
  const { multiGapListening } = await import('../fixtures/workspace-lessons');
  await page.setViewportSize({ width: 1440, height: 900 }); await start(page, multiGapListening());
  const source = await page.locator('.workspace-material').boundingBox(), card = await page.locator('.workspace-questions').boundingBox();
  expect(card!.y).toBeGreaterThan(source!.y + source!.height);
  const nav = page.locator('.workspace-card nav'); await page.screenshot({ path: testInfo.outputPath('card-layout.png') });
  await expect(nav.locator('[aria-current]')).toHaveCount(1);
  await nav.getByRole('button').nth(1).click(); await expect(nav.locator('[aria-current]')).toHaveText('2');
  await page.locator('.inline-gap input').first().focus(); await expect(nav.locator('[aria-current]')).toHaveText('1');
  for (const width of [1440, 375, 320]) {
    await page.setViewportSize({ width, height: 812 });
    const boxes = await nav.getByRole('button').evaluateAll(buttons => buttons.map(button => { const box = button.getBoundingClientRect(); return { width: box.width, height: box.height }; }));
    expect(boxes.every(box => box.width >= 44 && box.height >= 44 && Math.abs(box.width - boxes[0].width) < 1 && Math.abs(box.height - boxes[0].height) < 1)).toBe(true);
  }
});

for (const width of [375, 1440]) test(`manual input focus wins before the navigation frame: ${width}`, async ({ page }) => {
  const { multiGapListening } = await import('../fixtures/workspace-lessons');
  await page.setViewportSize({ width, height: 900 });
  await page.clock.install({ time: new Date('2026-10-19T09:00:00Z') });
  const { id } = await start(page, multiGapListening());
  const nav = page.locator('.workspace-card nav'), input = page.locator('.inline-gap input').first();
  await input.focus();
  await page.clock.pauseAt(new Date('2026-10-19T09:10:00Z'));
  const second = nav.getByRole('button').nth(1);
  await second.focus(); await second.press('Enter');
  await expect(nav.locator('[aria-current]')).toHaveText('2');
  await input.focus(); await expect(nav.locator('[aria-current]')).toHaveText('1');
  await page.clock.runFor(64);
  await expect(input).toBeFocused(); await expect(nav.locator('[aria-current]')).toHaveText('1');
  await page.clock.resume();
  await page.keyboard.type('manual-focus-kept');
  await expect(input).toHaveValue('manual-focus-kept');
  await expect(page.locator('.workspace-save-status')).toHaveText('已保存在本设备');
  await expect.poll(() => page.evaluate(async id => Object.values((await (await import('/src/data/db.ts' as string)).sessions.get(id)).workspace.drafts).some(value => Array.isArray(value) && value[0] === 'manual-focus-kept'), id)).toBe(true);
});

test('mobile sheet pointer blur stays inside the card and keyboard close restores the peek focus', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 }); await page.emulateMedia({ reducedMotion: 'reduce' }); await start(page, worksheet);
  const panel = page.locator('.workspace-questions'), toggle = panel.locator('.question-sheet-toggle'), scrim = page.locator('.question-sheet-scrim');
  await toggle.focus(); await toggle.press('Enter'); await expect(panel).toHaveAttribute('data-open', 'true');
  await expect(scrim).toHaveAttribute('data-blur', 'false');
  const box = (await panel.boundingBox())!; await page.mouse.move(box.x + 10, box.y + 10); await expect(scrim).toHaveAttribute('data-blur', 'false');
  await page.mouse.down(); await expect(scrim).toHaveAttribute('data-blur', 'true');
  await page.mouse.up(); await expect(scrim).toHaveAttribute('data-blur', 'false');
  await page.mouse.move(2, 100); await expect(scrim).toHaveAttribute('data-blur', 'false');
  await page.keyboard.press('Escape'); await expect(panel).toHaveAttribute('data-open', 'false'); await expect(toggle).toBeFocused();
});

test('touch interaction and scrolling blur the mobile sheet backdrop while editing stays clear', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await start(page, worksheet);
  const panel = page.locator('.workspace-questions'), scrim = page.locator('.question-sheet-scrim');
  await panel.locator('.question-sheet-toggle').click();
  await expect(scrim).toHaveAttribute('data-blur', 'false');
  const prompt = panel.locator('.workspace-question[data-selected=true] h2');
  await prompt.dispatchEvent('pointerdown', { pointerId: 7, pointerType: 'touch', bubbles: true });
  await expect(scrim).toHaveAttribute('data-blur', 'true');
  await panel.locator('.question-sheet-content').evaluate(el => { el.scrollTop += 30; });
  await prompt.dispatchEvent('pointercancel', { pointerId: 7, pointerType: 'touch', bubbles: true });
  await expect(scrim).toHaveAttribute('data-blur', 'false');
  await panel.locator('.workspace-card button').last().click();
  const input = panel.locator('.workspace-question[data-selected=true] input').first();
  await input.fill('editing-keeps-the-material-clear');
  await expect(scrim).toHaveAttribute('data-blur', 'false');
  await input.dispatchEvent('pointerdown', { pointerId: 8, pointerType: 'touch', bubbles: true });
  await expect(scrim).toHaveAttribute('data-blur', 'false');
  await input.dispatchEvent('pointerup', { pointerId: 8, pointerType: 'touch', bubbles: true });
});

test('mobile answer sheet resizes continuously with pointer and keyboard without changing answers', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 900 });
  const { id } = await start(page, worksheet);
  const drafts = await page.evaluate(async sessionId => (await (await import('/src/data/db.ts' as string)).sessions.get(sessionId)).workspace?.drafts, id);
  const panel = page.locator('.workspace-questions');
  await panel.locator('.question-sheet-toggle').click();
  const grip = panel.getByRole('separator', { name: '调整答题卡大小' });
  await expect(grip).toBeVisible();
  expect((await grip.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(grip).toHaveCSS('touch-action', 'none');
  await expect.poll(() => panel.evaluate(element => {
    const target = parseFloat(getComputedStyle(element).getPropertyValue('--question-sheet-height'));
    return Math.abs(element.getBoundingClientRect().height - target);
  })).toBeLessThanOrEqual(1);
  const initial = (await panel.boundingBox())!.height;
  const handle = (await grip.boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2 + 83, { steps: 8 });
  expect(Math.abs((await panel.boundingBox())!.height - (initial - 83))).toBeLessThanOrEqual(1);
  await page.mouse.up();
  const resized = (await panel.boundingBox())!.height;
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  expect(Math.abs((await panel.boundingBox())!.height - resized)).toBeLessThanOrEqual(1);
  await grip.press('Home');
  await expect(grip).toHaveAttribute('aria-valuenow', '0');
  await grip.press('End');
  await expect(grip).toHaveAttribute('aria-valuenow', '100');
  await expect.poll(async () => {
    const sheet = (await panel.boundingBox())!, header = (await page.locator('.session-header').boundingBox())!;
    return sheet.y >= header.y + header.height + 23 && sheet.y + sheet.height <= 901;
  }).toBe(true);
  expect(await page.evaluate(async sessionId => (await (await import('/src/data/db.ts' as string)).sessions.get(sessionId)).workspace?.drafts, id)).toEqual(drafts);
  await page.screenshot({ path: testInfo.outputPath('resized-mobile-sheet.png') });
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(grip).toHaveCount(0);
  await expect(panel).toHaveCSS('position', 'sticky');
});

test('stable mobile sheet still clears the software keyboard and restores its ordinary anchor', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 }); await start(page, worksheet);
  const panel = page.locator('.workspace-questions');
  await panel.locator('.question-sheet-toggle').click();
  await panel.locator('.workspace-card button').last().click();
  const input = panel.locator('.workspace-question[data-selected=true] input').first();
  await expect(input).toBeFocused();
  const geometry = await panel.evaluate(element => {
    const viewport = window.visualViewport!;
    try {
      Object.defineProperty(viewport, 'height', { configurable: true, value: 480 });
      viewport.dispatchEvent(new Event('resize'));
      return { bottom: element.getBoundingClientRect().bottom, target: parseFloat(getComputedStyle(element).getPropertyValue('--question-sheet-height')), offset: parseFloat(getComputedStyle(element).getPropertyValue('--learning-bottom')) };
    } finally {
      Reflect.deleteProperty(viewport, 'height'); viewport.dispatchEvent(new Event('resize'));
    }
  });
  expect(geometry.bottom).toBeCloseTo(480, 0); expect(geometry.target).toBeLessThanOrEqual(392); expect(geometry.offset).toBe(332);
  await expect(input).toBeFocused();
  expect((await panel.boundingBox())!.y + (await panel.boundingBox())!.height).toBeCloseTo(812, 0);
});

test('opening the mobile sheet near the end of a short page does not clamp the reading position', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 480 }); await start(page, reading);
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  const position = await page.evaluate(() => scrollY); expect(position).toBeGreaterThan(0);
  await page.locator('.workspace-questions .question-sheet-toggle').press('Enter');
  await expect(page.locator('.workspace-questions')).toHaveAttribute('data-open', 'true');
  expect(await page.evaluate(() => scrollY)).toBe(position);
  await page.locator('.workspace-questions .question-close').click(); expect(await page.evaluate(() => scrollY)).toBe(position);
});

for (const width of [1440, 375]) test(`material navigation restores each article page position at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 812 }); const { lesson } = await start(page, worksheet);
  await page.evaluate(() => scrollTo(0, 500)); const position = await page.evaluate(() => scrollY);
  if (width < 1200) await page.locator('.workspace-questions .question-sheet-toggle').click();
  await page.locator('.workspace-card button').nth(lesson.materials[0].questions.length).click();
  await expect(page.locator('.workspace-material').getByRole('heading', { name: lesson.materials[1].title, exact: true })).toBeVisible();
  await page.locator('.workspace-card button').first().click();
  await expect(page.locator('.workspace-material').getByRole('heading', { name: lesson.materials[0].title, exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(position);
  if (width < 1200) await page.locator('.workspace-questions .question-close').click(); expect(await page.evaluate(() => scrollY)).toBe(position);
});

test('short desktop viewport lets the new card flow without shrinking or clipping its controls', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 480 }); await start(page, worksheet);
  await expect(page.locator('.workspace-questions')).toHaveCSS('position', 'static');
  await expect(page.locator('.workspace-questions')).toHaveCSS('max-height', 'none');
  await expect(page.locator('.workspace-questions .question-sheet-content')).toHaveCSS('overflow-y', 'visible');
  expect(await page.locator('.workspace-card button').evaluateAll(buttons => buttons.every(button => button.getBoundingClientRect().height >= 44))).toBe(true);
});

test('table prompts use the full card width with inputs underneath on desktop and mobile', async ({ page }) => {
  const raw = JSON.parse(readFileSync(new URL('../fixtures/content/a2-reading.json', import.meta.url), 'utf8'));
  await page.setViewportSize({ width: 1440, height: 900 }); await start(page, raw);
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: 812 });
    if (width < 1200) await page.locator('.workspace-questions .question-sheet-toggle').click();
    const row = page.locator('.workspace-question .answer-table label').first();
    // The sheet moves while opening; compare all three boxes in the same frame.
    const boxes = await row.evaluate(element => ({
      row: element.getBoundingClientRect().toJSON(),
      label: element.querySelector('span')!.getBoundingClientRect().toJSON(),
      input: element.querySelector('input')!.getBoundingClientRect().toJSON(),
    }));
    expect(boxes.label.width).toBeGreaterThan(boxes.row.width * .9);
    expect(boxes.input.y).toBeGreaterThanOrEqual(boxes.label.y + boxes.label.height + 4);
    expect(boxes.input.height).toBeGreaterThanOrEqual(44);
  }
});

for (const locale of ['zh-Hans', 'zh-Hant', 'en', 'ar'] as const) for (const theme of ['light', 'dark'] as const) test(`listening shows every current-audio question beneath the reference player at ${locale}/${theme}`, async ({ page }, testInfo) => {
  await page.goto('/settings');
  await selectPicker(page, (await page.locator('.settings-language .setting-trigger').getAttribute('aria-label'))!, locale);
  await selectPicker(page, languagePacks[locale].app.theme, theme);
  const { lesson } = await start(page, listening);
  const panel = page.locator('.workspace-questions'), bar = page.locator('.workspace-player-bar'), slider = page.getByRole('slider', { name: languagePacks[locale].app.playbackProgress });
  for (const width of [1440, 375, 320]) {
    await page.setViewportSize({ width, height: 900 }); await page.evaluate(() => scrollTo(0, 0));
    const source = (await page.locator('.workspace-material').boundingBox())!, card = (await panel.boundingBox())!;
    expect(card.y).toBeGreaterThanOrEqual(source.y + source.height); await expect(panel).toHaveCSS('position', 'static');
    await expect(panel).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)'); await expect(panel).toHaveCSS('border-radius', '0px');
    await expect(bar.locator('..')).toHaveClass('question-progress'); await expect(bar.locator('..')).toHaveCSS('position', 'sticky'); await expect(slider).toHaveCSS('direction', 'ltr');
    // Preloading is a browser hint; a real playback gesture must make seeking available.
    await page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.muted = true);
    await page.getByRole('button', { name: languagePacks[locale].app.play, exact: true }).click();
    await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.currentTime)).toBeGreaterThan(.1);
    await page.getByRole('button', { name: languagePacks[locale].app.pause, exact: true }).click();
    await expect(slider).toBeEnabled();
    expect(await slider.evaluate(el => getComputedStyle(el).backgroundImage)).toContain('linear-gradient');
    expect((await slider.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(page.locator('.workspace-question:visible')).toHaveCount(lesson.materials[0].questions.length);
    const playerBox = (await bar.boundingBox())!;
    await expect(panel.locator('progress,.question-number')).toHaveCount(0);
    expect(playerBox.width).toBeGreaterThanOrEqual(card.width * .95);
    await expect(panel.locator('.workspace-card summary')).toHaveText(languagePacks[locale].workspace.card);
    expect(card.width).toBeLessThanOrEqual(760);
    const numbers = await panel.locator('.workspace-card button').evaluateAll(elements => elements.map(el => { const r = el.getBoundingClientRect(); return { x: r.x, width: r.width }; }));
    expect(numbers.every(number => number.width === 44)).toBe(true);
    expect(Math.abs(numbers[1].x - numbers[0].x)).toBe(52);
    await expect(page.locator('.session-header')).toHaveCSS('backdrop-filter', 'none');
    const selected = panel.locator('.workspace-card button[aria-current]');
    expect(await selected.evaluate(el => getComputedStyle(el).backgroundColor)).toBe(await page.evaluate(() => { const el = document.createElement('i'); el.style.color = 'var(--accent)'; document.body.appendChild(el); const color = getComputedStyle(el).color; el.remove(); return color; }));
    expect(playerBox.height).toBeLessThanOrEqual(60);
    expect((await page.locator('.audio-play').boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
    const header = (await page.locator('.session-header').boundingBox())!, headerBottom = header.y + header.height, pinned = (await bar.locator('..').boundingBox())!;
    expect(pinned.y).toBeGreaterThanOrEqual(headerBottom - 1); expect(pinned.y).toBeLessThanOrEqual(headerBottom + 12);
    const beforeSeek = await page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.currentTime);
    await slider.focus(); for (let step = 0; step < 4; step++) await slider.press('ArrowRight');
    await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.currentTime)).toBeGreaterThan(beforeSeek + .2);
    await page.locator('.workspace-card button').nth(1).click();
    const input = page.locator('.workspace-question[data-selected=true] h2').first(); await expect(input).toBeFocused();
    const control = (await input.boundingBox())!, controls = (await bar.locator('..').boundingBox())!; expect(control.y).toBeGreaterThanOrEqual(controls.y + controls.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`listening-${width}.png`) });
  }
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.evaluate(() => document.documentElement.style.fontSize = '200%');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 480 }); await expect(bar.locator('..')).toHaveCSS('position', 'static');
  await expect(panel).toHaveCSS('overflow-y', 'visible');
});

for (const mobile of [false, true]) test(`reading card fits available height and preserves two-way motion: mobile=${mobile}`, async ({ page }) => {
  await page.setViewportSize({ width: mobile ? 375 : 1440, height: 900 });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await start(page, worksheet);
  const panel = page.locator('.workspace-questions');
  if (!mobile) {
    const first = (await panel.boundingBox())!;
    expect(900 - first.y - first.height).toBeCloseTo(64, 0);
    await page.setViewportSize({ width: 1440, height: 1050 });
    await expect.poll(async () => (await panel.boundingBox())!.height).toBeGreaterThan(first.height + 140);
    return;
  }
  for (const height of [900, 600, 410]) {
    await page.setViewportSize({ width: 375, height }); await page.evaluate(() => scrollTo(0, 0));
    const measure = async (opening: boolean) => panel.evaluate(async (el, opening) => {
      const samples: number[] = [], start = performance.now();
      (el.querySelector(opening ? '.question-sheet-toggle' : '.question-close') as HTMLElement).click();
      while (performance.now() - start < 340) { samples.push(el.getBoundingClientRect().height); await new Promise(requestAnimationFrame); }
      return samples;
    }, opening);
    const closed = (await panel.boundingBox())!.height, opening = await measure(true), open = (await panel.boundingBox())!;
    expect(open.height).toBeGreaterThan(closed + 100);
    expect(opening.some(value => value > closed + 3 && value < open.height - 3)).toBe(true);
    const header = (await page.locator('.session-header').boundingBox())!;
    expect(open.y).toBeGreaterThanOrEqual(Math.max(0, header.y + header.height) + 23);
    expect(open.height).toBeLessThanOrEqual(height * .7 + 1);
    const closing = await measure(false);
    expect(closing.some(value => value > closed + 3 && value < open.height - 3)).toBe(true);
    expect(Math.abs((await panel.boundingBox())!.height - closed)).toBeLessThanOrEqual(1);
    await expect(panel.locator('.question-sheet-content')).toHaveAttribute('inert', '');
  }
  await page.emulateMedia({ reducedMotion: 'reduce' }); await expect(panel).toHaveCSS('transition-duration', '0s');
  expect(errors).toEqual([]);
});

test('reference completion hierarchy preserves exact prompt text, saved snapshot and input focus', async ({ page }) => {
  const heard = JSON.parse(readFileSync(new URL('../fixtures/content/a2-listening.json', import.meta.url), 'utf8'));
  const multiline = structuredClone(heard); multiline.materials[0].questions[0].prompt = multiline.materials[0].questions[0].prompt.replace(': ', ':\n');
  for (const raw of [worksheet, heard, multiline]) {
    const { id, lesson } = await start(page, raw);
    const completions = questions(lesson).filter(item => 'kind' in item.question && item.question.kind === 'completion');
    expect(completions.length).toBeGreaterThan(0);
    for (const item of completions) {
      const slot = questions(lesson).slice(0, questions(lesson).findIndex(candidate => candidate.question.id === item.question.id)).reduce((sum, item) => sum + questionSlots(item.question), 0);
      await page.locator('.workspace-card button').nth(slot).click();
      const block = page.locator('.workspace-question').filter({ has: page.locator(`[id="prompt-${item.question.id}"]`) });
      const prompt = item.question.prompt, split = prompt.indexOf('\n');
      await expect(block.locator('h2')).toContainText(split > 0 ? prompt.slice(0, split) : prompt);
      if (split > 0) await expect(block.locator('.question-sentence')).toHaveText(prompt.slice(split + 1));
      else await expect(block.locator('.question-sentence')).toHaveCount(0);
      await expect(block.locator('input')).toBeFocused();
      await expect(block.locator('input')).toHaveCSS('box-shadow', 'none');
      await expect(block.locator('input')).toHaveCSS('outline-style', 'none');
      await expect(block.locator('input')).toHaveCSS('direction', 'ltr');
    }
    expect(await page.evaluate(async id => (await (await import('/src/data/db.ts' as string)).sessions.get(id)).lesson, id)).toEqual(lesson);
  }
});
