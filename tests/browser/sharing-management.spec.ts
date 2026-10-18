import { expect, test } from '@playwright/test';
import { selectPicker } from './picker';

const clientId = '7c57514e-a61f-4f0b-9e97-12d33535cb89', shareId = 'c1bbacdd-0775-44a4-a744-74943d92349c';
test('sharing management is explicit, retains native confirmation, and fences account changes', async ({ page }) => {
  let account = 1234, reads = 0;
  const deleted: string[] = [];
  await page.route('**/api/session', route => route.fulfill({ json: { account: { id: account, login: 'synthetic-learner' }, csrfToken: 'c'.repeat(43), syncAvailable: false } }));
  await page.route('**/api/ai/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === 'DELETE') {
      expect(route.request().headers()['x-csrf-token']).toBe('c'.repeat(43));
      deleted.push(path); return route.fulfill({ json: { revoked: true } });
    }
    reads++;
    return route.fulfill({ json: path.endsWith('connections') ? { connections: deleted.includes(`/api/ai/connections/${clientId}`) ? [] : [{ id: clientId, name: 'Synthetic material client', createdAt: 100, expiresAt: 2147483647, contextsRead: 0, materialsRead: 1 }] } : { shares: deleted.includes(`/api/ai/shares/${shareId}`) ? [] : [{ id: shareId, profileId: 'synthetic-profile', connectionId: clientId, title: 'Synthetic selected context', createdAt: 100, expiresAt: 2147483647 }] } });
  });
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/settings');
  const management = page.locator('.sharing-management');
  await expect(management).toBeVisible();
  expect(reads).toBe(0);
  await management.locator('summary').click();
  expect(reads).toBe(0);
  await management.getByRole('button', { name: '查看或刷新' }).click();
  await expect(management.getByRole('heading', { name: 'Synthetic material client' })).toBeVisible();
  await expect(management).toContainText('搜索公开教材');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'output/playwright/sharing-management-320-light-zh-Hans.png' });
  page.once('dialog', dialog => dialog.dismiss());
  await management.getByRole('button', { name: '撤销分享', exact: true }).click();
  expect(deleted).toEqual([]);
  page.once('dialog', dialog => dialog.accept());
  await management.getByRole('button', { name: '撤销分享', exact: true }).click();
  await expect(management.getByRole('heading', { name: 'Synthetic selected context' })).toHaveCount(0);
  expect(deleted).toEqual([`/api/ai/shares/${shareId}`]);
  account = 5678;
  page.once('dialog', dialog => dialog.accept());
  await management.getByRole('button', { name: '撤销客户端权限' }).click();
  await expect(management).toContainText('网站账户已变化');
  expect(deleted).toHaveLength(1);
  account = 1234;
  await management.getByRole('button', { name: '查看或刷新' }).click();
  await expect(management.getByRole('heading', { name: 'Synthetic material client' })).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await management.getByRole('button', { name: '撤销客户端权限' }).click();
  await expect(management.getByRole('heading', { name: 'Synthetic material client' })).toHaveCount(0);
  expect(deleted).toHaveLength(2);
  for (const [label, locale, title] of [['语言', 'en', 'Sharing and client permissions'], ['Language', 'zh-Hant', '分享與用戶端權限'], ['語言', 'zh-Hans', '分享与客户端权限']]) {
    await selectPicker(page, label, locale);
    await expect(management.locator('summary')).toHaveText(title);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
