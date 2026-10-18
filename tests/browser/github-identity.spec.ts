import { confirmTask } from './task-start';
import { expect, test } from '@playwright/test';
import { selectPicker } from './picker';

test('optional identity reports real unavailable configuration without redirecting learning', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.locator('.github-identity')).toContainText('GitHub 登录尚未配置');
  await expect(page.getByRole('link', { name: '连接 GitHub', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '连接 GitHub', exact: true })).toBeDisabled();
  await expect(page.locator('.github-identity').getByRole('button', { name: '重试', exact: true })).toHaveCount(0);
  await page.goto('/today');
  await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
});

test('identity summary and logout use the current session and never upload a profile', async ({ page }) => {
  // UI simulation only. Real GitHub authorisation is a separate acceptance gate.
  let signedIn = true;
  await page.route('**/api/session', route => route.fulfill({ json: { account: signedIn ? { id: 1234, login: 'test-learner' } : null, ...(signedIn ? { csrfToken: 'c'.repeat(43) } : {}), syncAvailable: false } }));
  await page.route('**/api/auth/logout', async route => {
    expect(route.request().method()).toBe('POST');
    expect(route.request().headers()['x-csrf-token']).toBe('c'.repeat(43));
    expect(route.request().postData()).toBe(null);
    signedIn = false;
    await route.fulfill({ status: 204 });
  });
  await page.goto('/settings');
  await expect(page.locator('.github-identity')).toContainText('test-learner');
  await page.getByRole('button', { name: '退出本设备的网站会话' }).click();
  await expect(page.getByRole('link', { name: '连接 GitHub', exact: true })).toBeVisible();
  await expect(page.locator('.github-identity')).not.toContainText('test-learner');
});

test('disconnect confirmation can cancel and reports upstream revocation failure without clearing local records', async ({ page }) => {
  await page.route('**/api/session', route => route.fulfill({ json: { account: { id: 1234, login: 'test-learner' }, csrfToken: 'c'.repeat(43), syncAvailable: false } }));
  let requests = 0;
  await page.route('**/api/auth/disconnect', async route => {
    requests++;
    expect(route.request().method()).toBe('POST');
    expect(route.request().headers()['x-csrf-token']).toBe('c'.repeat(43));
    expect(route.request().postDataJSON()).toEqual({ confirm: true });
    await route.fulfill({ json: { disconnected: true, providerRevoked: false } });
  });
  await page.goto('/today');
  await page.locator('.primary-task.reading-task').getByRole('button', { name: '开始', exact: true }).click(); await confirmTask(page);
  await page.getByRole('radio').first().check();
  await page.getByRole('button', { name: '保存答案', exact: true }).click();
  await expect(page.locator('.feedback h2').first()).toBeVisible();
  await page.goto('/settings');
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: '断开 GitHub 身份', exact: true }).click();
  expect(requests).toBe(0);
  await expect(page.locator('.github-identity')).toContainText('test-learner');
  page.once('dialog', dialog => { expect(dialog.message()).toContain('所有设备'); return dialog.accept(); });
  await page.getByRole('button', { name: '断开 GitHub 身份', exact: true }).click();
  await expect(page.locator('.github-identity')).toContainText('无法确认 GitHub 撤销成功');
  await expect(page.getByRole('link', { name: '在 GitHub 管理授权' })).toHaveAttribute('href', 'https://github.com/settings/apps');
  await page.goto('/progress');
  await expect(page.locator('.totals dd').first()).toHaveText('1');
});

