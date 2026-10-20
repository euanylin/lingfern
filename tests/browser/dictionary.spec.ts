import { confirmTask } from './task-start';
import { expect, test, type Page } from '@playwright/test';
import { selectPicker } from './picker';

async function highlightPassageWord(page: Page, word: string) {
  await page.locator('.passage').first().scrollIntoViewIfNeeded();
  return page.locator('.passage').first().evaluate((paragraph, selected) => {
    const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
    let text: Node | null;
    while ((text = walker.nextNode()) && !text.textContent?.includes(selected)) {}
    if (!text) throw new Error('Passage word not found');
    const offset = text.textContent!.indexOf(selected);
    const range = document.createRange();
    range.setStart(text, offset); range.setEnd(text, offset + selected.length);
    getSelection()!.removeAllRanges(); getSelection()!.addRange(range);
    const rect = range.getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  }, word);
}

async function selectPassageWord(page: Page, word: string) {
  await highlightPassageWord(page, word);
}

test('local suggestions rank exact entries first and support keyboard and touch-sized selection', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/library/dictionary');
  const query = page.getByRole('combobox', { name: '查询单词或短语' });
  await expect(page.getByRole('button', { name: '查询', exact: true })).toHaveCount(0);
  await query.fill('a');
  const options = page.getByRole('listbox', { name: '查询建议' }).getByRole('option');
  await expect(options).toHaveCount(64);
  expect(await options.evaluateAll(items => items.every(item => item.getBoundingClientRect().height >= 44))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await query.press('ArrowDown');
  await expect(query).toHaveAttribute('aria-activedescendant', 'dictionary-suggestion-0');
  await query.press('ArrowUp');
  await expect(query).toHaveAttribute('aria-activedescendant', 'dictionary-suggestion-63');
  await expect(options.last()).toBeInViewport();
  await query.press('ArrowDown');
  await query.fill('apple');
  await expect(options.first()).toHaveText('apple');
  await query.press('Enter');
  await expect(page.locator('.dictionary-results h3')).toHaveText('apple');
  await expect(page.locator('footer .footer-wordmark')).toHaveCount(0);
  await expect(query).not.toBeFocused();
  await query.fill('librar');
  await page.getByRole('option', { name: 'library', exact: true }).click();
  await expect(query).toHaveValue('library');
  await expect(page.locator('.dictionary-results h3')).toHaveText('library');
  await expect(page.locator('footer .footer-wordmark')).toHaveCount(0);
});

test('empty dictionary fits without scrolling and keeps the active navigation at the bottom', async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 375, height: 812 }, { width: 320, height: 640 }, { width: 320, height: 568 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/library/dictionary');
    await expect(page.getByRole('heading', { level: 1, name: '英英词典' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '资料库' })).toHaveCount(0);
    const geometry = await page.evaluate(() => ({ content: document.querySelector('.dictionary')!.getBoundingClientRect().bottom, navTop: document.querySelector('.mobile-nav')!.getBoundingClientRect().top, nav: document.querySelector('.mobile-nav')!.getBoundingClientRect().bottom, pageWidth: document.documentElement.scrollWidth, pageHeight: document.documentElement.scrollHeight }));
    if (viewport.width < 768) { expect(geometry.nav).toBeCloseTo(viewport.height, 0); expect(geometry.content).toBeLessThanOrEqual(geometry.navTop - 8); }
    expect(geometry.pageWidth).toBeLessThanOrEqual(viewport.width);
    expect(geometry.pageHeight).toBeLessThanOrEqual(viewport.height);
  }
  await page.getByRole('combobox', { name: '查询单词或短语' }).fill('book');
  await page.getByLabel('查询单词或短语').press('Enter');
  await expect(page.getByText('其他可能的词义')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(568);
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await expect(page.locator('.mobile-nav')).toBeInViewport();
  const bottom = await page.evaluate(() => ({ content: document.querySelector('.dictionary')!.getBoundingClientRect().bottom, nav: document.querySelector('.mobile-nav')!.getBoundingClientRect().top }));
  expect(bottom.content).toBeLessThan(bottom.nav);
  await expect(page.locator('.footer-wordmark')).toHaveCount(0);
});

