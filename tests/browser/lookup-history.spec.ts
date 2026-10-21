import { expect, test } from '@playwright/test';
import { selectPicker } from './picker';

test('reference history persists per profile and reopens dictionary, usage and IPA destinations', async ({ page }) => {
  await page.goto('/library');
  await page.locator('.library-history-entry a').click();
  await expect(page.getByText('暂无查询记录。')).toBeVisible();
  await page.goto('/library/dictionary');
  const query = page.getByRole('combobox');
  await query.fill('apple'); await query.press('Enter');
  await expect(page.locator('.dictionary-results h3')).toHaveText('apple');
  await page.goto('/library/grammar');
  await page.getByRole('searchbox').fill('since / for');
  await page.locator('.grammar-results summary').click();
  await expect(page.getByText('I have lived here since 2020.', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(async () => (await (await import('/src/data/lookupHistory.ts' as string)).readLookupHistory('local-guest')).some((row: {kind: string}) => row.kind === 'grammar'))).toBe(true);
  await page.goto('/library/ipa');
  await expect(page.getByRole('button', { name: '简易版', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.locator('.ipa-entry[data-ipa=i] button').first().click();
  await expect.poll(() => page.evaluate(async () => (await (await import('/src/data/lookupHistory.ts' as string)).readLookupHistory('local-guest')).some((row: {kind: string}) => row.kind === 'ipa'))).toBe(true);
  await page.goto('/library/history'); await page.reload();
  await expect(page.locator('.history')).toHaveCount(3);
  await page.locator('.history a').filter({ hasText: 'apple' }).click();
  await expect(page.getByRole('combobox')).toHaveValue('apple');
  await expect(page.locator('.dictionary-results h3')).toHaveText('apple');
  await page.goBack();
  await page.locator('.history a').filter({ hasText: 'since / for' }).click();
  await expect(page.getByRole('searchbox')).toHaveValue('since / for');
  await expect(page.locator('.grammar-results details')).toHaveAttribute('open', '');
  await page.goBack();
  await page.locator('.history a').filter({ hasText: '/i/' }).click();
  await expect(page.locator('.ipa-entry[tabindex]')).toBeFocused();
  const simple = page.getByRole('button', { name: '简易版', exact: true });
  await simple.focus(); await simple.press('Enter');
  await expect(simple).toBeFocused();
  await expect(page.locator('.ipa-grid .ipa-entry[tabindex]')).toHaveAttribute('data-ipa', 'i');
  await expect(page.locator('.ipa-grid .ipa-entry')).toHaveCount(41);
  expect(await page.locator('audio').evaluate((audio: HTMLAudioElement) => audio.paused)).toBe(true);
  await page.goBack(); await expect(page.locator('.history')).toHaveCount(3);
  await page.evaluate(async () => {
    const { settings } = await import('/src/data/db.ts' as string);
    await settings.put({ key: 'profile:other:lookupHistory', value: JSON.stringify([{ kind: 'dictionary', term: 'pear', lookedUpAt: new Date().toISOString() }]) });
  });
  await page.reload(); await expect(page.locator('.history')).toHaveCount(3);
  await expect(page.locator('.history')).not.toContainText(['pear']);
});

for (const locale of ['zh-Hans', 'zh-Hant', 'en']) test(`history entry matches Today style and aligns with the Library title above references (${locale})`, async ({ page }) => {
    await page.goto('/settings'); await selectPicker(page, (await page.locator('.setting-trigger').first().getAttribute('aria-label'))!, locale);
    for (const theme of ['light', 'dark']) {
      await page.goto('/settings'); await selectPicker(page, (await page.locator('.setting-trigger').nth(1).getAttribute('aria-label'))!, theme);
      for (const width of [1440, 375, 320]) {
        await page.setViewportSize({ width, height: 812 });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.goto('/today'); await page.mouse.move(0, 0);
        const style = await page.locator('.records-link').evaluate(el => { const css = getComputedStyle(el); return [css.color, css.fontSize, css.minHeight, css.borderRadius, css.textDecorationLine]; });
        await page.goto('/library'); await page.mouse.move(0, 0);
        const link = page.locator('.library-history-entry a');
        expect(await link.evaluate(el => { const css = getComputedStyle(el); return [css.color, css.fontSize, css.minHeight, css.borderRadius, css.textDecorationLine]; })).toEqual(style);
        await expect(link).toHaveText(locale === 'zh-Hans' ? '历史记录' : locale === 'zh-Hant' ? '歷史紀錄' : 'History');
        const title = await page.locator('main h1').boundingBox(), button = await link.boundingBox(), references = await page.locator('.library-references').boundingBox();
        expect(Math.abs(button!.y + button!.height / 2 - title!.y - title!.height / 2)).toBeLessThanOrEqual(1);
        expect(button!.x).toBeGreaterThanOrEqual(title!.x + title!.width);
        expect(button!.y + button!.height).toBeLessThanOrEqual(references!.y);
        expect(references!.y - title!.y - title!.height).toBeLessThanOrEqual(56);
        expect(button!.height).toBeGreaterThanOrEqual(44); expect(button!.width).toBeGreaterThanOrEqual(44);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        await link.focus(); await expect(link).toBeFocused(); await link.press('Enter');
        await expect(page.locator('.lookup-history h1')).toBeVisible();
        if (locale === 'zh-Hans' && ((width === 1440 && theme === 'light') || (width === 320 && theme === 'dark'))) await page.screenshot({ path: `output/playwright/lookup-history-${width}-${theme}-zh-Hans-empty.png`, fullPage: true });
      }
    }
});

test('a failed history write preserves lookup results and reports the save failure', async ({ page }) => {
  await page.goto('/library/dictionary');
  await page.evaluate(async () => {
    const { settings } = await import('/src/data/db.ts' as string);
    const put = settings.put.bind(settings);
    settings.put = async (row: { key: string; value: string }) => { if (row.key.endsWith(':lookupHistory')) throw new Error('WRITE_FAILED'); return put(row); };
  });
  await page.getByRole('combobox').fill('apple'); await page.getByRole('combobox').press('Enter');
  await expect(page.locator('.dictionary-results h3')).toHaveText('apple');
  await expect(page.locator('.dictionary [role=alert]')).toContainText('查询记录未保存');
});
