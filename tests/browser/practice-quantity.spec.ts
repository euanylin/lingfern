import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { quantityFixture } from '../fixtures/quantity-lessons';
import { selectPicker } from './picker';
import { languagePacks } from '../../src/locales';

for (const [locale, width, theme] of [['zh-Hans', 375, 'light'], ['en', 1440, 'dark'], ['ar', 375, 'dark']] as const) test(`independent response inputs survive reload and score consistently: ${locale}/${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  await page.goto('/settings');
  await selectPicker(page, (await page.locator('.settings-language .setting-trigger').getAttribute('aria-label'))!, locale);
  await selectPicker(page, (await page.locator('.setting-trigger').nth(1).getAttribute('aria-label'))!, theme);
  const { lesson } = quantityFixture(150);
  for (const material of lesson.materials) {
    const q = material.questions[0]; material.blocks[0].text = 'This is a report. ' + 'the '.repeat(145);
    material.questions = [{ kind: 'response', id: q.id, blockId: q.blockId, prompt: 'Who arrived? Where did they go?', parts: ['Who arrived?', 'Where did they go?'], hints: q.hints, evidence: { start: 0, end: 17 }, criteria: [lesson.teaching!, lesson.workedExample!], explanation: lesson.teaching! }];
  }
  const result = await page.evaluate(async raw => {
    const { organizePractice } = await import('/src/core/practiceOrganization.ts' as string), { createSession } = await import('/src/data/db.ts' as string);
    return createSession(organizePractice(raw));
  }, lesson);
  await page.goto(`/learn/${result.id}`);
  await expect(page.locator('.material-workspace')).toBeVisible();
  if (width < 1200) await page.locator('.question-sheet-toggle').click();
  await expect(page.locator('.workspace-card button')).toHaveCount(4);
  await expect(page.locator('.workspace-question textarea')).toHaveCount(2);
  await page.locator('.workspace-question textarea').first().fill('Maya');
  await expect.poll(() => page.evaluate(async id => {
    const { sessions } = await import('/src/data/db.ts' as string), { practiceCardProgress } = await import('/src/app/PracticeCard.tsx' as string);
    return practiceCardProgress([await sessions.get(id)], []).answered;
  }, result.id)).toBe(1);
  await page.reload();
  if (width < 1200) await page.locator('.question-sheet-toggle').click();
  await expect(page.locator('.workspace-question textarea').first()).toHaveValue('Maya');
  await page.locator('.workspace-question textarea').nth(1).fill('The village');
  await page.locator('.workspace-card button').nth(2).click();
  await expect(page.locator(`[id="prompt-${result.lesson.materials[1].questions[0].id}"]`)).toBeVisible();
  await page.locator('.workspace-question textarea').first().fill('Maya');
  await page.locator('.workspace-question textarea').nth(1).fill('The village');
  await page.getByRole('button', { name: languagePacks[locale].workspace.submitAll, exact: true }).click();
  await expect(page.locator('#workspace-result')).toBeVisible();
  await expect(page.locator('.slot-result')).toHaveCount(4);
  const saved = await page.evaluate(async id => {
    const { sessions, attempts } = await import('/src/data/db.ts' as string), { practiceCardProgress } = await import('/src/app/PracticeCard.tsx' as string);
    const session = await sessions.get(id), records = await attempts.where('sessionId').equals(id).toArray();
    return { status: session.status, progress: practiceCardProgress([session], records), answers: records.map((r: { answer: unknown }) => r.answer), snapshot: session.lesson };
  }, result.id);
  expect(saved.status).toBe('completed'); expect(saved.progress).toMatchObject({ answered: 4, total: 4 });
  expect(saved.answers).toEqual([['Maya', 'The village'], ['Maya', 'The village']]);
  expect(saved.snapshot).toEqual(result.lesson);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath(`quantity-${locale}-${width}.png`) });
});


test('new listening assembly uses actual answer points and ignores playback speed', async ({ page }) => {
  const raw = JSON.parse(readFileSync(new URL('../fixtures/content/c2-listening.json', import.meta.url), 'utf8'));
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto('/today');
  const result = await page.evaluate(async raw => {
    const { organizePractice } = await import('/src/core/practiceOrganization.ts' as string), { createSession } = await import('/src/data/db.ts' as string);
    return createSession(organizePractice(raw));
  }, raw);
  await page.goto(`/learn/${result.id}`); await expect(page.locator('.material-workspace')).toBeVisible();
  const count = result.lesson.materials.reduce((sum: number, m: { quantity: { actual: number } }) => sum + m.quantity.actual, 0);
  expect(count).toBeGreaterThan(4); expect(count).toBeLessThanOrEqual(20);
  await expect(page.locator('.workspace-card button')).toHaveCount(count);
  const audio = page.locator('audio');
  await audio.evaluate((audio: HTMLAudioElement) => { audio.muted = true; audio.playbackRate = 4; });
  await page.getByRole('button', { name: '播放 / 重听', exact: true }).click();
  await expect.poll(() => audio.evaluate((audio: HTMLAudioElement) => audio.currentTime)).toBeGreaterThan(.1);
  const current = await page.evaluate(async id => (await (await import('/src/data/db.ts' as string)).sessions.get(id)).lesson, result.id);
  expect(current).toEqual(result.lesson); await expect(page.locator('.workspace-card button')).toHaveCount(count);
});
