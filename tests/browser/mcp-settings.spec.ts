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


test('settings controls share pointer, keyboard and touch feedback without highlighting disabled actions', async ({ page }) => {
  test.setTimeout(60000);
  await page.route('**/api/ai/**', route => route.fulfill({ json: new URL(route.request().url()).pathname.endsWith('connections') ? { connections: [] } : { shares: [] } }));
  await page.route('**/api/session', route => route.fulfill({ json: { account: { id: 1234, login: 'synthetic' }, csrfToken: 'c'.repeat(43), syncAvailable: false } }));
  await page.goto('/settings');
  for (const [locale, width, colorScheme] of [['zh-Hans', 375, 'dark'], ['en', 1440, 'light'], ['ar', 320, 'dark'], ['zh-Hans', 1440, 'light'], ['en', 320, 'dark'], ['ar', 1440, 'light']] as const) {
    await selectPicker(page, (await page.locator('.settings-language .setting-trigger').getAttribute('aria-label'))!, locale);
    await page.setViewportSize({ width, height: 900 }); await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await page.goto('/library');
    const entry = page.locator('.library-reference-tile').first();
    await entry.hover(); const entryHover = await entry.evaluate(el => { const s = getComputedStyle(el); return { background: s.backgroundColor, radius: s.borderRadius, transform: s.transform }; });
    await page.mouse.move(0, 0); await page.keyboard.press('Tab'); await entry.focus();
    const entryKeyboard = await entry.evaluate(el => { const s = getComputedStyle(el); return { background: s.backgroundColor, underline: s.textDecorationLine }; });
    await entry.evaluate(el => (el as HTMLElement).blur());
    await entry.dispatchEvent('pointerdown', { isPrimary: true, pointerType: 'touch', pointerId: 1, clientX: 10, clientY: 10 });
    await expect(entry).toHaveAttribute('data-touch-active', '');
    const entryTouch = await entry.evaluate(el => getComputedStyle(el).backgroundColor);
    await entry.dispatchEvent('pointercancel', { pointerId: 1 });
    await page.goto('/settings');
    for (const row of await page.locator('.settings-start-link,.settings-about-row,.sharing-management>summary,.github-session-actions>button').all()) {
      await row.hover(); await expect(row).toHaveCSS('background-color', entryHover.background); await expect(row).toHaveCSS('border-radius', entryHover.radius); await expect(row).toHaveCSS('transform', entryHover.transform);
      await page.mouse.move(0, 0); await page.keyboard.press('Tab'); await row.focus();
      await expect(row).toHaveCSS('background-color', entryKeyboard.background); await expect(row).toHaveCSS('text-decoration-line', entryKeyboard.underline);
      await row.evaluate(el => (el as HTMLElement).blur());
      await row.dispatchEvent('pointerdown', { isPrimary: true, pointerType: 'touch', pointerId: 1, clientX: 10, clientY: 10 });
      await expect(row).toHaveAttribute('data-touch-active', ''); await expect(row).toHaveCSS('background-color', entryTouch);
      expect(await row.evaluate(el => { const r = el.getBoundingClientRect(), card = el.closest('.settings-preferences,.settings-about-update,.github-identity,.mcp-settings')!.getBoundingClientRect(); return r.height >= 44 && r.left >= card.left + 7.5 && r.right <= card.right - 7.5; })).toBe(true);
      await row.dispatchEvent('pointercancel', { pointerId: 1 });
    }
    const reference = page.locator('.settings-language .setting-trigger'), profile = page.locator('.backup-profile-row .setting-trigger');
    await reference.hover(); const feedback = await reference.evaluate(el => getComputedStyle(el).backgroundColor);
    await reference.dispatchEvent('pointerdown', { isPrimary: true, pointerType: 'touch', pointerId: 1, clientX: 10, clientY: 10 });
    const rowFeedback = await reference.evaluate(el => getComputedStyle(el.parentElement!).backgroundColor);
    await reference.dispatchEvent('pointercancel', { pointerId: 1 });
    for (const control of await page.locator('.settings-preferences .setting-trigger,.backup-profile-row .setting-trigger,.mcp-copy-button').all()) {
      await control.hover(); await expect(control).toHaveCSS('background-color', feedback);
      await page.mouse.move(0, 0); await page.keyboard.press('Tab'); await control.focus();
      await expect(control).toHaveCSS('background-color', entryKeyboard.background);
      await control.evaluate(el => (el as HTMLElement).blur());
      await control.dispatchEvent('pointerdown', { isPrimary: true, pointerType: 'touch', pointerId: 1, clientX: 10, clientY: 10 });
      await expect(control).toHaveAttribute('data-touch-active', ''); await expect(control).toHaveCSS('background-color', feedback);
      if (await control.evaluate(el => el.classList.contains('setting-trigger'))) expect(await control.evaluate(el => getComputedStyle(el.parentElement!).backgroundColor)).toBe(rowFeedback);
      await control.dispatchEvent('pointercancel', { pointerId: 1 }); await expect(control).not.toHaveAttribute('data-touch-active');
    }
    expect(await profile.evaluate(el => el.getBoundingClientRect().width < el.parentElement!.getBoundingClientRect().width * .7)).toBe(true);
    await profile.press('Tab'); await page.keyboard.press('Shift+Tab');
    await expect(profile).toBeFocused(); await expect(profile.locator('span').first()).toHaveCSS('text-decoration-line', 'underline');
    await profile.press('Enter'); await expect(page.getByRole('listbox')).toBeVisible(); await page.keyboard.press('Escape');
    await reference.press('Enter');
    const option = page.locator('[role=option][aria-selected=false]').first();
    await option.hover(); await expect(option).toHaveCSS('background-color', entryHover.background);
    await option.dispatchEvent('pointerdown', { isPrimary: true, pointerType: 'touch', pointerId: 1, clientX: 10, clientY: 10 });
    await expect(option).toHaveAttribute('data-touch-active', ''); await expect(option).toHaveCSS('background-color', entryTouch); await option.dispatchEvent('pointercancel', { pointerId: 1 });
    await page.keyboard.press('Escape');
    await page.locator('.sharing-management>summary').press('Enter');
    const refresh = page.locator('.sharing-refresh'); await expect(refresh).toBeEnabled();
    await refresh.hover(); await expect(refresh).toHaveCSS('background-color', entryHover.background); await expect(refresh).toHaveCSS('border-radius', entryHover.radius);
    await page.locator('.sharing-management>summary').press('Enter');

    const download = page.locator('.backup-download'); await download.hover(); const primary = await download.evaluate(el => getComputedStyle(el).backgroundColor);
    await page.mouse.move(0, 0); await page.keyboard.press('Tab'); await download.focus(); await expect(download).toHaveCSS('background-color', primary);
    await download.evaluate(el => (el as HTMLElement).blur());
    await download.dispatchEvent('pointerdown', { isPrimary: true, pointerType: 'touch', pointerId: 1, clientX: 10, clientY: 10 });
    await expect(download).toHaveCSS('background-color', primary); await download.dispatchEvent('pointercancel', { pointerId: 1 });
    for (const button of [download, page.locator('.settings-update-row')]) {
      await page.mouse.move(0, 0); await button.evaluate(el => { (el as HTMLButtonElement).disabled = true; });
      const idle = await button.evaluate(el => getComputedStyle(el).backgroundColor);
      await button.hover(); await expect(button).toHaveCSS('background-color', idle);
      await button.evaluate(el => { (el as HTMLButtonElement).disabled = false; });
    }
    const restore = page.locator('.profile-backup .backup-file-label');
    await restore.locator('input').evaluate(el => { (el as HTMLInputElement).disabled = true; });
    await restore.locator('.backup-file-button').hover();
    await expect(restore.locator('.backup-file-button')).toHaveCSS('transform', 'none');
    await restore.locator('input').evaluate(el => { (el as HTMLInputElement).disabled = false; });
    await page.mouse.move(0, 0); await page.locator('.profile-backup').screenshot({ path: `output/playwright/profile-picker-${locale}-${colorScheme}-${width}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('.settings-preferences').screenshot({ path: `output/playwright/settings-feedback-preferences-${locale}-${colorScheme}-${width}.png` });
    await page.locator('.settings-about-update').screenshot({ path: `output/playwright/settings-feedback-update-${locale}-${colorScheme}-${width}.png` });
  }
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const actions = page.locator('.profile-backup .backup-download,.profile-backup .backup-file-button,.profile-backup .offline-remove');
  for (const action of await actions.all()) {
    await page.mouse.move(0, 0); await action.evaluate(el => (el as HTMLElement).blur());
    const width = (await action.boundingBox())!.width; await action.hover();
    await expect(action).toHaveCSS('transform', 'matrix(1.025, 0, 0, 1.025, 0, 0)');
    expect((await action.boundingBox())!.width / width).toBeCloseTo(1.025, 2);
  }
  for (const row of await page.locator('.settings-start-link,.settings-update-row,.settings-language .setting-trigger,.mcp-copy-button').all()) {
    await row.hover(); await expect(row).toHaveCSS('transform', 'none');
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const action of await actions.all()) { await action.hover(); await expect(action).toHaveCSS('transform', 'none'); }
  expect(await page.pageErrors()).toEqual([]);
});
