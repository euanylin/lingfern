import { expect, test } from '@playwright/test';
import { messages } from '../../src/locales';
import type { Locale } from '../../src/shared/content';

test.use({ hasTouch: true });

for (const [width, locale, theme] of [[375, 'en', 'light'], [320, 'zh-Hans', 'dark'], [1440, 'ar', 'dark']] as const) test(`practice choices reuse controls and persist at ${width}/${locale}/${theme}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 812 });
  await page.goto('/settings');
  await expect(page.locator('.settings-page')).toBeVisible();
  await page.evaluate(async ({ locale, theme }) => {
    const path = '/src/data/db.ts', data = await import(path);
    const id = (await data.settings.get('activeProfile'))?.value ?? 'local-guest';
    await data.savePreferences(id, { reading: 'B2', listening: 'A1', interests: [], step: 4, completed: true }, locale);
    await data.saveSetting(id, 'theme', theme);
  }, { locale, theme });
  await page.goto('/today');
  if (width === 1440) await page.emulateMedia({ reducedMotion: 'reduce' });
  const t = messages('practiceOptions')[locale as Locale];
  const card = page.locator('.primary-task:not(.reading-task):not(.combined-training)').first();
  const button = card.getByRole('button', { name: t.listeningSettings, exact: true });
  if (width < 768) await button.tap(); else { await button.focus(); await page.keyboard.press('Enter'); }
  const dialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: new RegExp(t.listeningSettings) }) });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS('opacity', '1');
  const topic = dialog.locator('.practice-option-fields .setting-trigger').first();
  await topic.click();
  await dialog.locator('[role=option][data-value=science]').click();
  await dialog.locator('[role=option][data-value=daily-life]').click();
  await expect(dialog.getByRole('listbox')).toHaveAttribute('aria-multiselectable', 'true');
  await expect(dialog.locator('[role=option][aria-selected=true]')).toHaveCount(2);
  await topic.click();
  const kind = dialog.getByRole('button', { name: t.kind, exact: true });
  await kind.click();
  const menu = dialog.getByRole('listbox');
  expect(await menu.evaluate(element => { const menu = element.getBoundingClientRect(), panel = element.closest('.task-detail-body')!.getBoundingClientRect(); return menu.left >= panel.left && menu.right <= panel.right && menu.top >= panel.top && menu.bottom <= panel.bottom; })).toBe(true);
  await dialog.locator('[role=option][data-value=completion]').click();
  await expect(menu).toHaveAttribute('aria-multiselectable', 'true');
  await dialog.locator('[role=option][data-value=choice]').click();
  await expect(dialog.locator('[role=option][aria-selected=true]')).toHaveCount(2);
  await kind.click();
  expect(await kind.locator('bdi').evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThan(60);
  for (const word of ['cat', 'bed']) {
    await dialog.getByRole('searchbox', { name: t.search }).fill(word);
    await expect(dialog.getByRole('searchbox', { name: t.search })).toHaveValue(word);
    await dialog.getByRole('checkbox', { name: word, exact: true }).check();
  }
  await dialog.getByRole('searchbox', { name: t.search }).fill('');
  expect(await dialog.evaluate(element => { const rect = element.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight && element.scrollWidth <= element.clientWidth; })).toBe(true);
  await expect(dialog.getByRole('button', { name: t.save, exact: true })).toHaveCount(0);
  expect(await dialog.locator('.practice-option-fields').evaluate(element => { const [first, second] = [...element.children].map(child => child.getBoundingClientRect()); return Math.abs(first.top - second.top) < 1 && Math.abs(first.left - second.left) > 100; })).toBe(true);
  expect(await dialog.locator('.practice-material-search').evaluate(element => { const [automatic, search] = [...element.children].map(child => child.getBoundingClientRect()); return Math.abs(automatic.top - search.top) < 1 && automatic.height >= 44 && search.height >= 44; })).toBe(true);
  if (width < 768) { const size = await dialog.boundingBox(); expect(size!.width).toBe(width); expect(size!.height).toBe(812); }
  await page.screenshot({ path: `output/playwright/practice-options-${width}-${locale}-${theme}.png` });
  await dialog.getByRole('button', { name: t.cancel, exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(button).toHaveAccessibleName(t.listeningSettings);
  await expect(button.locator('span').first()).toHaveText(t.listeningSettings);
  await expect(button.locator('span').first()).toHaveCSS('color', theme === 'light' ? 'rgb(83, 111, 91)' : 'rgb(168, 187, 163)');
  await button.click();
  await expect(topic).toHaveAttribute('data-value', 'science,daily-life');
  await expect(dialog.getByRole('button', { name: t.kind, exact: true })).toHaveAttribute('data-value', 'completion,choice');
  await expect(dialog.getByRole('checkbox', { name: 'cat', exact: true })).toBeChecked();
  await expect(dialog.getByRole('checkbox', { name: 'bed', exact: true })).toBeChecked();
  await dialog.getByRole('button', { name: t.cancel, exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const width of [1440, 900, 375]) test(`settings keep full-card mouse hover blur after selections and typing at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/today');
  await page.mouse.move(-10, -10);
  const trigger = page.locator('[data-practice-skill=reading]').first();
  await trigger.focus(); await trigger.press('Enter');
  const dialog = page.locator('.practice-options-dialog');
  await expect(dialog).toHaveCSS('opacity', '1');
  await expect(dialog).toHaveAttribute('data-blur', 'false');
  const box = (await dialog.boundingBox())!;
  await page.mouse.move(box.x + 2, box.y + 80);
  await expect(dialog).toHaveAttribute('data-blur', 'true');
  await dialog.locator('.setting-trigger').first().click();
  await dialog.getByRole('option').first().click();
  await dialog.locator('.setting-trigger').first().click();
  await expect(dialog).toHaveAttribute('data-blur', 'true');
  await dialog.getByRole('searchbox').fill('the');
  await expect(dialog).toHaveAttribute('data-blur', 'true');
  await page.waitForTimeout(250);
  await expect(dialog).toHaveAttribute('data-blur', 'true');
  await page.mouse.move(-10, -10);
  await expect(dialog).toHaveAttribute('data-blur', 'false');
  await dialog.getByRole('searchbox').fill('');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

test('unavailable choices remain visible and can be cleared without changing another skill', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.locator('.settings-page')).toBeVisible();
  await page.evaluate(async () => {
    const path = '/src/data/db.ts', data = await import(path);
    const id = (await data.settings.get('activeProfile'))?.value ?? 'local-guest';
    await data.savePreferences(id, { listening: 'A1', interests: [], step: 4, completed: true }, 'en');
    await data.saveSetting(id, 'listeningPractice', JSON.stringify({ kind: 'completion', materials: ['removed-work', 'ipa-word-cat'] }));
  });
  await page.goto('/today');
  const card = page.locator('.primary-task:not(.reading-task):not(.combined-training)').first();
  await card.getByRole('button', { name: 'Listening settings', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('checkbox', { name: 'Unavailable material · removed-work', exact: true })).toBeChecked();
  await dialog.getByRole('checkbox', { name: 'Unavailable material · removed-work', exact: true }).uncheck();
  await expect(dialog.getByText(messages('practiceOptions').en.materialHint, { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Automatic', exact: true }).click();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const values = await page.evaluate(async () => {
    const path = '/src/data/db.ts', data = await import(path);
    const id = (await data.settings.get('activeProfile'))?.value ?? 'local-guest';
    return Object.fromEntries((await data.projectPreferences(id)).values);
  });
  expect(JSON.parse(values.listeningPractice)).toEqual({ topics: [], kinds: ['completion'], materials: [] });
  expect(values.readingPractice).toBeUndefined();
});

for (const skill of ['reading', 'listening'] as const) test(`${skill} topics migrate a legacy choice, toggle independently and reset to Automatic`, async ({ page }) => {
  await page.goto('/settings');
  await expect(page.locator('.settings-page')).toBeVisible();
  await page.evaluate(async skill => {
    const path = '/src/data/db.ts', data = await import(path), id = (await data.settings.get('activeProfile'))?.value ?? 'local-guest';
    await data.savePreferences(id, { reading: 'B2', listening: 'A1', interests: [], step: 4, completed: true }, 'en');
    await data.saveSetting(id, `${skill}Practice`, JSON.stringify({ topic: 'science', kinds: [], materials: [] }));
  }, skill);
  await page.goto('/today');
  const button = page.locator(`[data-practice-skill=${skill}]`).first(), dialog = page.locator('.practice-options-dialog'), topic = dialog.locator('.practice-option-fields .setting-trigger').first();
  await button.click();
  await expect(topic).toHaveAttribute('data-value', 'science');
  await topic.click();
  await expect(dialog.getByRole('listbox')).toHaveAttribute('aria-multiselectable', 'true');
  await dialog.locator('[role=option][data-value=travel]').click();
  await dialog.locator('[role=option][data-value=science]').click();
  await expect(topic).toHaveAttribute('data-value', 'travel');
  await dialog.locator('[role=option][data-value=science]').click();
  await topic.click();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload(); await button.click();
  await expect(topic).toHaveAttribute('data-value', 'travel,science');
  await topic.click();
  await expect(dialog.locator('[role=option][aria-selected=true]')).toHaveCount(2);
  await dialog.locator('[role=option][data-value=""]').click();
  await expect(topic).toHaveAttribute('data-value', '');
  await expect(dialog.locator('[role=option][aria-selected=true]')).toHaveCount(1);
  await topic.click(); await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toHaveCount(0); await page.reload();
  await expect(button).toHaveAttribute('data-configured', 'false');
});


test('shared menus close on page or drawer scroll but keep their own options scrollable', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 500 });
  await page.goto('/settings');
  await page.locator('.settings-language .setting-trigger').click();
  const menu = page.getByRole('listbox');
  await menu.hover();
  await page.mouse.wheel(0, 160);
  await expect.poll(() => menu.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  await expect(menu).toBeVisible();
  await page.mouse.move(372, 400);
  await page.mouse.wheel(0, 150);
  await expect(menu).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
  await page.evaluate(async () => {
    const path = '/src/data/db.ts', data = await import(path);
    const id = (await data.settings.get('activeProfile'))?.value ?? 'local-guest';
    await data.savePreferences(id, { listening: 'A1', interests: [], step: 4, completed: true }, 'zh-Hans');
  });
  await page.goto('/today');
  await page.locator('[data-practice-skill=listening]').first().click();
  const dialog = page.locator('.practice-options-dialog');
  await expect(dialog).toHaveCSS('opacity', '1');
  await dialog.locator('.setting-trigger').last().click();
  await expect(menu).toBeVisible();
  await page.mouse.move(372, 400);
  await page.mouse.wheel(0, 180);
  await expect(menu).toHaveCount(0);
  await expect.poll(() => dialog.locator('.task-detail-body').evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  await dialog.locator('.setting-trigger').last().click();
  await expect(menu).toBeVisible();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 372, y: 400 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 372, y: 300 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(menu).toHaveCount(0);
  await cdp.detach();
});

