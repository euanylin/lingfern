import { openSnapshot, completeWorkspace } from './workspace';
import { expect, test } from '@playwright/test';
import { languagePacks } from '../../src/locales';
import { confirmTask } from './task-start';
import { selectPicker } from './picker';

test('Today loads learning, reference, history and account views only when opened', async ({ page }) => {
  const modules = new Set<string>();
  page.on('request', request => modules.add(new URL(request.url()).pathname));
  await page.goto('/today');
  await expect(page.locator('.practice-card').first()).toBeVisible();
  for (const name of ['Learning', 'Dictionary', 'GrammarLookup', 'SavedWords', 'ProfileBackup', 'GithubIdentity', 'ProgressRecords', 'CompletionTiming', 'SessionHistory', 'SyncConflicts', 'OfflineInstall', 'CommunityImport', 'LookupHistory', 'UnsavedDemo']) {
    expect(modules.has(`/src/app/${name}.tsx`), name).toBe(false);
  }
  await page.getByRole('link', { name: '资料库', exact: true }).first().click();
  await expect(page.locator('.offline-install')).toBeVisible();
  expect(modules.has('/src/app/OfflineInstall.tsx')).toBe(true);
  await page.locator('a[href="/library/dictionary"]').first().click();
  await expect(page.locator('.dictionary input').first()).toBeVisible();
  expect(modules.has('/src/app/Dictionary.tsx')).toBe(true);
  expect(modules.has('/src/app/Learning.tsx')).toBe(false);
});

test('a failed learning download offers retry without losing the saved session', async ({ page }) => {
  await page.route('**/src/app/Learning.tsx*', route => route.abort('failed'));
  await page.goto('/today');
  await page.locator('.primary-task.reading-task').getByRole('button', { name: '开始', exact: true }).click();
  await confirmTask(page);
  await expect(page.getByRole('alert')).toContainText(languagePacks['zh-Hans'].app.readError);
  const path = new URL(page.url()).pathname;
  expect(path).toMatch(/^\/learn\//);
  await page.unroute('**/src/app/Learning.tsx*');
  await page.getByRole('alert').getByRole('button', { name: '重试', exact: true }).click();
  await expect(page.getByRole('radio').first()).toBeVisible();
  expect(new URL(page.url()).pathname).toBe(path);
  const records = await page.evaluate("import('/src/data/db.ts').then(async module => ({ sessions: await module.sessions.count(), answers: await module.attempts.count() }))");
  expect(records).toEqual({ sessions: 1, answers: 0 });
});

test('a failed optional account module leaves local settings and backup usable', async ({ page }) => {
  await page.route('**/src/app/GithubIdentity.tsx', route => route.abort('failed'));
  await page.goto('/settings');
  await expect(page.getByRole('alert')).toContainText(languagePacks['zh-Hans'].app.readError);
  await expect(page.getByRole('button', { name: '下载备份', exact: true })).toBeVisible();
  await expect(page.locator('.settings-language .setting-trigger')).toBeEnabled();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载备份', exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/^lingfern-backup-.*\.zip$/);
});

test('reference pages do not load the daily quotation index until Today is opened', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => { if (request.url().includes('/content/daily-quote-index.json')) requests.push(request.url()); });
  for (const path of ['/settings', '/library', '/library/dictionary', '/library/grammar', '/settings/about']) {
    await page.goto(path); await expect(page.locator('main h1').first()).toBeVisible();
  }
  expect(requests).toHaveLength(0);
  await page.goto('/today'); await expect(page.locator('.daily-quote[data-quote-id] blockquote')).toBeVisible();
  expect(requests).toHaveLength(1);
});

test('a quote chunk failure leaves Today usable and reload retries without resetting records', async ({ page }) => {
  await page.route(/\/content\/daily-quote-chunks\/\d+\.json/, route => route.abort('failed'));
  await page.goto('/today');
  await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
  await expect(page.locator('.daily-quote')).toContainText(languagePacks['zh-Hans'].dailyQuote.loadError);
  await expect(page.locator('.practice-card').first()).toBeVisible();
  await page.unroute(/\/content\/daily-quote-chunks\/\d+\.json/);
  await page.locator('.daily-quote').getByRole('button', { name: '重试', exact: true }).click();
  await expect(page.locator('.daily-quote[data-quote-id] blockquote')).toBeVisible();
  const id = await page.locator('.daily-quote').getAttribute('data-quote-id');
  await page.locator('.daily-quote-next').click();
  await expect(page.locator('.daily-quote')).not.toHaveAttribute('data-quote-id', id!);
});

