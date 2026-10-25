import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { groupedListening } from '../fixtures/workspace-lessons';
import { questionSlots } from '../../src/shared/practiceWorkspace';
import type { Lesson } from '../../src/shared/content';
import { languagePacks } from '../../src/locales';
import { fillQuestion, playMaterial } from './workspace';

const english = (en: string) => ({ en, 'zh-Hans': en, 'zh-Hant': en });
function mixedReading() {
  const lesson = JSON.parse(readFileSync(new URL('../fixtures/content/a1-reading.json', import.meta.url), 'utf8')) as Lesson;
  for (const material of lesson.materials) material.questions.push({ kind: 'response', id: `${material.id}-response`, blockId: material.blocks[0].id, prompt: 'Explain the source wording.', evidence: material.questions[0].evidence, criteria: [english('Use the source.'), english('Preserve meaning.')], hints: material.questions[0].hints, explanation: lesson.goal });
  lesson.organization = 'material-v1'; return lesson;
}
for (const [skill, width, locale, theme, testMode] of [
  ['reading',1440,'en','light',false], ['reading',390,'ar','dark',true], ['reading',375,'ar','light',false], ['listening',390,'zh-Hans','dark',false], ['listening',1440,'en','light',true],
] as const) test.describe(`subjective ${skill}/${locale}/${testMode}`, () => {
  test.use({ viewport: { width, height: 900 }, hasTouch: width < 1200, isMobile: width < 1200, locale: locale === 'zh-Hans' ? 'zh-CN' : locale, colorScheme: theme, reducedMotion: skill === 'reading' && testMode ? 'reduce' : 'no-preference' });
  test('skip, restore, reload and submit preserve real answers and playback', async ({ page }, info) => {
    await page.route(/\/src\/data\/db\.ts(?:\?.*)?$/, async route => { const response = await route.fetch(); await route.fulfill({ response, body: `${await response.text()}\nfor (const [name, original] of [['exposure', markExposure], ['playback', recordPlayback]]) { const wrapped = async (...args) => { try { return await original(...args); } catch (error) { (window.practiceErrors ??= []).push(name + ':' + error.message); throw error; } }; if (name === 'exposure') markExposure = wrapped; else recordPlayback = wrapped; }` }); });
    const w = languagePacks[locale].workspace, raw = skill === 'reading' ? mixedReading() : groupedListening();
    await page.goto('/today'); await expect(page.locator('#practice-section-title')).toBeVisible();
    const { id, lesson } = await page.evaluate(async ({ raw, testMode }) => {
      const { asTestLesson } = await import('/src/shared/content.ts' as string), { createSession } = await import('/src/data/db.ts' as string);
      const session = await createSession(testMode ? asTestLesson(raw) : raw); return { id: session.id, lesson: session.lesson };
    }, { raw, testMode }) as { id: string; lesson: Lesson };
    const all = lesson.materials.flatMap(material => material.questions), open = all.find(question => 'criteria' in question)!;
    const number = all.slice(0, all.indexOf(open)).reduce((sum, question) => sum + questionSlots(question), 0);
    await page.goto(`/learn/${id}`); await expect(page.locator('.material-workspace')).toBeVisible();
    if (width < 1200 && skill === 'reading') await page.locator('.question-sheet-toggle').click();
    await page.locator('.workspace-card button').nth(number).click();
    const section = page.locator(`[id="prompt-${open.id}"]`).locator('..'), field = section.locator('textarea').first();
    await field.fill('Retained partial answer.');
    const skip = section.getByRole('button', { name: w.skip, exact: true });
    const hint = section.locator('button.hint');
    if (testMode) await expect(hint).toHaveCount(0);
    else {
      await skip.scrollIntoViewIfNeeded();
      const a = (await skip.boundingBox())!, b = (await hint.boundingBox())!;
      expect(Math.abs(a.y - b.y)).toBeLessThan(1); expect(a.height).toBeGreaterThanOrEqual(44); expect(b.height).toBeGreaterThanOrEqual(44);
      for (let level = 1; level <= 3; level++) { await hint.click(); await expect(section.locator('.hint-text')).toHaveCount(level); }
      await expect(hint).toBeDisabled();
      await skip.scrollIntoViewIfNeeded();
      const current = (await section.locator('.workspace-question-actions').boundingBox())!;
      expect((await section.locator('.hint-text').first().boundingBox())!.y).toBeGreaterThan(current.y + current.height);
      await page.screenshot({ path: info.outputPath('question-actions.png') });
    }
    if (width >= 1200) { await skip.focus(); await skip.press('Enter'); } else await skip.tap();
    await expect(field).toBeDisabled(); await expect(section.getByRole('status')).toHaveText(w.skipped);
    await expect.poll(() => page.evaluate(async id => (await (await import('/src/data/db.ts' as string)).sessions.get(id)).workspace.skipped, id)).toContain(open.id);
    await page.reload(); if (width < 1200 && skill === 'reading') await page.locator('.question-sheet-toggle').click();
    await page.locator('.workspace-card button').nth(number).click();
    await expect(field).toBeDisabled(); await expect(field).toHaveValue('Retained partial answer.');
    await section.getByRole('button', { name: w.resumeAnswer, exact: true }).click();
    await expect(field).toBeEnabled(); await expect(field).toHaveValue('Retained partial answer.');
    if (skill === 'listening') {
      await page.locator('audio').evaluate((audio: HTMLAudioElement) => { audio.muted = true; (window as unknown as { skipPlayer: HTMLAudioElement }).skipPlayer = audio; });
      await page.locator('.audio-play').click();
      await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => !audio.paused && audio.currentTime > .1)).toBe(true);
    }
    await section.getByRole('button', { name: w.skip, exact: true }).click();
    if (skill === 'listening') expect(await page.locator('audio').evaluate((audio: HTMLAudioElement) => audio === (window as unknown as { skipPlayer: HTMLAudioElement }).skipPlayer && !audio.paused && audio.currentTime > .1)).toBe(true);
    await expect(section.getByRole('button', { name: w.resumeAnswer })).toBeEnabled();
    expect(await section.getByRole('button', { name: w.resumeAnswer }).evaluate(element => { const box = element.getBoundingClientRect(); return box.width >= 44 && box.height >= 44; })).toBe(true);
    await page.screenshot({ path: info.outputPath('skipped.png') });
    let slot = 0; const heard = new Set<string>();
    for (const material of lesson.materials) {
      for (const question of material.questions) {
        await page.locator('.workspace-card button').nth(slot).click(); slot += questionSlots(question);
        const block = page.locator(`[id="prompt-${question.id}"]`).locator('..');
        if ('criteria' in question) { const button = block.getByRole('button', { name: w.skip, exact: true }); if (await button.count()) await button.click(); }
        else await fillQuestion(block, question);
      }
      if (material.audio && !heard.has(material.audio.src)) {
        expect(await page.evaluate(() => (window as unknown as { practiceErrors?: string[] }).practiceErrors ?? [])).toEqual([]);
        if (!(await page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.paused))) await page.locator('.audio-play').click();
        try { await playMaterial(page); } catch (error) { const localErrors = await page.evaluate(() => (window as unknown as { practiceErrors?: string[] }).practiceErrors ?? []); if (localErrors.length) throw new Error(localErrors.join(', ')); throw error; } heard.add(material.audio.src);
      }
    }
    await page.locator('form button[type=submit]').click(); await expect(page.locator('#workspace-result')).toBeVisible();
    const data = await page.evaluate(async id => { const { sessions, attempts } = await import('/src/data/db.ts' as string); return { session: await sessions.get(id), attempts: await attempts.where('sessionId').equals(id).toArray() }; }, id);
    expect(data.session.lesson).toEqual(lesson); expect(data.session.status).toBe('completed');
    expect(data.attempts).toHaveLength(all.filter(question => !('criteria' in question)).length);
    expect(data.attempts.every((attempt: { correct: boolean }) => attempt.correct)).toBe(true);
    await expect(page.locator('.workspace-review').getByText(w.skipped, { exact: true })).toHaveCount(all.filter(question => 'criteria' in question).length);
    await page.reload(); await expect(page.locator('#workspace-result')).toBeVisible();
    await expect(page.locator('.workspace-review').getByText(w.skipped, { exact: true })).toHaveCount(all.filter(question => 'criteria' in question).length);
    await page.goto('/progress'); await page.locator('.history details summary').click();
    await expect(page.locator('.history').getByText(w.skipped, { exact: true })).toHaveCount(all.filter(question => 'criteria' in question).length);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
});

