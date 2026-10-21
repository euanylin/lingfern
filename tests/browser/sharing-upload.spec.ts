import { confirmTask } from './task-start';
import { expect, test, type Page } from '@playwright/test';
import { selectPicker } from './picker';
import { showLearningPane } from './learning-pane';

const connectionId = '7c57514e-a61f-4f0b-9e97-12d33535cb89';
async function openUpload(page: Page) {
  await page.goto('/today');
  await page.locator('.primary-task.reading-task').getByRole('button', { name: '开始', exact: true }).click(); await confirmTask(page);
  await showLearningPane(page, 'question');
  await page.getByRole('radio', { name: 'At the library.' }).check();
  await page.getByRole('button', { name: '保存答案', exact: true }).click();
  await page.locator('.ai-handoff>summary').click();
  await page.locator('.sharing-upload>summary').click();
}
function session(account = 1234) { return { account: { id: account, login: 'synthetic-learner' }, csrfToken: 'c'.repeat(43), syncAvailable: false }; }
function clients(contextsRead = 1) { return { connections: [{ id: connectionId, name: 'Synthetic assistant', createdAt: 100, expiresAt: 2147483647, contextsRead, materialsRead: 1 }] }; }

test('only explicitly selected, previewed and confirmed content is uploaded once', async ({ page }) => {
  let reads = 0;
  const uploads: Record<string, unknown>[] = [];
  await page.route('**/api/session', route => route.fulfill({ json: session() }));
  await page.route('**/api/ai/connections', route => { reads++; return route.fulfill({ json: clients() }); });
  await page.route('**/api/ai/shares', route => {
    expect(route.request().method()).toBe('POST');
    expect(route.request().headers()['x-csrf-token']).toBe('c'.repeat(43));
    const value = route.request().postDataJSON() as Record<string, unknown>; uploads.push(value);
    return route.fulfill({ status: 201, json: { id: 'c1bbacdd-0775-44a4-a744-74943d92349c', profileId: value.profileId, connectionId: value.connectionId, title: value.title, createdAt: 100, expiresAt: 86500 } });
  });
  await page.setViewportSize({ width: 320, height: 640 });
  await openUpload(page);
  expect(reads).toBe(0); expect(uploads).toEqual([]);
  await page.getByRole('checkbox', { name: '材料', exact: true }).uncheck();
  await page.locator('.sharing-upload>summary').click();
  const upload = page.locator('.sharing-upload');
  await upload.getByRole('button', { name: '读取已授权客户端' }).click();
  await expect(upload).toContainText('synthetic-learner');
  await expect(upload.getByRole('button', { name: '确认上传' })).toBeDisabled();
  await selectPicker(page, '接收客户端', connectionId);
  await upload.getByRole('checkbox').check();
  // Invalidate content approval and receiver choice after selection edits.
  await page.getByRole('radio', { name: '再举一个例子' }).check();
  await page.locator('.sharing-upload>summary').click();
  await upload.getByRole('button', { name: '读取已授权客户端' }).click();
  await selectPicker(page, '接收客户端', connectionId);
  await expect(upload.getByRole('checkbox')).not.toBeChecked();
  const preview = await upload.locator('.ai-preview>p').innerText();
  expect(preview).not.toContain('Meet at the library at ten.');
  expect(preview).toContain('## 请求\n再举一个例子');
  await upload.getByRole('checkbox').check();
  expect(uploads).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const width of [1440, 1200, 1024, 768, 375, 320]) {
    await page.setViewportSize({ width, height: 640 });
    await showLearningPane(page, 'question');
    await upload.getByRole('button', { name: '确认上传' }).scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(upload.getByRole('button', { name: '确认上传' })).toBeVisible();
    await page.screenshot({ path: `output/playwright/sharing-upload-${width}-light-zh-Hans.png` });
  }
  await upload.getByRole('button', { name: '确认上传' }).click();
  await expect(upload.getByRole('status')).toContainText('分享已创建');
  expect(uploads).toHaveLength(1);
  expect(uploads[0]).toMatchObject({ profileId: 'local-guest', connectionId, confirm: true, text: preview });
  expect(Object.keys(uploads[0]).sort()).toEqual(['confirm', 'connectionId', 'profileId', 'text', 'title']);
  await expect(upload.getByRole('button', { name: '确认上传' })).toBeDisabled();
});

