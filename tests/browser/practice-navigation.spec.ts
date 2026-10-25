import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { groupedListening } from '../fixtures/workspace-lessons';
import { questionSlots } from '../../src/shared/practiceWorkspace';
import type { Lesson } from '../../src/shared/content';

for (const mobile of [false, true]) test.describe(`question navigation mobile=${mobile}`, () => {
  test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, hasTouch: mobile, isMobile: mobile });
  for (const skill of ['reading', 'listening']) test(`${skill} locates every slot without editing and retains drafts`, async ({ page }, info) => {
    const lesson = skill === 'listening' ? groupedListening() : JSON.parse(readFileSync(new URL('../fixtures/content/b1-summary-reading.json', import.meta.url), 'utf8')) as Lesson;
    lesson.organization = 'material-v1';
    if (skill === 'reading') for (const material of lesson.materials) for (const question of material.questions) if ('criteria' in question) question.parts = ['What is uncertain?', 'What should the reader do next?', 'What is the alternative?'];
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('/today'); await expect(page.getByRole('heading', { name: '练习', exact: true })).toBeVisible();
    const id = await page.evaluate(async lesson => (await (await import('/src/data/db.ts' as string)).createSession(lesson)).id, lesson);
    await page.goto(`/learn/${id}`); await expect(page.locator('.material-workspace')).toBeVisible();
    if (mobile && skill === 'reading') await page.locator('.question-sheet-toggle').click();
    const group = skill === 'listening' ? lesson.materials.slice(0, 2) : lesson.materials;
    const all = lesson.materials.flatMap(material => material.questions), slots = all.flatMap(question => Array.from({ length: questionSlots(question) }, (_, slot) => ({ question, slot })));
    if (skill === 'listening') {
      await expect(page.locator('.workspace-question h2')).toHaveCount(group.flatMap(material => material.questions).length);
      expect(await page.locator('.workspace-question h2').evaluateAll(elements => elements.map(element => element.id))).toEqual(group.flatMap(material => material.questions.map(question => `prompt-${question.id}`)));
      expect(await page.locator('form').evaluate(element => element.scrollHeight)).toBeGreaterThan(mobile ? 844 : 900);
      await page.locator('audio').evaluate((audio: HTMLAudioElement) => { audio.muted = true; (window as unknown as { originalAudio: HTMLAudioElement }).originalAudio = audio; });
      await page.locator('.audio-play').click();
      await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => !audio.paused && audio.currentTime > .1)).toBe(true);
    }
    await page.locator('audio').evaluateAll(elements => { const audio = elements[0] as HTMLAudioElement | undefined; if (!audio) return; const trace = { start: audio.currentTime, events: [] as string[] }; (window as unknown as { audioTrace: typeof trace }).audioTrace = trace; for (const type of ['loadstart', 'emptied', 'pause']) audio.addEventListener(type, () => trace.events.push(type)); });
    await page.evaluate(() => { (window as unknown as { editableFocus: string[] }).editableFocus = []; document.addEventListener('focusin', event => { const element = event.target as HTMLElement; if (element.matches('input:not([type=range]),textarea,[contenteditable=true]')) (window as unknown as { editableFocus: string[] }).editableFocus.push(element.id); }); });
    const limit = group.flatMap(material => material.questions).reduce((sum, question) => sum + questionSlots(question), 0);
    for (const index of [0, Math.floor(limit / 2), limit - 1, 0, limit - 1]) {
      const { question, slot } = slots[index];
      await page.locator('.workspace-card summary').evaluate((element: HTMLElement) => { (element.parentElement as HTMLDetailsElement).open = true; });
      const button = page.locator('.workspace-card button').nth(index);
      if (mobile) await button.tap(); else await button.click();
      await expect(page.locator(`[id="prompt-${question.id}"]`)).toBeFocused();
      await expect(page.locator('.workspace-card [aria-current]')).toHaveText(String(index + 1));
      const anchor = 'pairs' in question ? page.locator(`[id="prompt-${question.id}"]`).locator('..').locator('.setting').nth(slot) : page.locator(`[id="answer-${question.id}-${slot}"]`);
      if (slot) await expect(anchor).toBeInViewport();
      const heading = page.locator(`[id="prompt-${question.id}"]`);
      if (!slot) expect(await heading.evaluate(element => {
        const bar = document.querySelector('.question-progress')!, panel = element.closest('.question-sheet-content')!;
        return element.getBoundingClientRect().top >= (getComputedStyle(bar).position === 'sticky' ? bar.getBoundingClientRect().bottom : panel.getBoundingClientRect().top) - 1;
      })).toBe(true);
    }
    expect(await page.evaluate(() => (window as unknown as { editableFocus: string[] }).editableFocus)).toEqual([]);
    await expect(page.getByRole('listbox')).toHaveCount(0);
    const field = page.locator('.workspace-question textarea').first();
    if (mobile) await field.tap(); else await field.click();
    await field.fill('A retained, explicitly entered response.');
    await expect(page.locator('.workspace-save-status')).toHaveText('已保存在本设备');
    await page.locator('.workspace-card summary').click(); await page.locator('.workspace-card summary').click();
    await page.locator('.workspace-card button').first().click();
    await expect(page.locator(`[id="prompt-${slots[0].question.id}"]`)).toBeFocused();
    await page.waitForTimeout(350); // Include the sheet transition and queued draft completion.
    expect(await page.evaluate(() => document.activeElement?.matches('input,textarea,[contenteditable=true]'))).toBe(false);
    if (skill === 'listening') {
      expect(await page.locator('audio').evaluate((audio: HTMLAudioElement) => audio === (window as unknown as { originalAudio: HTMLAudioElement }).originalAudio && !audio.paused && audio.currentTime > .1)).toBe(true);
      expect(await page.locator('audio').evaluate((audio: HTMLAudioElement) => { const trace = (window as unknown as { audioTrace: { start: number; events: string[] } }).audioTrace; return { progressed: audio.currentTime > trace.start, events: trace.events }; })).toEqual({ progressed: true, events: [] });
    }
    await page.locator('.workspace-card button').nth(limit - 1).click();
    await expect(page.locator('.workspace-question textarea').first()).toHaveValue('A retained, explicitly entered response.');
    await page.screenshot({ path: info.outputPath(`${skill}-${mobile ? 'touch' : 'desktop'}.png`), fullPage: true });
    await page.reload();
    if (mobile && skill === 'reading') await page.locator('.question-sheet-toggle').click();
    await page.locator('.workspace-card button').nth(limit - 1).click();
    await expect(page.locator('.workspace-question textarea').first()).toHaveValue('A retained, explicitly entered response.');
    expect(errors).toEqual([]);
  });
});


