import { expect, test, type Locator } from '@playwright/test';
import { selectPicker } from './picker';

const starAppearance = (button: Locator) => button.evaluate(element => {
  const style = getComputedStyle(element);
  return { width: style.width, height: style.height, padding: style.padding, border: style.borderStyle, fontSize: style.fontSize, color: style.color };
});

test('bookmarks one dictionary meaning and restores it from ZIP', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/library/dictionary');
  await page.getByLabel('查询单词或短语').fill('apple');
  await page.getByLabel('查询单词或短语').press('Enter');
  await expect(page.locator('.dictionary-results h3')).toHaveText('apple');
  await page.getByRole('button', { name: /加入书签：/ }).first().click();
  await expect(page.locator('.dictionary-results .sense-star').first()).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/library/saved');
  await expect(page.getByRole('heading', { name: '书签' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'apple' })).toBeVisible();
  await expect(page.locator('.saved-word .sense-definition p')).toBeVisible();
  await expect(page.locator('.saved-word button')).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'apple' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/settings');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载备份' }).click(); await page.getByRole('dialog').getByRole('button', { name: '保存', exact: true }).click();
  const saved = await download;
  const bytes = await (await import('node:fs/promises')).readFile((await saved.path())!);
  await page.getByLabel('从备份恢复').setInputFiles({ name: 'memory.zip', mimeType: 'application/zip', buffer: bytes });
  await expect(page.locator('.backup-preview')).toContainText('书签 1 · 反馈笔记 0');
  await page.getByRole('button', { name: '导入为新档案' }).click();
  await page.goto('/library/saved');
  await expect(page.getByRole('heading', { name: 'apple' })).toBeVisible();
  await expect(page.locator('.saved-word .sense-definition p')).toBeVisible();
});

test('stars toggle a single sense and bookmarks open the chosen default online dictionary', async ({ page, context }) => {
  const external: string[] = [];
  await context.route(/https:\/\/(dictionary\.cambridge\.org|www\.oxfordlearnersdictionaries\.com)\//, route => {
    external.push(route.request().url());
    return route.abort();
  });
  await page.goto('/settings');
  await selectPicker(page, '默认在线词典', 'oxford');
  await page.goto('/library');
  await expect(page.getByRole('link', { name: '书签' })).toHaveCount(0);
  await page.getByRole('link', { name: '英英词典' }).click();
  await expect(page.getByRole('link', { name: '书签' })).toBeVisible();
  await page.getByLabel('查询单词或短语').fill('apple');
  await page.getByLabel('查询单词或短语').press('Enter');
  const star = page.locator('.dictionary-results .sense-star').first();
  await expect(star).toHaveAttribute('aria-pressed', 'false');
  await expect(star).toContainText('☆');
  expect(await star.evaluate(element => element.nextElementSibling?.tagName)).toBe('P');
  await star.click();
  await expect(star).toHaveAttribute('aria-pressed', 'true');
  await expect(star).toContainText('★');
  await star.click();
  await expect(star).toHaveAttribute('aria-pressed', 'false');
  await star.click();
  await page.getByRole('link', { name: '书签' }).click();
  await expect(page).toHaveURL(/\/library\/saved$/);
  await expect(page.getByRole('heading', { name: 'apple', exact: true })).toBeVisible();
  const link = page.locator('.saved-word-lookup');
  await expect(link).toHaveAttribute('aria-label', /在 Oxford Learner’s Dictionaries 中查询“apple”/);
  await expect(link).toHaveAttribute('href', /www\.oxfordlearnersdictionaries\.com\/search\/english\/\?q=apple/);
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  expect(external).toHaveLength(0);
  const [popup] = await Promise.all([page.waitForEvent('popup'), link.click()]);
  await popup.close();
  expect(external).toHaveLength(1);
  const savedStar = page.locator('.saved-word .sense-star');
  await expect(savedStar).toHaveAttribute('aria-pressed', 'true');
  await expect(savedStar).toContainText('★');
  await savedStar.click();
  await expect(savedStar).toHaveAttribute('aria-pressed', 'false');
  await expect(savedStar).toContainText('☆');
  await expect(page.getByRole('heading', { name: 'apple', exact: true })).toBeVisible();
  await expect(page.locator('.saved-word button')).toHaveCount(1);
  await savedStar.click();
  await expect(savedStar).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(savedStar).toHaveAttribute('aria-pressed', 'true');
  await savedStar.click();
  await expect(savedStar).toHaveAttribute('aria-pressed', 'false');
  await page.reload();
  await expect(page.getByText('还没有书签。')).toBeVisible();
  await page.goto('/settings');
  await expect(page.getByRole('button', { name: '默认在线词典' })).toHaveAttribute('data-value', 'oxford');
});


