import { expect, test } from '@playwright/test';
import { selectPicker } from './picker';
import { languagePacks } from '../../src/locales';

const account = { account: { id: 1234, login: 'synthetic-learner' }, csrfToken: 'c'.repeat(43), syncAvailable: false };

test.afterEach(async ({ page }) => { expect(await page.pageErrors()).toEqual([]); });

test('unchanged session revalidation preserves the chosen account profile', async ({ page }) => {
  let reads = 0;
  await page.route('**/api/session', route => { reads++; return route.fulfill({ json: { ...account, bindings: [
    { owner: 'synthetic-learner', name: 'first', profileId: 'remote-first', disabled: false },
    { owner: 'synthetic-learner', name: 'second', profileId: 'remote-second', disabled: false },
  ] } }); });
  await page.goto('/settings');
  await selectPicker(page, '账号档案', 'remote:remote-second');
  const response = page.waitForResponse('**/api/session');
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await response;
  // Allow the IndexedDB/effect work that previously replaced the selected target.
  await page.waitForTimeout(150);
  expect(reads).toBe(2);
  await expect(page.locator('.sync-account-choice .setting-trigger')).toHaveAttribute('data-value', 'remote:remote-second');
});

test('logout invalidates other open tabs and ignores an older in-flight session response', async ({ page, context }) => {
  let signedIn = true, hold = false, release!: () => void, delivered!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const completed = new Promise<void>(resolve => { delivered = resolve; });
  await context.route('**/api/session', async route => {
    const json = signedIn ? account : { account: null, syncAvailable: false };
    if (hold && route.request().frame().page() !== page) {
      hold = false; await pending;
      try { await route.fulfill({ json }); } finally { delivered(); }
    } else await route.fulfill({ json });
  });
  await context.route('**/api/auth/logout', route => { signedIn = false; return route.fulfill({ status: 204 }); });
  await page.goto('/settings');
  const other = await context.newPage(); await other.goto('/settings');
  await expect(other.locator('.github-status-line')).toHaveAttribute('data-status', 'connected');
  hold = true;
  const started = other.waitForRequest('**/api/session');
  await other.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await started;
  await page.getByRole('button', { name: '退出本设备的网站会话', exact: true }).click();
  await expect(page.locator('.github-status-line')).toHaveAttribute('data-status', 'signed-out');
  await expect(other.locator('.github-status-line')).toHaveAttribute('data-status', 'signed-out');
  release(); await completed;
  await expect(other.locator('.github-status-line')).toHaveAttribute('data-status', 'signed-out');
  await expect(other.locator('.sharing-management')).toHaveCount(0);
  expect(await other.pageErrors()).toEqual([]);
});

test('a disconnect result does not remain attached to a newly signed-in account', async ({ page }) => {
  let current = account;
  await page.route('**/api/session', route => route.fulfill({ json: current }));
  await page.route('**/api/auth/disconnect', route => route.fulfill({ json: { disconnected: true, providerRevoked: false } }));
  await page.goto('/settings');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '断开 GitHub 身份', exact: true }).click();
  await expect(page.locator('.github-identity')).toContainText('无法确认 GitHub 撤销成功');
  current = { ...account, account: { id: 5678, login: 'new-synthetic-account' } };
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.locator('.github-identity')).toContainText('new-synthetic-account');
  await expect(page.locator('.github-identity')).not.toContainText('无法确认 GitHub 撤销成功');
});

test('failed account-association reads cannot create or copy profiles until a successful retry', async ({ page }) => {
  await page.route('**/api/session', route => route.fulfill({ json: account }));
  await page.goto('/today');
  await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const { settings } = await import('/src/data/db.ts' as string);
    let fail = true;
    window.addEventListener('resume-association-read', () => { fail = false; }, { once: true });
    const get = settings.get.bind(settings);
    settings.get = (key: string) => fail && key === 'profile:local-guest:syncAccount' ? Promise.reject(new Error('Isolated local read failure')) : get(key);
  });
  await page.locator('nav a[href="/settings"]:visible').first().click();
  const identity = page.locator('.github-identity');
  await expect(identity.getByRole('button', { name: '重试', exact: true })).toBeVisible();
  await expect(identity.getByRole('button', { name: '切换到账号档案', exact: true })).toHaveCount(0);
  await expect(identity.getByRole('button', { name: '复制当前档案用于此账号', exact: true })).toHaveCount(0);
  expect(await page.evaluate(async () => (await import('/src/data/db.ts' as string)).profiles.count())).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new Event('resume-association-read')));
  await identity.getByRole('button', { name: '重试', exact: true }).click();
  await expect(identity.getByRole('button', { name: '切换到账号档案', exact: true })).toBeVisible();
  expect(await page.evaluate(async () => (await import('/src/data/db.ts' as string)).profiles.count())).toBe(1);
});

