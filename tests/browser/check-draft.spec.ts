import { showLearningPane } from './learning-pane';
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { StoredBatch } from '../../src/data/sync';
import { selectPicker } from './picker';

const draft = JSON.parse(readFileSync(new URL('../fixtures/content/a1-check-reading.json', import.meta.url), 'utf8'));

test('unfinished checks conceal answers across pages and reveal them only after completion', async ({ page }) => {
  await page.goto('/settings');
  await selectPicker(page, '语言', 'en');
  await page.goto('/today');
  const id = await page.evaluate(async lesson => {
    const { createSession, claimSession, revealHint, recordDictionaryUse, releaseSession } = await import('/src/data/db.ts' as string);
    const session = await createSession(lesson);
    await claimSession(session.id, 'restriction-test');
    for (const action of [() => revealHint(session.id, 'restriction-test'), () => recordDictionaryUse(session.id, 'restriction-test', 'tuesday-room')]) {
      try { await action(); throw new Error('Check restriction was bypassed'); }
      catch (error) { if (!(error instanceof Error) || error.message !== 'CHECK_RESTRICTED') throw error; }
    }
    await releaseSession(session.id, 'restriction-test');
    return session.id;
  }, draft);
  await page.reload();
  await expect(page.locator('[aria-label=Mode]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Start independent check', exact: true })).toHaveCount(0);
  await expect(page.getByText('Art club notice · check draft')).toHaveCount(0);
  await expect(page.getByText('Zoo bus notice · check draft')).toHaveCount(0);
  await page.goto(`/learn/${id}`);
  await expect(page.getByRole('heading', { name: 'Art club notice · check draft' })).toBeVisible();
  await expect(page.locator('header')).toContainText('Test');
  await expect(page.getByText('On Tuesday, art club meets')).toHaveCount(0);
  expect(await page.evaluate(async () => (await import('/src/data/db.ts' as string)).exposures.count())).toBe(0);
  await page.setViewportSize({ width: 320, height: 640 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('button', { name: 'Begin check' })).toHaveCSS('min-height', '48px');
  await page.getByRole('button', { name: 'Begin check' }).click();
  await expect(page.getByText('On Tuesday, art club meets', { exact: false })).toBeVisible();
  const passage = page.locator('.passage').first();
  await passage.scrollIntoViewIfNeeded();
  const point = await passage.evaluate(element => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let text: Node | null;
    while ((text = walker.nextNode()) && !text.textContent?.includes('Tuesday')) {}
    if (!text) throw new Error('Passage word not found');
    const offset = text.textContent!.indexOf('Tuesday');
    const range = document.createRange();
    range.setStart(text, offset); range.setEnd(text, offset + 7);
    getSelection()!.removeAllRanges(); getSelection()!.addRange(range);
    const rect = range.getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  });
  await page.mouse.click(point.x, point.y, { button: 'right' });
  await expect(page.getByRole('button', { name: 'Look up', exact: true })).toHaveCount(0);
  expect(await page.evaluate(async () => (await import('/src/data/db.ts' as string)).exposures.count())).toBe(1);
  await expect(page.getByRole('button', { name: /hint/i })).toHaveCount(0);
  await expect(page.locator('.dictionary-panel')).toHaveCount(0);
  await showLearningPane(page, 'question');
  for (const [index, question] of draft.materials[0].questions.entries()) {
    const row = page.locator(`#prompt-${question.id}`).locator('..');
    await row.getByRole('radio').first().check();
    await expect(page.locator('.workspace-save-status')).toHaveText('Saved on this device');
    await expect(page.locator('.workspace-review')).toHaveCount(0);
    expect(await page.evaluate(async () => (await import('/src/data/db.ts' as string)).attempts.count())).toBe(0);
    if (index === 0) {
      await page.goto('/progress');
      await page.locator('.history details').first().evaluate(element => (element as HTMLDetailsElement).open = true);
      await expect(page.getByText('Correct answer')).toHaveCount(0);
      await page.goto(`/learn/${id}`); await showLearningPane(page, 'question');
      await expect(page.locator(`#prompt-${question.id}`).locator('..').getByRole('radio').first()).toBeChecked();
    }
  }
  await page.getByRole('button', { name: 'Submit practice', exact: true }).click();
  await expect(page.locator('#workspace-result')).toBeVisible();
  await expect(page.locator('.workspace-review')).toHaveCount(4);
  await page.reload();
  await expect(page.locator('.workspace-review')).toHaveCount(4);
});