test('automatic saves report a failed write and retry the latest rapid multi-selection', async ({ page }) => {
  await page.goto('/today');
  await page.locator('[data-practice-skill=reading]').first().click();
  const dialog = page.locator('.practice-options-dialog');
  await page.evaluate(async () => {
    const path = '/src/data/db.ts', data = await import(path), put = data.settings.put.bind(data.settings);
    data.settings.put = async (entry: { key: string; value: string }) => {
      if (entry.key.endsWith(':readingPractice')) { data.settings.put = put; throw new DOMException('Test quota failure', 'QuotaExceededError'); }
      return put(entry);
    };
  });
  await dialog.locator('.setting-trigger').last().click();
  await dialog.locator('[role=option][data-value=completion]').click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await dialog.locator('[role=option][data-value=choice]').click();
  await dialog.locator('[role=option][data-value=matching]').click();
  await dialog.locator('.setting-trigger').last().click();
  await dialog.getByRole('button', { name: messages('practiceOptions')['zh-Hans'].cancel, exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await page.locator('[data-practice-skill=reading]').first().click();
  await expect(dialog.locator('.setting-trigger').last()).toHaveAttribute('data-value', 'completion,choice,matching');
  await expect(dialog.getByRole('alert')).toHaveCount(0);
});

for (const skill of ['reading', 'listening'] as const) test(`${skill} material choices do not rescan the corpus while saving or searching`, async ({ page }) => {
  await page.goto('/settings');
  await expect(page.locator('.settings-page')).toBeVisible();
  await page.evaluate(async () => {
    const path = '/src/data/db.ts', data = await import(path);
    const id = (await data.settings.get('activeProfile'))?.value ?? 'local-guest';
    await data.savePreferences(id, { reading: 'B2', listening: 'A1', interests: [], step: 4, completed: true }, 'zh-Hans');
  });
  await page.goto('/today');
  await page.locator(`[data-practice-skill=${skill}]`).first().click();
  const dialog = page.locator('.practice-options-dialog'), group = dialog.locator('.offline-source-group-toggle').first();
  await expect(group).toBeVisible();
  if (await group.getAttribute('aria-expanded') === 'false') await group.click();
  await expect(dialog.getByRole('checkbox').first()).toBeVisible();
  await page.evaluate(async () => {
    const path = '/src/data/db.ts', data = await import(path), where = data.communityPacks.where.bind(data.communityPacks);
    Reflect.set(window, 'materialReads', 0);
    data.communityPacks.where = (index: unknown) => { Reflect.set(window, 'materialReads', Reflect.get(window, 'materialReads') + 1); return where(index); };
  });
  await dialog.getByRole('checkbox').first().check();
  await expect(dialog.getByRole('button', { name: '取消', exact: true })).toBeEnabled();
  await dialog.getByRole('searchbox').fill('a');
  await dialog.getByRole('searchbox').fill('');
  await dialog.locator('.practice-material-search>button').click();
  await expect(dialog.getByRole('button', { name: '取消', exact: true })).toBeEnabled();
  // Give the async save/live-query turn time to run; an erroneous resubscription used to start immediately.
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => Reflect.get(window, 'materialReads'))).toBe(0);
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.locator(`[data-practice-skill=${skill}]`).first().click();
  await expect(group).toBeVisible();
  if (await group.getAttribute('aria-expanded') === 'false') await group.click();
  await expect(dialog.getByRole('checkbox').first()).toBeVisible();
  expect(await page.evaluate(() => Reflect.get(window, 'materialReads'))).toBe(0);
  await page.evaluate(() => window.dispatchEvent(new Event('lingfern-resources-installed')));
  await expect.poll(() => page.evaluate(() => Reflect.get(window, 'materialReads'))).toBeGreaterThan(0);
  await expect(dialog.getByRole('checkbox').first()).toBeVisible();
});


test('text edits commit before card feedback resets and outside edits stay isolated', async ({ page }) => {
  await page.goto('/today');
  const order = await page.evaluate(async () => {
    const path = '/src/app/cardInteraction.ts', { cardInteraction } = await import(path);
    const panel = document.createElement('div'), input = document.createElement('input'), outside = document.createElement('input'), events: string[] = [];
    panel.appendChild(input); document.body.appendChild(panel); document.body.appendChild(outside);
    const edit = () => events.push('edit');
    document.body.addEventListener('input', edit);
    const state = cardInteraction(panel, (active: boolean) => { if (!active) events.push('feedback'); });
    try {
      input.dispatchEvent(new InputEvent('input', { bubbles: true }));
      outside.dispatchEvent(new InputEvent('input', { bubbles: true }));
      return events;
    } finally { state.dispose(); document.body.removeEventListener('input', edit); panel.remove(); outside.remove(); }
  });
  expect(order).toEqual(['edit', 'feedback', 'edit']);
});
