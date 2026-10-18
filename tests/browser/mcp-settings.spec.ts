import { expect, test } from '@playwright/test';
import { selectPicker } from './picker';

test('MCP sits below GitHub and renders all languages at narrow widths', async ({ page }) => {
  let sharingRequests = 0;
  await page.route('**/api/session', route => route.fulfill({ json: { account: { id: 1234, login: 'synthetic-learner' }, csrfToken: 'c'.repeat(43), syncAvailable: false } }));
  await page.route('**/api/ai/**', route => { sharingRequests++; return route.fulfill({ status: 503, json: { error: 'SHARING_NOT_CONFIGURED' } }); });
  await page.setViewportSize({ width: 320, height: 640 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  for (const [label, value, backupTitle, backupScope] of [['语言', 'en', 'Backup', 'excluding resources and recordings'], ['Language', 'zh-Hant', '備份', '不含資源和錄音'], ['語言', 'zh-Hans', '备份', '不含资源和录音']] as const) {
    await page.goto('/settings'); await selectPicker(page, label, value);
    await expect(page.getByRole('link', { name: /External assistants|外部助手/ })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'MCP', exact: true })).toBeVisible();
    await expect(page.locator('.github-identity + .mcp-settings')).toHaveCount(1);
    await expect(page.locator('.sharing-endpoint')).toHaveText('https://lingfern.com/mcp');
    await expect(page.locator('.sharing-management')).toBeVisible();
    await expect(page.locator('.mcp-settings .sharing-management')).toBeVisible();
    await expect(page.locator('.mcp-settings > .muted')).not.toBeEmpty();
    await expect(page.locator('.github-identity > .muted')).not.toBeEmpty();
    await expect(page.locator('.settings-data > h2,.settings-data > p')).toHaveCount(0);
    await expect(page.locator('.profile-backup > h2')).toHaveText(backupTitle);
    await expect(page.locator('.profile-backup > .muted')).toHaveCount(1);
    await expect(page.locator('.profile-backup > .muted')).toContainText(backupScope);
    await expect(page.locator('.profile-backup > .muted')).toContainText('ZIP');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `output/playwright/mcp-settings-320-${value}-dark.png`, fullPage: true });
  }
  await page.goto('/settings#mcp');
  await expect(page).toHaveURL('/settings#mcp');
  await expect(page.getByRole('heading', { name: 'MCP', exact: true })).toBeVisible();
  expect(sharingRequests).toBe(0);
  await page.locator('.sharing-management>summary').click();
  await page.getByRole('button', { name: '查看或刷新' }).click();
  await expect(page.locator('.sharing-management')).toContainText('分享服务尚未配置');
});