test('a failed skip save retries without losing an earlier answer or silently submitting', async ({ page }) => {
  await page.route(/\/src\/data\/db\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch(); await route.fulfill({ response, body: `${await response.text()}\nconst originalSkip = skipWorkspaceQuestion; skipWorkspaceQuestion = async function(...args) { if (window.failSkip) { window.failSkip = false; throw new Error('DISK_FULL'); } return originalSkip(...args); };` });
  });
  await page.goto('/today'); await expect(page.locator('#practice-section-title')).toBeVisible();
  const id = await page.evaluate(async lesson => (await (await import('/src/data/db.ts' as string)).createSession(lesson)).id, mixedReading());
  await page.goto(`/learn/${id}`); await expect(page.locator('.material-workspace')).toBeVisible();
  await page.locator('.workspace-card button').nth(2).click(); const section = page.locator('.workspace-question[data-selected=true]'), field = section.locator('textarea');
  await field.fill('Earlier saved answer.'); await page.evaluate(() => { (window as unknown as { failSkip: boolean }).failSkip = true; });
  await section.getByRole('button', { name: '跳过此题', exact: true }).click();
  const alert = page.locator('.material-workspace [role=alert]'); await expect(alert).toBeVisible();
  await alert.getByRole('button', { name: '重试', exact: true }).click(); await expect(alert).toHaveCount(0);
  expect(await page.evaluate(async id => { const { sessions, attempts } = await import('/src/data/db.ts' as string), session = await sessions.get(id); return { skipped: session.workspace.skipped.length, drafts: Object.values(session.workspace.drafts), attempts: await attempts.count(), status: session.status }; }, id)).toEqual({ skipped: 1, drafts: ['Earlier saved answer.'], attempts: 0, status: 'active' });
});