test('focusing dictionary search keeps the mobile navigation fixed and compact', async ({ page }) => {
  for (const width of [320, 375, 640]) {
    await page.setViewportSize({ width, height: 746 });
    await page.goto('/library/dictionary');
    const nav = page.locator('.mobile-nav');
    const initial = await nav.boundingBox();
    await page.getByRole('combobox', { name: '查询单词或短语' }).focus();
    await expect(nav).toHaveCSS('position', 'fixed');
    await expect(page.locator('footer')).toHaveCount(0);
    const focused = await nav.boundingBox();
    expect(focused!.y + focused!.height).toBeCloseTo(746, 0);
    expect(await nav.evaluate(el => parseFloat(getComputedStyle(el, '::before').height))).toBeLessThanOrEqual(focused!.height + 1);
    expect(focused!.height).toBeLessThanOrEqual(initial!.height + 1);
    expect(focused!.width).toBeLessThanOrEqual(width);
    expect(await nav.locator('a').evaluateAll(links => links.every(link => link.getBoundingClientRect().height >= 44))).toBe(true);
    if (width === 375) {
      await page.setViewportSize({ width, height: 440 });
      await expect(nav).toHaveCSS('position', 'fixed');
      const resized = await nav.boundingBox();
      expect(resized!.y + resized!.height).toBeCloseTo(440, 0);
      await expect(page.locator('footer')).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
    await page.getByRole('combobox', { name: '查询单词或短语' }).evaluate(input => (input as HTMLInputElement).blur());
    await expect(page.locator('footer')).toHaveCount(0);
  }
  await page.goto('/library/grammar');
  await page.getByRole('searchbox', { name: '搜索单词、搭配或用法疑问' }).focus();
  await expect(page.locator('footer')).toHaveCount(0);
  await page.goto('/library');
  await page.locator('.package-row:visible input[type=checkbox]').first().focus();
  await expect(page.locator('footer')).toHaveCount(0);
  await expect.poll(() => page.locator('.mobile-nav').evaluate(el => getComputedStyle(el).position)).toBe('fixed');
});

test('empty progress page does not scroll at a regular mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/progress');
  await expect(page.getByRole('heading', { name: '记录' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(812);
});

test('empty narrow dictionary fits in every interface language', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  for (const locale of ['zh-Hant', 'en']) {
    await page.goto('/settings');
    await selectPicker(page, (await page.locator('.settings-preferences .setting-trigger').first().getAttribute('aria-label'))!, locale);
    await page.goto('/library/dictionary');
    await expect(page.locator('.dictionary-search input')).toBeVisible();
    const geometry = await page.evaluate(() => ({ pageHeight: document.documentElement.scrollHeight, navTops: [...document.querySelectorAll('.mobile-nav a')].map(link => link.getBoundingClientRect().top) }));
    expect(geometry.pageHeight).toBe(568);
    expect(new Set(geometry.navTops).size).toBe(1);
  }
});

test('dictionary finds course, WordNet, inflected, multiword and missing terms', async ({ page }) => {
  await page.goto('/library/dictionary');
  await expect(page.getByRole('heading', { level: 1, name: '英英词典' })).toBeVisible();
  const query = page.getByRole('combobox', { name: '查询单词或短语' });
  await query.focus();
  expect(await query.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('none');
  expect(await query.evaluate(el => getComputedStyle(el).borderTopWidth)).toBe('0px');
  expect(await query.evaluate(el => getComputedStyle(el).boxShadow)).toBe('none');
  async function lookup(term: string) { await query.fill(term); await page.getByLabel('查询单词或短语').press('Enter'); }
  await lookup('book');
  await expect(page.getByText('A set of pages with words or pictures that you can read.')).toBeVisible();
  await expect(page.getByText('其他可能的词义')).toBeVisible();
  await lookup('children');
  await expect(page.getByText('词形对应: child')).toBeVisible();
  await lookup('front desk');
  await expect(page.getByText('The place near an entrance where staff help visitors.')).toBeVisible();
  await lookup('zzzxxyyqq');
  await expect(page.getByText('站内词典未收录这个词条。')).toBeVisible();
  await expect(page.locator('.online-lookup-links').getByRole('link', { name: '在 Cambridge Dictionary 中查询“zzzxxyyqq”（打开外部网站）' })).toHaveAttribute('href', /zzzxxyyqq/);
});

test('learning lookup retains the current task while opening one external dictionary', async ({ page, context }) => {
  await context.route('https://dictionary.cambridge.org/**', route => route.abort());
  await page.goto('/today');
  await page.locator('.primary-task.reading-task').getByRole('button', { name: '开始', exact: true }).click(); await confirmTask(page);
  await expect(page.locator('.dictionary-panel')).toHaveCount(0);
  await selectPassageWord(page, 'library');
  expect(await page.locator('.passage').first().evaluate(el => el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })))).toBe(true);
  await page.getByRole('button', { name: '查词', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '查词: library' })).toBeVisible();
  await expect(page.getByText('A place where you can read or borrow books.')).toBeVisible();
  const position = await page.evaluate(() => scrollY);
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.locator('.selection-dictionary-online').click()]);
  await popup.close();
  await expect(page.getByRole('dialog', { name: '查词: library' })).toBeVisible();
  expect(await page.evaluate(() => scrollY)).toBe(position);
  await expect(page.locator('.question-number bdi')).toHaveText('1 / 4');
  await expect(page.locator('.question-panel h2')).toHaveText('Where do we meet?');
  await page.getByRole('radio', { name: 'At the library.' }).check();
  await page.getByRole('button', { name: '保存答案', exact: true }).click();
  const saved = await page.evaluate(async () => {
    const request = indexedDB.open('lingfern');
    const database = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const tx = database.transaction('attempts');
    const all = tx.objectStore('attempts').getAll();
    return new Promise<unknown[]>((resolve, reject) => { all.onsuccess = () => resolve(all.result); all.onerror = () => reject(all.error); });
  });
  expect(saved).toEqual([expect.objectContaining({ assistance: expect.objectContaining({ dictionaryUsed: true }) })]);
});

