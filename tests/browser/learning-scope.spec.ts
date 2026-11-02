import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { languagePacks } from '../../src/locales';
import { openSnapshot, focusQuestion } from './workspace';

for (const width of [1440, 375]) test(`switching profiles retires the open learning view without losing its saved draft: ${width}`, async ({ page, context }) => {
  await page.setViewportSize({ width, height: 900 });
  if (width === 1440) await page.route(/\/src\/data\/db\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}\nconst originalClaim = claimSession; claimSession = async (...args) => { if (window.holdLearningHeartbeat && args.length < 5) { window.holdLearningHeartbeat = false; await new Promise(resolve => window.releaseLearningHeartbeat = resolve); } return originalClaim(...args); };` });
  });
  const { id, lesson } = await openSnapshot(page, 'a1-reading', true);
  await focusQuestion(page, lesson, 0);
  await page.getByRole('radio', { name: 'At the library.' }).check();
  const questionId = lesson.materials[0].questions[0].id;
  await expect.poll(() => page.evaluate(async ({ id, questionId }) => (await (await import('/src/data/db.ts' as string)).sessions.get(id)).workspace.drafts[questionId], { id, questionId })).toBe(1);
  if (width === 1440) {
    await page.evaluate(() => Reflect.set(window, 'holdLearningHeartbeat', true));
    await expect.poll(() => page.evaluate(() => typeof Reflect.get(window, 'releaseLearningHeartbeat')), { timeout: 10_000 }).toBe('function');
  }
  const other = await context.newPage();
  await other.goto('/settings');
  await expect(other.locator('.settings-page')).toBeVisible();
  await other.evaluate(async () => {
    const { db, profiles, settings } = await import('/src/data/db.ts' as string);
    await db.transaction('rw', profiles, settings, async () => {
      await profiles.add({ id: 'isolated-learning-scope', name: 'Scope regression', createdAt: new Date().toISOString(), preferences: { interests: [], step: 3, completed: true } });
      await settings.put({ key: 'profile:isolated-learning-scope:locale', value: 'en' });
      await settings.put({ key: 'activeProfile', value: 'isolated-learning-scope' });
    });
  });
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('.material-workspace')).toHaveCount(0);
  await expect(page.getByRole('alert')).toContainText(languagePacks.en.app.missing);
  if (width === 1440) await page.evaluate(() => Reflect.get(window, 'releaseLearningHeartbeat')());
  await expect.poll(() => page.evaluate(async id => (await (await import('/src/data/db.ts' as string)).sessions.get(id)).owner, id)).toBeUndefined();
  const saved = await page.evaluate(async ({ id, questionId }) => {
    const { sessions, attempts } = await import('/src/data/db.ts' as string);
    const session = await sessions.get(id);
    return { profileId: session.profileId, answer: session.workspace.drafts[questionId], newProfileAttempts: await attempts.where('profileId').equals('isolated-learning-scope').count() };
  }, { id, questionId });
  expect(saved).toEqual({ profileId: 'local-guest', answer: 1, newProfileAttempts: 0 });
  await other.evaluate(async () => { const { settings } = await import('/src/data/db.ts' as string); await settings.put({ key: 'activeProfile', value: 'local-guest' }); });
  await expect(page.locator('.material-workspace')).toBeVisible();
  await focusQuestion(page, lesson, 0);
  await expect(page.getByRole('radio', { name: 'At the library.' })).toBeChecked();
  await other.close();
});

test('a rejected learning claim releases its Web Lock before retry', async ({ page }) => {
  await page.goto('/today');
  await expect(page.locator('#practice-section-title')).toBeVisible();
  const lesson = JSON.parse(readFileSync('tests/fixtures/content/a1-reading.json', 'utf8'));
  const id = await page.evaluate(async lesson => {
    const { createSession, claimSession } = await import('/src/data/db.ts' as string);
    const session = await createSession(lesson);
    await claimSession(session.id, 'synthetic-held-owner');
    return session.id;
  }, lesson);
  await page.goto(`/learn/${id}`);
  await expect(page.getByRole('alert')).toContainText(languagePacks['zh-Hans'].app.busy);
  await expect.poll(() => page.evaluate(async id => (await navigator.locks.query()).held?.some(lock => lock.name === `lingfern-session:${id}`), id)).toBe(false);
  await page.evaluate(async id => { const { releaseSession } = await import('/src/data/db.ts' as string); await releaseSession(id, 'synthetic-held-owner'); }, id);
  await page.getByRole('button', { name: languagePacks['zh-Hans'].app.retry, exact: true }).click();
  await expect(page.locator('.material-workspace')).toBeVisible();
});

test('switching profiles preserves drafts queued behind an unfinished save', async ({ page, context }) => {
  await page.route(/\/src\/data\/db\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}\nconst originalDraftSave = saveWorkspaceDraft; let draftCalls = 0; saveWorkspaceDraft = async (...args) => { const call = ++draftCalls; try { const saved = await originalDraftSave(...args); if (call === 1) await new Promise(resolve => window.releaseFirstDraftSave = resolve); return saved; } finally { window.finishedDraftSaves = (window.finishedDraftSaves || 0) + 1; } };` });
  });
  const { id, lesson } = await openSnapshot(page, 'a1-reading', true);
  await focusQuestion(page, lesson, 0);
  await page.getByRole('radio', { name: 'At the library.' }).check();
  await expect.poll(() => page.evaluate(() => typeof Reflect.get(window, 'releaseFirstDraftSave'))).toBe('function');
  await page.getByRole('radio', { name: 'At the café.' }).check();
  await expect(page.getByRole('radio', { name: 'At the café.' })).toBeChecked();
  const other = await context.newPage();
  await other.goto('/settings');
  await expect(other.locator('.settings-page')).toBeVisible();
  await other.evaluate(async () => {
    const { db, profiles, settings } = await import('/src/data/db.ts' as string);
    await db.transaction('rw', profiles, settings, async () => {
      await profiles.add({ id: 'queued-draft-scope', name: 'Queued draft regression', createdAt: new Date().toISOString(), preferences: { interests: [], step: 3, completed: true } });
      await settings.put({ key: 'profile:queued-draft-scope:locale', value: 'en' });
      await settings.put({ key: 'activeProfile', value: 'queued-draft-scope' });
    });
  });
  await expect(page.locator('.material-workspace')).toHaveCount(0);
  await expect(page.getByRole('alert')).toContainText(languagePacks.en.app.missing);
  const questionId = lesson.materials[0].questions[0].id;
  const beforeFlush = await page.evaluate(async ({ id, questionId }) => {
    const session = await (await import('/src/data/db.ts' as string)).sessions.get(id);
    return { owner: session.owner, draft: session.workspace.drafts[questionId] };
  }, { id, questionId });
  await test.info().attach('pending-draft-state', { body: JSON.stringify(beforeFlush), contentType: 'application/json' });
  await page.evaluate(() => Reflect.get(window, 'releaseFirstDraftSave')());
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'finishedDraftSaves'))).toBe(2);
  await expect.poll(() => page.evaluate(async ({ id, questionId }) => (await (await import('/src/data/db.ts' as string)).sessions.get(id)).workspace.drafts[questionId], { id, questionId })).toBe(0);
  await expect.poll(() => page.evaluate(async id => (await (await import('/src/data/db.ts' as string)).sessions.get(id)).owner, id)).toBeUndefined();
  await other.close();
});