for (const [locale, width, theme, input] of [['zh-Hans', 1440, 'light', 'mouse'], ['zh-Hant', 375, 'dark', 'touch'], ['en', 320, 'light', 'keyboard']] as const) {
  test(`saved-word stars match dictionary controls and persist until refresh at ${width} ${locale}`, async ({ browser }) => {
    const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5173', viewport: { width, height: 812 }, locale: 'zh-CN', colorScheme: theme, hasTouch: input === 'touch', isMobile: input === 'touch', reducedMotion: input === 'keyboard' ? 'reduce' : 'no-preference' });
    try {
      const page = await context.newPage();
      await page.goto('/today');
      await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
      await page.evaluate(async value => { const path = '/src/data/db.ts'; await (await import(path)).settings.put({ key: 'profile:local-guest:locale', value }); }, locale);
      await page.goto('/library/dictionary');
      await page.locator('#dictionary-query').fill('apple'); await page.locator('#dictionary-query').press('Enter');
      const dictionaryStar = page.locator('.dictionary-results .sense-star').first();
      await expect(dictionaryStar).toHaveAttribute('aria-pressed', 'false');
      const emptyAppearance = await starAppearance(dictionaryStar);
      const toggle = async (button: Locator) => {
        if (input === 'touch') await button.tap();
        else if (input === 'keyboard') { await page.keyboard.press('Tab'); await button.focus(); await expect(button).toBeFocused(); await button.press('Space'); }
        else await button.click();
      };
      await toggle(dictionaryStar); await expect(dictionaryStar).toHaveAttribute('aria-pressed', 'true');
      await expect(dictionaryStar).toBeEnabled();
      const filledAppearance = await starAppearance(dictionaryStar), removeLabel = await dictionaryStar.getAttribute('aria-label');
      await page.goto('/library/saved');
      const savedStar = page.locator('.saved-word .sense-star');
      await expect(savedStar).toHaveAttribute('aria-pressed', 'true');
      await expect(savedStar).toHaveAttribute('aria-label', removeLabel!);
      expect(await starAppearance(savedStar)).toEqual(filledAppearance);
      const box = (await savedStar.boundingBox())!; expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
      await expect(page.locator('.saved-word-heading .sense-star')).toHaveCount(1);
      const definition = page.locator('.saved-word .sense-definition p');
      await expect(definition).toBeVisible();
      const definitionBox = (await definition.boundingBox())!;
      const headingBox = (await page.locator('.saved-word h2').boundingBox())!;
      expect(definitionBox.x).toBe(headingBox.x);
      expect(box.x).toBeGreaterThan(headingBox.x + headingBox.width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const disclosure = page.locator('.saved-word > details'), summary = disclosure.locator('summary');
      await expect(disclosure).toHaveAttribute('open', '');
      const toggleDefinition = async () => {
        if (input === 'keyboard') { await summary.focus(); await expect(summary).toBeFocused(); await expect(summary).toHaveCSS('outline-style', 'solid'); await summary.press('Space'); }
        else if (input === 'touch') await summary.locator('h2').tap();
        else await summary.locator('h2').click();
      };
      await toggleDefinition();
      await expect(disclosure).not.toHaveAttribute('open');
      await expect(definition).toBeHidden();
      await expect(page.locator('.saved-word h2')).toBeVisible();
      await expect(page.locator('.saved-word-lookup')).toBeVisible();
      await expect(savedStar).toBeVisible();
      await expect.poll(async () => (await summary.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await page.screenshot({ path: `output/playwright/saved-word-collapse-${width}-${theme}-${locale}.png`, fullPage: true });
      await toggleDefinition();
      await expect(definition).toBeVisible();
      await expect(savedStar).toHaveAttribute('aria-pressed', 'true');
      await context.setOffline(true);
      await toggle(savedStar); await expect(savedStar).toHaveAttribute('aria-pressed', 'false');
      await expect(savedStar).toBeEnabled(); await expect(savedStar).toContainText('☆');
      expect(await starAppearance(savedStar)).toEqual(emptyAppearance);
      await expect(page.locator('.saved-word h2')).toHaveText('apple');
      await expect(page.locator('.saved-word button')).toHaveCount(1);
      await page.screenshot({ path: `output/playwright/saved-word-star-${width}-${theme}-${locale}-unchecked.png`, fullPage: true });
      await toggle(savedStar); await expect(savedStar).toHaveAttribute('aria-pressed', 'true');
      await context.setOffline(false); await page.reload();
      await expect(savedStar).toHaveAttribute('aria-pressed', 'true');
      await page.screenshot({ path: `output/playwright/saved-word-star-${width}-${theme}-${locale}-checked.png`, fullPage: true });
      await toggle(savedStar); await expect(savedStar).toHaveAttribute('aria-pressed', 'false');
      await page.reload(); await expect(page.locator('.saved-word')).toHaveCount(0);
      await expect(page.getByRole('alert')).toHaveCount(0);
    } finally { await context.close(); }
  });
}

test('received public bookmarks resolve without transferring private definitions', async ({ page }) => {
  await page.goto('/today');
  await page.evaluate(async () => {
    const syncPath = '/src/data/sync.ts', sharedPath = '/src/shared/sync.ts';
    const sync = await import(syncPath), shared = await import(sharedPath);
    const events = [{ id: 'remote-save', deviceId: 'remote', counter: 1, occurredAt: '2026-09-01T00:00:00.000Z', type: 'saved_item', payload: { memoryId: 'apple%1:13:00::', saved: true } }];
    const valid = await shared.validateSyncBatch({ product: 'Lingfern', formatVersion: 1, profileId: 'local-guest', deviceId: 'remote', batchId: 'public-meaning', events });
    await sync.receiveSyncBatch('local-guest', valid.batch, valid.hash);
  });
  await page.goto('/library/saved');
  await expect(page.getByRole('heading', { name: 'apple', exact: true })).toBeVisible();
  await expect(page.locator('.saved-word .sense-definition p')).toBeVisible();
  await expect(page.locator('.saved-word button')).toHaveCount(1);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.evaluate(async () => {
    const path = '/src/data/memory.ts';
    await (await import(path)).saveSense('local-guest', 'collapse-example', 'example', 'A separate meaning.');
  });
  await page.reload();
  const apple = page.locator('.saved-word').filter({ has: page.getByRole('heading', { name: 'apple', exact: true }) });
  const other = page.locator('.saved-word').filter({ has: page.getByRole('heading', { name: 'example', exact: true }) });
  await apple.locator('summary').click();
  await expect(apple.locator('details')).not.toHaveAttribute('open');
  await expect(other.locator('.sense-definition p')).toBeVisible();
  await other.locator('.sense-star').click();
  await expect(other.locator('.sense-star')).toHaveAttribute('aria-pressed', 'false');
  await expect(apple.locator('details')).not.toHaveAttribute('open');
  await page.reload();
  await expect(apple.locator('.sense-definition p')).toBeVisible();
  await expect(other).toHaveCount(0);
});

for (const width of [1440, 375]) for (const theme of ['light', 'dark'] as const) {
  test(`bookmark list matches the reference at ${width} ${theme}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: 812 }, colorScheme: theme });
    try {
      const page = await context.newPage();
      await page.goto('http://127.0.0.1:5173/today');
      await expect(page.getByRole('heading', { name: '今日', exact: true })).toBeVisible();
      await page.evaluate(async () => {
        const path = '/src/data/memory.ts', { saveSense } = await import(path);
        for (const [term, definition] of [
          ['affect', 'to have an influence on someone or something'],
          ['ephemeral', 'lasting for a very short time'],
          ['dad', 'an informal term for a father; probably derived from baby talk'],
        ]) await saveSense('local-guest', `reference-${term}`, term, definition);
      });
      await page.goto('http://127.0.0.1:5173/library/saved');
      await expect(page.locator('.saved-words-list')).toHaveCount(1);
      const rows = page.locator('.saved-word');
      await expect(rows).toHaveCount(3);
      for (let index = 1; index < 3; index++) await rows.nth(index).locator('h2').click();
      for (let index = 0; index < 3; index++) {
        const row = rows.nth(index), star = row.locator('.sense-star'), link = row.locator('.saved-word-lookup');
        await expect(star).toBeVisible(); await expect(link).toBeVisible();
        await expect(link).toHaveCSS('text-decoration-line', 'none');
        expect((await star.boundingBox())!.width).toBeGreaterThanOrEqual(44);
        expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        if (index) await expect(row).toHaveCSS('border-top-width', '1px');
      }
      const first = rows.first(), heading = (await first.locator('h2').boundingBox())!;
      await expect(first.locator('h2')).toHaveText('dad');
      expect((await first.locator('.sense-definition p').boundingBox())!.x).toBe(heading.x);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.mouse.move(0, 0);
      await expect(rows.last().locator('summary')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      await page.screenshot({ path: `output/playwright/bookmarks-${width}-${theme}.png`, fullPage: true });
      await page.locator('.saved-words-list').screenshot({ path: `output/playwright/bookmarks-card-${width}-${theme}.png` });
      const order = await rows.locator('h2').allTextContents();
      const positions = await rows.evaluateAll(elements => elements.map(row => row.getBoundingClientRect().y));
      const closedRow = rows.filter({ has: page.getByRole('heading', { name: 'ephemeral', exact: true }) });
      const closedStar = closedRow.locator('.sense-star');
      await closedStar.click(); await expect(closedStar).toHaveAttribute('aria-pressed', 'false');
      await expect(closedRow.locator('details')).not.toHaveAttribute('open');
      await closedStar.click(); await expect(closedStar).toHaveAttribute('aria-pressed', 'true');
      await expect(closedRow.locator('details')).not.toHaveAttribute('open');
      expect(await rows.locator('h2').allTextContents()).toEqual(order);
      expect(await rows.evaluateAll(elements => elements.map(row => row.getBoundingClientRect().y))).toEqual(positions);
      const starBox = (await closedStar.boundingBox())!;
      await page.mouse.move(starBox.x + starBox.width / 2, starBox.y + starBox.height / 2);
      await page.mouse.down();
      await expect(closedRow.locator('summary')).toHaveCSS('transform', 'none');
      await page.mouse.up();
    } finally { await context.close(); }
  });
}
