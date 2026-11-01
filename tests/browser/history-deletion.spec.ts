import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

for (const width of [1440, 320]) test(`history rows expose confirmed deletion with stable layout at ${width}px`, async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: width === 320, locale: 'zh-CN', colorScheme: width === 320 ? 'dark' : 'light' });
  const page = await context.newPage();
  const destructiveColor = width === 320 ? 'rgb(229, 154, 136)' : 'rgb(158, 63, 46)';
  try {
    await page.goto('http://127.0.0.1:5173/today');
    await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
    const id = await page.evaluate(async () => {
      const data = await import('/src/data/db.ts' as string), raw = (await import('/tests/fixtures/content/a1-reading.json' as string)).default;
      const session = await data.createSession(raw); await data.claimSession(session.id, 'synthetic');
      await data.markExposure(session); await data.submit(session.id, 'synthetic', 1); await data.releaseSession(session.id, 'synthetic');
      const { recordLookup } = await import('/src/data/lookupHistory.ts' as string);
      await recordLookup('local-guest', 'dictionary', 'apple'); await recordLookup('local-guest', 'grammar', 'since / for'); await recordLookup('local-guest', 'ipa', 'ɪ');
      return session.id;
    });
    await page.locator('.records-link').click();
    await expect(page.locator('.history-overview,.progress-records,.progress-skill-summary,.progress-source-list,.totals')).toHaveCount(0);
    await expect(page.locator('.totals')).not.toBeVisible();
    await expect(page.locator('.progress-skill-summary')).not.toBeVisible();
    const back = page.locator('.records-back');
    await expect(back).toHaveText('←'); await expect(back).toHaveAccessibleName('今日');
    await expect(back).toHaveCSS('text-decoration-line', 'none');
    expect((await back.boundingBox())!.width).toBeGreaterThanOrEqual(44);
    await back.focus(); await back.press('Enter'); await expect(page).toHaveURL(/\/today$/);
    await page.locator('.records-link').click();
    await expect(page.getByRole('heading', { name: '已保存任务', exact: true })).toHaveCount(0);
    const title = page.locator('.history-entry-heading>a');
    await expect(title).not.toContainText('继续任务'); await expect(title).toHaveCSS('text-decoration-line', 'none');
    await title.hover(); await expect(title).toHaveCSS('text-decoration-line', 'none');
    const disclosure = page.locator('.history-records-toggle');
    await expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.history-entry-records section')).toHaveCount(0);
    if (width === 320) await disclosure.tap(); else { await disclosure.focus(); await disclosure.press('Enter'); }
    await expect(disclosure).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.history-entry-records section')).toHaveCount(1);
    await disclosure.click(); await expect(page.locator('.history-entry-records section')).toHaveCount(0);
    await page.screenshot({ path: `output/playwright/history-polish-today-${width}.png`, fullPage: true });
    const remove = page.locator('.history-entry-heading .history-delete');
    await expect(remove).toBeVisible();
    const toggleRect = await disclosure.boundingBox(), deleteRect = await remove.boundingBox();
    expect(toggleRect!.x + toggleRect!.width).toBeLessThanOrEqual(deleteRect!.x);
    await disclosure.focus(); await disclosure.press('Tab'); await expect(remove).toBeFocused();
    await expect(remove).toHaveCSS('color', destructiveColor);
    if (width === 320) await remove.tap(); else { await remove.focus(); await remove.press('Enter'); }
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('button', { name: '确认删除', exact: true })).toHaveCSS('color', width === 320 ? 'rgb(227, 148, 132)' : 'rgb(156, 69, 55)');
    await expect(dialog.locator('p')).toHaveCount(1);
    await expect(dialog.getByRole('button', { name: '取消', exact: true })).toBeFocused();
    await page.keyboard.press('Escape'); await expect(remove).toBeFocused();
    await remove.click(); await dialog.getByRole('button', { name: '取消', exact: true }).click();
    await expect(page.locator('.history-grid .history')).toHaveCount(1);
    await remove.click();
    await page.screenshot({ path: `output/playwright/history-delete-confirm-${width}.png`, fullPage: true });
    await dialog.getByRole('button', { name: '确认删除', exact: true }).click();
    await expect(page.locator('.history-grid .history')).toHaveCount(0);
    expect(await page.evaluate(async id => (await import('/src/data/db.ts' as string)).sessions.get(id), id)).toBeUndefined();
    await page.reload(); await expect(page.locator('.history-grid .history')).toHaveCount(0);
    await page.goto('http://127.0.0.1:5173/library'); await page.locator('.library-history-entry a').click();
    await expect(page.locator('.lookup-history-list .history')).toHaveCount(3);
    await expect(back).toHaveText('←'); await expect(back).toHaveAccessibleName('资料库'); await expect(back).toHaveCSS('text-decoration-line', 'none');
    await back.focus(); await back.press('Enter'); await expect(page).toHaveURL(/\/library$/);
    await page.locator('.library-history-entry a').click();
    const first = page.locator('.lookup-history-list .history').first(), lookupRemove = first.locator('.history-delete');
    await expect(lookupRemove).toHaveCSS('color', destructiveColor); await expect(first.locator('a')).toHaveCSS('text-decoration-line', 'none');
    const rect = await lookupRemove.boundingBox(); expect(rect!.width).toBeGreaterThanOrEqual(44); expect(rect!.height).toBeGreaterThanOrEqual(44);
    const kindRect = await first.locator('.lookup-history-kind').boundingBox();
    expect(rect!.x + rect!.width).toBeLessThanOrEqual(kindRect!.x);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `output/playwright/history-delete-library-${width}.png`, fullPage: true });
    await lookupRemove.click(); await page.keyboard.press('Escape'); await expect(lookupRemove).toBeFocused();
    for (let count = 3; count > 0; count--) {
      await page.locator('.lookup-history-list .history-delete').first().click();
      await dialog.getByRole('button', { name: '确认删除', exact: true }).click();
      await expect(page.locator('.lookup-history-list .history')).toHaveCount(count - 1);
    }
    await expect(page.getByText('暂无查询记录。')).toBeVisible();
    await page.reload(); await expect(page.getByText('暂无查询记录。')).toBeVisible();
  } finally { await context.close(); }
});

