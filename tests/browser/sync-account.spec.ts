import { openSnapshot, completeWorkspace } from './workspace';
import { expect, test } from '@playwright/test';
import { selectPicker } from './picker';

test('account changes require a choice, preserve local originals, and do not upload implicitly', async ({ page }) => {
  // Simulate session UI without claiming real sign-in or upload.
  let accountId = 1, syncWrites = 0;
  await page.route('**/api/session', route => route.fulfill({ json: { account: { id: accountId, login: `learner-${accountId}` }, csrfToken: 'c'.repeat(43), syncAvailable: false, bindings: accountId === 2 ? [{ name: 'lingfern-first', owner: 'learner-2', profileId: 'remote-first', disabled: false }, { name: 'lingfern-target', owner: 'learner-2', profileId: 'remote-target', disabled: false }] : [] } }));
  page.on('request', request => { if (request.method() === 'POST' && new URL(request.url()).pathname.startsWith('/api/sync/')) syncWrites++; });
  const { lesson } = await openSnapshot(page, 'a1-reading', true);
  await completeWorkspace(page, lesson);
  await page.getByRole('link', { name: '离开任务' }).click();
  await page.goto('/settings');
  await page.getByRole('button', { name: '保留当前本机档案' }).click();
  await expect(page.locator('.sync-account-choice')).toContainText('不关联此账号');
  await expect(page.locator('.repository-binding')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^当前档案:/ })).toHaveAttribute('data-value', 'local-guest');
  const originalLabel = await page.getByRole('button', { name: /^当前档案:/ }).getAttribute('aria-label');
  await page.getByRole('button', { name: '复制当前档案用于此账号' }).click();
  await expect(page.locator('.repository-binding')).toBeVisible();
  await expect(page.getByRole('button', { name: /^当前档案:/ })).not.toHaveAttribute('data-value', 'local-guest');
  const copied = await page.getByRole('button', { name: /^当前档案:/ }).getAttribute('data-value');
  expect(copied).not.toBe('local-guest');
  await expect(page.getByRole('button', { name: /^当前档案:/ })).toHaveAttribute('aria-label', originalLabel!);
  accountId = 2;
  await page.reload();
  await expect(page.locator('.sync-account-choice')).toBeVisible();
  await expect(page.locator('.repository-binding')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^当前档案:/ })).toHaveAttribute('data-value', copied!);
  await selectPicker(page, '账号档案', 'remote:remote-target');
  await page.getByRole('button', { name: '切换到账号档案' }).click();
  await expect(page.locator('.repository-binding')).toBeVisible();
  await expect(page.getByRole('button', { name: /^当前档案:/ })).not.toHaveAttribute('data-value', copied!);
  const second = await page.getByRole('button', { name: /^当前档案:/ }).getAttribute('data-value');
  expect(second).not.toBe(copied);
  await expect(page.getByRole('button', { name: /^当前档案:/ })).toContainText('learner-2 · 本机档案');
  expect(await page.evaluate(async () => {
    const path = '/src/data/db.ts'; const data = await import(path);
    const selected = (await data.settings.get('activeProfile')).value;
    return { count: await data.attempts.where('profileId').equals(selected).count(), logicalProfileId: (await data.syncClocks.get(selected)).logicalProfileId };
  })).toEqual({ count: 0, logicalProfileId: 'remote-target' });
  accountId = 1;
  await page.reload();
  await page.getByRole('button', { name: '切换到账号档案' }).click();
  await expect(page.locator('.repository-binding')).toBeVisible();
  await expect(page.getByRole('button', { name: /^当前档案:/ })).toHaveAttribute('data-value', copied!);
  expect(await page.evaluate(async () => {
    const path = '/src/data/db.ts'; const data = await import(path);
    return { originals: await data.attempts.where('profileId').equals('local-guest').count(), profiles: await data.profiles.count() };
  })).toEqual({ originals: 2, profiles: 3 });
  expect(syncWrites).toBe(0);
});

test('all account choices remain readable in three languages on narrow screens', async ({ page }) => {
  await page.route('**/api/session', route => route.fulfill({ json: { account: { id: 2, login: 'learner' }, csrfToken: 'c'.repeat(43), syncAvailable: false, bindings: [{ name: 'lingfern-first', owner: 'learner', profileId: 'remote-first', disabled: false }, { name: 'lingfern-second', owner: 'learner', profileId: 'remote-second', disabled: false }] } }));
  await page.goto('/settings');
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  for (const [label, value, title] of [['语言', 'en', 'Profile choice'], ['Language', 'zh-Hant', '檔案選擇'], ['語言', 'zh-Hans', '档案选择']]) {
    await selectPicker(page, label, value);
    for (const width of [375, 320]) {
      await page.setViewportSize({ width, height: 812 });
      const choice = page.locator('.sync-account-choice');
      await expect(choice.getByRole('heading')).toHaveText(title);
      await expect(choice.locator('.backup-actions button')).toHaveCount(3);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await choice.locator('.backup-actions button').evaluateAll(buttons => buttons.every(button => button.getBoundingClientRect().height >= 44))).toBe(true);
      if ((value === 'en' && width === 375) || (value === 'zh-Hans' && width === 320)) {
        await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        await choice.screenshot({ path: `output/playwright/sync-account-${width}-${value}-dark.png`, animations: 'disabled' });
      }
    }
  }
});