test('selected-word popup fits a narrow dark learning view and closes with Escape', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/today');
  await page.locator('.primary-task.reading-task').getByRole('button', { name: '开始', exact: true }).click(); await confirmTask(page);
  await selectPassageWord(page, 'library');
  expect(await page.locator('.passage').first().evaluate(el => el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })))).toBe(true);
  await page.getByRole('button', { name: '查词', exact: true }).click();
  const popup = page.getByRole('dialog', { name: '查词: library' });
  await expect(popup).toBeVisible();
  await expect(popup.getByText('A place where you can read or borrow books.')).toBeVisible();
  const bounds = await popup.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(375);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(812);
  await expect(page.locator('.selection-dictionary')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: 'output/playwright/learning-word-popup-375x812-dark-zh-Hans.png' });
  await page.keyboard.press('Escape');
  await expect(popup).toHaveCount(0);
  await selectPassageWord(page, 'library');
  await expect(page.locator('.selection-dictionary-menu')).toBeVisible();
  await page.evaluate(() => window.visualViewport!.dispatchEvent(new Event('scroll')));
  await expect(page.locator('.selection-dictionary-menu')).toHaveCount(0);
});

test.describe('touch selection', () => {
  test.use({ hasTouch: true });

  test('selecting text reveals an adjacent action and a bounded glass card', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/today');
    await page.locator('.primary-task.reading-task').getByRole('button', { name: '开始', exact: true }).click(); await confirmTask(page);
    await highlightPassageWord(page, 'library');
    const menu = page.locator('.selection-dictionary-menu');
    await expect(menu).toHaveAttribute('data-input', 'touch');
    await expect(menu).toHaveCSS('backdrop-filter', /blur/);
    const selectionBottom = await page.evaluate(() => getSelection()!.getRangeAt(0).getBoundingClientRect().bottom);
    expect((await menu.boundingBox())!.y).toBeCloseTo(selectionBottom + 10, 0);
    await page.screenshot({ path: 'output/playwright/learning-word-menu-touch-375x812-dark-zh-Hans.png' });
    await page.getByRole('button', { name: '查词', exact: true }).click();
    const card = page.locator('.selection-dictionary');
    await expect(card).toHaveCSS('backdrop-filter', /blur/);
    await expect(page.getByRole('dialog', { name: '查词: library' }).getByText('A place where you can read or borrow books.')).toBeVisible();
    const bounds = await card.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(375);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(812);
    await page.screenshot({ path: 'output/playwright/learning-word-popup-touch-375x812-dark-zh-Hans.png' });
    const outside = { x: bounds!.x + bounds!.width / 2, y: bounds!.y >= 48 ? bounds!.y - 48 : bounds!.y + bounds!.height + 48 };
    expect(await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('.selection-dictionary'), outside)).toBe(false);
    // Leave enough space to avoid Chromium's touch-target adjustment into the card.
    await page.touchscreen.tap(outside.x, outside.y);
    await expect(card).toHaveCount(0);
    await page.setViewportSize({ width: 820, height: 900 });
    await highlightPassageWord(page, 'library');
    await page.getByRole('button', { name: '查词', exact: true }).click();
    const tablet = await card.boundingBox();
    expect(tablet!.width).toBeLessThanOrEqual(560);
    expect(tablet!.x).toBeGreaterThanOrEqual(0);
    expect(tablet!.x + tablet!.width).toBeLessThanOrEqual(820);
  });
});