for (const width of [1440, 375]) test(`leaving through the task back button preserves queued drafts: ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.route(/\/src\/data\/db\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}\nconst originalDraftSave = saveWorkspaceDraft; let draftCalls = 0; saveWorkspaceDraft = async (...args) => { const call = ++draftCalls; try { const saved = await originalDraftSave(...args); if (call === 1) await new Promise(resolve => window.releaseFirstDraftSave = resolve); return saved; } finally { window.finishedDraftSaves = (window.finishedDraftSaves || 0) + 1; } };` });
  });
  const { id, lesson } = await openSnapshot(page, 'a1-reading', true);
  await focusQuestion(page, lesson, 0);
  await page.getByRole('radio', { name: 'At the library.' }).check();
  await expect.poll(() => page.evaluate(() => typeof Reflect.get(window, 'releaseFirstDraftSave'))).toBe('function');
  await page.getByRole('radio', { name: 'At the café.' }).check();
  page.on('dialog', dialog => dialog.accept());
  await page.locator('.session-header .back-button').click();
  await expect(page.locator('.material-workspace')).toHaveCount(0);
  await page.locator('.session-header .back-button').click();
  await expect(page).toHaveURL(`/learn/${id}`);
  await page.evaluate(() => Reflect.get(window, 'releaseFirstDraftSave')());
  await expect(page).toHaveURL('/today');
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'finishedDraftSaves'))).toBe(2);
  const questionId = lesson.materials[0].questions[0].id;
  await expect.poll(() => page.evaluate(async ({ id, questionId }) => (await (await import('/src/data/db.ts' as string)).sessions.get(id)).workspace.drafts[questionId], { id, questionId })).toBe(0);
  await expect.poll(() => page.evaluate(async id => (await (await import('/src/data/db.ts' as string)).sessions.get(id)).owner, id)).toBeUndefined();
  await expect.poll(() => page.evaluate(async id => (await navigator.locks.query()).held?.some(lock => lock.name === `lingfern-session:${id}`), id)).toBe(false);
  await page.goto(`/learn/${id}`);
  await focusQuestion(page, lesson, 0);
  await expect(page.getByRole('radio', { name: 'At the café.' })).toBeChecked();
  expect(await page.pageErrors()).toEqual([]);
});

