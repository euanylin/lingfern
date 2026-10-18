import { expect, test } from '@playwright/test';
import { languagePacks } from '../../src/locales';
import { confirmTask } from './task-start';
import { selectPicker } from './picker';

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
  // Await the same module evaluation, then read after any previously queued settings transaction.
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
  await page.goto('/today');
  await page.locator('.primary-task.reading-task').getByRole('button', { name: '开始', exact: true }).click();
  await confirmTask(page);
  for (const answer of ['At the library.', 'A student card.', 'At the café.', 'A pencil.']) {
    await page.getByRole('radio', { name: answer }).check();
    await page.getByRole('button', { name: '保存答案', exact: true }).click();
    if (answer !== 'A pencil.') await page.getByRole('button', { name: '下一题' }).click();
  }
  // A received language change holds the next view refresh while its uncached package loads.
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