test('dictionary keeps bundled course definitions but reports unavailable non-course entries at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.route('**/dictionary/oewn-2025/b.json', route => route.abort());
  await page.goto('/library/dictionary');
  const query = page.getByRole('combobox', { name: '查询单词或短语' });
  await query.fill('book');
  await query.press('Enter');
  await expect(page.getByText('A set of pages with words or pictures that you can read.')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await query.fill('badger');
  await query.press('Enter');
  await expect(page.getByRole('alert')).toContainText('词典文件无法读取');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('four external lookups follow the current phrase without prefetching or leaving Lingfern', async ({ page, context }) => {
  const external: string[] = [];
  await context.route(/https:\/\/(dictionary\.cambridge\.org|www\.oxfordlearnersdictionaries\.com|en\.wiktionary\.org|www\.merriam-webster\.com)\//, route => {
    external.push(route.request().url());
    return route.abort();
  });
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/library/dictionary');
  const query = page.getByRole('combobox', { name: '查询单词或短语' });
  const links = page.locator('.online-lookup-links a');
  await expect(links).toHaveCount(0);
  await expect(page.locator('.online-lookup-disabled')).toHaveCount(4);
  await query.fill('take off');
  await expect(links).toHaveCount(4);
  expect(await links.allTextContents()).toEqual(['Cambridge ↗', 'Oxford ↗', 'Wiktionary ↗', 'Merriam-Webster ↗']);
  await links.first().focus();
  await expect(links.first()).toBeFocused();
  expect(await links.first().evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
  expect(await links.evaluateAll(els => els.every(el => el.getBoundingClientRect().height >= 44))).toBe(true);
  expect(external).toEqual([]);
  for (const index of [0, 1]) {
    const link = links.nth(index);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(link).toHaveAttribute('referrerpolicy', 'no-referrer');
    const [popup] = await Promise.all([page.waitForEvent('popup'), link.click()]);
    await popup.close();
    await expect(query).toHaveValue('take off');
    expect(page.url()).toContain('/library/dictionary');
  }
  expect(external).toHaveLength(2);
  await query.fill('US');
  for (const link of await links.all()) await expect(link).toHaveAttribute('href', /US/);
  expect(external).toHaveLength(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await context.setOffline(true);
  await page.evaluate(() => dispatchEvent(new Event('offline')));
  await expect(page.getByText('在线查询需要联网。')).toBeVisible();
  await expect(links).toHaveCount(0);
  await expect(page.locator('.online-lookup-disabled')).toHaveCount(4);
});

test('online dictionary preference persists and invalid saved values fall back', async ({ page, context }) => {
  await context.route('https://dictionary.cambridge.org/**', route => route.abort());
  await page.goto('/settings');
  const picker = page.getByRole('button', { name: '默认在线词典' });
  await expect(picker).toHaveAttribute('data-value', 'cambridge');
  await selectPicker(page, '默认在线词典', 'oxford');
  await expect(picker).toHaveAttribute('data-value', 'oxford');
  await page.reload();
  await expect(picker).toHaveAttribute('data-value', 'oxford');
  await page.goto('/library/dictionary');
  await page.getByRole('combobox', { name: '查询单词或短语' }).fill('apple');
  await expect(page.locator('.online-lookup h3')).toHaveCount(0);
  await expect(page.locator('.online-lookup-links a').first()).toHaveAttribute('href', /dictionary\.cambridge\.org/);
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.locator('.online-lookup-links a').first().click()]);
  await popup.close();
  await page.goto('/settings');
  await expect(picker).toHaveAttribute('data-value', 'oxford');
  await page.evaluate(async () => {
    const request = indexedDB.open('lingfern');
    const database = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const tx = database.transaction('settings', 'readwrite');
    tx.objectStore('settings').put({ key: 'onlineDictionary', value: 'invalid' });
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
    database.close();
  });
  await page.reload();
  // Legacy corruption cannot override a valid profile-scoped saved event.
  await expect(picker).toHaveAttribute('data-value', 'oxford');
  // A fresh profile with no valid dictionary event must reject a corrupt scoped value.
  const fresh = await context.browser()!.newContext({ locale: 'zh-CN' });
  try {
    const freshPage = await fresh.newPage();
    await freshPage.goto('http://127.0.0.1:5173/settings');
    await expect(freshPage.getByRole('button', { name: '默认在线词典' })).toHaveAttribute('data-value', 'cambridge');
    await freshPage.evaluate(async () => {
      const request = indexedDB.open('lingfern');
      const database = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      const tx = database.transaction('settings', 'readwrite');
      tx.objectStore('settings').put({ key: 'profile:local-guest:onlineDictionary', value: 'invalid' });
      await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
      database.close();
    });
    await freshPage.reload();
    await expect(freshPage.getByRole('button', { name: '默认在线词典' })).toHaveAttribute('data-value', 'cambridge');
  } finally { await fresh.close(); }
});

test('online lookup labels follow all three interface languages without contacting providers', async ({ page, context }) => {
  const requests: string[] = [];
  await context.route(/https:\/\/(dictionary\.cambridge\.org|www\.oxfordlearnersdictionaries\.com|en\.wiktionary\.org|www\.merriam-webster\.com)\//, route => {
    requests.push(route.request().url());
    return route.abort();
  });
  await page.goto('/settings');
  for (const [locale, entry, heading, label, suggestions] of [
    ['zh-Hans', '英英词典', '在线查询', '在 Cambridge Dictionary 中查询“apple”（打开外部网站）', '查询建议'],
    ['zh-Hant', '英英詞典', '線上查詢', '在 Cambridge Dictionary 中查詢「apple」（開啟外部網站）', '查詢建議'],
    ['en', 'Dictionary', 'Online lookup', 'Look up “apple” in Cambridge Dictionary (opens an external website)', 'Suggestions'],
  ]) {
    await selectPicker(page, (await page.locator('.settings-preferences .setting-trigger').first().getAttribute('aria-label'))!, locale);
    await page.goto('/library');
    await expect(page.locator('.library-references').getByRole('link', { name: entry, exact: true })).toBeVisible();
    await page.goto('/library/dictionary');
    await page.locator('#dictionary-query').fill('apple');
    await expect(page.getByRole('listbox', { name: suggestions }).getByRole('option').first()).toHaveText('apple');
    await expect(page.getByRole('region', { name: heading, exact: true })).toBeVisible();
    await expect(page.locator('.online-lookup h3')).toHaveCount(0);
    await expect(page.locator('.online-lookup a')).toHaveCount(4);
    await expect(page.locator('.online-lookup-links a').first()).toHaveAttribute('aria-label', label);
    await page.goto('/settings');
  }
  expect(requests).toEqual([]);
});


test('reviewed course meanings rank the matching sense ahead of unrelated uses', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/library/dictionary');
  const query = page.getByRole('combobox', { name: '查询单词或短语' });
  for (const [word, definition] of [['record', 'register electronically'], ['work out', 'do physical exercise'], ['book', 'physical objects consisting of a number of pages bound together']]) {
    await query.fill(word); await query.press('Enter');
    await expect(page.locator('.sense-definition p').first()).toHaveText(definition);
    expect(await page.locator('.sense-definition').count()).toBeGreaterThan(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.screenshot({ path: 'output/playwright/dictionary-reviewed-sense-320-light-zh-Hans.png' });
});