test('ending a check preserves draft answers without recording a completed result', async ({ page }) => {
  await page.goto('/settings');
  await selectPicker(page, '语言', 'en');
  const id = await page.evaluate(async lesson => (await import('/src/data/db.ts' as string)).createSession(lesson).then((session: { id: string }) => session.id), draft);
  await page.goto(`/learn/${id}`);
  await page.getByRole('button', { name: 'Begin check' }).click();
  await showLearningPane(page, 'question');
  await page.locator('input[type=radio]').first().check();
  await expect(page.locator('.workspace-save-status')).toHaveText('Saved on this device');
  await page.getByRole('button', { name: 'End check', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/learn/${id}$`));
  const state = await page.evaluate(async checkId => {
    const { sessions, attempts } = await import('/src/data/db.ts' as string);
    const { exportBackup, inspectBackup } = await import('/src/data/backup.ts' as string);
    const saved = await sessions.get(checkId);
    const backup = await inspectBackup(await exportBackup('local-guest'));
    return { status: saved.status, ended: !!saved.checkEndedAt, responses: await attempts.where('sessionId').equals(checkId).count(), drafts: Object.keys(saved.workspace.drafts).length, backupStatus: backup.records.sessions.find((session: { id: string }) => session.id === checkId)?.status };
  }, id);
  expect(state).toEqual({ status: 'ended', ended: true, responses: 0, drafts: 1, backupStatus: 'ended' });
  await page.goto(`/learn/${id}`);
  await expect(page.getByRole('heading', { name: 'Check ended' })).toBeVisible();
  await expect(page.locator('.workspace-review')).toHaveCount(0);
  await showLearningPane(page, 'question');
  await expect(page.locator('input[type=radio]').first()).toBeChecked();
  await expect(page.locator('input[type=radio]').first()).toBeDisabled();
  const restored = await page.evaluate(async () => {
    const { sessions } = await import('/src/data/db.ts' as string);
    const { exportBackup, inspectBackup, importBackup } = await import('/src/data/backup.ts' as string);
    const profileId = await importBackup(await inspectBackup(await exportBackup('local-guest')));
    return (await sessions.where('profileId').equals(profileId).toArray()).find((session: { lesson: { mode?: string } }) => session.lesson.mode === 'check')?.status;
  });
  expect(restored).toBe('ended');
});

test('a started unfinished check shares only contact references and prevents another device from revealing its source', async ({ page, browser }) => {
  await page.goto('/settings'); await selectPicker(page, '语言', 'en');
  const id = await page.evaluate(async lesson => { const session = await (await import('/src/data/db.ts' as string)).createSession(lesson); return session.id; }, draft);
  await page.goto(`/learn/${id}`); await page.getByRole('button', { name: 'Begin check', exact: true }).click();
  await showLearningPane(page, 'question'); await page.getByRole('radio', { name: 'Room 8', exact: true }).check(); await expect(page.locator('.workspace-save-status')).toHaveText('Saved on this device');
  const sent: StoredBatch | undefined = await page.evaluate(async () => (await import('/src/data/sync.ts' as string)).pendingSyncBatch('local-guest'));
  expect(sent).toBeTruthy(); expect(sent!.batch.events.filter(event => event.type === 'exposure')).toHaveLength(1); expect(sent!.batch.events.filter(event => event.type === 'completion')).toHaveLength(0);
  expect(JSON.stringify(sent!.batch)).not.toMatch(/"(?:answer|draft|blocks|correct|assistance)"/);
  const context = await browser.newContext({ locale: 'zh-CN', viewport: { width: 375, height: 812 } });
  try {
    const second = await context.newPage(); await second.goto('http://127.0.0.1:5173/settings'); await selectPicker(second, '语言', 'en');
    const candidate = await second.evaluate(async lesson => { const session = await (await import('/src/data/db.ts' as string)).createSession(lesson); return session.id; }, draft);
    await second.goto(`http://127.0.0.1:5173/learn/${candidate}`); await expect(second.locator('.check-intro')).toBeVisible(); expect(await second.locator('.passage').count()).toBe(0);
    const received = await second.evaluate(async incoming => (await import('/src/data/sync.ts' as string)).receiveSyncBatch('local-guest', incoming!.batch, incoming!.hash), sent);
    expect(received).toBe('received'); await second.getByRole('button', { name: 'Begin check', exact: true }).click(); await expect(second.getByRole('alert')).toContainText('No unused test materials are available yet.'); expect(await second.locator('.passage').count()).toBe(0); await expect(second.getByRole('button', { name: 'Begin check', exact: true })).toHaveCount(0);
    expect(await second.evaluate(async candidate => (await (await import('/src/data/db.ts' as string)).sessions.get(candidate))?.checkStartedAt, candidate)).toBeUndefined();
    await second.getByRole('alert').scrollIntoViewIfNeeded(); await second.screenshot({ path: 'output/playwright/check-contact-second-device-375-light-en-fixture.png', fullPage: true });
    await page.reload(); await showLearningPane(page, 'question'); await expect(page.getByRole('radio', { name: 'Room 8', exact: true })).toBeChecked(); expect(await page.evaluate(async () => (await import('/src/data/db.ts' as string)).attempts.count())).toBe(0);
  } finally { await context.close(); }
});