for (const mobile of [false, true]) test.describe(`listening submit mobile=${mobile}`, () => {
  test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, hasTouch: mobile, isMobile: mobile });
  for (const interleaved of [false, true]) test(`submit follows the final audio question, interleaved=${interleaved}`, async ({ page }) => {
    const lesson = groupedListening();
    if (interleaved) [lesson.materials[1], lesson.materials[2]] = [lesson.materials[2], lesson.materials[1]];
    await page.goto('/today'); await expect(page.getByRole('heading', { name: '练习', exact: true })).toBeVisible();
    const id = await page.evaluate(async lesson => (await (await import('/src/data/db.ts' as string)).createSession(lesson)).id, lesson);
    await page.goto(`/learn/${id}`); await expect(page.locator('.material-workspace')).toBeVisible();
    const form = page.locator('.workspace-questions form');
    await expect(form.locator('button[type=submit]')).toHaveCount(0);
    await page.locator('#answer-same-audio-word-0').fill('draft-before-next-audio');
    await page.locator('#answer-same-audio-word-0').press('Enter');
    await expect(page.getByRole('dialog')).toBeHidden();
    expect(await page.evaluate(async id => (await (await import('/src/data/db.ts' as string)).attempts.where('sessionId').equals(id).count()), id)).toBe(0);
    const next = form.locator(':scope>button[type=button]');
    expect(await next.evaluate(element => element.previousElementSibling?.classList.contains('workspace-question'))).toBe(true);
    if (mobile) await next.tap(); else await next.click();
    const other = lesson.materials.find(material => material.audio!.src !== lesson.materials[0].audio!.src)!;
    await expect(page.locator('audio')).toHaveAttribute('src', other.audio!.src);
    await expect(page.locator('.workspace-question')).toHaveCount(other.questions.length);
    const submit = form.locator('button[type=submit]'); await expect(submit).toHaveCount(1);
    expect(await submit.evaluate(element => element.previousElementSibling?.classList.contains('workspace-question'))).toBe(true);
    await expect(form.locator(':scope>button[type=button]')).toHaveCount(0);
    await page.locator('.workspace-card button').first().click();
    await expect(form.locator('button[type=submit]')).toHaveCount(0);
    await expect(page.locator('#answer-same-audio-word-0')).toHaveValue('draft-before-next-audio');
  });
});