test('a transient heartbeat failure preserves the open reading note through retry', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route(/\/src\/data\/db\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}\nconst originalClaim = claimSession; claimSession = async (...args) => { if (window.failLearningHeartbeat && args.length < 5 || window.failLearningRetry && args.length === 5) { window.failLearningHeartbeat = false; window.failLearningRetry = false; throw new Error('SYNTHETIC_STORAGE_FAILURE'); } return originalClaim(...args); };` });
  });
  const { id } = await openSnapshot(page, 'a1-reading', true);
  await page.locator('.reading-notes summary').click();
  const note = page.locator('.reading-notes textarea');
  await note.fill('Preserve this unsaved note through heartbeat retry.');
  await page.evaluate(() => Reflect.set(window, 'failLearningHeartbeat', true));
  await expect(page.getByRole('alert')).toBeVisible({ timeout: 10_000 });
  await expect(note).toHaveValue('Preserve this unsaved note through heartbeat retry.');
  await page.evaluate(() => Reflect.set(window, 'failLearningRetry', true));
  await page.getByRole('alert').getByRole('button', { name: languagePacks['zh-Hans'].app.retry, exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(languagePacks['zh-Hans'].app.saveError);
  await expect(note).toHaveValue('Preserve this unsaved note through heartbeat retry.');
  expect(await page.evaluate(async id => (await navigator.locks.query()).held?.some(lock => lock.name === `lingfern-session:${id}`), id)).toBe(true);
  await page.getByRole('alert').getByRole('button', { name: languagePacks['zh-Hans'].app.retry, exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(note).toHaveValue('Preserve this unsaved note through heartbeat retry.');
  await page.locator('.reading-notes button', { hasText: '保存笔记' }).click();
  await expect.poll(() => page.evaluate(async id => (await (await import('/src/data/db.ts' as string)).sessions.get(id)).readingAnnotations?.[0]?.note, id)).toBe('Preserve this unsaved note through heartbeat retry.');
});
test('a failed strict-check start shows its retry action without revealing the material', async ({ page }) => {
  await page.route(/\/src\/data\/db\.ts(?:\?.*)?$/, async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}\nconst originalBeginCheck = beginCheck; beginCheck = async (...args) => { if (window.failCheckStart) { window.failCheckStart = false; throw new Error('SYNTHETIC_STORAGE_FAILURE'); } return originalBeginCheck(...args); };` });
  });
  const lesson = JSON.parse(readFileSync('tests/fixtures/content/a1-check-reading.json', 'utf8'));
  await page.goto('/today');
  await expect(page.locator('#practice-section-title')).toBeVisible();
  const id = await page.evaluate(async lesson => (await (await import('/src/data/db.ts' as string)).createSession(lesson)).id, lesson);
  await page.goto(`/learn/${id}`);
  await expect(page.locator('.check-intro')).toBeVisible();
  await page.evaluate(() => Reflect.set(window, 'failCheckStart', true));
  await page.getByRole('button', { name: languagePacks['zh-Hans'].app.checkBegin, exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(languagePacks['zh-Hans'].app.saveError);
  await expect(page.locator('.material-workspace,.passage')).toHaveCount(0);
  expect(await page.evaluate(async id => (await (await import('/src/data/db.ts' as string)).sessions.get(id)).checkStartedAt, id)).toBeUndefined();
  await page.getByRole('button', { name: languagePacks['zh-Hans'].app.retry, exact: true }).click();
  await expect(page.locator('.check-intro')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: languagePacks['zh-Hans'].app.checkBegin, exact: true }).click();
  await expect(page.locator('.material-workspace')).toBeVisible();
  await expect(page.locator('.workspace-hints,.teaching,.workspace-review')).toHaveCount(0);
});