test('changed repository generations discard an earlier verification intent', async ({ page }) => {
  let version = 'a'.repeat(43);
  await page.route('**/api/session', route => route.fulfill({ json: { ...account, bindings: [{ profileId: 'local-guest', name: 'lingfern-data', owner: 'synthetic-learner', disabled: false, bindingVersion: version }] } }));
  await page.route('**/api/sync/repositories', route => route.fulfill({ json: { repositories: [{ name: 'lingfern-data', repositoryId: 21, installationId: 31 }] } }));
  await page.route('**/api/sync/inspect', route => route.fulfill({ json: { intent: 'i'.repeat(43), name: 'lingfern-data', owner: 'synthetic-learner', profileId: 'local-guest', existing: true, expiresAt: Math.floor(Date.now() / 1000) + 300 } }));
  await page.goto('/settings');
  await page.getByRole('button', { name: '复制当前档案用于此账号', exact: true }).click();
  await page.getByRole('button', { name: '核验资料库', exact: true }).click();
  await expect(page.locator('.repository-binding .backup-preview')).toBeVisible();
  version = 'b'.repeat(43);
  const refreshed = page.waitForResponse('**/api/session');
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await refreshed;
  await expect(page.locator('.repository-binding .backup-preview')).toHaveCount(0);
});

test('stalled logout and repository lookup time out and remain retryable after late responses', async ({ page, context }) => {
  test.setTimeout(45_000);
  let signedIn = true, logouts = 0, finds = 0, release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await context.route('**/api/session', route => route.fulfill({ json: signedIn ? account : { account: null, syncAvailable: false } }));
  await context.route('**/api/auth/logout', async route => { logouts++; await pending; await route.fulfill({ status: 204 }); });
  await context.route('**/api/sync/repositories', async route => { finds++; await pending; await route.fulfill({ json: { repositories: [{ name: 'late-choice', repositoryId: 21, installationId: 31 }] } }); });
  await page.goto('/settings');
  await page.getByRole('button', { name: '复制当前档案用于此账号', exact: true }).click();
  const other = await context.newPage(); await other.goto('/settings');
  const find = other.getByRole('button', { name: '查找已授权资料库', exact: true });
  await find.click();
  await page.getByRole('button', { name: '退出本设备的网站会话', exact: true }).evaluate(element => { (element as HTMLButtonElement).click(); (element as HTMLButtonElement).click(); });
  await expect(page.locator('.github-status-line')).toHaveAttribute('data-status', 'loading');
  await expect(find).toBeDisabled();
  await Promise.all([
    expect(page.locator('.github-status-line')).toHaveAttribute('data-status', 'failed', { timeout: 35_000 }),
    expect(other.locator('.repository-binding')).toContainText(languagePacks['zh-Hans'].repositoryBinding.failed, { timeout: 35_000 }),
  ]);
  expect(logouts).toBe(1); expect(finds).toBe(1);
  await expect(find).toBeEnabled();
  release();
  // Flush a browser task after the late network replies; no old result may reopen access.
  await page.waitForTimeout(150);
  await expect(page.locator('.github-status-line')).toHaveAttribute('data-status', 'failed');
  await expect(other.locator('.repository-binding .setting-trigger')).toHaveCount(0);
  signedIn = false;
  await page.getByRole('button', { name: '重试', exact: true }).click();
  await expect(page.locator('.github-status-line')).toHaveAttribute('data-status', 'signed-out');
});

test('visibility revalidation remains available without BroadcastChannel and skips offline wakeups', async ({ page, context }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'BroadcastChannel', { value: undefined }));
  let signedIn = true, reads = 0;
  await page.route('**/api/session', route => { reads++; return route.fulfill({ json: signedIn ? account : { account: null, syncAvailable: false } }); });
  await page.goto('/settings');
  await expect(page.locator('.github-status-line')).toHaveAttribute('data-status', 'connected');
  expect(reads).toBe(1);
  await context.setOffline(true);
  await page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('online')); });
  await page.waitForTimeout(150);
  expect(reads).toBe(1);
  signedIn = false;
  await context.setOffline(false);
  await expect(page.locator('.github-status-line')).toHaveAttribute('data-status', 'signed-out');
  expect(reads).toBe(2);
});
