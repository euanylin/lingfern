import { expect, test } from '@playwright/test';
import { selectPicker } from './picker';
import { languagePacks } from '../../src/locales';

test('MCP sits below GitHub and renders all languages at narrow widths', async ({ page }) => {
  let sharingRequests = 0;
  await page.route('**/api/session', route => route.fulfill({ json: { account: { id: 1234, login: 'synthetic-learner' }, csrfToken: 'c'.repeat(43), syncAvailable: false } }));
  await page.route('**/api/ai/**', route => { sharingRequests++; return route.fulfill({ status: 503, json: { error: 'SHARING_NOT_CONFIGURED' } }); });
  await page.setViewportSize({ width: 320, height: 640 });
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  for (const [label, value, backupTitle] of [['语言', 'en', 'Backup'], ['Language', 'zh-Hant', '備份'], ['語言', 'zh-Hans', '备份']] as const) {
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
    await expect(page.locator('.profile-backup > .muted')).toHaveText(languagePacks[value].profileBackup.shortNote);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `output/playwright/mcp-settings-320-${value}-dark.png`, fullPage: true });
  }
  await page.goto('/settings#mcp');
  await expect(page).toHaveURL('/settings#mcp');
  await expect(page.getByRole('heading', { name: 'MCP', exact: true })).toBeVisible();
  expect(sharingRequests).toBe(0);
  await page.locator('.sharing-management>summary').click();
  await expect(page.locator('.sharing-management')).toContainText('分享服务尚未配置');
});

test('connected service cards keep setup folded, keyboard controls usable, and targets readable across themes', async ({ page }) => {
  let repositoryReads = 0, sharingReads = 0;
  await page.route('**/api/session', route => route.fulfill({ json: { account: { id: 1234, login: 'synthetic-learner' }, csrfToken: 'c'.repeat(43), syncAvailable: false, bindings: [{ name: 'lingfern-data', owner: 'synthetic-learner', profileId: 'local-guest', disabled: false }] } }));
  await page.route('**/api/sync/repositories', route => { repositoryReads++; return route.fulfill({ json: { repositories: [{ name: 'lingfern-data', repositoryId: 21, installationId: 31 }] } }); });
  await page.route('**/api/ai/**', route => { sharingReads++; return route.fulfill({ json: new URL(route.request().url()).pathname.endsWith('connections') ? { connections: [] } : { shares: [] } }); });
  await page.goto('/settings');
  await page.getByRole('button', { name: '复制当前档案用于此账号' }).click();
  const repository = page.locator('.repository-binding'), management = page.locator('.sharing-management');
  await expect(repository).toBeVisible();
  expect(repositoryReads).toBe(0); expect(sharingReads).toBe(0);
  await expect(repository.locator('.repository-steps')).toBeHidden();
  await expect(repository.locator('bdi')).toHaveText('synthetic-learner/lingfern-data');
  const resetSummary = repository.locator('.repository-reset>summary');
  await expect(resetSummary).toHaveCSS('min-height', '56px');
  await resetSummary.press('Enter');
  await repository.getByRole('button', { name: languagePacks['zh-Hans'].repositoryBinding.find, exact: true }).click();
  await expect(repository.locator('.setting-trigger')).toContainText('lingfern-data');
  expect(repositoryReads).toBe(1);
  await resetSummary.press('Enter');
  for (const [label, locale, reset, permissions] of [['语言', 'en', 'Set up again', 'Sharing and client permissions'], ['Language', 'zh-Hant', '重新設定', '分享與用戶端權限'], ['語言', 'zh-Hans', '重新设置', '分享与客户端权限']] as const) {
    await selectPicker(page, label, locale);
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
      for (const width of [1440, 320]) {
        await page.setViewportSize({ width, height: 900 });
        const summary = repository.locator('.repository-reset>summary');
        await summary.focus(); await summary.press('Enter');
        await expect(repository.getByText(reset, { exact: true })).toBeVisible();
        await expect(repository.locator('.repository-steps')).toBeVisible();
        await summary.press('Enter');
        await expect(repository.locator('.repository-steps')).toBeHidden();
        await management.locator('summary').focus();
        if (!await management.evaluate(element => (element as HTMLDetailsElement).open)) await management.locator('summary').press('Enter');
        await expect(management.locator('.sharing-empty')).toHaveCount(2);
        await expect(management.locator('summary')).toHaveText(permissions);
        expect(await management.evaluate(element => getComputedStyle(element).borderBottomWidth)).toBe('0px');
        expect(await management.locator('h3').first().evaluate(element => getComputedStyle(element).fontSize)).toBe('13px');
        expect(await management.locator('.sharing-empty').last().evaluate(element => getComputedStyle(element).marginBottom)).toBe('4px');
        const footer = page.locator('.github-session-actions');
        expect(await footer.evaluate(element => getComputedStyle(element).borderTopWidth)).toBe('1px');
        await expect(footer.locator('button').first()).toHaveCSS('font-weight', '500');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const smallTargets = await page.locator('.github-identity button,.github-identity a,.mcp-settings button,.mcp-settings summary').evaluateAll(elements => elements.filter(element => {
          const box = element.getBoundingClientRect();
          return box.width > 0 && box.height > 0 && !element.closest('[hidden]') && (box.width < 44 || box.height < 44);
        }).map(element => element.textContent));
        expect(smallTargets).toEqual([]);
        await page.locator('.github-identity').evaluate(element => window.scrollTo(0, element.getBoundingClientRect().top + scrollY - 100));
        await page.mouse.move(0, 0);
        await page.locator('.github-identity').screenshot({ path: `output/playwright/github-card-${locale}-${colorScheme}-${width}.png`, animations: 'disabled' });
        await management.locator('summary').blur();
        await page.locator('.mcp-settings').evaluate(element => window.scrollTo(0, element.getBoundingClientRect().top + scrollY - 100));
        await page.locator('.mcp-settings').screenshot({ path: `output/playwright/mcp-card-${locale}-${colorScheme}-${width}.png`, animations: 'disabled' });
      }
    }
  }
});

test('MCP copy feedback expires and a blocked clipboard selects the address', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => {} } }));
  await page.goto('/settings');
  const copy = page.getByRole('button', { name: '复制地址', exact: true });
  await copy.click(); await expect(copy.getByRole('status')).toHaveText('已复制');
  await expect(copy.getByRole('status')).toHaveCount(0, { timeout: 2500 });
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('Denied'); } } }));
  await copy.click();
  await expect(page.locator('.mcp-settings')).toContainText('复制失败，请选中地址手动复制');
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe('https://lingfern.com/mcp');
});
