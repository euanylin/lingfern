import { openSnapshot, completeWorkspace } from './workspace';
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { selectPicker } from './picker';
import { unzipSync } from 'fflate';
import { languagePacks } from '../../src/locales';

test.use({ timezoneId: 'Asia/Shanghai' });

for (const [locale, width] of [['en', 320], ['zh-Hant', 375], ['zh-Hans', 1440]] as const) test(`backup actions stay equally sized and non-overlapping: ${locale} ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/settings');
  await expect(page.locator('.profile-backup')).toBeVisible();
  if (locale !== 'zh-Hans') await selectPicker(page, '语言', locale);
  const actions = page.locator('.profile-backup .backup-actions');
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await actions.scrollIntoViewIfNeeded();
    const bounds = await actions.locator(':scope>button,.backup-file-button').evaluateAll(elements => elements.map(element => {
      const box = element.getBoundingClientRect(), text = document.createRange();
      text.selectNodeContents(element);
      return { left: box.left, right: box.right, top: box.top, width: box.width, height: box.height, textFits: [...text.getClientRects()].every(rect => rect.left >= box.left - 1 && rect.right <= box.right + 1 && rect.top >= box.top - 1 && rect.bottom <= box.bottom + 1) };
    }));
    expect(bounds).toHaveLength(3);
    for (const [index, button] of bounds.entries()) {
      expect(button.width).toBeGreaterThanOrEqual(44);
      expect(button.height).toBeGreaterThanOrEqual(44);
      expect(button.width).toBeCloseTo(bounds[0].width, 0);
      expect(button.top).toBeCloseTo(bounds[0].top, 0);
      expect(button.textFits).toBe(true);
      if (index) expect(button.left - bounds[index - 1].right).toBeGreaterThanOrEqual(7);
    }
    expect(await actions.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await page.screenshot({ path: `output/playwright/code-audit-20261024/backup-actions-${locale}-${width}-${colorScheme}.png` });
  }
});

test('another tab switching profiles clears a stale backup preview and export dialog', async ({ page, context }) => {
  await page.goto('/settings');
  const profile = page.locator('.profile-backup .setting-trigger');
  await expect(profile).toBeEnabled();
  await profile.click({ position: { x: 8, y: 20 } });
  await expect(page.getByRole('listbox', { name: '当前档案', exact: true })).toBeVisible();
  await profile.press('Escape');
  const bytes = await page.evaluate(async () => {
    const data = await import('/src/data/db.ts' as string);
    await data.profiles.add({ id: 'other-profile', name: 'Other profile', createdAt: new Date().toISOString() });
    return Array.from(new Uint8Array(await (await import('/src/data/backup.ts' as string)).exportBackup('local-guest')));
  });
  await page.getByLabel('从备份恢复').setInputFiles({ name: 'source.zip', mimeType: 'application/zip', buffer: Buffer.from(bytes) });
  await expect(page.locator('.backup-preview')).toBeVisible();
  await page.getByRole('button', { name: '下载备份', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const other = await context.newPage(); await other.goto('/settings');
  await selectPicker(other, '当前档案', 'other-profile');
  await expect(other.locator('.profile-backup .setting-trigger')).toHaveAttribute('data-value', 'other-profile');
  await expect(page.locator('.profile-backup .setting-trigger')).toHaveAttribute('data-value', 'other-profile');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.backup-preview')).toHaveCount(0);
  await expect(page.locator('.profile-backup .backup-file-name')).toHaveCount(0);
  expect(await page.pageErrors()).toEqual([]);
});

test('a delayed earlier profile load cannot overwrite the latest profile language', async ({ page, context }) => {
  let release!: () => void, started!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const requested = new Promise<void>(resolve => { started = resolve; });
  await page.route(/\/src\/locales\/ja\/teaching\.json/, async route => { started(); await held; await route.continue(); });
  await page.goto('/settings'); await expect(page.locator('.profile-backup .setting-trigger')).toBeVisible();
  await page.evaluate(async () => {
    const data = await import('/src/data/db.ts' as string);
    await data.profiles.add({ id: 'japanese-profile', name: 'Japanese profile', createdAt: new Date().toISOString() });
    await data.saveSetting('japanese-profile', 'locale', 'ja');
  });
  const other = await context.newPage(); await other.goto('/settings');
  await selectPicker(other, '当前档案', 'japanese-profile'); await requested;
  await selectPicker(other, languagePacks.ja.profileBackup.profile, 'local-guest');
  await expect(page.locator('.profile-backup .setting-trigger')).toHaveAttribute('data-value', 'local-guest');
  const response = page.waitForResponse(/\/src\/locales\/ja\/teaching\.json/);
  release(); await (await response).finished();
  await page.evaluate("import('/src/locales/teaching.ts').then(module => module.loadInstructionLocale('ja'))");
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hans');
  expect(await page.pageErrors()).toEqual([]);
});

for (const [locale, profileLabel, exportLabel, importLabel, copyLabel, done] of [
  ['zh-Hans', '当前档案', '下载备份', '导入为新档案', '复制当前档案用于此账号', '已建立新档案并导入记录。'],
  ['en', 'Current profile', 'Download backup', 'Import as new profile', 'Copy the current profile for this account', 'New profile created and records imported.'],
  ['ar', 'الملف الحالي', 'تنزيل النسخة الاحتياطية', 'استيراد كملف جديد', 'نسخ الملف الحالي لهذا الحساب', 'أُنشئ ملف جديد واستُوردت السجلات.'],
]) test(`repeated restore and account copy keep a long Unicode profile recoverable in ${locale}`, async ({ page }) => {
  test.setTimeout(90_000);
  let syncWrites = 0;
  await page.route('**/api/session', route => route.fulfill({ json: { account: { id: 1, login: 'learner' }, csrfToken: 'c'.repeat(43), syncAvailable: false, bindings: [] } }));
  page.on('request', request => { if (request.method() === 'POST' && new URL(request.url()).pathname.startsWith('/api/sync/')) syncWrites++; });
  const { lesson } = await openSnapshot(page, 'a1-reading', true);
  await completeWorkspace(page, lesson);
  await page.getByRole('link', { name: '离开任务' }).click();
  await page.goto('/settings');
  const name = "Reading and listening practice · Personal learning profile · Daily review record";
  await page.evaluate(async name => { const path = '/src/data/db.ts'; const data = await import(path); await data.profiles.update('local-guest', { name }); }, name);
  await page.reload();
  if (locale !== 'zh-Hans') await selectPicker(page, '语言', locale);
  const download = async () => {
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: exportLabel, exact: true }).click();
    await page.getByRole('dialog').getByRole('textbox').fill(name);
    await page.getByRole('dialog').getByRole('button', { name: languagePacks[locale as keyof typeof languagePacks].profileBackup.save, exact: true }).click();
    const downloaded = await pending;
    expect(downloaded.suggestedFilename()).toBe(`${name}.zip`);
    const bytes = await readFile((await downloaded.path())!);
    const files = unzipSync(bytes), decode = (file: string) => JSON.parse(new TextDecoder().decode(files[file]));
    const manifest = decode('manifest.json');
    expect(manifest.profileName).toBe(name);
    expect(manifest.profileName.length).toBeLessThanOrEqual(80);
    expect(new TextDecoder().decode(new TextEncoder().encode(manifest.profileName))).toBe(manifest.profileName);
    return { bytes, lesson: decode('sessions.json')[0].lesson, answers: decode('attempts.json').map(({ answer, questionId, rootId, correct, rule, assistance, submittedAt }: Record<string, unknown>) => ({ answer, questionId, rootId, correct, rule, assistance, submittedAt })) };
  };
  const restore = async (bytes: Buffer) => {
    const chooser = page.waitForEvent('filechooser');
    await page.locator('.backup-file-button').click();
    await (await chooser).setFiles({ name: 'synthetic-profile.zip', mimeType: 'application/zip', buffer: bytes });
    await expect(page.locator('.backup-preview')).toContainText(name);
    await page.getByRole('button', { name: importLabel, exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: done })).toBeVisible();
    await expect(page.getByRole('button', { name: new RegExp(`^${profileLabel}:`) })).toContainText(name);
  };
  const original = await download();
  expect(original.answers).toHaveLength(2);
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.setViewportSize({ width: colorScheme === 'light' ? 1440 : 375, height: 900 });
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await restore((await download()).bytes);
    await page.getByRole('button', { name: copyLabel, exact: true }).click();
    await expect(page.locator('.repository-binding')).toBeVisible();
    const copied = await download();
    expect(copied.lesson).toEqual(original.lesson);
    expect(copied.answers).toEqual(original.answers);
    await restore(copied.bytes);
    const picker = page.getByRole('button', { name: new RegExp(`^${profileLabel}:`) });
    await picker.focus(); await picker.press('Enter');
    const selected = page.getByRole('option', { selected: true });
    await expect(selected).toBeVisible();
    await expect.poll(() => selected.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    await picker.press('Escape'); await expect(picker).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `output/playwright/backup-long-name-${locale}-${colorScheme}.png`, fullPage: true });
  }
  expect(await page.evaluate(async () => { const path = '/src/data/db.ts'; const data = await import(path); return { name: (await data.profiles.get('local-guest')).name, answers: await data.attempts.where('profileId').equals('local-guest').count() }; })).toEqual({ name, answers: 2 });
  expect(syncWrites).toBe(0);
});

for (const locale of ['zh-Hans', 'en', 'ar'] as const) test(`backup filename dialog supports time defaults, custom names and cancellation: ${locale}`, async ({ page }) => {
  const t = languagePacks[locale].profileBackup;
  await page.goto('/settings');
  await expect(page.locator('.profile-backup .setting-trigger')).toBeVisible();
  if (locale !== 'zh-Hans') await selectPicker(page, '语言', locale);
  await page.clock.setFixedTime(new Date('2026-10-24T01:02:03+08:00'));
  const trigger = page.getByRole('button', { name: t.export, exact: true });
  const dialog = page.getByRole('dialog', { name: t.exportTitle, exact: true });
  const input = dialog.getByRole('textbox', { name: t.fileName, exact: true });
  const filenames: string[] = [];
  page.on('download', download => filenames.push(download.suggestedFilename()));
  for (const [width, colorScheme] of [[1440, 'light'], [375, 'dark'], [320, 'dark']] as const) {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ colorScheme, reducedMotion: width === 375 ? 'reduce' : 'no-preference' });
    const actions = await page.locator('.profile-backup .backup-actions>button,.profile-backup .backup-file-button').evaluateAll(elements => elements.map(element => { const rect = element.getBoundingClientRect(); return { top: rect.top, width: rect.width, height: rect.height }; }));
    expect(actions).toHaveLength(3);
    expect(actions.every(action => action.width >= 44 && action.height >= 44 && Math.abs(action.top - actions[0].top) < 1)).toBe(true);
    await trigger.click();
    await expect(input).toHaveValue('');
    await expect(input).toHaveAttribute('placeholder', 'lingfern-2026-10-24');
    expect(await input.evaluate(element => ({ start: (element as HTMLInputElement).selectionStart, end: (element as HTMLInputElement).selectionEnd }))).toEqual({ start: 0, end: 0 });
    await expect(input).toHaveAttribute('data-default', 'true');
    await expect(input).toBeFocused();
    expect(await input.evaluate(element => getComputedStyle(element, '::placeholder').color)).toBe(await dialog.locator('.muted').evaluate(element => getComputedStyle(element).color));
    expect(await input.evaluate(element => getComputedStyle(element).borderTopWidth)).toBe('0px');
    await expect(input).toHaveCSS('font-size', '15px');
    await expect(input).toHaveCSS('font-weight', '600');
    expect(await dialog.getByRole('button').evaluateAll(buttons => buttons.every(button => button.getBoundingClientRect().height >= 44))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `output/playwright/backup-export-${locale}-${width}-${colorScheme}.png` });
    if (width === 1440) await page.keyboard.press('Escape');
    else await dialog.getByRole('button', { name: t.cancel, exact: true }).click();
    await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
  }
  expect(filenames).toEqual([]);
  const save = async (value?: string) => {
    await trigger.click();
    if (value !== undefined) await input.pressSequentially(value);
    const pending = page.waitForEvent('download');
    await dialog.getByRole('button', { name: t.save, exact: true }).click();
    const download = await pending;
    await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
    const files = unzipSync(await readFile((await download.path())!));
    const selectedName = download.suggestedFilename().slice(0, -4);
    expect(JSON.parse(new TextDecoder().decode(files['manifest.json'])).profileName).toBe(selectedName);
    await page.getByLabel(t.choose).setInputFiles({ name: 'manually-renamed.zip', mimeType: 'application/zip', buffer: await readFile((await download.path())!) });
    await expect(page.locator('.backup-preview strong')).toHaveText(`${t.preview}：${selectedName}`);
    await page.getByRole('button', { name: t.import, exact: true }).click();
    const picker = page.locator('.profile-backup .setting-trigger');
    await expect(picker).toHaveAttribute('aria-label', `${t.profile}: ${selectedName}`);
    await page.reload();
    await expect(picker).toHaveAttribute('aria-label', `${t.profile}: ${selectedName}`);
    return download.suggestedFilename();
  };
  expect(await save()).toBe('lingfern-2026-10-24.zip');
  expect(await save('英语学习 2026-10-23.ZIP')).toBe('英语学习 2026-10-23.zip');
  expect(await save('   ')).toBe('lingfern-2026-10-24.zip');
  expect(await save('My Local profile 2026-10-23')).toBe('My Local profile 2026-10-23.zip');
  expect(await save('Local profile')).toBe('Local profile.zip');
  await trigger.click();
  await input.fill('../invalid');
  await dialog.getByRole('button', { name: t.save, exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText(t.invalidName);
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  await input.fill('My backup');
  await expect(input).toHaveAttribute('data-default', 'false');
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  const pending = page.waitForEvent('download');
  await input.press('Enter');
  expect((await pending).suggestedFilename()).toBe('My backup.zip');
  expect(filenames).toHaveLength(6);
  expect(await page.pageErrors()).toEqual([]);
});

for (const locale of ['zh-Hans', 'zh-Hant'] as const) test(`backup copy wraps complete Chinese words: ${locale}`, async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 812 });
  await page.goto('/settings');
  if (locale === 'zh-Hant') await selectPicker(page, '语言', locale);
  const backup = page.locator('.profile-backup');
  await expect(backup).toBeVisible();
  const split = await backup.evaluate((element, traditional) => {
    const problems: string[] = [];
    for (const [selector, word] of [['>p.muted', traditional ? '錄音' : '录音'], ['.backup-file-button', traditional ? '還原' : '恢复']]) {
      const target = selector.startsWith('>') ? element.querySelector(':scope ' + selector) : element.querySelector(selector);
      if (!target) throw new Error('Missing backup copy');
      const start = target.textContent!.indexOf(word); if (start < 0) throw new Error('Missing word');
      const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT), range = document.createRange();
      let node: Node | null, offset = 0;
      while ((node = walker.nextNode())) {
        const length = node.textContent!.length;
        if (start >= offset && start < offset + length) range.setStart(node, start - offset);
        if (start + word.length > offset && start + word.length <= offset + length) { range.setEnd(node, start + word.length - offset); break; }
        offset += length;
      }
      const lines = new Set([...range.getClientRects()].filter(rect => rect.width > 0).map(rect => Math.round(rect.top)));
      if (lines.size !== 1) problems.push(word);
    }
    return problems;
  }, locale === 'zh-Hant');
  expect(split).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `output/playwright/backup-word-wrap-${locale}-320.png`, fullPage: true });
});