test('a new account profile is immediately named and keyboard-selectable in the backup picker', async ({ page }) => {
  await page.route('**/api/session', route => route.fulfill({ json: { account: { id: 1, login: 'learner' }, csrfToken: 'c'.repeat(43), syncAvailable: false, bindings: [] } }));
  await page.goto('/settings');
  await page.getByRole('button', { name: '切换到账号档案', exact: true }).click();
  for (const [languageLabel, locale, profileLabel, localName] of [['语言', 'en', 'Current profile', 'Local profile'], ['Language', 'zh-Hant', '目前檔案', '本機檔案'], ['語言', 'zh-Hans', '当前档案', '本机档案']]) {
    await selectPicker(page, languageLabel, locale);
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.setViewportSize({ width: colorScheme === 'light' ? 1440 : 375, height: 900 });
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      const picker = page.getByRole('button', { name: new RegExp(`^${profileLabel}:`) });
      await expect(picker).toContainText(`learner · ${localName}`);
      await picker.focus(); await picker.press('Enter');
      const selected = page.getByRole('option', { selected: true });
      await expect(selected).toContainText(`learner · ${localName}`);
      await expect(page.getByRole('option')).toHaveCount(2);
      expect(await selected.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `output/playwright/account-profile-${locale}-${colorScheme}.png`, fullPage: true });
      await page.keyboard.press('Escape'); await expect(picker).toBeFocused();
    }
  }
});

for (const change of ['disconnect', 'account'] as const) test(`a delayed account copy is cancelled after ${change} without changing the local profile`, async ({ page }) => {
  let account: { id: number; login: string } | null = { id: 1, login: 'synthetic-first' }, syncWrites = 0;
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.method() === 'POST' && new URL(request.url()).pathname.startsWith('/api/sync/')) syncWrites++; });
  await page.route('**/api/session', route => route.fulfill({ json: { account, syncAvailable: false, ...(account ? { csrfToken: 'c'.repeat(43), bindings: [] } : {}) } }));
  await page.route('**/api/auth/disconnect', route => { account = null; return route.fulfill({ json: { disconnected: true, providerRevoked: true } }); });
  await page.route(/\/src\/data\/backup\.ts(?:\?|$)/, async route => {
    const response = await route.fetch(), body = await response.text();
    const pattern = /async function exportBackup\([^)]*\)\s*\{/;
    expect(body).toMatch(pattern);
    await route.fulfill({ response, body: body.replace(pattern, '$&\nwindow.__copyExportStarted=true; await new Promise(resolve=>{window.__releaseCopyExport=resolve;});') });
  });
  await page.route(/\/src\/data\/syncAccount\.ts(?:\?|$)/, async route => {
    const response = await route.fetch(), body = await response.text();
    const pattern = /return importBackup\(([^;]+)\);/;
    expect(body).toMatch(pattern);
    await route.fulfill({ response, body: body.replace(pattern, 'try { return await importBackup($1); } finally { window.__copyOperationDone=true; }') });
  });
  const snapshot = () => page.evaluate(async () => {
    const d = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('lingfern'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const tx = d.transaction(['profiles', 'settings'], 'readonly');
    const read = <T,>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const [profiles, settings] = await Promise.all([read(tx.objectStore('profiles').getAll()), read(tx.objectStore('settings').getAll())]);
    d.close(); return { profiles, active: settings.find(row => row.key === 'activeProfile')?.value, associations: settings.filter(row => row.key.endsWith(':syncAccount')) };
  });
  await page.goto('/settings');
  await page.getByRole('button', { name: '复制当前档案用于此账号', exact: true }).click();
  await expect.poll(() => page.evaluate(() => Reflect.get(window, '__copyExportStarted'))).toBe(true);
  const original = await snapshot();
  if (change === 'disconnect') {
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: '断开 GitHub 身份', exact: true }).click();
    await expect(page.locator('.github-connect')).toBeVisible();
  } else {
    account = { id: 2, login: 'synthetic-second' };
    await page.evaluate(() => { const channel = new BroadcastChannel('lingfern-identity'); channel.postMessage('changed'); channel.close(); });
    await expect(page.locator('.github-status')).toContainText('synthetic-second');
  }
  expect(await snapshot()).toEqual(original);
  await page.evaluate(() => Reflect.get(window, '__releaseCopyExport')());
  await expect.poll(() => page.evaluate(() => Reflect.get(window, '__copyOperationDone'))).toBe(true);
  expect(await snapshot()).toEqual(original);
  expect(syncWrites).toBe(0); expect(errors).toEqual([]);
});
