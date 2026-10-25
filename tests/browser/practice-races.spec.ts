import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { Lesson } from '../../src/shared/content';

async function start(page: Page, skill: 'reading' | 'listening') {
  const lesson = JSON.parse(readFileSync(new URL(`../fixtures/content/${skill === 'reading' ? 'b1-summary-reading' : 'c2-listening'}.json`, import.meta.url), 'utf8')) as Lesson;
  lesson.organization = 'material-v1';
  await page.goto('/today'); await expect(page.getByRole('heading', { name: '练习', exact: true })).toBeVisible();
  const id = await page.evaluate(async lesson => (await (await import('/src/data/db.ts' as string)).createSession(lesson)).id, lesson);
  await page.goto(`/learn/${id}`); await expect(page.locator('.material-workspace')).toBeVisible();
  return { id, lesson };
}

async function holdFirstExposure(page: Page) {
  await page.route(/\/src\/data\/db\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}\nconst originalExposure = markExposure; markExposure = async function(...args) { await originalExposure(...args); if (window.holdExposure) { window.holdExposure = false; window.exposureHeld = true; await new Promise(resolve => window.releaseExposure = resolve); } };` });
  });
}

for (const mobile of [false, true]) test.describe(`practice races mobile=${mobile}`, () => {
  test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, hasTouch: mobile, isMobile: mobile });
  test('choosing an answer while an older cross-material jump waits for saving wins', async ({ page }) => {
    await page.route(/\/src\/data\/db\.ts(?:\?.*)?$/, async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: `${await response.text()}\nconst originalDraftSave = saveWorkspaceDraft; saveWorkspaceDraft = async function(...args) { if (window.holdDraft) { window.holdDraft = false; await new Promise(resolve => window.releaseDraft = resolve); } return originalDraftSave(...args); };` });
    });
    const { id, lesson } = await start(page, 'reading');
    if (mobile) await page.locator('.question-sheet-toggle').click();
    await page.evaluate(() => { (window as unknown as { holdDraft: boolean }).holdDraft = true; });
    const original = page.locator(`[id="answer-${lesson.materials[0].questions[0].id}-0"]`);
    await original.fill('First retained answer.');
    await expect.poll(() => page.evaluate(() => typeof (window as unknown as { releaseDraft?: unknown }).releaseDraft)).toBe('function');
    await page.locator('.workspace-card button').last().click();
    await original.click(); await original.fill('Latest explicit answer.');
    await page.evaluate(() => (window as unknown as { releaseDraft: () => void }).releaseDraft());
    await expect(page.locator('.workspace-save-status')).toHaveText('已保存在本设备');
    await expect(page.locator('.workspace-material')).toContainText(lesson.materials[0].title);
    await expect(original).toHaveValue('Latest explicit answer.'); await expect(original).toBeFocused();
    await expect.poll(() => page.evaluate(async id => (await (await import('/src/data/db.ts' as string)).sessions.get(id)).workspace.selected, id)).toBe(lesson.materials[0].questions[0].id);
    await expect(page.locator('.material-workspace [role=alert]')).toHaveCount(0);
  });

  test('changing audio releases the old preparation before its delayed exposure finishes', async ({ page }) => {
    await holdFirstExposure(page);
    const { id, lesson } = await start(page, 'listening');
    await page.evaluate(() => { (window as unknown as { holdExposure: boolean }).holdExposure = true; });
    await page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.muted = true);
    await page.locator('.audio-play').click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { exposureHeld?: boolean }).exposureHeld)).toBe(true);
    await page.locator('.workspace-card button').last().click();
    await expect(page.locator('audio')).toHaveAttribute('src', lesson.materials[1].audio!.src);
    await expect(page.locator('.audio-play')).toHaveAttribute('aria-label', '播放 / 重听');
    await page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.muted = true);
    await page.locator('.audio-play').click();
    await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => !audio.paused && audio.currentTime > .1)).toBe(true);
    await page.evaluate(() => (window as unknown as { releaseExposure: () => void }).releaseExposure());
    await expect.poll(() => page.evaluate(async id => (await (await import('/src/data/db.ts' as string)).sessions.get(id)).assistance.playbackRequests, id)).toBe(1);
    expect(await page.locator('audio').evaluate((audio: HTMLAudioElement) => !audio.paused)).toBe(true);
    await expect(page.locator('.material-workspace [role=alert]')).toHaveCount(0);
  });

  test('an ended old recording cannot complete the newly selected recording after a delayed save', async ({ page }) => {
    await holdFirstExposure(page);
    const { id, lesson } = await start(page, 'listening');
    await page.evaluate(() => { (window as unknown as { holdExposure: boolean }).holdExposure = true; });
    await page.locator('audio').evaluate((audio: HTMLAudioElement) => { audio.muted = true; audio.playbackRate = 16; });
    await page.locator('.audio-play').click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { exposureHeld?: boolean }).exposureHeld)).toBe(true);
    await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.ended), { timeout: 15_000 }).toBe(true);
    await page.locator('.workspace-card button').last().click();
    await expect(page.locator('audio')).toHaveAttribute('src', lesson.materials[1].audio!.src);
    await page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.muted = true);
    await page.locator('.audio-play').click();
    await expect.poll(() => page.locator('audio').evaluate((audio: HTMLAudioElement) => !audio.paused && audio.currentTime > .1)).toBe(true);
    await page.evaluate(() => (window as unknown as { releaseExposure: () => void }).releaseExposure());
    const current = await page.evaluate(async id => {
      const { db, sessions } = await import('/src/data/db.ts' as string);
      return db.transaction('rw', sessions, () => sessions.get(id));
    }, id);
    expect(current.assistance.audioCompleted ?? false).toBe(false);
    expect(await page.locator('audio').evaluate((audio: HTMLAudioElement) => !audio.paused && !audio.ended)).toBe(true);
    await expect(page.locator('.material-workspace [role=alert]')).toHaveCount(0);
  });


  test('a persisted single draft retains Today progress, survives navigation and commits its original answer', async ({ page }) => {
    const lesson = JSON.parse(readFileSync(new URL('../fixtures/content/a1-reading.json', import.meta.url), 'utf8')) as Lesson;
    await page.goto('/today'); await expect(page.getByRole('heading', { name: '练习', exact: true })).toBeVisible();
    const id = await page.evaluate(async lesson => {
      const data = await import('/src/data/db.ts' as string), session = await data.createSession(lesson), owner = 'isolated-single-draft';
      const first = lesson.materials[0].questions[0]; if (!('options' in first)) throw new Error('NO_CHOICE');
      await data.claimSession(session.id, owner); await data.saveDraft(session.id, owner, first.answer); await data.releaseSession(session.id, owner); return session.id;
    }, lesson);
    await page.reload();
    await expect(page.locator('.practice-card[data-skill=reading] [role=progressbar]')).toHaveAttribute('aria-valuenow', '1');
    await page.goto(`/learn/${id}`); await expect(page.locator('.material-workspace')).toBeVisible();
    if (mobile) await page.locator('.question-sheet-toggle').click();
    const all = lesson.materials.flatMap(material => material.questions), first = all[0];
    if (!('options' in first)) throw new Error('NO_CHOICE');
    await expect(page.locator('.workspace-question').first().getByRole('radio').nth(first.answer)).toBeChecked();
    await page.locator('.workspace-card button').last().click();
    await expect.poll(() => page.evaluate(async id => (await (await import('/src/data/db.ts' as string)).sessions.get(id)).draft, id)).toBeUndefined();
    for (const [index, question] of all.entries()) {
      if (!index) continue;
      if (!('options' in question)) throw new Error('NO_CHOICE');
      await page.locator('.workspace-card button').nth(index).click();
      await page.locator('.workspace-question[data-selected=true]').getByRole('radio').nth(question.answer).check();
    }
    await page.locator('form button[type=submit]').click();
    await expect(page.locator('#workspace-result')).toBeVisible();
    await expect(page.locator('.workspace-review .slot-result')).toHaveText(all.map(() => /✓/));
    await page.reload(); await expect(page.locator('.workspace-review')).toHaveCount(all.length);
  });

});