test('account changes and lost acknowledgement never silently upload or retry', async ({ page }) => {
  let account = 1234, posts = 0, allowed = 1;
  await page.route('**/api/session', route => route.fulfill({ json: session(account) }));
  await page.route('**/api/ai/connections', route => route.fulfill({ json: clients(allowed) }));
  await page.route('**/api/ai/shares', route => { posts++; return route.abort('connectionfailed'); });
  await openUpload(page);
  const upload = page.locator('.sharing-upload');
  async function approve() {
    await upload.getByRole('button', { name: '读取已授权客户端' }).click();
    await selectPicker(page, '接收客户端', connectionId);
    await upload.getByRole('checkbox').check();
  }
  await approve(); account = 5678;
  await upload.getByRole('button', { name: '确认上传' }).click();
  await expect(upload.getByRole('status')).toContainText('账户、档案或客户端权限已变化');
  expect(posts).toBe(0);
  account = 1234; await approve(); allowed = 0;
  await upload.getByRole('button', { name: '确认上传' }).click();
  await expect(upload.getByRole('status')).toContainText('账户、档案或客户端权限已变化');
  expect(posts).toBe(0);
  allowed = 1; await approve();
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('lingfern');
    request.onsuccess = () => { const db = request.result, tx = db.transaction('settings', 'readwrite'); tx.objectStore('settings').put({ key: 'activeProfile', value: 'other-synthetic-profile' }); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); };
    request.onerror = () => reject(request.error);
  }));
  await upload.getByRole('button', { name: '确认上传' }).click();
  await expect(upload.getByRole('status')).toContainText('账户、档案或客户端权限已变化');
  expect(posts).toBe(0);
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('lingfern');
    request.onsuccess = () => { const db = request.result, tx = db.transaction('settings', 'readwrite'); tx.objectStore('settings').delete('activeProfile'); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); };
    request.onerror = () => reject(request.error);
  }));
  await approve();
  await upload.getByRole('button', { name: '确认上传' }).click();
  await expect(upload.getByRole('status')).toContainText('无法确认上传结果');
  expect(posts).toBe(1);
  await expect(upload.getByRole('button', { name: '确认上传' })).toBeDisabled();
  await expect(upload.getByRole('button', { name: '读取已授权客户端' })).toBeDisabled();
});

test('missing identity, client permission, configuration and network preserve local handoff', async ({ page, context }) => {
  let signedIn = false, configured = true, posts = 0;
  await page.route('**/api/session', route => route.fulfill({ json: signedIn ? session() : { account: null, syncAvailable: false } }));
  await page.route('**/api/ai/connections', route => route.fulfill(configured ? { json: clients(0) } : { status: 503, json: { error: 'SHARING_NOT_CONFIGURED' } }));
  await page.route('**/api/ai/shares', route => { posts++; return route.abort(); });
  await openUpload(page);
  const upload = page.locator('.sharing-upload');
  await upload.getByRole('button', { name: '读取已授权客户端' }).click();
  await expect(upload.getByRole('status')).toContainText('请先在设置中登录 GitHub');
  signedIn = true;
  await upload.getByRole('button', { name: '读取已授权客户端' }).click();
  await expect(upload).toContainText('没有获准读取分享内容的客户端');
  await expect(upload.getByRole('button', { name: '确认上传' })).toHaveCount(0);
  configured = false;
  await upload.getByRole('button', { name: '读取已授权客户端' }).click();
  await expect(upload.getByRole('status')).toContainText('分享服务尚未配置');
  await context.setOffline(true);
  await upload.getByRole('button', { name: '读取已授权客户端' }).click();
  await expect(upload.getByRole('status')).toContainText('当前离线');
  await expect(page.getByRole('button', { name: '下载 Markdown' })).toBeEnabled();
  expect(posts).toBe(0);
});