test('a failed linked-session deletion keeps both rows and permits retry', async ({ page }) => {
  await page.goto('/today'); await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const data = await import('/src/data/db.ts' as string), raw = (await import('/tests/fixtures/content/a1-reading.json' as string)).default;
    const listening = (await import('/tests/fixtures/content/a1-listening.json' as string)).default;
    await data.createCombinedPractice(raw, listening, 'local-guest');
  });
  await page.goto('/progress');
  const rows = page.locator('.history-grid>.history');
  const firstRow = await rows.first().boundingBox(), secondRow = await rows.nth(1).boundingBox();
  expect(secondRow!.y).toBeGreaterThanOrEqual(firstRow!.y + firstRow!.height);
  expect(secondRow!.width).toBe(firstRow!.width);
  await page.evaluate(async () => {
    const { sessions } = await import('/src/data/db.ts' as string);
    const fail = () => { sessions.hook('deleting').unsubscribe(fail); throw new Error('SYNTHETIC_STORAGE_FAILURE'); };
    sessions.hook('deleting', fail);
  });
  await page.locator('.history-entry-heading .history-delete').first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('关联的两部分将一并删除。', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: '确认删除', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible(); await expect(page.locator('.history-grid .history')).toHaveCount(2);
  await dialog.getByRole('button', { name: '确认删除', exact: true }).click();
  await expect(page.locator('.history-grid .history')).toHaveCount(0);
});

test('built offline pages delete both history kinds in narrow dark RTL layout', async ({ browser }) => {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:8787', viewport: { width: 320, height: 700 }, locale: 'zh-CN', colorScheme: 'dark', reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto('/today'); await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
    await page.evaluate(() => navigator.serviceWorker.ready);
    const lesson = JSON.parse(readFileSync(new URL('../fixtures/content/a1-reading.json', import.meta.url), 'utf8'));
    await page.evaluate(async lesson => {
      const id = crypto.randomUUID(), contentHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(lesson)))), byte => byte.toString(16).padStart(2, '0')).join('');
      await new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('lingfern'); open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result, tx = db.transaction(['sessions', 'settings'], 'readwrite');
          tx.objectStore('sessions').add({ id, profileId: 'local-guest', lesson, contentHash, position: 0, status: 'active', draft: 1, startedAt: new Date().toISOString(), assistance: { hintLevel: 0 }, leaseUntil: 0 });
          tx.objectStore('settings').put({ key: 'profile:local-guest:locale', value: 'ar' });
          tx.objectStore('settings').put({ key: 'profile:local-guest:lookupHistory', value: JSON.stringify([{ kind: 'dictionary', term: 'synthetic history', lookedUpAt: new Date().toISOString() }]) });
          tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => { db.close(); reject(tx.error); };
        };
      });
    }, lesson);
    await page.reload(); await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await context.setOffline(true);
    for (const [path, row] of [['/progress', '.history-grid .history'], ['/library/history', '.lookup-history-list .history']]) {
      await page.goto(path); await expect(page.locator(row)).toHaveCount(1);
      await page.locator(`${row} .history-delete`).click();
      const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `output/playwright/history-delete-offline-ar-${path === '/progress' ? 'session' : 'lookup'}.png` });
      await dialog.locator('.practice-restart-actions button').last().click();
      await expect(page.locator(row)).toHaveCount(0);
      await page.reload(); await expect(page.locator(row)).toHaveCount(0);
    }
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});