test('private repository binding is inspected before confirmation and disconnect stays separate', async ({ page }) => {
  let binding: { name: string; owner: string; profileId: string; disabled: boolean } | undefined;
  let markerWrites = 0;
  await page.route('**/api/session', route => route.fulfill({ json: { account: { id: 1234, login: 'test-learner' }, csrfToken: 'c'.repeat(43), syncAvailable: false, bindings: binding ? [binding] : [] } }));
  await page.route('**/api/sync/repositories', route => route.fulfill({ json: { repositories: [{ name: 'lingfern-data', repositoryId: 21, installationId: 31 }], installationUrl: 'https://github.com/apps/lingfern-test/installations/new' } }));
  await page.route('**/api/sync/inspect', route => {
    expect(route.request().headers()['x-csrf-token']).toBe('c'.repeat(43));
    expect(route.request().postDataJSON()).toEqual({ name: 'lingfern-data', repositoryId: 21, installationId: 31, profileId: 'local-guest' });
    return route.fulfill({ json: { intent: 'i'.repeat(43), name: 'lingfern-data', owner: 'test-learner', profileId: 'local-guest', existing: false, expiresAt: Math.floor(Date.now() / 1000) + 300 } });
  });
  await page.route('**/api/sync/bind', route => {
    expect(route.request().postDataJSON()).toEqual({ intent: 'i'.repeat(43), confirm: true });
    markerWrites++; binding = { name: 'lingfern-data', owner: 'test-learner', profileId: 'local-guest', disabled: false };
    return route.fulfill({ json: { binding, syncAvailable: false } });
  });
  await page.route('**/api/sync/disconnect', route => {
    expect(route.request().postDataJSON()).toEqual({ profileId: 'local-guest', confirm: true });
    binding = undefined; return route.fulfill({ json: { disconnected: true } });
  });
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/settings');
  await page.getByRole('button', { name: '复制当前档案用于此账号' }).click();
  await page.getByRole('button', { name: '查找已授权资料库' }).click();
  await page.getByRole('button', { name: '核验资料库', exact: true }).click();
  await expect(page.locator('.repository-binding')).toContainText('Git 历史中的内容也可能公开');
  expect(markerWrites).toBe(0);
  await page.getByRole('button', { name: '取消', exact: true }).click();
  expect(markerWrites).toBe(0);
  await page.getByRole('button', { name: '核验资料库', exact: true }).click();
  await page.getByRole('button', { name: '确认绑定', exact: true }).click();
  await expect(page.getByRole('button', { name: '断开资料库同步绑定' })).toBeVisible();
  await expect(page.locator('.repository-binding')).toContainText('批次同步尚未开放');
  expect(markerWrites).toBe(1);
  for (const width of [1440, 1200, 1024, 768, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: '断开资料库同步绑定' }).click();
  await expect(page.getByRole('button', { name: '断开资料库同步绑定' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '断开 GitHub 身份', exact: true })).toBeVisible();
});

test('repository guidance and controls remain readable in all three languages on narrow screens', async ({ page }) => {
  await page.route('**/api/session', route => route.fulfill({ json: { account: { id: 1234, login: 'test-learner' }, csrfToken: 'c'.repeat(43), syncAvailable: false, bindings: [] } }));
  await page.route('**/api/sync/repositories', route => route.fulfill({ json: { repositories: [{ name: 'x'.repeat(100), repositoryId: 21, installationId: 31 }] } }));
  await page.goto('/settings');
  await page.getByRole('button', { name: '复制当前档案用于此账号' }).click();
  await expect(page.locator('.repository-binding')).toBeVisible();
  await page.setViewportSize({ width: 320, height: 640 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  for (const [label, value, title, find, inspect] of [['语言', 'en', 'Private repository', 'Find authorised repositories', 'Verify repository'], ['Language', 'zh-Hant', '私人資料庫', '尋找已授權資料庫', '核驗資料庫'], ['語言', 'zh-Hans', '私人资料库', '查找已授权资料库', '核验资料库']]) {
    await selectPicker(page, label, value);
    await expect(page.locator('.repository-binding h3')).toHaveText(title);
    await page.getByRole('button', { name: find, exact: true }).click();
    await expect(page.getByRole('button', { name: inspect, exact: true })).toBeVisible();
    const history = page.locator('.repository-history');
    await history.locator('summary').click();
    await expect(history.locator('li')).toHaveCount(3);
    await expect(history.locator('a')).toHaveAttribute('href', 'https://docs.github.com/en/repositories/creating-and-managing-repositories/deleting-a-repository');
    await expect(history.getByRole('button')).toHaveCount(0);
    await page.screenshot({ path: `output/playwright/remote-history-320-${value}-dark.png`, fullPage: true });
    await history.locator('summary').click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});


test('a failed initial session read offers explicit connection without starting authorisation automatically', async ({ page }) => {
  let authorisations = 0;
  await page.route('**/api/session', route => route.fulfill({ status: 500, json: { error: 'SESSION_FAILED' } }));
  await page.route('**/api/auth/start?**', route => { authorisations++; return route.fulfill({ status: 500 }); });
  await page.goto('/settings');
  const identity = page.locator('.github-identity');
  await expect(identity).toContainText('暂时无法检查连接状态');
  await expect(identity.getByRole('link', { name: '连接 GitHub', exact: true })).toHaveAttribute('href', '/api/auth/start?return=%2Fsettings');
  await expect(identity.getByRole('button', { name: '重试', exact: true })).toHaveCount(0);
  expect(authorisations).toBe(0);
});

test('a failed logout of a known account keeps retry instead of offering a second identity connection', async ({ page }) => {
  await page.route('**/api/session', route => route.fulfill({ json: { account: { id: 1234, login: 'test-learner' }, csrfToken: 'c'.repeat(43), syncAvailable: false } }));
  await page.route('**/api/auth/logout', route => route.fulfill({ status: 500 }));
  await page.goto('/settings');
  const identity = page.locator('.github-identity');
  await expect(identity).toContainText('test-learner');
  await identity.getByRole('button', { name: '退出本设备的网站会话', exact: true }).click();
  await expect(identity.getByRole('button', { name: '重试', exact: true })).toBeVisible();
  await expect(identity.getByRole('link', { name: '连接 GitHub', exact: true })).toHaveCount(0);
});