test('a failed teaching package cannot persist an unusable locale; a fresh load can retry', async ({ page }) => {
  await page.goto('/settings');
  const trigger = page.locator('.settings-language .setting-trigger');
  const label = (await trigger.getAttribute('aria-label'))!;
  await page.route(/\/src\/locales\/ar\/teaching\.json/, route => route.abort('failed'));
  await trigger.click();
  await page.getByRole('listbox', { name: label }).locator('[data-value="ar"]').click();
  await expect(page.locator('.error')).toBeVisible();
  await expect(trigger).toHaveAttribute('data-value', 'zh-Hans');
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hans');
  await page.unroute(/\/src\/locales\/ar\/teaching\.json/);
  await page.reload();
  await expect(trigger).toHaveAttribute('data-value', 'zh-Hans');
  await selectPicker(page, label, 'ar');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
});

test('First Run releases its busy state after a teaching download failure', async ({ page }) => {
  await page.goto('/start');
  await page.route(/\/src\/locales\/ja\/teaching\.json/, route => route.abort('failed'));
  const trigger = page.locator('.first-run .setting-trigger');
  await trigger.click();
  await page.getByRole('listbox').locator('[data-value="ja"]').click();
  await expect(page.locator('.first-run .error')).toBeVisible();
  await expect(trigger).toBeEnabled();
  await expect(trigger).toHaveAttribute('data-value', 'zh-Hans');
  await expect(page.getByRole('button', { name: '保存并继续', exact: true })).toBeEnabled();
});


test('changing an asynchronously loaded quotation preserves keyboard focus and English LTR in Arabic', async ({ page }) => {
  await page.goto('/settings');
  await selectPicker(page, (await page.locator('.settings-language .setting-trigger').getAttribute('aria-label'))!, 'ar');
  await page.goto('/today');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('.daily-quote blockquote')).toHaveCSS('direction', 'ltr');
  await expect(page.locator('.daily-quote[data-quote-id] blockquote')).toBeVisible();
  const button = page.locator('.daily-quote-next');
  await button.focus();
  const previous = await page.locator('.daily-quote').getAttribute('data-quote-id');
  await page.keyboard.press('Enter');
  await expect(page.locator('.daily-quote')).not.toHaveAttribute('data-quote-id', previous!);
  await expect(button).toHaveAttribute('aria-busy', 'false');
  await expect(button).toBeFocused();
});


test('a slower earlier teaching request cannot overwrite the latest saved language', async ({ page }) => {
  let release!: () => void, started!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const requested = new Promise<void>(resolve => { started = resolve; });
  await page.route(/\/src\/locales\/ar\/teaching\.json/, async route => { started(); await held; await route.continue(); });
  await page.goto('/settings');
  const trigger = page.locator('.settings-language .setting-trigger');
  await trigger.click();
  await page.getByRole('listbox').locator('[data-value=ar]').click();
  await requested;
  await selectPicker(page, (await trigger.getAttribute('aria-label'))!, 'fr');
  const response = page.waitForResponse(/\/src\/locales\/ar\/teaching\.json/);
  release(); await (await response).finished();
  // Await module evaluation and queued settings writes before reading.
  await page.evaluate("import('/src/locales/teaching.ts').then(module => module.loadInstructionLocale('ar'))");
  const stored = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('lingfern'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    try { return await new Promise<string>((resolve, reject) => { const request = db.transaction('settings').objectStore('settings').get('profile:local-guest:locale'); request.onsuccess = () => resolve(request.result?.value); request.onerror = () => reject(request.error); }); }
    finally { db.close(); }
  });
  expect(stored).toBe('fr');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await page.reload();
  await expect(trigger).toHaveAttribute('data-value', 'fr');
});


test('First Run restores picker focus after a delayed teaching package finishes', async ({ page }) => {
  let release!: () => void, started!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const requested = new Promise<void>(resolve => { started = resolve; });
  await page.route(/\/src\/locales\/ar\/teaching\.json/, async route => { started(); await gate; await route.continue(); });
  await page.goto('/start');
  const trigger = page.locator('.first-run .setting-trigger');
  await trigger.click(); await page.getByRole('listbox').locator('[data-value=ar]').click();
  await requested; await expect(trigger).toBeDisabled(); release();
  await expect(trigger).toBeEnabled();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(trigger).toBeFocused();
});

test('returning from learning waits for refreshed history before enabling Today', async ({ page }) => {
  const { lesson } = await openSnapshot(page, 'a1-reading'); await completeWorkspace(page, lesson);
  await page.evaluate("import('/src/data/db.ts').then(module => module.saveSetting('local-guest', 'locale', 'ar'))");
  let release!: () => void, started!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const requested = new Promise<void>(resolve => { started = resolve; });
  await page.route(/\/src\/locales\/ar\/teaching\.json/, async route => { started(); await gate; await route.continue(); });
  await page.getByRole('link', { name: '返回今日' }).click();
  await requested;
  await expect(page.locator('.primary-task')).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText(languagePacks['zh-Hans'].app.loading);
  release();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await page.locator('.primary-task.reading-task').getByRole('button', { name: languagePacks.ar.practiceCard.start, exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Match the plans', exact: true })).toBeVisible();
  const count = await page.evaluate("import('/src/data/db.ts').then(module => module.attempts.count())");
  expect(count).toBe(4);
});
