import { confirmTask } from './task-start';
import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { selectPicker } from './picker';
import { unzipSync } from 'fflate';

for (const [locale, profileLabel, exportLabel, importLabel, copyLabel, done] of [
  ['zh-Hans', '当前档案', '下载备份', '导入为新档案', '复制当前档案用于此账号', '已建立新档案并导入记录。'],
  ['en', 'Current profile', 'Download backup', 'Import as new profile', 'Copy the current profile for this account', 'New profile created and records imported.'],
  ['ar', 'الملف الحالي', 'تنزيل النسخة الاحتياطية', 'استيراد كملف جديد', 'نسخ الملف الحالي لهذا الحساب', 'أُنشئ ملف جديد واستُوردت السجلات.'],
]) test(`repeated restore and account copy keep a long Unicode profile recoverable in ${locale}`, async ({ page }) => {
  test.setTimeout(90_000);
  let syncWrites = 0;
  await page.route('**/api/session', route => route.fulfill({ json: { account: { id: 1, login: 'learner' }, csrfToken: 'c'.repeat(43), syncAvailable: false, bindings: [] } }));
  page.on('request', request => { if (request.method() === 'POST' && new URL(request.url()).pathname.startsWith('/api/sync/')) syncWrites++; });
  await page.goto('/today');
  await page.locator('.primary-task.reading-task').getByRole('button', { name: '开始', exact: true }).click(); await confirmTask(page);
  await page.getByRole('radio', { name: 'At the library.' }).check();
  await page.getByRole('button', { name: '保存答案', exact: true }).click();
  await page.getByRole('link', { name: '离开任务' }).click();
  await page.goto('/settings');
  const name = "Reading and listening practice · Personal learning profile · Daily review record";
  await page.evaluate(async name => { const path = '/src/data/db.ts'; const data = await import(path); await data.profiles.update('local-guest', { name }); }, name);
  await page.reload();
  if (locale !== 'zh-Hans') await selectPicker(page, '语言', locale);
  const download = async () => {
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: exportLabel, exact: true }).click();
    const bytes = await readFile((await (await pending).path())!);
    const files = unzipSync(bytes), decode = (file: string) => JSON.parse(new TextDecoder().decode(files[file]));
    const manifest = decode('manifest.json');
    expect(manifest.profileName.length).toBeLessThanOrEqual(80);
    expect(new TextDecoder().decode(new TextEncoder().encode(manifest.profileName))).toBe(manifest.profileName);
    return { bytes, lesson: decode('sessions.json')[0].lesson, answers: decode('attempts.json').map(({ answer, questionId, rootId, correct, rule, assistance, submittedAt }: Record<string, unknown>) => ({ answer, questionId, rootId, correct, rule, assistance, submittedAt })) };
  };
  const restore = async (bytes: Buffer) => {
    const chooser = page.waitForEvent('filechooser');
    await page.locator('.backup-file-button').click();
    await (await chooser).setFiles({ name: 'synthetic-profile.zip', mimeType: 'application/zip', buffer: bytes });
    await expect(page.locator('.backup-preview')).toBeVisible();
    await page.getByRole('button', { name: importLabel, exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: done })).toBeVisible();
  };
  const original = await download();
  expect(original.answers).toHaveLength(1);
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
    const picker = page.getByRole('button', { name: profileLabel, exact: true });
    await picker.focus(); await picker.press('Enter');
    expect(await page.getByRole('option', { selected: true }).evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    await picker.press('Escape'); await expect(picker).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `output/playwright/backup-long-name-${locale}-${colorScheme}.png`, fullPage: true });
  }
  expect(await page.evaluate(async () => { const path = '/src/data/db.ts'; const data = await import(path); return { name: (await data.profiles.get('local-guest')).name, answers: await data.attempts.where('profileId').equals('local-guest').count() }; })).toEqual({ name, answers: 1 });
  expect(syncWrites).toBe(0);
});

test('downloads a local ZIP and restores answers into a separate profile while offline', async ({ page, context }) => {
  await page.goto('/today');
  await page.locator('.primary-task.reading-task').getByRole('button', { name: '开始', exact: true }).click(); await confirmTask(page);
  await page.getByRole('radio', { name: 'At the library.' }).check();
  await page.getByRole('button', { name: '保存答案', exact: true }).click();
  await page.getByRole('link', { name: '离开任务' }).click();
  await page.getByRole('link', { name: '设置', exact: true }).click();
  await context.setOffline(true);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载备份' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^lingfern-backup-.*\.zip$/);
  const bytes = await readFile((await file.path())!);
  await expect(page.locator('.backup-file-button')).toBeVisible();
  const chooser = page.waitForEvent('filechooser');
  await page.locator('.backup-file-button').click();
  await (await chooser).setFiles({ name: 'saved.zip', mimeType: 'application/zip', buffer: bytes });
  await expect(page.locator('.backup-file-name')).toHaveText('saved.zip');
  await expect(page.getByText('待导入：本机档案')).toBeVisible();
  await expect(page.locator('.backup-preview')).toContainText('任务 1 · 作答 1');
  await page.getByRole('button', { name: '导入为新档案' }).click();
  await expect(page.getByRole('status').filter({ hasText: '已建立新档案并导入记录。' })).toBeVisible();
  const current = await page.getByRole('button', { name: '当前档案' }).getAttribute('data-value');
  expect(current).not.toBe('local-guest');
  await page.getByRole('link', { name: '今日', exact: true }).click(); await page.getByRole('link', { name: '历史记录', exact: true }).click();
  await expect(page.locator('.totals dd').first()).toHaveText('1');
  await page.getByRole('link', { name: '设置', exact: true }).click();
  await selectPicker(page, '当前档案', 'local-guest');
  await page.getByRole('link', { name: '今日', exact: true }).click(); await page.getByRole('link', { name: '历史记录', exact: true }).click();
  await expect(page.locator('.totals dd').first()).toHaveText('1');
});
