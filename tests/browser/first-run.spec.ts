import { expect, test } from '@playwright/test';
import { selectPicker } from './picker';
import { languagePacks } from '../../src/locales';

test('first site visit opens starting choices once, then Settings owns the edit entry', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/introduction$/);
  await expect(page.locator('.welcome')).toBeVisible();
  await page.locator('.welcome-start').click();
  await expect(page.getByRole('heading', { name: '界面语言', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '跳过这一步' }).click();
  await expect(page.getByRole('heading', { name: '你想用英语做什么？' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '你想用英语做什么？' })).toBeVisible();
  for (let index = 0; index < 4; index++) await page.getByRole('button', { name: '跳过这一步' }).click();
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByRole('link', { name: /调整起点与兴趣/ })).toHaveCount(0);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/today$/);
  await page.getByRole('link', { name: '设置', exact: true }).first().click();
  const edit = page.getByRole('link', { name: /调整起点与兴趣/ });
  const dictionary = page.getByRole('button', { name: '默认在线词典' });
  expect((await edit.boundingBox())!.y).toBeGreaterThan((await dictionary.boundingBox())!.y);
  expect((await edit.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await edit.click();
  await expect(page).toHaveURL(/\/start$/);
});

test('first run saves optional choices, resumes and changes separate task recommendations without growth', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/start');
  await expect(page.getByRole('heading', { name: '界面语言', exact: true })).toBeFocused();
  await expect(page.locator('.mobile-nav')).toHaveCount(0);
  await page.getByRole('button', { name: '保存并继续', exact: true }).click();
  await page.getByRole('radio', { name: '旅行', exact: true }).check();
  await page.getByRole('button', { name: '保存并继续', exact: true }).click();
  await page.getByRole('checkbox', { name: '科学', exact: true }).check();
  await page.getByRole('button', { name: '保存并继续', exact: true }).click();
  await expect(page.getByRole('heading', { name: '你选择的阅读与听力起点' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '你选择的阅读与听力起点' })).toBeVisible();
  await page.getByRole('group', { name: '阅读', exact: true }).getByRole('radio', { name: /^C2/ }).check();
  await page.getByRole('group', { name: '听力', exact: true }).getByRole('radio', { name: /^A1/ }).check();
  await page.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(...args) {
      if (this.name === 'profiles') { IDBObjectStore.prototype.put = put; throw new DOMException('Synthetic quota failure', 'QuotaExceededError'); }
      return put.apply(this, args);
    };
  });
  await page.getByRole('button', { name: '保存并继续', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('未能保存');
  await expect(page.getByRole('heading', { name: '你选择的阅读与听力起点' })).toBeVisible();
  await page.getByRole('button', { name: '保存并继续', exact: true }).click();
  await expect(page.getByRole('heading', { name: '试一份简短任务' })).toBeVisible();
  await page.getByRole('button', { name: '上一步' }).click();
  await expect(page.getByRole('group', { name: '阅读', exact: true }).getByRole('radio', { name: /^C2/ })).toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'output/playwright/first-run-320-light-zh-Hans-step4.png' });
  await page.getByRole('button', { name: '保存并继续', exact: true }).click();
  await page.getByRole('button', { name: '保存并前往今日' }).click();
  await expect(page).toHaveURL(/\/today$/);
  await page.locator('.primary-task.reading-task').getByRole('button', { name: '开始', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: '保留分歧与责任', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '关闭详情' }).click();
  const preferences = await page.evaluate(async () => (await (await import('/src/data/db.ts' as string)).profiles.get('local-guest')).preferences);
  expect(preferences).toMatchObject({ reading: 'C2', listening: 'A1', interests: ['science'], purpose: 'travel', completed: true });
  expect(await page.evaluate(async () => (await import('/src/data/db.ts' as string)).attempts.count())).toBe(0);
});

test('skipped choices stay unspecified and the English demonstration starts a real task', async ({ page }) => {
  await page.goto('/start');
  await selectPicker(page, '界面语言', 'en');
  for (let index = 0; index < 4; index++) await page.getByRole('button', { name: 'Skip this step' }).click();
  await expect(page.getByRole('heading', { name: 'Try a short task' })).toBeVisible();
  await page.getByRole('button', { name: 'Try reading', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Where do we meet?' })).toBeVisible();
  await page.getByRole('radio', { name: 'At the library.', exact: true }).check();
  await page.getByRole('button', { name: 'Save answer', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Correct/ })).toBeVisible();
  const preferences = await page.evaluate(async () => (await (await import('/src/data/db.ts' as string)).profiles.get('local-guest')).preferences);
  expect(preferences.reading).toBeUndefined(); expect(preferences.listening).toBeUndefined(); expect(preferences.purpose).toBeUndefined();
});

test('first run supports Traditional Chinese, dark mode, six widths and enlarged text', async ({ page }) => {
  await page.goto('/settings');
  await selectPicker(page, '语言', 'zh-Hant');
  await selectPicker(page, '外觀', 'dark');
  await page.goto('/start');
  for (let index = 0; index < 3; index++) {
    await page.getByRole('button', { name: '跳過這一步' }).click();
    await expect(page.locator('.first-run-top span')).toHaveText(`第 ${index + 2} 步，共 5 步`);
  }
  for (const width of [1440, 1200, 1024, 768, 375, 320]) {
    await page.setViewportSize({ width, height: 720 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator('.first-run-choices label').evaluateAll(labels => labels.every(label => label.getBoundingClientRect().height >= 44))).toBe(true);
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: '儲存並繼續', exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: '儲存並繼續', exact: true })).toBeVisible();
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
  await page.getByRole('heading', { name: '你選擇的閱讀與聽力起點' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'output/playwright/first-run-320-dark-zh-Hant-step4.png' });
});

test('storage failure offers an explicitly unsaved example without creating a profile or response', async ({ page }) => {
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(...args) {
      if (this.name === 'profiles') throw new DOMException('Synthetic storage failure', 'QuotaExceededError');
      return put.apply(this, args);
    };
  });
  await page.goto('/start');
  await page.getByRole('button', { name: '试用不保存的阅读示例', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('回答不会保存');
  await page.getByRole('radio', { name: 'At the library.', exact: true }).check();
  await page.getByRole('button', { name: '查看反馈' }).click();
  await expect(page.getByRole('heading', { name: '回答正确', exact: true })).toBeVisible();
  expect(await page.evaluate(async () => (await import('/src/data/db.ts' as string)).attempts.count())).toBe(0);
  expect(await page.evaluate(async () => (await import('/src/data/db.ts' as string)).profiles.count())).toBe(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: '回答正确', exact: true })).toHaveCount(0);
});


for (const [locale, width, theme] of [['zh-Hans', 1440, 'light'], ['zh-Hant', 375, 'dark'], ['en', 320, 'light']] as const) test(`editing and clearing optional starting choices survives reload (${locale})`, async ({ page }) => {
  const t = languagePacks[locale].firstRun_firstRunCopy;
  await page.setViewportSize({ width, height: 800 });
  await page.goto('/settings');
  await selectPicker(page, '语言', locale);
  await selectPicker(page, languagePacks[locale].app.theme, theme);
  await page.getByRole('link', { name: t.edit, exact: true }).click();
  await page.getByRole('button', { name: t.next, exact: true }).click();
  await page.getByRole('radio', { name: t.purposes[3], exact: true }).check();
  await page.getByRole('button', { name: t.next, exact: true }).click();
  await page.locator('.first-run-choices input[type=checkbox]').first().check();
  await page.getByRole('button', { name: t.next, exact: true }).click();
  await page.getByRole('group', { name: t.reading, exact: true }).getByRole('radio', { name: /^B2/ }).check();
  await page.getByRole('group', { name: t.listening, exact: true }).getByRole('radio', { name: /^A2/ }).check();
  await page.getByRole('button', { name: t.next, exact: true }).click();
  await page.getByRole('button', { name: t.today, exact: true }).click();
  await expect(page.getByRole('heading', { name: languagePacks[locale].app.today, exact: true })).toBeVisible();
  await page.getByRole('link', { name: languagePacks[locale].app.settings, exact: true }).first().click();
  await page.getByRole('link', { name: t.edit, exact: true }).click();
  await page.getByRole('button', { name: t.next, exact: true }).click();
  await page.getByRole('radio', { name: t.unsure, exact: true }).check();
  await page.getByRole('button', { name: t.next, exact: true }).click();
  await page.locator('.first-run-choices input[type=checkbox]').first().uncheck();
  await page.getByRole('button', { name: t.next, exact: true }).click();
  for (const skill of ['reading', 'listening'] as const) await page.getByRole('group', { name: t[skill], exact: true }).getByRole('radio', { name: t.unsure, exact: true }).check();
  await page.getByRole('button', { name: t.next, exact: true }).click();
  await page.getByRole('button', { name: t.today, exact: true }).click();
  await expect(page).toHaveURL(/\/today$/);
  await page.reload();
  await expect(page.getByRole('heading', { name: languagePacks[locale].app.today, exact: true })).toBeVisible();
  await expect(page.locator('main > .error')).toHaveCount(0);
  const saved = await page.evaluate(async () => (await (await import('/src/data/db.ts' as string)).profiles.get('local-guest')).preferences);
  expect(saved).toEqual({ interests: [], step: 4, completed: true });
  // Recover affected IndexedDB rows without rewriting immutable events.
  const original = await page.evaluate(async () => {
    const { profiles, syncEvents } = await import('/src/data/db.ts' as string);
    const preferences = { interests: [], step: 4, completed: true, purpose: undefined, reading: undefined, listening: undefined };
    await profiles.update('local-guest', { preferences });
    const rows: import('../../src/data/sync').StoredEvent[] = await syncEvents.where('profileId').equals('local-guest').toArray();
    const event = rows.filter(row => row.type === 'preferences').sort((a, b) => b.counter - a.counter)[0];
    await syncEvents.update(['local-guest', event.id], { payload: preferences });
    return await syncEvents.where('profileId').equals('local-guest').toArray();
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: languagePacks[locale].app.today, exact: true })).toBeVisible();
  await expect(page.locator('main > .error')).toHaveCount(0);
  expect(await page.evaluate(async () => (await import('/src/data/db.ts' as string)).syncEvents.where('profileId').equals('local-guest').toArray())).toEqual(original);
  await page.screenshot({ path: `output/playwright/preferences-revisit-${width}-${theme}-${locale}.png` });
});
